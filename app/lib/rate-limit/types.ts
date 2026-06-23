import type { LimitKey } from './config'

export type { LimitKey, RateLimitRuntimeMode } from './config'
export type RateLimitBackend = 'postgres' | 'valkey'
export type LoginFailureEndpoint = 'LOGIN_FAILED_IP' | 'LOGIN_FAILED_EMAIL'

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfter: number }

export type RateLimitAdapter = {
  checkGeneralLimit(ip: string, limitKey: LimitKey): Promise<RateLimitResult>
  checkLoginFailure(ip: string, email: unknown): Promise<RateLimitResult>
  recordLoginFailure(ip: string, email: unknown): Promise<void>
  clearLoginFailures(ip: string, email: unknown): Promise<void>
  checkEventLimit(sessionId: string): Promise<RateLimitResult>
}

export type RateLimitMismatchReason =
  | 'decision_mismatch'
  | 'retry_after_mismatch'
  | 'window_mismatch'
  | 'bucket_mismatch'
  | 'error_state_mismatch'
  | 'comparison_failed'

export type RateLimitExecutionError = {
  name: string
  message: string
}

export type RateLimitExecutionResult = {
  backend: RateLimitBackend
  result: RateLimitResult | null
  latencyMs: number
  error: RateLimitExecutionError | null
}

export type RateLimitComparisonResult = {
  bucket: string
  limitKey: string | null
  windowMs: number | null
  authoritativeBackend: RateLimitBackend
  shadowBackend: RateLimitBackend
  authoritativeAllowed: boolean | null
  shadowAllowed: boolean | null
  authoritativeRetryAfter: number | null
  shadowRetryAfter: number | null
  authoritativeLatencyMs: number
  shadowLatencyMs: number
  authoritativeError: RateLimitExecutionError | null
  shadowError: RateLimitExecutionError | null
  parity: boolean
  mismatchReason: RateLimitMismatchReason | null
  executedAt: string
}

export type RateLimitComparison = RateLimitComparisonResult

export type RateLimitShadowMetrics = {
  totalComparisons: number
  identical: number
  mismatches: number
  mismatchRate: number
  backendFailures: number
  avgLatencyDeltaMs: number
  decisionParity: {
    allow: RateLimitParityMetric
    deny: RateLimitParityMetric
  }
  retryAfterParity: RateLimitParityMetric
}

export type RateLimitParityMetric = {
  total: number
  identical: number
  rate: number
}

export type RateLimitShadowParityReport = RateLimitShadowMetrics
