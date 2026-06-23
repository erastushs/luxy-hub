import type { LimitKey, RateLimitAdapter } from './types'
import { getPostgresRateLimitAdapter, resolveRateLimitAdapter } from './runtime'

let activeRateLimitAdapter: RateLimitAdapter | null = null

export function getRateLimitAdapter(): RateLimitAdapter {
  if (!activeRateLimitAdapter) {
    activeRateLimitAdapter = resolveRateLimitAdapter()
  }

  return activeRateLimitAdapter
}

export function setRateLimitAdapterForTests(adapter: RateLimitAdapter): void {
  activeRateLimitAdapter = adapter
}

export function resetRateLimitAdapterForTests(): void {
  activeRateLimitAdapter = getPostgresRateLimitAdapter()
}

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

export function checkRateLimit(ip: string, limitKey: LimitKey) {
  return getRateLimitAdapter().checkGeneralLimit(ip, limitKey)
}

export function checkLoginFailureLimit(ip: string, email: unknown) {
  return getRateLimitAdapter().checkLoginFailure(ip, email)
}

export function recordLoginFailure(ip: string, email: unknown): Promise<void> {
  return getRateLimitAdapter().recordLoginFailure(ip, email)
}

export function clearLoginFailures(ip: string, email: unknown): Promise<void> {
  return getRateLimitAdapter().clearLoginFailures(ip, email)
}

export function checkEventRateLimit(sessionId: string) {
  return getRateLimitAdapter().checkEventLimit(sessionId)
}

export type { LimitKey, RateLimitAdapter, RateLimitResult } from './types'
export { parseRateLimitRuntimeConfig } from './config'
export { resolveRateLimitAdapter } from './runtime'
