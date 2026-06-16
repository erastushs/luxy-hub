import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@/app/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
  getClientIP: vi.fn(),
}))

vi.mock('@/app/lib/logger', () => ({
  logEvent: vi.fn(),
}))

vi.mock('@/app/lib/services/provider-key-issuance-service', () => ({
  issueProviderKey: vi.fn(),
}))

import { checkRateLimit, getClientIP } from '@/app/lib/rate-limiter'
import { logEvent } from '@/app/lib/logger'
import { issueProviderKey } from '@/app/lib/services/provider-key-issuance-service'
import { POST as generateKeyRoute } from '@/app/api/generate-key/route'
import { POST as verifyWorkinkRoute } from '@/app/api/verify-workink/route'

const mockedCheckRateLimit = vi.mocked(checkRateLimit)
const mockedGetClientIP = vi.mocked(getClientIP)
const mockedLogEvent = vi.mocked(logEvent)
const mockedIssueProviderKey = vi.mocked(issueProviderKey)

function jsonRequest(url: string, body?: Record<string, unknown>): NextRequest {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }) as NextRequest
}

describe('provider route compatibility', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedGetClientIP.mockReturnValue('203.0.113.10')
    mockedCheckRateLimit.mockResolvedValue({ allowed: true })
  })

  it('preserves /api/generate-key success shape and status', async () => {
    mockedIssueProviderKey.mockResolvedValue({
      success: true,
      key: 'LUXY-AAAA-BBBB-CCCC',
      expires_at: '2026-06-17T00:00:00.000Z',
      verification: { success: true, message: 'Token verified', validToken: true, tokenInfo: { offer: 'ok' } },
    })

    const response = await generateKeyRoute(jsonRequest('https://example.test/api/generate-key', { token: 'token-1' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      success: true,
      key: 'LUXY-AAAA-BBBB-CCCC',
      expires_at: '2026-06-17T00:00:00.000Z',
    })
    expect(mockedIssueProviderKey).toHaveBeenCalledWith({ providerKey: 'workink', token: 'token-1', clientIP: '203.0.113.10' })
    expect(mockedLogEvent).toHaveBeenCalledWith({
      event: 'KEY_GENERATED',
      ip: '203.0.113.10',
      key: 'LUXY-AAAA-BBBB-CCCC',
      message: 'Key generated via generate-key API',
    })
  })

  it('preserves /api/generate-key validation, rate limit, and verification failure responses', async () => {
    let response = await generateKeyRoute(jsonRequest('https://example.test/api/generate-key', { token: '' }))
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ success: false, message: 'Work.ink verification token required' })

    mockedIssueProviderKey.mockResolvedValue({
      success: false,
      message: 'Invalid token',
      verification: { success: false, message: 'Invalid token', validToken: false },
    })
    response = await generateKeyRoute(jsonRequest('https://example.test/api/generate-key', { token: 'bad' }))
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ success: false, message: 'Invalid token' })

    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 60 })
    response = await generateKeyRoute(jsonRequest('https://example.test/api/generate-key', { token: 'token-1' }))
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('60')
    await expect(response.json()).resolves.toEqual({ success: false, message: 'Too many keys generated. Try again tomorrow.' })
  })

  it('preserves /api/verify-workink success shape and status', async () => {
    mockedIssueProviderKey.mockResolvedValue({
      success: true,
      key: 'LUXY-AAAA-BBBB-CCCC',
      expires_at: '2026-06-17T00:00:00.000Z',
      verification: { success: true, message: 'Token verified', validToken: true, tokenInfo: { offer: 'ok' } },
    })

    const response = await verifyWorkinkRoute(jsonRequest('https://example.test/api/verify-workink', { token: 'token-1' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      success: true,
      key: 'LUXY-AAAA-BBBB-CCCC',
      expires_at: '2026-06-17T00:00:00.000Z',
      tokenInfo: { offer: 'ok' },
    })
    expect(mockedIssueProviderKey).toHaveBeenCalledWith({ providerKey: 'workink', token: 'token-1', clientIP: '203.0.113.10' })
    expect(mockedLogEvent).toHaveBeenCalledWith({
      event: 'KEY_GENERATED',
      ip: '203.0.113.10',
      key: 'LUXY-AAAA-BBBB-CCCC',
      message: 'Key generated via Work.ink verification',
    })
  })

  it('preserves /api/verify-workink status mapping', async () => {
    mockedIssueProviderKey.mockResolvedValueOnce({
      success: false,
      message: 'Token already used',
      verification: { success: false, message: 'Token already used', validToken: false },
    })

    let response = await verifyWorkinkRoute(jsonRequest('https://example.test/api/verify-workink', { token: 'used' }))
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ success: false, message: 'Token already used' })

    mockedIssueProviderKey.mockResolvedValueOnce({
      success: false,
      message: 'Internal server error',
      verification: { success: false, message: 'Internal server error', validToken: false },
    })

    response = await verifyWorkinkRoute(jsonRequest('https://example.test/api/verify-workink', { token: 'token-1' }))
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ success: false, message: 'Internal server error' })
  })
})
