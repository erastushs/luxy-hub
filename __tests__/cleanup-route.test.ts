import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@/app/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

vi.mock('@/app/lib/repositories/event-repository', () => ({
  deleteDeadLetterEventsBefore: vi.fn(),
  deleteDeliveredEventsBefore: vi.fn(),
  deletePendingEventsBefore: vi.fn(),
}))

vi.mock('@/app/lib/repositories/delivery-session-repository', () => ({
  deleteExpiredSessionsWithoutExecutions: vi.fn(),
}))

import { supabaseAdmin } from '@/app/lib/supabase'
import {
  deleteDeadLetterEventsBefore,
  deleteDeliveredEventsBefore,
  deletePendingEventsBefore,
} from '@/app/lib/repositories/event-repository'
import { deleteExpiredSessionsWithoutExecutions } from '@/app/lib/repositories/delivery-session-repository'

type QueryChain = {
  update: Mock
  select: Mock
  delete: Mock
  lt: Mock
  eq: Mock
  order: Mock
  limit: Mock
  in: Mock
}

function request(secret = 'cron-secret'): NextRequest {
  return new Request('https://luxy.example/api/cleanup', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
  }) as NextRequest
}

function createUpdateChain(count = 0, error: unknown = null): QueryChain {
  const chain = {} as QueryChain
  chain.update = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.delete = vi.fn(() => chain)
  chain.lt = vi.fn(() => chain)
  chain.eq = vi.fn(async () => ({ count, error }))
  chain.order = vi.fn(() => chain)
  chain.limit = vi.fn(() => chain)
  chain.in = vi.fn(() => chain)
  return chain
}

function createSelectIdsChain(
  ids: string[],
  error: unknown = null,
  idColumn = 'id'
): QueryChain {
  const chain = {} as QueryChain
  chain.update = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.delete = vi.fn(() => chain)
  chain.lt = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.limit = vi.fn(async () => ({ data: ids.map((id) => ({ [idColumn]: id })), error }))
  chain.in = vi.fn(() => chain)
  return chain
}

function createDeleteIdsChain(count: number, error: unknown = null): QueryChain {
  const chain = {} as QueryChain
  chain.update = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.delete = vi.fn(() => chain)
  chain.lt = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.limit = vi.fn(() => chain)
  chain.in = vi.fn(async () => ({ count, error }))
  return chain
}

function createEmptyCleanupMocks() {
  const chainsByTable = new Map<string, QueryChain[]>()

  const push = (table: string, chain: QueryChain) => {
    chainsByTable.set(table, [...(chainsByTable.get(table) ?? []), chain])
  }

  ;(supabaseAdmin.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
    if (table === 'keys') {
      const chain = createUpdateChain(0)
      push(table, chain)
      return chain
    }

    const chain = createSelectIdsChain([])
    push(table, chain)
    return chain
  })

  return chainsByTable
}

describe('cleanup route retention cleanup', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    vi.mocked(deleteDeliveredEventsBefore).mockResolvedValue(3)
    vi.mocked(deleteDeadLetterEventsBefore).mockResolvedValue(2)
    vi.mocked(deletePendingEventsBefore).mockResolvedValue(1)
    vi.mocked(deleteExpiredSessionsWithoutExecutions).mockResolvedValue(4)
    createEmptyCleanupMocks()
  })

  it('returns cleanup counts and execution time', async () => {
    const { POST } = await import('@/app/api/cleanup/route')

    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.status).toBe('success')
    expect(body.execution_time_ms).toEqual(expect.any(Number))
    expect(body.keys_disabled).toMatchObject({ deleted: 0, status: 'success' })
    expect(body.used_workink_tokens_deleted).toMatchObject({ deleted: 0, status: 'success' })
    expect(body.rate_limits_deleted).toMatchObject({ deleted: 0, status: 'success' })
    expect(body.verification_logs_deleted).toMatchObject({ deleted: 0, status: 'success' })
    expect(body.script_downloads_deleted).toMatchObject({ deleted: 0, status: 'success' })
    expect(body.delivery_sessions_deleted).toMatchObject({ deleted: 4, status: 'success' })
    expect(body.event_logs).toEqual({
      delivered: 3,
      deadLetter: 2,
      pending: 1,
    })
  })

  it('deletes rate limits by selecting ids then deleting by id batches', async () => {
    const chainsByTable = new Map<string, QueryChain[]>()
    const rateLimitSelectOne = createSelectIdsChain(['rl-1', 'rl-2'])
    const rateLimitDeleteOne = createDeleteIdsChain(2)
    const rateLimitSelectTwo = createSelectIdsChain([])

    ;(supabaseAdmin.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      const chains = chainsByTable.get(table) ?? []
      let chain: QueryChain

      if (table === 'keys') {
        chain = createUpdateChain(0)
      } else if (table === 'rate_limits') {
        chain = [rateLimitSelectOne, rateLimitDeleteOne, rateLimitSelectTwo][chains.length]
      } else {
        chain = createSelectIdsChain([])
      }

      chainsByTable.set(table, [...chains, chain])
      return chain
    })

    const { POST } = await import('@/app/api/cleanup/route')
    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.rate_limits_deleted).toMatchObject({ deleted: 2, status: 'success' })
    expect(rateLimitSelectOne.select).toHaveBeenCalledWith('id')
    expect(rateLimitSelectOne.lt).toHaveBeenCalledWith('created_at', expect.any(String))
    expect(rateLimitSelectOne.order).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(rateLimitSelectOne.order).toHaveBeenCalledWith('id', { ascending: true })
    expect(rateLimitSelectOne.limit).toHaveBeenCalledWith(10000)
    expect(rateLimitDeleteOne.delete).toHaveBeenCalledWith({ count: 'exact' })
    expect(rateLimitDeleteOne.in).toHaveBeenCalledWith('id', ['rl-1', 'rl-2'])
    expect(rateLimitDeleteOne.limit).not.toHaveBeenCalled()
  })

  it('uses id batches for token, verification, and download cleanup', async () => {
    const chainsByTable = new Map<string, QueryChain[]>()
    const tableChains = {
      used_workink_tokens: [createSelectIdsChain(['token-1'], null, 'token'), createDeleteIdsChain(1)],
      verification_logs: [createSelectIdsChain(['log-1']), createDeleteIdsChain(1)],
      script_downloads: [createSelectIdsChain(['download-1']), createDeleteIdsChain(1)],
    }

    ;(supabaseAdmin.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      const chains = chainsByTable.get(table) ?? []
      let chain: QueryChain

      if (table === 'keys') {
        chain = createUpdateChain(0)
      } else if (table in tableChains) {
        chain = tableChains[table as keyof typeof tableChains][chains.length]
      } else {
        chain = createSelectIdsChain([])
      }

      chainsByTable.set(table, [...chains, chain])
      return chain
    })

    const { POST } = await import('@/app/api/cleanup/route')
    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.used_workink_tokens_deleted).toMatchObject({ deleted: 1, status: 'success' })
    expect(body.verification_logs_deleted).toMatchObject({ deleted: 1, status: 'success' })
    expect(body.script_downloads_deleted).toMatchObject({ deleted: 1, status: 'success' })
    expect(tableChains.used_workink_tokens[0].select).toHaveBeenCalledWith('token')
    expect(tableChains.used_workink_tokens[1].in).toHaveBeenCalledWith('token', ['token-1'])
    expect(tableChains.verification_logs[1].in).toHaveBeenCalledWith('id', ['log-1'])
    expect(tableChains.script_downloads[1].in).toHaveBeenCalledWith('id', ['download-1'])
    expect(tableChains.used_workink_tokens[1].limit).not.toHaveBeenCalled()
    expect(tableChains.verification_logs[1].limit).not.toHaveBeenCalled()
    expect(tableChains.script_downloads[1].limit).not.toHaveBeenCalled()
  })

  it('splits large rate limit deletes into safe in-filter batches', async () => {
    const ids = Array.from({ length: 501 }, (_, index) => `rl-${index}`)
    const chainsByTable = new Map<string, QueryChain[]>()
    const rateLimitSelect = createSelectIdsChain(ids)
    const rateLimitDeleteOne = createDeleteIdsChain(500)
    const rateLimitDeleteTwo = createDeleteIdsChain(1)

    ;(supabaseAdmin.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      const chains = chainsByTable.get(table) ?? []
      let chain: QueryChain

      if (table === 'keys') {
        chain = createUpdateChain(0)
      } else if (table === 'rate_limits') {
        chain = [rateLimitSelect, rateLimitDeleteOne, rateLimitDeleteTwo][chains.length]
      } else {
        chain = createSelectIdsChain([])
      }

      chainsByTable.set(table, [...chains, chain])
      return chain
    })

    const { POST } = await import('@/app/api/cleanup/route')
    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.rate_limits_deleted).toMatchObject({ deleted: 501, status: 'success' })
    expect(rateLimitDeleteOne.in).toHaveBeenCalledWith('id', ids.slice(0, 500))
    expect(rateLimitDeleteTwo.in).toHaveBeenCalledWith('id', ids.slice(500))
  })

  it('returns partial status without exposing database error details', async () => {
    const failingRateLimitSelect = createSelectIdsChain([], new Error('database detail'))

    ;(supabaseAdmin.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'keys') return createUpdateChain(1)
      if (table === 'rate_limits') return failingRateLimitSelect
      return createSelectIdsChain([])
    })

    const { POST } = await import('@/app/api/cleanup/route')
    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.status).toBe('partial')
    expect(body.rate_limits_deleted).toEqual({
      deleted: 0,
      status: 'failed',
      error: 'cleanup_failed',
    })
    expect(JSON.stringify(body)).not.toContain('database detail')
  })
})
