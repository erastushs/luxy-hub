import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@/app/lib/supabase'
import { getAnalyticsPepper } from '@/app/config/env'
import { rateLimitConfig, type RateLimitKey } from '@/app/config/rate-limits'

export type LimitKey = RateLimitKey
const LOGIN_FAILED_IP: 'LOGIN_FAILED_IP' = rateLimitConfig.loginFailure.ipEndpoint
const LOGIN_FAILED_EMAIL: 'LOGIN_FAILED_EMAIL' = rateLimitConfig.loginFailure.emailEndpoint

type LoginFailureEndpoint = typeof LOGIN_FAILED_IP | typeof LOGIN_FAILED_EMAIL
type LoginFailureLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfter: number }

export function getClientIP(request: Request): string {
  return getClientIPFromHeaders(request.headers)
}

export function getClientIPFromHeaders(headers: Headers): string {
  if (headers.has('x-vercel-forwarded-for')) {
    return headers.get('x-vercel-forwarded-for')!.trim()
  }

  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const ips = forwarded.split(',').map((s) => s.trim())
    const ip = ips[ips.length - 1]
    if (ip) return ip
  }

  const realIp = headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  return '127.0.0.1'
}

export async function checkRateLimit(ip: string, limitKey: LimitKey) {
  const windowMs = rateLimitConfig.windowsMs[limitKey]
  const maxRequests = rateLimitConfig.maxRequests[limitKey]
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

export async function checkLoginFailureLimit(
  ip: string,
  email: unknown
): Promise<LoginFailureLimitResult> {
  const now = new Date()
  const ipLimit = await checkLoginFailureBucket({
    identifier: ip,
    endpoint: LOGIN_FAILED_IP,
    windowMs: rateLimitConfig.loginFailure.ipWindowMs,
    maxFailures: rateLimitConfig.loginFailure.ipMaxFailures,
    now,
  })

  if (!ipLimit.allowed) {
    return ipLimit
  }

  const emailIdentifier = getLoginEmailIdentifier(email)
  if (!emailIdentifier) {
    return { allowed: true }
  }

  return checkLoginFailureBucket({
    identifier: emailIdentifier,
    endpoint: LOGIN_FAILED_EMAIL,
    windowMs: rateLimitConfig.loginFailure.emailWindowMs,
    maxFailures: rateLimitConfig.loginFailure.emailMaxFailures,
    now,
  })
}

export async function recordLoginFailure(ip: string, email: unknown): Promise<void> {
  const now = new Date().toISOString()
  const rows: { ip: string; endpoint: string; created_at: string }[] = [
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

export async function clearLoginFailures(ip: string, email: unknown): Promise<void> {
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

async function checkLoginFailureBucket(params: {
  identifier: string
  endpoint: LoginFailureEndpoint
  windowMs: number
  maxFailures: number
  now: Date
}): Promise<LoginFailureLimitResult> {
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

function getLoginEmailIdentifier(email: unknown): string | null {
  if (typeof email !== 'string' || email.trim().length === 0) {
    return null
  }

  const normalizedEmail = email.trim().toLowerCase()
  const pepper = getAnalyticsPepper()
  const hash = createHash('sha256')
    .update(`${normalizedEmail}:${pepper}`)
    .digest('hex')

  return `email:${hash}`
}
