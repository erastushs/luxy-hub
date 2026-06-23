import type { ValkeyConnectionState, ValkeyMetricsSnapshot } from './types'

const metrics: ValkeyMetricsSnapshot = {
  connectionCount: 0,
  reconnectCount: 0,
  successfulReconnectCount: 0,
  failedReconnectCount: 0,
  disconnectCount: 0,
  commandFailureCount: 0,
  healthFailureCount: 0,
  lastLatencyMs: null,
  maxLatencyMs: null,
  lastMemoryUsedBytes: null,
  lastConnectionState: 'disabled',
  connectedSince: null,
  lastSuccessfulPingAt: null,
  lastFailedHealthCheckAt: null,
  lastReconnectAt: null,
  lastDisconnectReason: null,
  startupInitializationMs: null,
  uptimeMs: null,
  connectionDurationMs: null,
}

export function recordValkeyConnection(state: ValkeyConnectionState = 'ready'): void {
  metrics.connectionCount += 1
  metrics.lastConnectionState = state
  metrics.connectedSince = new Date().toISOString()
}

export function recordValkeyReconnect(): void {
  metrics.reconnectCount += 1
  metrics.lastConnectionState = 'connecting'
  metrics.lastReconnectAt = new Date().toISOString()
}

export function recordValkeySuccessfulReconnect(): void {
  metrics.successfulReconnectCount += 1
}

export function recordValkeyFailedReconnect(): void {
  metrics.failedReconnectCount += 1
}

export function recordValkeyDisconnect(reason: string = 'unknown'): void {
  metrics.disconnectCount += 1
  metrics.lastConnectionState = 'closed'
  metrics.lastDisconnectReason = reason

  if (metrics.connectedSince) {
    metrics.connectionDurationMs = Date.now() - Date.parse(metrics.connectedSince)
  }
}

export function recordValkeyCommandFailure(): void {
  metrics.commandFailureCount += 1
}

export function recordValkeyHealthFailure(): void {
  metrics.healthFailureCount += 1
  metrics.lastFailedHealthCheckAt = new Date().toISOString()
}

export function recordValkeyLatency(latencyMs: number): void {
  metrics.lastLatencyMs = latencyMs
  metrics.maxLatencyMs = metrics.maxLatencyMs == null ? latencyMs : Math.max(metrics.maxLatencyMs, latencyMs)
}

export function recordValkeyMemory(memoryUsedBytes: number | null): void {
  metrics.lastMemoryUsedBytes = memoryUsedBytes
}

export function recordValkeySuccessfulPing(): void {
  metrics.lastSuccessfulPingAt = new Date().toISOString()
}

export function recordValkeyStartupInitialization(latencyMs: number): void {
  metrics.startupInitializationMs = latencyMs
}

export function recordValkeyConnectionState(state: ValkeyConnectionState): void {
  metrics.lastConnectionState = state
}

export function getValkeyMetricsSnapshot(): ValkeyMetricsSnapshot {
  const uptimeMs = metrics.connectedSince ? Date.now() - Date.parse(metrics.connectedSince) : null

  return {
    ...metrics,
    uptimeMs,
    connectionDurationMs: metrics.lastConnectionState === 'ready' ? uptimeMs : metrics.connectionDurationMs,
  }
}

export function resetValkeyMetricsForTests(): void {
  metrics.connectionCount = 0
  metrics.reconnectCount = 0
  metrics.successfulReconnectCount = 0
  metrics.failedReconnectCount = 0
  metrics.disconnectCount = 0
  metrics.commandFailureCount = 0
  metrics.healthFailureCount = 0
  metrics.lastLatencyMs = null
  metrics.maxLatencyMs = null
  metrics.lastMemoryUsedBytes = null
  metrics.lastConnectionState = 'disabled'
  metrics.connectedSince = null
  metrics.lastSuccessfulPingAt = null
  metrics.lastFailedHealthCheckAt = null
  metrics.lastReconnectAt = null
  metrics.lastDisconnectReason = null
  metrics.startupInitializationMs = null
  metrics.uptimeMs = null
  metrics.connectionDurationMs = null
}
