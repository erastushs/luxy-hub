import { randomUUID } from 'node:crypto'
import { getValkeyConnectionManager, type ValkeyConnectionManager } from '@/app/lib/valkey/connection'
import { createValkeyKeyPrefix, sanitizeSegment } from '@/app/lib/valkey/namespace'
import type { DeliverySessionAdapter, DeliverySessionData } from './types'

const DELIVERY_SESSION_TTL_SECONDS = 60
const DELIVERY_SESSION_NAMESPACE = 'delivery'
const DELIVERY_SESSION_TTL_MS = DELIVERY_SESSION_TTL_SECONDS * 1000

type ValkeyDeliverySessionAdapterOptions = {
  logFailures?: boolean
}

function sessionDataKey(id: string): string {
  return `${createValkeyKeyPrefix(DELIVERY_SESSION_NAMESPACE)}v1:session:${sanitizeSegment(id)}`
}

function tokenIndexKey(tokenHash: string): string {
  return `${createValkeyKeyPrefix(DELIVERY_SESSION_NAMESPACE)}v1:token:${sanitizeSegment(tokenHash)}`
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
    created_at: String(obj.created_at ?? ''),
  }
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
    const now = new Date().toISOString()
    const sessionKey = sessionDataKey(id)
    const indexKey = tokenIndexKey(params.tokenHash)

    const data = JSON.stringify({
      id,
      script_id: params.scriptId,
      build_id: params.buildId,
      session_token_hash: params.tokenHash,
      expires_at: params.expiresAt,
      consumed_at: null,
      event_secret: params.eventSecret ?? null,
      created_at: now,
    })

    const client = await this.manager.connect()
    if (!client) {
      throw new Error('Valkey client unavailable')
    }

    if (typeof client.set !== 'function') {
      throw new Error('Valkey client does not support set')
    }

    const setResult = await (client as unknown as { set: (key: string, value: string, options: { PX: number }) => Promise<unknown> }).set(sessionKey, data, { PX: DELIVERY_SESSION_TTL_MS })
    if (setResult === null) {
      throw new Error('Failed to create delivery session in Valkey')
    }

    if (typeof client.set !== 'function') {
      throw new Error('Valkey client does not support set')
    }
    await (client as unknown as { set: (key: string, value: string, options: { PX: number }) => Promise<unknown> }).set(indexKey, id, { PX: DELIVERY_SESSION_TTL_MS })

    return {
      id,
      script_id: params.scriptId,
      build_id: params.buildId,
      session_token_hash: params.tokenHash,
      expires_at: params.expiresAt,
      consumed_at: null,
      event_secret: params.eventSecret ?? null,
      created_at: now,
    }
  }

  async getSessionByTokenHash(tokenHash: string): Promise<DeliverySessionData | null> {
    const indexKey = tokenIndexKey(tokenHash)

    const client = await this.manager.connect()
    if (!client || typeof client.get !== 'function') {
      throw new Error('Valkey client unavailable')
    }

    const sessionId = await (client as unknown as { get: (key: string) => Promise<string | null> }).get(indexKey)
    if (!sessionId) {
      return null
    }

    const sessionKey = sessionDataKey(sessionId)
    const data = await (client as unknown as { get: (key: string) => Promise<string | null> }).get(sessionKey)
    if (!data) {
      return null
    }

    return normalizeSessionData(data)
  }

  async consumeSession(sessionId: string): Promise<DeliverySessionData | null> {
    const sessionKey = sessionDataKey(sessionId)
    const now = new Date().toISOString()

    const client = await this.manager.connect()
    if (!client || typeof client.get !== 'function' || typeof client.set !== 'function') {
      throw new Error('Valkey client unavailable')
    }

    const data = await (client as unknown as { get: (key: string) => Promise<string | null> }).get(sessionKey)
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
    await (client as unknown as { set: (key: string, value: string, options: { PX: number }) => Promise<unknown> }).set(sessionKey, JSON.stringify(session), { PX: DELIVERY_SESSION_TTL_MS })

    return normalizeSessionData(session)
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const sessionKey = sessionDataKey(sessionId)

    const client = await this.manager.connect()
    if (!client || typeof client.get !== 'function' || typeof client.del !== 'function') {
      throw new Error('Valkey client unavailable')
    }

    const data = await (client as unknown as { get: (key: string) => Promise<string | null> }).get(sessionKey)
    if (!data) {
      return false
    }

    const session = JSON.parse(data)
    const indexKey = tokenIndexKey(session.session_token_hash || '')

    const delSession = await (client as unknown as { del: (key: string) => Promise<number> }).del(sessionKey)
    await (client as unknown as { del: (key: string) => Promise<number> }).del(indexKey)

    return delSession > 0
  }
}
