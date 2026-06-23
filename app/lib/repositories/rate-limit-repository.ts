export {
  checkLoginFailureLimit,
  checkRateLimit,
  clearLoginFailures,
  getClientIP,
  getClientIPFromHeaders,
  recordLoginFailure,
} from '@/app/lib/rate-limit'
export type { LimitKey, RateLimitResult } from '@/app/lib/rate-limit'
