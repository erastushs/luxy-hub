import { randomUUID } from 'node:crypto'
import { getValkeyConnectionManager, type ValkeyConnectionManager } from '@/app/lib/valkey/connection'
import { createValkeyKeyPrefix, sanitizeSegment } from '@/app/lib/valkey/namespace'
import { getDeliverySessionTtlMs } from './config'
import type { DeliverySessionAdapter, DeliverySessionData } from './types'

/*
 * Namespace versioning
 *
 * Key format: luxyhub:<env>:delivery:v2:<type>:<identifier>
 *   v1 was the initial Phase 8A layout (never reached production).
 *   v2 introduces minimized stored payload, single TTL source, and
 *     improved key structure.
 *
 * Version bumps prevent conflicts when the key schema or storage
 * format changes. A future v3 (or higher) would coexist without
 * overwriting existing keys during a rolling migration or rollback.
 *
 * Key types:
 *   session — serialized session data keyed by session UUID
 *   token   — index mapping token_hash → session UUID (for lookup)
 */

const DELIVERY_SESSION_NAMESPACE = 'delivery'
const NAMESPACE_VERSION = 'v2'

type ValkeyDeliverySessionAdapterOptions = {
  logFailures?: boolean
}

function sessionDataKey(id: string): string {
  return `${createValkeyKeyPrefix(DELIVERY_SESSION_NAMESPACE)}${NAMESPACE_VERSION}:session:${sanitizeSegment(id)}`
}

function tokenIndexKey(tokenHash: string): string {
  return `${createValkeyKeyPrefix(DELIVERY_SESSION_NAMESPACE)}${NAMESPACE_VERSION}:token:${sanitizeSegment(tokenHash)}`
}

/*
 * Minimal stored object in Valkey.
 *
 * Fields stored:
 *   id                  — session UUID, primary key for consumeSession
 *   script_id           — script UUID, required for build ownership check
 *   build_id            — build UUID, required to fetch delivery payload
 *   session_token_hash  — SHA-256 of raw token; needed for index cleanup on delete
 *   expires_at          — ISO-8601 expiration timestamp
 *   consumed_at         — null until consumed, then ISO-8601 timestamp
 *   event_secret        — HMAC secret for runtime event signing
 *
 * Fields NOT stored (recomputable or unused):
 *   created_at          — unused at runtime; derivable from TTL
 */
type ValkeyStoredSession = {
  id: string
  script_id: string
  build_id: string
  session_token_hash: string
  expires_at: string
  consumed_at: string | null
  event_secret: string | null
}

function normalizeSessionData(raw: string | Record<string, unknown>): DeliverySessionData {
  const obj = typeof raw === 'string'
    ? JSON.parse(raw) as Record<string, unknown>
    : raw

  return {
    id: String(obj.id ?? ''),
    script_id: String(obj.script_id ?? ''),
    build_id: String(obj.build_id ?? ''),
    session_token_hash: String(obj.session_token_hash ?? ''),
    expires_at: String(obj.expires_at ?? ''),
    consumed_at: obj.consumed_at && obj.consumed_at !== 'null' && obj.consumed_at !== '' ? String(obj.consumed_at) : null,
    event_secret: obj.event_secret && obj.event_secret !== 'null' && obj.event_secret !== '' ? String(obj.event_secret) : null,
    created_at: '',
  }
}

function buildValkeyPayload(params: {
  id: string
  scriptId: string
  buildId: string
  tokenHash: string
  expiresAt: string
  eventSecret: string | null
}): string {
  const stored: ValkeyStoredSession = {
    id: params.id,
    script_id: params.scriptId,
    build_id: params.buildId,
    session_token_hash: params.tokenHash,
    expires_at: params.expiresAt,
    consumed_at: null,
    event_secret: params.eventSecret,
  }
  return JSON.stringify(stored)
}

export class ValkeyDeliverySessionAdapter implements DeliverySessionAdapter {
  private readonly logFailures: boolean

  constructor(
    private readonly manager: ValkeyConnectionManager = getValkeyConnectionManager(),
    options: ValkeyDeliverySessionAdapterOptions = {}
  ) {
    this.logFailures = options.logFailures ?? true
  }

  async createSession(params: {
    scriptId: string
    buildId: string
    tokenHash: string
    expiresAt: string
    eventSecret?: string | null
  }): Promise<DeliverySessionData> {
    const id = randomUUID()
    const sessionKey = sessionDataKey(id)
    const indexKey = tokenIndexKey(params.tokenHash)
    const ttlMs = getDeliverySessionTtlMs()

    const data = buildValkeyPayload({
      id,
      scriptId: params.scriptId,
      buildId: params.buildId,
      tokenHash: params.tokenHash,
      expiresAt: params.expiresAt,
      eventSecret: params.eventSecret ?? null,
    })

    const client = await this.manager.connect()
    if (!client) {
      throw new Error('Valkey client unavailable')
    }

    if (typeof client.set !== 'function') {
      throw new Error('Valkey client does not support set')
    }

    const c = client as unknown as { set: (key: string, value: string, options: { PX: number }) => Promise<unknown> }

    const setResult = await c.set(sessionKey, data, { PX: ttlMs })
    if (setResult === null) {
      throw new Error('Failed to create delivery session in Valkey')
    }

    await c.set(indexKey, id, { PX: ttlMs })

    return {
      id,
      script_id: params.scriptId,
      build_id: params.buildId,
      session_token_hash: params.tokenHash,
      expires_at: params.expiresAt,
      consumed_at: null,
      event_secret: params.eventSecret ?? null,
      created_at: '',
    }
  }

  async getSessionByTokenHash(tokenHash: string): Promise<DeliverySessionData | null> {
    const indexKey = tokenIndexKey(tokenHash)

    const client = await this.manager.connect()
    if (!client || typeof client.get !== 'function') {
      throw new Error('Valkey client unavailable')
    }

    const c = client as unknown as { get: (key: string) => Promise<string | null> }

    const sessionId = await c.get(indexKey)
    if (!sessionId) {
      return null
    }

    const sessionKey = sessionDataKey(sessionId)
    const data = await c.get(sessionKey)
    if (!data) {
      return null
    }

    return normalizeSessionData(data)
  }

  async consumeSession(sessionId: string): Promise<DeliverySessionData | null> {
    const sessionKey = sessionDataKey(sessionId)
    const now = new Date().toISOString()
    const ttlMs = getDeliverySessionTtlMs()

    const client = await this.manager.connect()
    if (!client || typeof client.get !== 'function' || typeof client.set !== 'function') {
      throw new Error('Valkey client unavailable')
    }

    const c = client as unknown as {
      get: (key: string) => Promise<string | null>
      set: (key: string, value: string, options: { PX: number }) => Promise<unknown>
    }

    const data = await c.get(sessionKey)
    if (!data) {
      return null
    }

    const session = JSON.parse(data)
    if (session.consumed_at && session.consumed_at !== 'null') {
      return null
    }
    if (session.expires_at <= now) {
      return null
    }

    session.consumed_at = now
    await c.set(sessionKey, JSON.stringify(session), { PX: ttlMs })

    return normalizeSessionData(session)
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const sessionKey = sessionDataKey(sessionId)

    const client = await this.manager.connect()
    if (!client || typeof client.get !== 'function' || typeof client.del !== 'function') {
      throw new Error('Valkey client unavailable')
    }

    const c = client as unknown as {
      get: (key: string) => Promise<string | null>
      del: (key: string) => Promise<number>
    }

    const data = await c.get(sessionKey)
    if (!data) {
      return false
    }

    const session = JSON.parse(data)
    const tokenHash = session.session_token_hash || ''
    const indexKey = tokenIndexKey(tokenHash)

    const delSession = await c.del(sessionKey)
    await c.del(indexKey)

    return delSession > 0
  }
}
