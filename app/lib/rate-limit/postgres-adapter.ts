import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@/app/lib/supabase'
import {
  EVENT_RATE_LIMIT_MAX_REQUESTS,
  EVENT_RATE_LIMIT_WINDOW_MS,
  LOGIN_FAILED_EMAIL,
  LOGIN_FAILED_EMAIL_MAX,
  LOGIN_FAILED_EMAIL_WINDOW_MS,
  LOGIN_FAILED_IP,
  LOGIN_FAILED_IP_MAX,
  LOGIN_FAILED_IP_WINDOW_MS,
  MAX_REQUESTS,
  WINDOW_MS,
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
      return { allowed: false, retryAfter: Math.ceil(windowMs / 1000) }
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
      return { allowed: false, retryAfter: Math.ceil(windowMs / 1000) }
    }

    if (count > maxRequests) {
      return { allowed: false, retryAfter: Math.ceil(windowMs / 1000) }
    }

    return { allowed: true }
  }

  async checkLoginFailure(ip: string, email: unknown): Promise<RateLimitResult> {
    const now = new Date()
    const ipLimit = await this.checkLoginFailureBucket({
      identifier: ip,
      endpoint: LOGIN_FAILED_IP,
      windowMs: LOGIN_FAILED_IP_WINDOW_MS,
      maxFailures: LOGIN_FAILED_IP_MAX,
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
      endpoint: LOGIN_FAILED_EMAIL,
      windowMs: LOGIN_FAILED_EMAIL_WINDOW_MS,
      maxFailures: LOGIN_FAILED_EMAIL_MAX,
      now,
    })
  }

  async recordLoginFailure(ip: string, email: unknown): Promise<void> {
    const now = new Date().toISOString()
    const rows = [
      {
        ip,
        endpoint: LOGIN_FAILED_IP,
        created_at: now,
      },
    ]

    const emailIdentifier = getLoginEmailIdentifier(email)
    if (emailIdentifier) {
      rows.push({
        ip: emailIdentifier,
        endpoint: LOGIN_FAILED_EMAIL,
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
      .eq('endpoint', LOGIN_FAILED_EMAIL)

    if (emailError) {
      console.error(`[rate-limiter] login email failure cleanup error: ${ip}`)
    }
  }

  async checkEventLimit(sessionId: string): Promise<RateLimitResult> {
    const endpoint = `EVENT_REPORT:${sessionId}`
    const now = new Date()
    const windowStart = new Date(now.getTime() - EVENT_RATE_LIMIT_WINDOW_MS)

    const { error: insertError } = await supabaseAdmin
      .from('rate_limits')
      .insert({ ip: sessionId, endpoint, created_at: now.toISOString() })

    if (insertError) {
      return { allowed: false, retryAfter: Math.ceil(EVENT_RATE_LIMIT_WINDOW_MS / 1000) }
    }

    const { count, error } = await supabaseAdmin
      .from('rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('ip', sessionId)
      .eq('endpoint', endpoint)
      .gte('created_at', windowStart.toISOString())
      .lte('created_at', now.toISOString())

    if (error || count === null) {
      return { allowed: false, retryAfter: Math.ceil(EVENT_RATE_LIMIT_WINDOW_MS / 1000) }
    }

    if (count > EVENT_RATE_LIMIT_MAX_REQUESTS) {
      return { allowed: false, retryAfter: Math.ceil(EVENT_RATE_LIMIT_WINDOW_MS / 1000) }
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
      return { allowed: false, retryAfter: Math.ceil(params.windowMs / 1000) }
    }

    if (count >= params.maxFailures) {
      return { allowed: false, retryAfter: Math.ceil(params.windowMs / 1000) }
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
