export type DeliverySessionData = {
  id: string
  script_id: string
  build_id: string
  session_token_hash: string
  expires_at: string
  consumed_at: string | null
  event_secret: string | null
  created_at: string
}

export type DeliverySessionBackend = 'postgres' | 'valkey'

export type DeliverySessionAdapter = {
  createSession(params: {
    scriptId: string
    buildId: string
    tokenHash: string
    expiresAt: string
    eventSecret?: string | null
  }): Promise<DeliverySessionData>

  getSessionByTokenHash(tokenHash: string): Promise<DeliverySessionData | null>

  consumeSession(sessionId: string): Promise<DeliverySessionData | null>

  deleteSession(sessionId: string): Promise<boolean>
}

export const DELIVERY_SESSION_RUNTIME_MODES = [
  'postgres',
  'shadow',
  'valkey_canary',
  'valkey',
] as const

export type DeliverySessionRuntimeMode = (typeof DELIVERY_SESSION_RUNTIME_MODES)[number]

export type DeliverySessionRuntimeConfig = {
  requestedMode: string | null
  mode: DeliverySessionRuntimeMode
  invalidMode: string | null
  canaryPercentage: number
}

export type DeliverySessionExecutionError = {
  name: string
  message: string
}

export type DeliverySessionExecutionResult = {
  backend: DeliverySessionBackend
  data: DeliverySessionData | null
  latencyMs: number
  error: DeliverySessionExecutionError | null
}

export type DeliverySessionComparisonResult = {
  operation: 'create' | 'get' | 'consume'
  authoritativeBackend: DeliverySessionBackend
  shadowBackend: DeliverySessionBackend
  authoritativeData: DeliverySessionData | null
  shadowData: DeliverySessionData | null
  authoritativeLatencyMs: number
  shadowLatencyMs: number
  authoritativeError: DeliverySessionExecutionError | null
  shadowError: DeliverySessionExecutionError | null
  parity: boolean
  mismatchReason: string | null
  executedAt: string
}

export type DeliverySessionRolloutMetricsSnapshot = {
  mode: DeliverySessionRuntimeMode
  canaryPercentage: number
  totalRequests: number
  canaryRequests: number
  postgresRequests: number
  valkeyRequests: number
  fallbackCount: number
  createdSessions: number
  consumedSessions: number
  expiredSessions: number
  lookupFailures: number
  backendFailures: number
  avgValkeyLatencyMs: number | null
  avgPostgresLatencyMs: number | null
}
