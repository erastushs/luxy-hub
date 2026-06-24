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

const RATE_LIMIT_IDLE_TTL_GRACE_MS = 5_000

const RATE_LIMIT_INSERT_AND_COUNT_SCRIPT = `
local window_ms = tonumber(ARGV[1])
local now_ms = tonumber(ARGV[2])
local idle_ttl_ms = tonumber(ARGV[3])
local window_start = now_ms - window_ms

redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', '(' .. window_start)

local sequence = redis.call('INCR', KEYS[2])
local member = ARGV[2] .. ':' .. sequence
redis.call('ZADD', KEYS[1], now_ms, member)
redis.call('PEXPIRE', KEYS[1], idle_ttl_ms)
redis.call('PEXPIRE', KEYS[2], idle_ttl_ms)

local count = redis.call('ZCOUNT', KEYS[1], window_start, now_ms)
local ttl = redis.call('PTTL', KEYS[1])
return { count, ttl }
`

const RATE_LIMIT_COUNT_SCRIPT = `
local window_ms = tonumber(ARGV[1])
local now_ms = tonumber(ARGV[2])
local idle_ttl_ms = tonumber(ARGV[3])
local window_start = now_ms - window_ms

redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', '(' .. window_start)
local count = redis.call('ZCOUNT', KEYS[1], window_start, now_ms)

if count == 0 then
  redis.call('DEL', KEYS[1])
  return { 0, -2 }
end

redis.call('PEXPIRE', KEYS[1], idle_ttl_ms)
local ttl = redis.call('PTTL', KEYS[1])
return { count, ttl }
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
    const result = await this.insertAndCountWindow(key, windowMs)

    if (!result) {
      return { allowed: false, retryAfter: retryAfterSeconds(windowMs) }
    }

    if (result.count > MAX_REQUESTS[limitKey]) {
      return { allowed: false, retryAfter: retryAfterSeconds(windowMs) }
    }

    return { allowed: true }
  }

  async checkLoginFailure(ip: string, email: unknown): Promise<RateLimitResult> {
    const nowMs = Date.now()
    const ipKey = createRateLimitKey('login', LOGIN_FAILURE_WINDOWS.ip.endpoint, ip)
    const ipLimit = await this.countWindow(ipKey, LOGIN_FAILURE_WINDOWS.ip.windowMs, nowMs)

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
    const emailLimit = await this.countWindow(emailKey, LOGIN_FAILURE_WINDOWS.email.windowMs, nowMs)

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
    const nowMs = Date.now()
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
      await this.insertAndCountWindow(row.key, row.windowMs, nowMs)
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

      await client.del([key, createSequenceKey(key)])
    } catch (error) {
      this.handleFailure('clear_login_failures', error)
    }
  }

  async checkEventLimit(sessionId: string): Promise<RateLimitResult> {
    const endpoint = `EVENT_REPORT:${sessionId}`
    const key = createRateLimitKey('event', endpoint, sessionId)
    const result = await this.insertAndCountWindow(key, EVENT_RATE_LIMITS.windowMs)

    if (!result) {
      return { allowed: false, retryAfter: retryAfterSeconds(EVENT_RATE_LIMITS.windowMs) }
    }

    if (result.count > EVENT_RATE_LIMITS.maxRequests) {
      return { allowed: false, retryAfter: retryAfterSeconds(EVENT_RATE_LIMITS.windowMs) }
    }

    return { allowed: true }
  }

  private async insertAndCountWindow(
    key: string,
    windowMs: number,
    nowMs: number = Date.now()
  ): Promise<CounterResult | null> {
    try {
      const client = await this.manager.connect()

      if (!client?.eval) {
        this.handleFailure('insert_and_count_window', new Error('Valkey client unavailable'))
        return null
      }

      return parseCounterResult(await client.eval(RATE_LIMIT_INSERT_AND_COUNT_SCRIPT, {
        keys: [key, createSequenceKey(key)],
        arguments: [String(windowMs), String(nowMs), String(getIdleTtlMs(windowMs))],
      }))
    } catch (error) {
      this.handleFailure('insert_and_count_window', error)
      return null
    }
  }

  private async countWindow(
    key: string,
    windowMs: number,
    nowMs: number = Date.now()
  ): Promise<CounterResult | null> {
    try {
      const client = await this.manager.connect()

      if (!client?.eval) {
        this.handleFailure('count_window', new Error('Valkey client unavailable'))
        return null
      }

      return parseCounterResult(await client.eval(RATE_LIMIT_COUNT_SCRIPT, {
        keys: [key],
        arguments: [String(windowMs), String(nowMs), String(getIdleTtlMs(windowMs))],
      }))
    } catch (error) {
      this.handleFailure('count_window', error)
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
  return `${createValkeyKeyPrefix('rate')}v2:${scope}:${sanitizeSegment(hashedBucket)}:${sanitizeSegment(hashedIdentifier)}`
}

function createSequenceKey(key: string): string {
  return `${key}:seq`
}

function getIdleTtlMs(windowMs: number): number {
  return windowMs + RATE_LIMIT_IDLE_TTL_GRACE_MS
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
