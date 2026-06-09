import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/app/lib/services/event-queue-service', () => ({
  processEventQueue: vi.fn(),
}))

vi.mock('@/app/lib/providers/mock-provider', () => ({
  mockProvider: { deliver: vi.fn() },
}))

import { processEventQueue } from '@/app/lib/services/event-queue-service'

const mockedProcessEventQueue = vi.mocked(processEventQueue)

async function callWorker(authHeader?: string) {
  const { POST } = await import('@/app/api/internal/event-worker/route')

  const headers = new Headers()
  if (authHeader) {
    headers.set('authorization', authHeader)
  }

  const req = new NextRequest('http://localhost/api/internal/event-worker', {
    method: 'POST',
    headers,
  })

  return POST(req)
}

describe('POST /api/internal/event-worker', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.CRON_SECRET = 'test-secret'
    mockedProcessEventQueue.mockResolvedValue({
      processed: 5,
      delivered: 4,
      failed: 1,
      deadLettered: 0,
      skipped: 0,
    })
  })

  it('returns 500 if CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET
    const res = await callWorker('Bearer test-secret')
    expect(res.status).toBe(500)
  })

  it('returns 401 if authorization header is missing', async () => {
    const res = await callWorker()
    expect(res.status).toBe(401)
  })

  it('returns 401 if bearer token is wrong', async () => {
    const res = await callWorker('Bearer wrong-token')
    expect(res.status).toBe(401)
  })

  it('returns 200 with stats on successful batch', async () => {
    const res = await callWorker('Bearer test-secret')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.delivered).toBe(4)
    expect(body.failed).toBe(1)
  })

  it('returns 500 when processEventQueue throws', async () => {
    mockedProcessEventQueue.mockRejectedValue(new Error('DB down'))
    const res = await callWorker('Bearer test-secret')
    expect(res.status).toBe(500)
  })
})
