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

export type CreateDeliverySessionParams = {
  scriptId: string
  buildId: string
  tokenHash: string
  expiresAt: string
  eventSecret?: string | null
  id?: string
}

export type DeliverySessionAdapter = {
  createSession(params: CreateDeliverySessionParams): Promise<DeliverySessionData>

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

export const DELIVERY_COMPARISON_OPERATIONS = [
  'create',
  'lookup',
  'consume',
] as const

export type DeliveryComparisonOperation = (typeof DELIVERY_COMPARISON_OPERATIONS)[number]

export type ComparisonBreakdownEntry = {
  total: number
  identical: number
  mismatches: number
  parity: number | null
}

export type ComparisonBreakdown = {
  [K in DeliveryComparisonOperation]?: ComparisonBreakdownEntry
}

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
  mismatchFields: string[]
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
  comparisonFailures: number
  totalComparisons: number
  identicalComparisons: number
  mismatches: number
  parity: number | null
  mismatchRate: number
  deltaAverageMs: number
  avgValkeyLatencyMs: number | null
  avgPostgresLatencyMs: number | null
  activeSessions: number
  estimatedMemoryBytes: number
  estimatedAverageSessionSize: number
  comparisonBreakdown: ComparisonBreakdown
}
