export const LIMIT_KEYS = [
  'VERIFY_WORKINK',
  'VALIDATE',
  'GENERATE',
  'SCRIPT_UPLOAD',
  'SCRIPT_UPDATE',
  'SCRIPT_DELETE',
  'SCRIPT_LIST',
  'SCRIPT_GET',
  'SCRIPT_RAW',
  'SCRIPT_STATS',
  'DASHBOARD_SCRIPTS_LIST',
  'DASHBOARD_SCRIPTS_CREATE',
  'DASHBOARD_SCRIPTS_UPDATE',
  'DASHBOARD_SCRIPTS_DELETE',
  'DASHBOARD_SCRIPTS_GET',
  'DASHBOARD_ANALYTICS_OVERVIEW',
  'DASHBOARD_ANALYTICS_STATS',
  'DASHBOARD_ANALYTICS_DOWNLOADS',
  'DASHBOARD_VERSIONS_LIST',
  'DASHBOARD_VERSIONS_GET',
  'DELIVERY_SESSION',
  'DELIVERY_FETCH',
  'LOADER_BOOTSTRAP',
] as const

export type LimitKey = (typeof LIMIT_KEYS)[number]

export const WINDOW_MS: Record<LimitKey, number> = {
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

export const MAX_REQUESTS: Record<LimitKey, number> = {
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

export const LOGIN_FAILED_IP = 'LOGIN_FAILED_IP'
export const LOGIN_FAILED_EMAIL = 'LOGIN_FAILED_EMAIL'

export const LOGIN_FAILURE_WINDOWS = {
  ip: {
    endpoint: LOGIN_FAILED_IP,
    windowMs: 5 * 60 * 1000,
    maxFailures: 5,
  },
  email: {
    endpoint: LOGIN_FAILED_EMAIL,
    windowMs: 15 * 60 * 1000,
    maxFailures: 10,
  },
} as const

export const EVENT_RATE_LIMITS = {
  windowMs: 60_000,
  maxRequests: 10,
} as const

export const RATE_LIMIT_RUNTIME_MODES = [
  'postgres',
  'shadow',
  'dual_write',
  'valkey_canary',
  'valkey',
] as const

export type RateLimitRuntimeMode = (typeof RATE_LIMIT_RUNTIME_MODES)[number]

export type RateLimitRuntimeConfig = {
  requestedMode: string | null
  mode: RateLimitRuntimeMode
  invalidMode: string | null
  canaryPercentage: number
}

export function retryAfterSeconds(windowMs: number): number {
  return Math.ceil(windowMs / 1000)
}

export function parseRateLimitRuntimeConfig(
  env: Record<string, string | undefined> = process.env
): RateLimitRuntimeConfig {
  const requestedMode = env.RATE_LIMIT_MODE?.trim() || null
  const canaryPercentage = parseCanaryPercentage(env.RATE_LIMIT_CANARY_PERCENT)

  if (!requestedMode) {
    return { requestedMode: null, mode: 'postgres', invalidMode: null, canaryPercentage }
  }

  const normalizedMode = requestedMode.toLowerCase()

  if (RATE_LIMIT_RUNTIME_MODES.includes(normalizedMode as RateLimitRuntimeMode)) {
    return {
      requestedMode,
      mode: normalizedMode as RateLimitRuntimeMode,
      invalidMode: null,
      canaryPercentage,
    }
  }

  return { requestedMode, mode: 'postgres', invalidMode: requestedMode, canaryPercentage }
}

function parseCanaryPercentage(rawValue: string | undefined): number {
  if (!rawValue?.trim()) {
    return 0
  }

  const parsed = Number(rawValue)

  if (!Number.isFinite(parsed)) {
    return 0
  }

  return Math.min(100, Math.max(0, Math.floor(parsed)))
}
