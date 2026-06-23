import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@/app/lib/supabase'
import {
  EVENT_RATE_LIMITS,
  LOGIN_FAILURE_WINDOWS,
  MAX_REQUESTS,
  WINDOW_MS,
  retryAfterSeconds,
} from './config'
import {
  type LimitKey,
  type LoginFailureEndpoint,
  type RateLimitAdapter,
  type RateLimitResult,
} from './types'

export class PostgresRateLimitAdapter implements RateLimitAdapter {
  async checkGeneralLimit(ip: string, limitKey: LimitKey): Promise<RateLimitResult> {
    const windowMs = WINDOW_MS[limitKey]
    const maxRequests = MAX_REQUESTS[limitKey]
    const now = new Date()
    const windowStart = new Date(now.getTime() - windowMs)

    const { error: insertError } = await supabaseAdmin
      .from('rate_limits')
      .insert({
        ip,
        endpoint: limitKey,
        created_at: now.toISOString(),
      })

    if (insertError) {
      console.error(`[rate-limiter] DB insert error — denying request (fail-closed): ${ip}`)
      return { allowed: false, retryAfter: retryAfterSeconds(windowMs) }
    }

    const { count, error } = await supabaseAdmin
      .from('rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .eq('endpoint', limitKey)
      .gte('created_at', windowStart.toISOString())
      .lte('created_at', now.toISOString())

    if (error || count === null) {
      console.error(`[rate-limiter] DB count error — denying request (fail-closed): ${ip}`)
      return { allowed: false, retryAfter: retryAfterSeconds(windowMs) }
    }

    if (count > maxRequests) {
      return { allowed: false, retryAfter: retryAfterSeconds(windowMs) }
    }

    return { allowed: true }
  }

  async checkLoginFailure(ip: string, email: unknown): Promise<RateLimitResult> {
    const now = new Date()
    const ipLimit = await this.checkLoginFailureBucket({
      identifier: ip,
      endpoint: LOGIN_FAILURE_WINDOWS.ip.endpoint,
      windowMs: LOGIN_FAILURE_WINDOWS.ip.windowMs,
      maxFailures: LOGIN_FAILURE_WINDOWS.ip.maxFailures,
      now,
    })

    if (!ipLimit.allowed) {
      return ipLimit
    }

    const emailIdentifier = getLoginEmailIdentifier(email)
    if (!emailIdentifier) {
      return { allowed: true }
    }

    return this.checkLoginFailureBucket({
      identifier: emailIdentifier,
      endpoint: LOGIN_FAILURE_WINDOWS.email.endpoint,
      windowMs: LOGIN_FAILURE_WINDOWS.email.windowMs,
      maxFailures: LOGIN_FAILURE_WINDOWS.email.maxFailures,
      now,
    })
  }

  async recordLoginFailure(ip: string, email: unknown): Promise<void> {
    const now = new Date().toISOString()
    const rows: Array<{ ip: string; endpoint: LoginFailureEndpoint; created_at: string }> = [
      {
        ip,
        endpoint: LOGIN_FAILURE_WINDOWS.ip.endpoint,
        created_at: now,
      },
    ]

    const emailIdentifier = getLoginEmailIdentifier(email)
    if (emailIdentifier) {
      rows.push({
        ip: emailIdentifier,
        endpoint: LOGIN_FAILURE_WINDOWS.email.endpoint,
        created_at: now,
      })
    }

    const { error } = await supabaseAdmin
      .from('rate_limits')
      .insert(rows)

    if (error) {
      console.error(`[rate-limiter] login failure insert error: ${ip}`)
    }
  }

  async clearLoginFailures(ip: string, email: unknown): Promise<void> {
    const emailIdentifier = getLoginEmailIdentifier(email)
    if (!emailIdentifier) {
      return
    }

    const { error: emailError } = await supabaseAdmin
      .from('rate_limits')
      .delete()
      .eq('ip', emailIdentifier)
      .eq('endpoint', LOGIN_FAILURE_WINDOWS.email.endpoint)

    if (emailError) {
      console.error(`[rate-limiter] login email failure cleanup error: ${ip}`)
    }
  }

  async checkEventLimit(sessionId: string): Promise<RateLimitResult> {
    const endpoint = `EVENT_REPORT:${sessionId}`
    const now = new Date()
    const windowStart = new Date(now.getTime() - EVENT_RATE_LIMITS.windowMs)

    const { error: insertError } = await supabaseAdmin
      .from('rate_limits')
      .insert({ ip: sessionId, endpoint, created_at: now.toISOString() })

    if (insertError) {
      return { allowed: false, retryAfter: retryAfterSeconds(EVENT_RATE_LIMITS.windowMs) }
    }

    const { count, error } = await supabaseAdmin
      .from('rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('ip', sessionId)
      .eq('endpoint', endpoint)
      .gte('created_at', windowStart.toISOString())
      .lte('created_at', now.toISOString())

    if (error || count === null) {
      return { allowed: false, retryAfter: retryAfterSeconds(EVENT_RATE_LIMITS.windowMs) }
    }

    if (count > EVENT_RATE_LIMITS.maxRequests) {
      return { allowed: false, retryAfter: retryAfterSeconds(EVENT_RATE_LIMITS.windowMs) }
    }

    return { allowed: true }
  }

  private async checkLoginFailureBucket(params: {
    identifier: string
    endpoint: LoginFailureEndpoint
    windowMs: number
    maxFailures: number
    now: Date
  }): Promise<RateLimitResult> {
    const windowStart = new Date(params.now.getTime() - params.windowMs)
    const { count, error } = await supabaseAdmin
      .from('rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('ip', params.identifier)
      .eq('endpoint', params.endpoint)
      .gte('created_at', windowStart.toISOString())
      .lte('created_at', params.now.toISOString())

    if (error || count === null) {
      console.error('[rate-limiter] login failure count error')
      return { allowed: false, retryAfter: retryAfterSeconds(params.windowMs) }
    }

    if (count >= params.maxFailures) {
      return { allowed: false, retryAfter: retryAfterSeconds(params.windowMs) }
    }

    return { allowed: true }
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
