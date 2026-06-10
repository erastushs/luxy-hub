import { createHmac, timingSafeEqual } from 'node:crypto'
import { supabaseAdmin } from '@/app/lib/supabase'
import { hashDeliverySessionToken } from '@/app/lib/services/delivery-session-service'
import { getSessionByTokenHash } from '@/app/lib/repositories/delivery-session-repository'
import { createEventLog, findEventByNonce, isValidEventType, type EventType } from '@/app/lib/repositories/event-repository'
import { recordSecurityCounter } from '@/app/lib/services/event-monitoring-service'

const EVENT_REJECTED_MESSAGE = 'Event rejected'
const INVALID_SESSION_MESSAGE = 'Invalid event session'
const INVALID_TIMESTAMP_MESSAGE = 'Invalid event timestamp'
const INVALID_PAYLOAD_MESSAGE = 'Invalid event payload'
const UNKNOWN_EVENT_MESSAGE = 'Unknown event type'
const TOO_MANY_EVENTS_MESSAGE = 'Too many events'
const PAYLOAD_TOO_LARGE_MESSAGE = 'Payload too large'

const MAX_PAYLOAD_BYTES = 4096
const MAX_TIMESTAMP_SKEW_SECONDS = 300
const MAX_EVENTS_PER_SESSION_PER_MINUTE = 10
const RATE_LIMIT_WINDOW_MS = 60_000

export type EventReportInput = Readonly<{
  sessionId: string
  event: string
  timestamp: number
  nonce: string
  signature: string
  payload: unknown
}>

export type EventReportResult =
  | { success: true }
  | {
      success: false
      message: string
      status: number
      retryAfter?: number
    }

function safeJSON(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

function isValidNonce(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{32}$/.test(value)
}

function isValidSignature(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
}

function isValidSessionId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 44 && value.length <= 256
}

function isValidTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function jsonByteSize(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8')
  } catch {
    return 0
  }
}

function computeEventSignature(eventSecret: string, event: string, timestamp: number, nonce: string, data: unknown): string {
  const payload = `${event}:${timestamp}:${nonce}:${safeJSON(data)}`
  return createHmac('sha256', eventSecret).update(payload).digest('hex')
}

export async function checkEventRateLimit(sessionId: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const endpoint = `EVENT_REPORT:${sessionId}`
  const now = new Date()
  const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS)

  const { error: insertError } = await supabaseAdmin
    .from('rate_limits')
    .insert({ ip: sessionId, endpoint, created_at: now.toISOString() })

  if (insertError) {
    return { allowed: false, retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) }
  }

  const { count, error } = await supabaseAdmin
    .from('rate_limits')
    .select('id', { count: 'exact', head: true })
    .eq('ip', sessionId)
    .eq('endpoint', endpoint)
    .gte('created_at', windowStart.toISOString())
    .lte('created_at', now.toISOString())

  if (error || count === null) {
    return { allowed: false, retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) }
  }

  if (count > MAX_EVENTS_PER_SESSION_PER_MINUTE) {
    return { allowed: false, retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) }
  }

  return { allowed: true }
}

export async function reportEvent(input: EventReportInput): Promise<EventReportResult> {
  if (!isValidSessionId(input.sessionId)) {
    recordSecurityCounter('event.auth_failure', 'invalid session_id format')
    return { success: false, message: INVALID_SESSION_MESSAGE, status: 401 }
  }

  if (typeof input.event !== 'string' || input.event.length === 0 || !isValidEventType(input.event)) {
    return { success: false, message: UNKNOWN_EVENT_MESSAGE, status: 422 }
  }
  if (!isValidTimestamp(input.timestamp)) {
    recordSecurityCounter('event.auth_failure', 'invalid timestamp')
    return { success: false, message: INVALID_TIMESTAMP_MESSAGE, status: 400 }
  }

  const nowSeconds = Date.now() / 1000
  if (Math.abs(nowSeconds - input.timestamp) > MAX_TIMESTAMP_SKEW_SECONDS) {
    recordSecurityCounter('event.auth_failure', 'timestamp skew')
    return { success: false, message: INVALID_TIMESTAMP_MESSAGE, status: 400 }
  }

  if (!isValidNonce(input.nonce)) {
    recordSecurityCounter('event.auth_failure', 'invalid nonce')
    return { success: false, message: INVALID_PAYLOAD_MESSAGE, status: 400 }
  }

  if (!isValidSignature(input.signature)) {
    recordSecurityCounter('event.auth_failure', 'invalid signature format')
    return { success: false, message: INVALID_PAYLOAD_MESSAGE, status: 400 }
  }

  if (jsonByteSize(input.payload) > MAX_PAYLOAD_BYTES) {
    return { success: false, message: PAYLOAD_TOO_LARGE_MESSAGE, status: 413 }
  }

  const tokenHash = hashDeliverySessionToken(input.sessionId)

  let eventSecret: string
  let sessionId: string
  let scriptId: string
  try {
    const row = await getSessionByTokenHash(tokenHash)
    if (!row || !row.event_secret || new Date(row.expires_at).getTime() <= Date.now()) {
      recordSecurityCounter('event.auth_failure', 'invalid or expired session')
      return { success: false, message: INVALID_SESSION_MESSAGE, status: 401 }
    }
    eventSecret = row.event_secret
    sessionId = row.id
    scriptId = row.script_id
  } catch {
    return { success: false, message: INVALID_SESSION_MESSAGE, status: 401 }
  }

  const expectedSignature = computeEventSignature(
    eventSecret,
    input.event,
    input.timestamp,
    input.nonce,
    input.payload,
  )

  const expectedBuf = Buffer.from(expectedSignature, 'hex')
  const providedBuf = Buffer.from(input.signature, 'hex')
  if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
    recordSecurityCounter('event.invalid_signature', `session:${sessionId}`)
    return { success: false, message: INVALID_SESSION_MESSAGE, status: 401 }
  }

  const rateLimit = await checkEventRateLimit(sessionId)
  if (!rateLimit.allowed) {
    recordSecurityCounter('event.rate_limited', `session:${sessionId}`)
    return { success: false, message: TOO_MANY_EVENTS_MESSAGE, status: 429, retryAfter: rateLimit.retryAfter }
  }

  const existing = await findEventByNonce(sessionId, input.nonce)
  if (existing) {
    recordSecurityCounter('event.replay_attempt', `session:${sessionId}`)
    return { success: false, message: INVALID_SESSION_MESSAGE, status: 401 }
  }

  try {
    await createEventLog({
      scriptId,
      sessionId,
      eventType: input.event as EventType,
      payload: (typeof input.payload === 'object' && input.payload !== null ? input.payload : {}) as Record<string, unknown>,
      timestamp: new Date(input.timestamp * 1000).toISOString(),
      nonce: input.nonce,
    })
  } catch {
    return { success: false, message: EVENT_REJECTED_MESSAGE, status: 500 }
  }

  return { success: true }
}
