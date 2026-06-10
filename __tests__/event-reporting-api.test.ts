import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { createHmac } from 'node:crypto'

const TEST_EVENT_SECRET = 'test-event-secret-key-for-hmac'
const TEST_SESSION_ID = 'test-session-token-that-is-long-enough-for-validation'

function futureIso(seconds: number = 60): string {
  return new Date(Date.now() + seconds * 1000).toISOString()
}

function pastIso(seconds: number = 60): string {
  return new Date(Date.now() - seconds * 1000).toISOString()
}

function hmacJSON(event: string, timestamp: number, nonce: string, data: unknown): string {
  const serialized = JSON.stringify(data)
  const input = `${event}:${timestamp}:${nonce}:${serialized}`
  return createHmac('sha256', TEST_EVENT_SECRET).update(input).digest('hex')
}

vi.mock('@/app/lib/repositories/delivery-session-repository', () => ({
  getSessionByTokenHash: vi.fn(),
}))

vi.mock('@/app/lib/repositories/event-repository', () => ({
  createEventLog: vi.fn(),
  findEventByNonce: vi.fn(),
  isValidEventType: vi.fn(),
}))

vi.mock('@/app/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

vi.mock('@/app/lib/services/event-monitoring-service', () => ({
  recordSecurityCounter: vi.fn(),
}))

import { supabaseAdmin } from '@/app/lib/supabase'
import {
  createEventLog,
  findEventByNonce,
  isValidEventType,
} from '@/app/lib/repositories/event-repository'
import { getSessionByTokenHash } from '@/app/lib/repositories/delivery-session-repository'
import { reportEvent } from '@/app/lib/services/event-reporting-service'
import { hashDeliverySessionToken } from '@/app/lib/services/delivery-session-service'

const mockedGetSessionByTokenHash = vi.mocked(getSessionByTokenHash)
const mockedCreateEventLog = vi.mocked(createEventLog)
const mockedFindEventByNonce = vi.mocked(findEventByNonce)
const mockedIsValidEventType = vi.mocked(isValidEventType)

function mockValidSession(overrides: Partial<{
  event_secret: string | null
  expires_at: string
}> = {}): void {
  mockedGetSessionByTokenHash.mockResolvedValue({
    id: 'session-uuid-1',
    script_id: 'script-uuid-1',
    build_id: 'build-uuid-1',
    session_token_hash: 'a'.repeat(64),
    expires_at: overrides.expires_at ?? futureIso(),
    consumed_at: '2026-01-01T00:00:10.000Z', // already consumed for delivery
    event_secret: overrides.event_secret !== undefined ? overrides.event_secret : TEST_EVENT_SECRET,
    created_at: '2026-01-01T00:00:00.000Z',
  })
}

function stubEventTypeValid(): void {
  mockedIsValidEventType.mockReturnValue(true)
}

function stubNoReplay(): void {
  mockedFindEventByNonce.mockResolvedValue(null)
}

function mockEventCreated(eventType = 'execute', nonce = 'a'.repeat(32)): void {
  mockedCreateEventLog.mockResolvedValue({
    id: `event-${eventType}`,
    script_id: 'script-uuid-1',
    session_id: 'session-uuid-1',
    event_type: eventType as 'execute',
    payload: {},
    delivery_status: 'pending',
    retry_count: 0,
    timestamp: '2026-06-09T12:00:00.000Z',
    received_at: '2026-06-09T12:00:01.000Z',
    nonce,
    last_retry_at: null,
    delivered_at: null,
    error_message: null,
    claimed_at: null,
    created_at: '2026-06-09T12:00:01.000Z',
  })
}

function rateLimitChain(allowed: boolean) {
  const chain = {} as Record<string, Mock>
  chain.insert = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.gte = vi.fn(() => chain)
  chain.lte = vi.fn(() => chain)
  chain.single = vi.fn(() => ({ data: null, error: null }))
  chain.maybeSingle = vi.fn(() => ({ data: null, error: null }))
  chain.then = vi.fn((resolve: (v: unknown) => void) => {
    resolve({ data: null, error: null, count: allowed ? 3 : 20 })
    return undefined as unknown as Promise<unknown>
  })
  return chain
}
function stubRateLimit(allowed: boolean): void {
  ;(supabaseAdmin.from as ReturnType<typeof vi.fn>).mockReturnValue(rateLimitChain(allowed))
}

function forEvent(opts?: { sessionId?: string; event?: string; timestamp?: number; nonce?: string; signature?: string; payload?: unknown }) {
  const sessionId = opts?.sessionId ?? TEST_SESSION_ID
  const ts = opts?.timestamp ?? Math.floor(Date.now() / 1000)
  const event = opts?.event ?? 'execute'
  const nonce = opts?.nonce ?? 'a'.repeat(32)
  const payload = opts?.payload ?? {}
  const sig = opts?.signature ?? hmacJSON(event, ts, nonce, payload)
  return { sessionId, event, timestamp: ts, nonce, signature: sig, payload }
}

describe('Event Reporting Service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    stubEventTypeValid()
    stubNoReplay()
  })

  // ---------------------------------------------------------------------------
  // Happy path
  // ---------------------------------------------------------------------------

  it('accepts a valid event', async () => {
    mockValidSession()
    stubRateLimit(true)
    mockEventCreated()

    const result = await reportEvent(forEvent())

    expect(result.success).toBe(true)
    expect(mockedCreateEventLog).toHaveBeenCalledTimes(1)
  })

  it('accepts timestamp at the edge of the skew window', async () => {
    mockValidSession()
    stubRateLimit(true)
    mockEventCreated('execute', 'b'.repeat(32))

    const ts = Math.floor(Date.now() / 1000) - 299
    const nonce = 'b'.repeat(32)

    const result = await reportEvent(forEvent({
      timestamp: ts,
      nonce,
      payload: {},
      signature: hmacJSON('execute', ts, nonce, {}),
    }))

    expect(result.success).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // Session rejection
  // ---------------------------------------------------------------------------

  it('rejects an expired session', async () => {
    mockedGetSessionByTokenHash.mockResolvedValue({
      id: 'session-uuid-1',
      script_id: 'script-uuid-1',
      build_id: 'build-uuid-1',
      session_token_hash: 'a'.repeat(64),
      expires_at: pastIso(),
      consumed_at: null,
      event_secret: TEST_EVENT_SECRET,
      created_at: '2026-01-01T00:00:00.000Z',
    })

    const result = await reportEvent(forEvent())

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(401)
      expect(result.message).toBe('Invalid event session')
    }
  })

  it('rejects a session missing event_secret', async () => {
    mockValidSession({ event_secret: null })

    const result = await reportEvent(forEvent())

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(401)
    }
  })

  it('rejects an unknown session token', async () => {
    mockedGetSessionByTokenHash.mockResolvedValue(null)

    const result = await reportEvent(forEvent())

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(401)
    }
  })

  it('accepts a 43-character delivery session token through hash lookup', async () => {
    const sessionId = 'a'.repeat(43)
    const timestamp = Math.floor(Date.now() / 1000)
    mockValidSession()
    stubRateLimit(true)
    mockEventCreated('execute', 'c'.repeat(32))

    const result = await reportEvent(forEvent({
      sessionId,
      timestamp,
      nonce: 'c'.repeat(32),
      payload: {},
      signature: hmacJSON('execute', timestamp, 'c'.repeat(32), {}),
    }))

    expect(result.success).toBe(true)
    expect(mockedGetSessionByTokenHash).toHaveBeenCalledWith(hashDeliverySessionToken(sessionId))
    expect(mockedCreateEventLog).toHaveBeenCalledTimes(1)
  })

  // ---------------------------------------------------------------------------
  // Event type
  // ---------------------------------------------------------------------------

  it('rejects an unknown event type', async () => {
    mockedIsValidEventType.mockReturnValue(false)

    const result = await reportEvent(forEvent({ event: 'unknown_event' }))

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(422)
      expect(result.message).toBe('Unknown event type')
    }
  })

  // ---------------------------------------------------------------------------
  // Timestamp
  // ---------------------------------------------------------------------------

  it('rejects a future timestamp beyond skew', async () => {
    const ts = Math.floor(Date.now() / 1000) + 600

    const result = await reportEvent(forEvent({ timestamp: ts }))

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(400)
      expect(result.message).toBe('Invalid event timestamp')
    }
  })

  it('rejects a stale timestamp beyond skew', async () => {
    const ts = Math.floor(Date.now() / 1000) - 600

    const result = await reportEvent(forEvent({ timestamp: ts }))

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(400)
    }
  })

  // ---------------------------------------------------------------------------
  // Nonce
  // ---------------------------------------------------------------------------

  it('rejects a malformed nonce', async () => {
    const result = await reportEvent(forEvent({ nonce: 'short' }))

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(400)
      expect(result.message).toBe('Invalid event payload')
    }
  })

  it('rejects a replayed nonce', async () => {
    mockValidSession()
    stubRateLimit(true)
    mockEventCreated('execute', 'c'.repeat(32))

    const nonce = 'c'.repeat(32)
    const input = forEvent({ nonce, payload: {}, signature: hmacJSON('execute', Math.floor(Date.now() / 1000), nonce, {}) })

    // first submission accepted
    const first = await reportEvent(input)
    expect(first.success).toBe(true)

    // stub the DB to say nonce exists
    mockedFindEventByNonce.mockResolvedValue({
      id: 'event-uuid-replayed',
      script_id: 'script-uuid-1',
      session_id: 'session-uuid-1',
      event_type: 'execute',
      payload: {},
      delivery_status: 'pending',
      retry_count: 0,
      timestamp: '2026-06-09T12:00:00.000Z',
      received_at: '2026-06-09T12:00:01.000Z',
      nonce,
      last_retry_at: null,
      delivered_at: null,
      error_message: null,
      claimed_at: null,
      created_at: '2026-06-09T12:00:01.000Z',
    })

    const replay = await reportEvent(input)
    expect(replay.success).toBe(false)
    if (!replay.success) {
      expect(replay.status).toBe(401)
    }
  })

  // ---------------------------------------------------------------------------
  // Signature
  // ---------------------------------------------------------------------------

  it('rejects a malformed signature', async () => {
    const result = await reportEvent(forEvent({ signature: 'bad' }))

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(400)
    }
  })

  it('rejects an invalid HMAC signature uniformly', async () => {
    mockValidSession()

    const result = await reportEvent(forEvent({ signature: 'f'.repeat(64) }))

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(401)
      expect(result.message).toBe('Invalid event session')
    }
  })

  // ---------------------------------------------------------------------------
  // Payload size
  // ---------------------------------------------------------------------------

  it('rejects a payload larger than 4KB', async () => {
    const large = { data: 'x'.repeat(5000) }

    const result = await reportEvent(forEvent({ payload: large }))

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(413)
      expect(result.message).toBe('Payload too large')
    }
  })

  // ---------------------------------------------------------------------------
  // Rate limiting
  // ---------------------------------------------------------------------------

  it('enforces per-session rate limit', async () => {
    mockValidSession()
    stubRateLimit(false)

    const result = await reportEvent(forEvent())

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(429)
      expect(result.message).toBe('Too many events')
    }
  })

  // ---------------------------------------------------------------------------
  // All event types
  // ---------------------------------------------------------------------------

  it.each([
    'execute', 'purchase', 'error', 'ban',
    'key_redeem', 'heartbeat', 'license_activate', 'license_revoke',
  ])('accepts allowed event type: %s', async (eventType) => {
    vi.resetAllMocks()
    mockedIsValidEventType.mockReturnValue(true)
    mockedFindEventByNonce.mockResolvedValue(null)
    mockValidSession()
    stubRateLimit(true)
    mockedCreateEventLog.mockResolvedValue({
      id: `event-${eventType}`,
      script_id: 'script-uuid-1',
      session_id: 'session-uuid-1',
      event_type: eventType as 'execute',
      payload: {},
      delivery_status: 'pending',
      retry_count: 0,
      timestamp: '2026-06-09T12:00:00.000Z',
      received_at: '2026-06-09T12:00:01.000Z',
      nonce: 'e'.repeat(32),
      last_retry_at: null,
      delivered_at: null,
      error_message: null,
      claimed_at: null,
      created_at: '2026-06-09T12:00:01.000Z',
    })

    const ts = Math.floor(Date.now() / 1000)
    const nonce = 'e'.repeat(32)

    const result = await reportEvent(forEvent({
      event: eventType,
      timestamp: ts,
      nonce,
      payload: {},
      signature: hmacJSON(eventType, ts, nonce, {}),
    }))

    expect(result.success).toBe(true)
  })
})
