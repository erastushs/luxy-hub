import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@/app/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
  getClientIP: vi.fn(() => '127.0.0.1'),
}))

import { checkRateLimit } from '@/app/lib/rate-limiter'
import { GET as loaderRoute } from '@/app/api/loader/[slug]/route'

const mockedCheckRateLimit = vi.mocked(checkRateLimit)

function getRequest(url: string): NextRequest {
  return new Request(url, { method: 'GET' }) as NextRequest
}

describe('Phase 6D loader API route', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedCheckRateLimit.mockResolvedValue({ allowed: true })
  })

  it('GET /api/loader/[slug] returns bootstrap Lua code', async () => {
    const response = await loaderRoute(
      getRequest('https://luxy.example/api/loader/my-script') as NextRequest,
      { params: Promise.resolve({ slug: 'my-script' }) }
    )
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/plain')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(mockedCheckRateLimit).toHaveBeenCalledWith('127.0.0.1', 'LOADER_BOOTSTRAP')
    expect(body).toContain('loader-runtime-v1')
    expect(body).toContain('local LUXY_SLUG = "my-script"')
    expect(body).toContain('https://luxy.example')
    expect(body).toContain('/api/delivery/session')
    expect(body).toContain('/api/delivery/fetch')
    expect(body).toContain('payload_format_version .. ":" .. context.version_id .. ":" .. context.source_sha256')
    expect(body).not.toContain('encrypted-payload')
  })

  it('rejects invalid loader slugs without exposing internals', async () => {
    const response = await loaderRoute(
      getRequest('https://luxy.example/api/loader/BAD') as NextRequest,
      { params: Promise.resolve({ slug: 'BAD' }) }
    )
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({ success: false, message: 'Loader unavailable' })
  })

  it('returns rate limit responses for bootstrap requests', async () => {
    mockedCheckRateLimit.mockResolvedValue({ allowed: false, retryAfter: 60 })

    const response = await loaderRoute(
      getRequest('https://luxy.example/api/loader/my-script') as NextRequest,
      { params: Promise.resolve({ slug: 'my-script' }) }
    )
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('60')
    expect(body).toEqual({ success: false, message: 'Too many requests. Please try again later.' })
  })
})
