import { logValkeyEvent } from './logger'
import {
  recordValkeyHealthFailure,
  recordValkeyLatency,
  recordValkeyMemory,
  recordValkeySuccessfulPing,
  getValkeyMetricsSnapshot,
} from './metrics'
import { getValkeyConnectionManager, type ValkeyConnectionManager } from './connection'
import type { ValkeyHealthResult } from './types'

function parseInfoValue(info: string, key: string): string | null {
  const line = info
    .split('\n')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${key}:`))

  return line ? line.slice(key.length + 1) : null
}

function parseMemoryUsed(info: string): number | null {
  const value = parseInfoValue(info, 'used_memory')
  const parsed = value == null ? Number.NaN : Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

function parseVersion(info: string): string | null {
  return parseInfoValue(info, 'valkey_version') ?? parseInfoValue(info, 'redis_version')
}

export async function checkValkeyHealth(
  manager: ValkeyConnectionManager = getValkeyConnectionManager()
): Promise<ValkeyHealthResult> {
  const checkedAt = new Date().toISOString()
  const config = manager.getConfig()
  const metrics = getValkeyMetricsSnapshot()

  if (!manager.isEnabled()) {
    return {
      status: 'disabled',
      enabled: false,
      connectionState: manager.getState(),
      latencyMs: null,
      ping: 'skipped',
      version: null,
      memoryUsedBytes: null,
      connectedSince: manager.getConnectedSince(),
      lastSuccessfulPingAt: metrics.lastSuccessfulPingAt,
      lastFailedHealthCheckAt: metrics.lastFailedHealthCheckAt,
      lastReconnectAt: manager.getLastReconnectAt() ?? metrics.lastReconnectAt,
      totalReconnectCount: metrics.reconnectCount,
      errors: config.errors,
      checkedAt,
    }
  }

  const startedAt = Date.now()

  try {
    const client = await manager.connect()

    if (!client) {
      throw new Error('Valkey client is unavailable')
    }

    const pingResponse = await client.ping()
    const serverInfo = await client.info('server')
    const memoryInfo = await client.info('memory')
    const latencyMs = Date.now() - startedAt
    const memoryUsedBytes = parseMemoryUsed(memoryInfo)

    recordValkeyLatency(latencyMs)
    recordValkeyMemory(memoryUsedBytes)
    recordValkeySuccessfulPing()
    const updatedMetrics = getValkeyMetricsSnapshot()

    return {
      status: pingResponse.toUpperCase() === 'PONG' ? 'healthy' : 'unhealthy',
      enabled: true,
      connectionState: manager.getState(),
      latencyMs,
      ping: pingResponse.toUpperCase() === 'PONG' ? 'ok' : 'failed',
      version: parseVersion(serverInfo),
      memoryUsedBytes,
      connectedSince: manager.getConnectedSince(),
      lastSuccessfulPingAt: updatedMetrics.lastSuccessfulPingAt,
      lastFailedHealthCheckAt: updatedMetrics.lastFailedHealthCheckAt,
      lastReconnectAt: manager.getLastReconnectAt() ?? updatedMetrics.lastReconnectAt,
      totalReconnectCount: updatedMetrics.reconnectCount,
      errors: pingResponse.toUpperCase() === 'PONG' ? [] : ['Valkey ping failed'],
      checkedAt,
    }
  } catch (error) {
    recordValkeyHealthFailure()
    const updatedMetrics = getValkeyMetricsSnapshot()
    logValkeyEvent('warn', 'health_failure', {
      state: manager.getState(),
      errorName: error instanceof Error ? error.name : 'UnknownError',
    })

    return {
      status: 'unhealthy',
      enabled: true,
      connectionState: manager.getState(),
      latencyMs: Date.now() - startedAt,
      ping: 'failed',
      version: null,
      memoryUsedBytes: null,
      connectedSince: manager.getConnectedSince(),
      lastSuccessfulPingAt: updatedMetrics.lastSuccessfulPingAt,
      lastFailedHealthCheckAt: updatedMetrics.lastFailedHealthCheckAt,
      lastReconnectAt: manager.getLastReconnectAt() ?? updatedMetrics.lastReconnectAt,
      totalReconnectCount: updatedMetrics.reconnectCount,
      errors: ['Valkey health check failed'],
      checkedAt,
    }
  }
}
