import { supabase } from './supabase'

const WINDOW_MS = {
  VERIFY_WORKINK: 60_000,
  VALIDATE: 60_000,
  GENERATE: 86_400_000,
}

const MAX_REQUESTS = {
  VERIFY_WORKINK: 10,
  VALIDATE: 30,
  GENERATE: 5,
}

type LimitKey = keyof typeof WINDOW_MS

export async function checkRateLimit(ip: string, limitKey: LimitKey) {
  const windowMs = WINDOW_MS[limitKey]
  const maxRequests = MAX_REQUESTS[limitKey]
  const now = new Date()
  const windowStart = new Date(now.getTime() - windowMs)

  const { data: recentRequests, error } = await supabase
    .from('rate_limits')
    .select('id')
    .eq('ip', ip)
    .eq('endpoint', limitKey)
    .gte('created_at', windowStart.toISOString())
    .lte('created_at', now.toISOString())

  if (error) {
    console.error('Rate limit check error:', error)
    return { allowed: false, retryAfter: Math.ceil(windowMs / 1000) }
  }

  if (recentRequests && recentRequests.length >= maxRequests) {
    return { allowed: false, retryAfter: Math.ceil(windowMs / 1000) }
  }

  await supabase.from('rate_limits').insert({
    ip,
    endpoint: limitKey,
    created_at: now.toISOString(),
  })

  return { allowed: true }
}

export function getClientIP(request: Request): string {
  const clientIp = request.headers.get('x-client-ip')
  if (clientIp) {
    return clientIp.trim()
  }
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }
  return '127.0.0.1'
}
