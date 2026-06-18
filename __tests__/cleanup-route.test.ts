import { beforeEach, describe, expect, it, vi } from 'vitest'
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

function request(secret = 'cron-secret'): NextRequest {
  return new Request('https://luxy.example/api/cleanup', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
  }) as NextRequest
}

function cleanupChain() {
  const chain = {
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    lt: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve({ error: null })),
  }
  return chain
}

function rateLimitCleanupChain(deletedCount: number) {
  const chain = {
    delete: vi.fn(() => chain),
    lt: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve({ count: deletedCount, error: null })),
  }
  return chain
}

describe('cleanup route event retention', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    ;(supabaseAdmin.from as ReturnType<typeof vi.fn>).mockImplementation(() => cleanupChain())
    vi.mocked(deleteDeliveredEventsBefore).mockResolvedValue(3)
    vi.mocked(deleteDeadLetterEventsBefore).mockResolvedValue(2)
    vi.mocked(deletePendingEventsBefore).mockResolvedValue(1)
    vi.mocked(deleteExpiredSessionsWithoutExecutions).mockResolvedValue(4)
  })

  it('returns event log retention deletion counts', async () => {
    const { POST } = await import('@/app/api/cleanup/route')

    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.event_logs).toEqual({
      delivered: 3,
      deadLetter: 2,
      pending: 1,
    })
    expect(body).not.toHaveProperty('delivery_sessions')
    expect(body).not.toHaveProperty('rate_limits')
    expect(deleteDeliveredEventsBefore).toHaveBeenCalledWith(expect.any(Date))
    expect(deleteDeadLetterEventsBefore).toHaveBeenCalledWith(expect.any(Date))
    expect(deletePendingEventsBefore).toHaveBeenCalledWith(expect.any(Date))
    expect(deleteExpiredSessionsWithoutExecutions).toHaveBeenCalledWith(expect.any(Date))
  })

  it('deletes rate limits in bounded batches until the backlog is drained', async () => {
    const chains: ReturnType<typeof rateLimitCleanupChain>[] = []
    ;(supabaseAdmin.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'rate_limits') {
        const chain = rateLimitCleanupChain(chains.length === 0 ? 10000 : 2000)
        chains.push(chain)
        return chain
      }
      return cleanupChain()
    })
    const { POST } = await import('@/app/api/cleanup/route')

    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).not.toHaveProperty('rate_limits')
    expect(chains).toHaveLength(2)
    expect(chains[0].delete).toHaveBeenCalledWith({ count: 'exact' })
    expect(chains[0].limit).toHaveBeenCalledWith(10000)
    expect(chains[1].limit).toHaveBeenCalledWith(10000)
  })
})
