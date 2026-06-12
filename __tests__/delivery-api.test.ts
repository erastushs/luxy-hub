import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@/app/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
  getClientIP: vi.fn(() => '127.0.0.1'),
}))

vi.mock('@/app/lib/services/delivery-session-service', () => ({
  createDeliverySession: vi.fn(),
  consumeDeliverySession: vi.fn(),
}))

import { checkRateLimit } from '@/app/lib/rate-limiter'
import {
  consumeDeliverySession,
  createDeliverySession,
} from '@/app/lib/services/delivery-session-service'
import { POST as createSessionRoute } from '@/app/api/delivery/session/route'
import { POST as fetchDeliveryRoute } from '@/app/api/delivery/fetch/route'

const mockedCheckRateLimit = vi.mocked(checkRateLimit)
const mockedCreateDeliverySession = vi.mocked(createDeliverySession)
const mockedConsumeDeliverySession = vi.mocked(consumeDeliverySession)

function successfulSessionResult() {
  return {
    success: true as const,
    session_token: 'raw-session-token',
    event_secret: 'event-secret',
    expires_in: 60,
    session: {
      id: 'session-uuid-1',
      script_id: 'script-uuid-1',
      build_id: 'build-uuid-1',
      session_token_hash: '0'.repeat(64),
      expires_at: '2026-01-01T00:01:00.000Z',
      consumed_at: null,
      event_secret: 'event-secret',
      created_at: '2026-01-01T00:00:00.000Z',
    },
  }
}

function jsonRequest(url: string, body: Record<string, unknown>): NextRequest {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as NextRequest
}

describe('Phase 5C delivery API routes', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedCheckRateLimit.mockResolvedValue({ allowed: true })
  })

  it('POST /api/delivery/session returns a session token', async () => {
    mockedCreateDeliverySession.mockResolvedValue(successfulSessionResult())

    const response = await createSessionRoute(jsonRequest('https://example.test/api/delivery/session', { slug: 'my-script' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ session_token: 'raw-session-token', event_secret: 'event-secret', expires_in: 60 })
    expect(body).not.toHaveProperty('session')
    expect(body).not.toHaveProperty('session_token_hash')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(mockedCreateDeliverySession).toHaveBeenCalledWith('my-script', undefined, undefined, undefined)
  })

  it('POST /api/delivery/session forwards key to service layer', async () => {
    mockedCreateDeliverySession.mockResolvedValue(successfulSessionResult())

    const response = await createSessionRoute(jsonRequest('https://example.test/api/delivery/session', {
      slug: 'my-script',
      key: 'LUXY-ABCD-1234-EFGH',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ session_token: 'raw-session-token', event_secret: 'event-secret', expires_in: 60 })
    expect(mockedCreateDeliverySession).toHaveBeenCalledWith('my-script', 'LUXY-ABCD-1234-EFGH', undefined, undefined)
  })

  it('POST /api/delivery/session forwards license to service layer', async () => {
    mockedCreateDeliverySession.mockResolvedValue(successfulSessionResult())

    const response = await createSessionRoute(jsonRequest('https://example.test/api/delivery/session', {
      slug: 'premium-script',
      license: 'LUXY-PREM-XXXX-XXXX-XXXX',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ session_token: 'raw-session-token', event_secret: 'event-secret', expires_in: 60 })
    expect(mockedCreateDeliverySession).toHaveBeenCalledWith(
      'premium-script',
      undefined,
      'LUXY-PREM-XXXX-XXXX-XXXX',
      undefined
    )
  })

  it('POST /api/delivery/session supports license_key alias and customer_identifier forwarding', async () => {
    mockedCreateDeliverySession.mockResolvedValue(successfulSessionResult())

    const response = await createSessionRoute(jsonRequest('https://example.test/api/delivery/session', {
      slug: 'premium-script',
      license_key: 'LUXY-PREM-XXXX-XXXX-XXXX',
      customer_identifier: ' Customer@Example.COM ',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ session_token: 'raw-session-token', event_secret: 'event-secret', expires_in: 60 })
    expect(mockedCreateDeliverySession).toHaveBeenCalledWith(
      'premium-script',
      undefined,
      'LUXY-PREM-XXXX-XXXX-XXXX',
      ' Customer@Example.COM '
    )
  })

  it('POST /api/delivery/session rate limits before creating sessions', async () => {
    mockedCheckRateLimit.mockResolvedValue({ allowed: false, retryAfter: 30 })

    const response = await createSessionRoute(jsonRequest('https://example.test/api/delivery/session', { slug: 'my-script' }))
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('30')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(body).toEqual({ success: false, message: 'Too many requests. Please try again later.' })
    expect(mockedCreateDeliverySession).not.toHaveBeenCalled()
  })

  it('POST /api/delivery/session treats invalid JSON as unavailable without leaking internals', async () => {
    mockedCreateDeliverySession.mockResolvedValue({ success: false, status: 404, message: 'Delivery unavailable' })

    const response = await createSessionRoute(new Request('https://example.test/api/delivery/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad-json',
    }) as NextRequest)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({ success: false, message: 'Delivery unavailable' })
    expect(mockedCreateDeliverySession).toHaveBeenCalledWith(undefined, undefined, undefined, undefined)
  })

  it('POST /api/delivery/fetch returns runtime payload and consumes token', async () => {
    mockedConsumeDeliverySession.mockResolvedValue({
      success: true,
      runtime_payload: 'print("LUXY TEST")',
      build_version: 'delivery-build-v1',
      version_id: 'version-uuid-1',
      runtime_format_version: 'runtime-v1',
      event_secret: 'event-secret',
      session: {
        id: 'session-uuid-1',
        script_id: 'script-uuid-1',
        build_id: 'build-uuid-1',
        session_token_hash: '0'.repeat(64),
        expires_at: '2026-01-01T00:01:00.000Z',
        consumed_at: '2026-01-01T00:00:10.000Z',
        event_secret: 'event-secret',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      build: {
        id: 'build-uuid-1',
        script_id: 'script-uuid-1',
        version_id: 'version-uuid-1',
        build_status: 'ready',
        payload_storage_kind: 'inline_encrypted',
        payload_ciphertext: 'encrypted-payload',
        payload_content_type: 'application/vnd.luxyhub.delivery-payload.v1+json',
        payload_byte_size: 128,
        source_sha256: '0'.repeat(64),
        payload_sha256: '1'.repeat(64),
        build_version: 'delivery-build-v1',
        payload_format_version: 'inline-json-v1',
        encryption_scheme: 'aes-256-gcm:v1',
        encryption_key_id: 'test-key',
        invalidated_reason: null,
        build_error_code: null,
        build_error_message: null,
        metadata: {},
        built_at: '2026-01-01T00:00:00.000Z',
        invalidated_at: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    })

    const response = await fetchDeliveryRoute(jsonRequest('https://example.test/api/delivery/fetch', { session_token: 'raw-session-token' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      runtime_payload: 'print("LUXY TEST")',
      build_version: 'delivery-build-v1',
      version_id: 'version-uuid-1',
      runtime_format_version: 'runtime-v1',
      event_secret: 'event-secret',
    })
    expect(body).not.toHaveProperty('payload')
    expect(body).not.toHaveProperty('context')
    expect(body).not.toHaveProperty('source_sha256')
    expect(body).not.toHaveProperty('payload_sha256')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(mockedConsumeDeliverySession).toHaveBeenCalledWith('raw-session-token')
  })

  it('delivery fetch failures use a uniform session error response', async () => {
    mockedConsumeDeliverySession.mockResolvedValue({
      success: false,
      message: 'Invalid delivery session',
      status: 403,
    })

    const response = await fetchDeliveryRoute(jsonRequest('https://example.test/api/delivery/fetch', { session_token: 'bad-token' }))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ success: false, message: 'Invalid delivery session' })
  })

  it('POST /api/delivery/fetch rate limits before consuming sessions', async () => {
    mockedCheckRateLimit.mockResolvedValue({ allowed: false, retryAfter: 45 })

    const response = await fetchDeliveryRoute(jsonRequest('https://example.test/api/delivery/fetch', { session_token: 'raw-session-token' }))
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('45')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(body).toEqual({ success: false, message: 'Too many requests. Please try again later.' })
    expect(mockedConsumeDeliverySession).not.toHaveBeenCalled()
  })
})
