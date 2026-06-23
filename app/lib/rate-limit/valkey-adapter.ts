import { createHash } from 'node:crypto'
import { getValkeyConnectionManager, type ValkeyConnectionManager } from '@/app/lib/valkey/connection'
import { createValkeyKeyPrefix, hashValkeyIdentifier, sanitizeSegment } from '@/app/lib/valkey/namespace'
import {
  EVENT_RATE_LIMITS,
  LOGIN_FAILURE_WINDOWS,
  MAX_REQUESTS,
  WINDOW_MS,
  retryAfterSeconds,
} from './config'
import type {
  LimitKey,
  RateLimitAdapter,
  RateLimitResult,
} from './types'

const RATE_LIMIT_INCREMENT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { current, ttl }
`

const RATE_LIMIT_READ_SCRIPT = `
local current = redis.call('GET', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if not current then
  return { 0, ttl }
end
return { tonumber(current), ttl }
`

type CounterResult = {
  count: number
  ttlMs: number | null
}

type ValkeyRateLimitAdapterOptions = {
  logFailures?: boolean
  throwOnFailure?: boolean
}

export class ValkeyRateLimitAdapter implements RateLimitAdapter {
  private readonly logFailures: boolean
  private readonly throwOnFailure: boolean

  constructor(
    private readonly manager: ValkeyConnectionManager = getValkeyConnectionManager(),
    options: ValkeyRateLimitAdapterOptions = {}
  ) {
    this.logFailures = options.logFailures ?? true
    this.throwOnFailure = options.throwOnFailure ?? false
  }

  async checkGeneralLimit(ip: string, limitKey: LimitKey): Promise<RateLimitResult> {
    const windowMs = WINDOW_MS[limitKey]
    const key = createRateLimitKey('general', limitKey, ip)
    const result = await this.incrementWindow(key, windowMs)

    if (!result) {
      return { allowed: false, retryAfter: retryAfterSeconds(windowMs) }
    }

    if (result.count > MAX_REQUESTS[limitKey]) {
      return { allowed: false, retryAfter: retryAfterSeconds(windowMs) }
    }

    return { allowed: true }
  }

  async checkLoginFailure(ip: string, email: unknown): Promise<RateLimitResult> {
    const ipKey = createRateLimitKey('login', LOGIN_FAILURE_WINDOWS.ip.endpoint, ip)
    const ipLimit = await this.readWindow(ipKey)

    if (!ipLimit) {
      return {
        allowed: false,
        retryAfter: retryAfterSeconds(LOGIN_FAILURE_WINDOWS.ip.windowMs),
      }
    }

    if (ipLimit.count >= LOGIN_FAILURE_WINDOWS.ip.maxFailures) {
      return {
        allowed: false,
        retryAfter: retryAfterSeconds(LOGIN_FAILURE_WINDOWS.ip.windowMs),
      }
    }

    const emailIdentifier = getLoginEmailIdentifier(email)
    if (!emailIdentifier) {
      return { allowed: true }
    }

    const emailKey = createRateLimitKey('login', LOGIN_FAILURE_WINDOWS.email.endpoint, emailIdentifier)
    const emailLimit = await this.readWindow(emailKey)

    if (!emailLimit) {
      return {
        allowed: false,
        retryAfter: retryAfterSeconds(LOGIN_FAILURE_WINDOWS.email.windowMs),
      }
    }

    if (emailLimit.count >= LOGIN_FAILURE_WINDOWS.email.maxFailures) {
      return {
        allowed: false,
        retryAfter: retryAfterSeconds(LOGIN_FAILURE_WINDOWS.email.windowMs),
      }
    }

    return { allowed: true }
  }

  async recordLoginFailure(ip: string, email: unknown): Promise<void> {
    const rows: Array<{ key: string; windowMs: number }> = [
      {
        key: createRateLimitKey('login', LOGIN_FAILURE_WINDOWS.ip.endpoint, ip),
        windowMs: LOGIN_FAILURE_WINDOWS.ip.windowMs,
      },
    ]

    const emailIdentifier = getLoginEmailIdentifier(email)
    if (emailIdentifier) {
      rows.push({
        key: createRateLimitKey('login', LOGIN_FAILURE_WINDOWS.email.endpoint, emailIdentifier),
        windowMs: LOGIN_FAILURE_WINDOWS.email.windowMs,
      })
    }

    for (const row of rows) {
      await this.incrementWindow(row.key, row.windowMs)
    }
  }

  async clearLoginFailures(_ip: string, email: unknown): Promise<void> {
    const emailIdentifier = getLoginEmailIdentifier(email)
    if (!emailIdentifier) {
      return
    }

    const key = createRateLimitKey('login', LOGIN_FAILURE_WINDOWS.email.endpoint, emailIdentifier)

    try {
      const client = await this.manager.connect()
      if (!client?.del) {
        this.handleFailure('clear_login_failures', new Error('Valkey client unavailable'))
        return
      }

      await client.del(key)
    } catch (error) {
      this.handleFailure('clear_login_failures', error)
    }
  }

  async checkEventLimit(sessionId: string): Promise<RateLimitResult> {
    const endpoint = `EVENT_REPORT:${sessionId}`
    const key = createRateLimitKey('event', endpoint, sessionId)
    const result = await this.incrementWindow(key, EVENT_RATE_LIMITS.windowMs)

    if (!result) {
      return { allowed: false, retryAfter: retryAfterSeconds(EVENT_RATE_LIMITS.windowMs) }
    }

    if (result.count > EVENT_RATE_LIMITS.maxRequests) {
      return { allowed: false, retryAfter: retryAfterSeconds(EVENT_RATE_LIMITS.windowMs) }
    }

    return { allowed: true }
  }

  private async incrementWindow(key: string, windowMs: number): Promise<CounterResult | null> {
    try {
      const client = await this.manager.connect()

      if (!client?.eval) {
        this.handleFailure('increment_window', new Error('Valkey client unavailable'))
        return null
      }

      return parseCounterResult(await client.eval(RATE_LIMIT_INCREMENT_SCRIPT, {
        keys: [key],
        arguments: [String(windowMs)],
      }))
    } catch (error) {
      this.handleFailure('increment_window', error)
      return null
    }
  }

  private async readWindow(key: string): Promise<CounterResult | null> {
    try {
      const client = await this.manager.connect()

      if (!client?.eval) {
        this.handleFailure('read_window', new Error('Valkey client unavailable'))
        return null
      }

      return parseCounterResult(await client.eval(RATE_LIMIT_READ_SCRIPT, {
        keys: [key],
        arguments: [],
      }))
    } catch (error) {
      this.handleFailure('read_window', error)
      return null
    }
  }

  private handleFailure(operation: string, error: unknown): void {
    if (this.logFailures) {
      logValkeyRateLimitFailure(operation, error)
    }

    if (this.throwOnFailure) {
      throw error
    }
  }
}

export function createRateLimitKey(
  scope: 'general' | 'login' | 'event',
  bucket: string,
  identifier: string
): string {
  const hashedBucket = hashValkeyIdentifier(bucket)
  const hashedIdentifier = hashValkeyIdentifier(identifier)
  return `${createValkeyKeyPrefix('rate')}${scope}:${sanitizeSegment(hashedBucket)}:${sanitizeSegment(hashedIdentifier)}`
}

function parseCounterResult(result: unknown): CounterResult | null {
  if (!Array.isArray(result) || result.length < 2) {
    return null
  }

  const count = Number(result[0])
  const ttl = Number(result[1])

  if (!Number.isFinite(count)) {
    return null
  }

  return {
    count,
    ttlMs: Number.isFinite(ttl) && ttl >= 0 ? ttl : null,
  }
}

function getLoginEmailIdentifier(email: unknown): string | null {
  if (typeof email !== 'string' || email.trim().length === 0) {
    return null
  }

  const normalizedEmail = email.trim().toLowerCase()
  const pepper = process.env.ANALYTICS_PEPPER || 'dev-pepper'
  const hash = createHash('sha256')
    .update(`${normalizedEmail}:${pepper}`)
    .digest('hex')

  return `email:${hash}`
}

function logValkeyRateLimitFailure(operation: string, error: unknown): void {
  try {
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      component: 'rate-limit',
      backend: 'valkey',
      event: 'adapter_failure',
      operation,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    }))
  } catch {
    // Logging must not affect shadow execution or future runtime fallback behavior.
  }
}
