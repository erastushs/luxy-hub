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
  const cloudflareIp = headers.get('cf-connecting-ip')?.trim()
  if (cloudflareIp) return cloudflareIp

  const vercelForwardedIp = headers
    .get('x-vercel-forwarded-for')
    ?.split(',')
    .map((s) => s.trim())
    .find(Boolean)
  if (vercelForwardedIp) return vercelForwardedIp

  const forwardedIp = headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((s) => s.trim())
    .find(Boolean)
  if (forwardedIp) return forwardedIp

  const realIp = headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

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
export { selectCanaryBackend, stableCanaryBucket } from './canary-adapter'
export {
  getRateLimitShadowHealth,
  getRateLimitShadowMetrics,
  getRateLimitShadowOperationalSnapshot,
  getRateLimitShadowParityReport,
  getRateLimitRolloutMetrics,
} from './metrics-service'
