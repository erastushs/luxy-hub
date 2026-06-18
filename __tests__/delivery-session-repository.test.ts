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
  limit: Mock
  in: Mock
}

function selectChain(data: unknown[], error: unknown = null): QueryChain {
  const chain = {} as QueryChain
  chain.select = vi.fn(() => chain)
  chain.delete = vi.fn(() => chain)
  chain.lt = vi.fn(() => chain)
  chain.limit = vi.fn(async () => ({ data, error }))
  chain.in = vi.fn(async () => ({ data, error }))
  return chain
}

function deleteChain(count: number, error: unknown = null): QueryChain {
  const chain = {} as QueryChain
  chain.select = vi.fn(() => chain)
  chain.delete = vi.fn(() => chain)
  chain.lt = vi.fn(() => chain)
  chain.limit = vi.fn(() => chain)
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
    expect(expiredSessions.limit).toHaveBeenCalledWith(100)
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
})
