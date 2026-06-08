import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@/app/lib/supabase'

const WINDOW_MS: Record<string, number> = {
  VERIFY_WORKINK: 60_000,
  VALIDATE: 60_000,
  GENERATE: 86_400_000,
  SCRIPT_UPLOAD: 3_600_000,
  SCRIPT_UPDATE: 3_600_000,
  SCRIPT_DELETE: 3_600_000,
  SCRIPT_LIST: 60_000,
  SCRIPT_GET: 60_000,
  SCRIPT_RAW: 60_000,
  SCRIPT_STATS: 60_000,
  DASHBOARD_SCRIPTS_LIST: 60_000,
  DASHBOARD_SCRIPTS_CREATE: 3_600_000,
  DASHBOARD_SCRIPTS_UPDATE: 3_600_000,
  DASHBOARD_SCRIPTS_DELETE: 3_600_000,
  DASHBOARD_SCRIPTS_GET: 60_000,
  DASHBOARD_ANALYTICS_OVERVIEW: 60_000,
  DASHBOARD_ANALYTICS_STATS: 60_000,
  DASHBOARD_ANALYTICS_DOWNLOADS: 60_000,
  DASHBOARD_VERSIONS_LIST: 60_000,
  DASHBOARD_VERSIONS_GET: 60_000,
  DELIVERY_SESSION: 60_000,
  DELIVERY_FETCH: 60_000,
  LOADER_BOOTSTRAP: 60_000,
}

const MAX_REQUESTS: Record<string, number> = {
  VERIFY_WORKINK: 10,
  VALIDATE: 30,
  GENERATE: 5,
  SCRIPT_UPLOAD: 30,
  SCRIPT_UPDATE: 60,
  SCRIPT_DELETE: 30,
  SCRIPT_LIST: 30,
  SCRIPT_GET: 60,
  SCRIPT_RAW: 100,
  SCRIPT_STATS: 30,
  DASHBOARD_SCRIPTS_LIST: 60,
  DASHBOARD_SCRIPTS_CREATE: 30,
  DASHBOARD_SCRIPTS_UPDATE: 60,
  DASHBOARD_SCRIPTS_DELETE: 30,
  DASHBOARD_SCRIPTS_GET: 60,
  DASHBOARD_ANALYTICS_OVERVIEW: 30,
  DASHBOARD_ANALYTICS_STATS: 30,
  DASHBOARD_ANALYTICS_DOWNLOADS: 30,
  DASHBOARD_VERSIONS_LIST: 60,
  DASHBOARD_VERSIONS_GET: 60,
  DELIVERY_SESSION: 20,
  DELIVERY_FETCH: 40,
  LOADER_BOOTSTRAP: 60,
}

export type LimitKey = keyof typeof WINDOW_MS
const LOGIN_FAILED_IP = 'LOGIN_FAILED_IP'
const LOGIN_FAILED_EMAIL = 'LOGIN_FAILED_EMAIL'
const LOGIN_FAILED_IP_WINDOW_MS = 5 * 60 * 1000
const LOGIN_FAILED_EMAIL_WINDOW_MS = 15 * 60 * 1000
const LOGIN_FAILED_IP_MAX = 5
const LOGIN_FAILED_EMAIL_MAX = 10

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

export async function checkLoginFailureLimit(
  ip: string,
  email: unknown
): Promise<LoginFailureLimitResult> {
  const now = new Date()
  const ipLimit = await checkLoginFailureBucket({
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

  return checkLoginFailureBucket({
    identifier: emailIdentifier,
    endpoint: LOGIN_FAILED_EMAIL,
    windowMs: LOGIN_FAILED_EMAIL_WINDOW_MS,
    maxFailures: LOGIN_FAILED_EMAIL_MAX,
    now,
  })
}

export async function recordLoginFailure(ip: string, email: unknown): Promise<void> {
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
  const pepper = process.env.ANALYTICS_PEPPER || 'dev-pepper'
  const hash = createHash('sha256')
    .update(`${normalizedEmail}:${pepper}`)
    .digest('hex')

  return `email:${hash}`
}
