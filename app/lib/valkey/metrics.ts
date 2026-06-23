import type { ValkeyConnectionState, ValkeyMetricsSnapshot } from './types'

const metrics: ValkeyMetricsSnapshot = {
  connectionCount: 0,
  reconnectCount: 0,
  disconnectCount: 0,
  commandFailureCount: 0,
  healthFailureCount: 0,
  lastLatencyMs: null,
  maxLatencyMs: null,
  lastMemoryUsedBytes: null,
  lastConnectionState: 'disabled',
}

export function recordValkeyConnection(state: ValkeyConnectionState = 'ready'): void {
  metrics.connectionCount += 1
  metrics.lastConnectionState = state
}

export function recordValkeyReconnect(): void {
  metrics.reconnectCount += 1
  metrics.lastConnectionState = 'connecting'
}

export function recordValkeyDisconnect(): void {
  metrics.disconnectCount += 1
  metrics.lastConnectionState = 'closed'
}

export function recordValkeyCommandFailure(): void {
  metrics.commandFailureCount += 1
}

export function recordValkeyHealthFailure(): void {
  metrics.healthFailureCount += 1
}

export function recordValkeyLatency(latencyMs: number): void {
  metrics.lastLatencyMs = latencyMs
  metrics.maxLatencyMs = metrics.maxLatencyMs == null ? latencyMs : Math.max(metrics.maxLatencyMs, latencyMs)
}

export function recordValkeyMemory(memoryUsedBytes: number | null): void {
  metrics.lastMemoryUsedBytes = memoryUsedBytes
}

export function recordValkeyConnectionState(state: ValkeyConnectionState): void {
  metrics.lastConnectionState = state
}

export function getValkeyMetricsSnapshot(): ValkeyMetricsSnapshot {
  return { ...metrics }
}

export function resetValkeyMetricsForTests(): void {
  metrics.connectionCount = 0
  metrics.reconnectCount = 0
  metrics.disconnectCount = 0
  metrics.commandFailureCount = 0
  metrics.healthFailureCount = 0
  metrics.lastLatencyMs = null
  metrics.maxLatencyMs = null
  metrics.lastMemoryUsedBytes = null
  metrics.lastConnectionState = 'disabled'
}
