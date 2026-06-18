import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

vi.mock('@/app/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

import { supabaseAdmin } from '@/app/lib/supabase'
import { deleteExpiredSessionsWithoutExecutions } from '@/app/lib/repositories/delivery-session-repository'

type QueryChain = {
  select: Mock
  delete: Mock
  lt: Mock
  order: Mock
  range: Mock
  in: Mock
}

function selectChain(data: unknown[], error: unknown = null): QueryChain {
  const chain = {} as QueryChain
  chain.select = vi.fn(() => chain)
  chain.delete = vi.fn(() => chain)
  chain.lt = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.range = vi.fn(async () => ({ data, error }))
  chain.in = vi.fn(async () => ({ data, error }))
  return chain
}

function deleteChain(count: number, error: unknown = null): QueryChain {
  const chain = {} as QueryChain
  chain.select = vi.fn(() => chain)
  chain.delete = vi.fn(() => chain)
  chain.lt = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.range = vi.fn(() => chain)
  chain.in = vi.fn(async () => ({ count, error }))
  return chain
}

describe('delivery session repository cleanup', () => {
  const mockedFrom = supabaseAdmin.from as unknown as Mock

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('deletes only expired sessions that are not referenced by script executions', async () => {
    const expiredSessions = selectChain([{ id: 'session-1' }, { id: 'session-2' }])
    const executions = selectChain([{ session_id: 'session-2' }])
    const deleted = deleteChain(1)
    mockedFrom
      .mockReturnValueOnce(expiredSessions)
      .mockReturnValueOnce(executions)
      .mockReturnValueOnce(deleted)

    const count = await deleteExpiredSessionsWithoutExecutions(new Date('2026-01-01T00:00:00.000Z'), 100)

    expect(count).toBe(1)
    expect(mockedFrom).toHaveBeenNthCalledWith(1, 'delivery_sessions')
    expect(expiredSessions.select).toHaveBeenCalledWith('id')
    expect(expiredSessions.lt).toHaveBeenCalledWith('expires_at', '2026-01-01T00:00:00.000Z')
    expect(expiredSessions.order).toHaveBeenCalledWith('expires_at', { ascending: true })
    expect(expiredSessions.order).toHaveBeenCalledWith('id', { ascending: true })
    expect(expiredSessions.range).toHaveBeenCalledWith(0, 99)
    expect(mockedFrom).toHaveBeenNthCalledWith(2, 'script_executions')
    expect(executions.in).toHaveBeenCalledWith('session_id', ['session-1', 'session-2'])
    expect(mockedFrom).toHaveBeenNthCalledWith(3, 'delivery_sessions')
    expect(deleted.delete).toHaveBeenCalledWith({ count: 'exact' })
    expect(deleted.in).toHaveBeenCalledWith('id', ['session-1'])
  })

  it('does not delete when all expired sessions have execution rows', async () => {
    const expiredSessions = selectChain([{ id: 'session-1' }])
    const executions = selectChain([{ session_id: 'session-1' }])
    mockedFrom
      .mockReturnValueOnce(expiredSessions)
      .mockReturnValueOnce(executions)

    const count = await deleteExpiredSessionsWithoutExecutions(new Date('2026-01-01T00:00:00.000Z'))

    expect(count).toBe(0)
    expect(mockedFrom).toHaveBeenCalledTimes(2)
  })

  it('continues scanning when the first expired batch only has execution rows', async () => {
    const firstExpiredBatch = selectChain([{ id: 'session-1' }])
    const firstExecutions = selectChain([{ session_id: 'session-1' }])
    const secondExpiredBatch = selectChain([{ id: 'session-2' }])
    const secondExecutions = selectChain([])
    const deleted = deleteChain(1)
    mockedFrom
      .mockReturnValueOnce(firstExpiredBatch)
      .mockReturnValueOnce(firstExecutions)
      .mockReturnValueOnce(secondExpiredBatch)
      .mockReturnValueOnce(secondExecutions)
      .mockReturnValueOnce(deleted)

    const count = await deleteExpiredSessionsWithoutExecutions(
      new Date('2026-01-01T00:00:00.000Z'),
      1,
      2
    )

    expect(count).toBe(1)
    expect(firstExpiredBatch.range).toHaveBeenCalledWith(0, 0)
    expect(secondExpiredBatch.range).toHaveBeenCalledWith(1, 1)
    expect(deleted.in).toHaveBeenCalledWith('id', ['session-2'])
  })

  it('splits large script execution lookups and delivery session deletes into safe in-filter batches', async () => {
    const expiredIds = Array.from({ length: 501 }, (_, index) => `session-${index}`)
    const expiredSessions = selectChain(expiredIds.map((id) => ({ id })))
    const firstExecutions = selectChain([])
    const secondExecutions = selectChain([])
    const firstDelete = deleteChain(500)
    const secondDelete = deleteChain(1)

    mockedFrom
      .mockReturnValueOnce(expiredSessions)
      .mockReturnValueOnce(firstExecutions)
      .mockReturnValueOnce(secondExecutions)
      .mockReturnValueOnce(firstDelete)
      .mockReturnValueOnce(secondDelete)

    const count = await deleteExpiredSessionsWithoutExecutions(
      new Date('2026-01-01T00:00:00.000Z'),
      1000
    )

    expect(count).toBe(501)
    expect(firstExecutions.in).toHaveBeenCalledWith('session_id', expiredIds.slice(0, 500))
    expect(secondExecutions.in).toHaveBeenCalledWith('session_id', expiredIds.slice(500))
    expect(firstDelete.in).toHaveBeenCalledWith('id', expiredIds.slice(0, 500))
    expect(secondDelete.in).toHaveBeenCalledWith('id', expiredIds.slice(500))
  })
})
