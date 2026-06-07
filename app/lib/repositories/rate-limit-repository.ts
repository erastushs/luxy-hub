import { supabaseAdmin } from '@/app/lib/supabase'

const WINDOW_MS: Record<string, number> = {
  VERIFY_WORKINK: 60_000,
  VALIDATE: 60_000,
  GENERATE: 86_400_000,
  SCRIPT_UPLOAD: 3_600_000,
  SCRIPT_UPDATE: 3_600_000,
  SCRIPT_LIST: 60_000,
  SCRIPT_GET: 60_000,
  SCRIPT_RAW: 60_000,
  SCRIPT_STATS: 60_000,
}

const MAX_REQUESTS: Record<string, number> = {
  VERIFY_WORKINK: 10,
  VALIDATE: 30,
  GENERATE: 5,
  SCRIPT_UPLOAD: 30,
  SCRIPT_UPDATE: 60,
  SCRIPT_LIST: 30,
  SCRIPT_GET: 60,
  SCRIPT_RAW: 100,
  SCRIPT_STATS: 30,
}

export type LimitKey = keyof typeof WINDOW_MS

export function getClientIP(request: Request): string {
  if (request.headers.has('x-vercel-forwarded-for')) {
    return request.headers.get('x-vercel-forwarded-for')!.trim()
  }

  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const ips = forwarded.split(',').map((s) => s.trim())
    const ip = ips[ips.length - 1]
    if (ip) return ip
  }

  const realIp = request.headers.get('x-real-ip')
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
