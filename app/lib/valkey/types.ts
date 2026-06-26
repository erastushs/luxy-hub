export type ValkeyConnectionState =
  | 'disabled'
  | 'idle'
  | 'connecting'
  | 'ready'
  | 'error'
  | 'closed'

export type ValkeyConfig = {
  enabled: boolean
  requestedEnabled: boolean
  host: string | null
  port: number
  password: string | null
  database: number
  tls: boolean
  connectTimeoutMs: number
  commandTimeoutMs: number
  errors: string[]
}

export type ValkeyClient = {
  isOpen?: boolean
  isReady?: boolean
  connect: () => Promise<unknown>
  quit: () => Promise<unknown>
  disconnect?: () => unknown
  ping: () => Promise<string>
  info: (section?: string) => Promise<string>
  eval?: (script: string, options: { keys: string[]; arguments: string[] }) => Promise<unknown>
  get?: (key: string) => Promise<string | null>
  set?: (key: string, value: string, options?: { PX?: number; KEEPTTL?: boolean }) => Promise<unknown>
  del?: (key: string | string[]) => Promise<number>
  on: (event: string, listener: (...args: unknown[]) => void) => unknown
  off?: (event: string, listener: (...args: unknown[]) => void) => unknown
}

export type ValkeyMetricsSnapshot = {
  connectionCount: number
  reconnectCount: number
  successfulReconnectCount: number
  failedReconnectCount: number
  disconnectCount: number
  commandFailureCount: number
  healthFailureCount: number
  lastLatencyMs: number | null
  maxLatencyMs: number | null
  lastMemoryUsedBytes: number | null
  lastConnectionState: ValkeyConnectionState
  connectedSince: string | null
  lastSuccessfulPingAt: string | null
  lastFailedHealthCheckAt: string | null
  lastReconnectAt: string | null
  lastDisconnectReason: string | null
  startupInitializationMs: number | null
  uptimeMs: number | null
  connectionDurationMs: number | null
}

export type ValkeyHealthStatus = 'disabled' | 'healthy' | 'unhealthy'

export type ValkeyHealthResult = {
  status: ValkeyHealthStatus
  enabled: boolean
  connectionState: ValkeyConnectionState
  latencyMs: number | null
  ping: 'ok' | 'failed' | 'skipped'
  version: string | null
  memoryUsedBytes: number | null
  connectedSince: string | null
  lastSuccessfulPingAt: string | null
  lastFailedHealthCheckAt: string | null
  lastReconnectAt: string | null
  totalReconnectCount: number
  errors: string[]
  checkedAt: string
}
