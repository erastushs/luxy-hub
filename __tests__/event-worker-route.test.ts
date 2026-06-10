import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/lib/supabase', () => ({
  supabaseAdmin: {},
}))

vi.mock('@/app/lib/services/event-queue-service', () => ({
  processEventQueue: vi.fn(),
}))

vi.mock('@/app/lib/providers/discord-provider', () => ({
  discordProvider: { deliver: vi.fn() },
}))

import { NextRequest } from 'next/server'
import { processEventQueue } from '@/app/lib/services/event-queue-service'

let POST: (req: NextRequest) => Promise<Response>

describe('POST /api/internal/event-worker', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    const mod = await import('@/app/api/internal/event-worker/route')
    POST = mod.POST
  })

  it('returns 500 when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET

    const res = await POST(new NextRequest('https://luxy.example/api/internal/event-worker', { method: 'POST' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.message).toBe('CRON_SECRET not configured')
  })

  it('returns 401 when auth header is missing', async () => {
    process.env.CRON_SECRET = 'super-secret'

    const res = await POST(new NextRequest('https://luxy.example/api/internal/event-worker', { method: 'POST' }))
    expect(res.status).toBe(401)

    delete process.env.CRON_SECRET
  })

  it('returns 401 when auth header has wrong bearer', async () => {
    process.env.CRON_SECRET = 'super-secret'

    const req = new NextRequest('https://luxy.example/api/internal/event-worker', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong-secret' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)

    delete process.env.CRON_SECRET
  })

  it('returns 200 with stats on successful batch', async () => {
    process.env.CRON_SECRET = 'super-secret'
    const mockedProcess = vi.mocked(processEventQueue)
    mockedProcess.mockResolvedValue({
      processed: 10,
      delivered: 8,
      failed: 1,
      deadLettered: 1,
      skipped: 0,
    })

    const req = new NextRequest('https://luxy.example/api/internal/event-worker', {
      method: 'POST',
      headers: { authorization: 'Bearer super-secret' },
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.processed).toBe(10)
    expect(body.delivered).toBe(8)
    expect(body.failed).toBe(1)
    expect(body.deadLettered).toBe(1)

    delete process.env.CRON_SECRET
  })

  it('returns 500 when processEventQueue throws', async () => {
    process.env.CRON_SECRET = 'super-secret'
    const mockedProcess = vi.mocked(processEventQueue)
    mockedProcess.mockRejectedValue(new Error('db-down'))

    const req = new NextRequest('https://luxy.example/api/internal/event-worker', {
      method: 'POST',
      headers: { authorization: 'Bearer super-secret' },
    })
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.success).toBe(false)

    delete process.env.CRON_SECRET
  })
})
