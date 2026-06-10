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

import { supabaseAdmin } from '@/app/lib/supabase'
import {
  deleteDeadLetterEventsBefore,
  deleteDeliveredEventsBefore,
  deletePendingEventsBefore,
} from '@/app/lib/repositories/event-repository'

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

describe('cleanup route event retention', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    ;(supabaseAdmin.from as ReturnType<typeof vi.fn>).mockImplementation(() => cleanupChain())
    vi.mocked(deleteDeliveredEventsBefore).mockResolvedValue(3)
    vi.mocked(deleteDeadLetterEventsBefore).mockResolvedValue(2)
    vi.mocked(deletePendingEventsBefore).mockResolvedValue(1)
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
    expect(deleteDeliveredEventsBefore).toHaveBeenCalledWith(expect.any(Date))
    expect(deleteDeadLetterEventsBefore).toHaveBeenCalledWith(expect.any(Date))
    expect(deletePendingEventsBefore).toHaveBeenCalledWith(expect.any(Date))
  })
})
