import { parseDeliverySessionRuntimeConfig } from './config'
import type { DeliverySessionBackend, DeliverySessionRolloutMetricsSnapshot } from './types'

type MutableDeliverySessionMetrics = {
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
  totalValkeyLatencyMs: number
  valkeyLatencyCount: number
  totalPostgresLatencyMs: number
  postgresLatencyCount: number
}

function createEmptyMetrics(): MutableDeliverySessionMetrics {
  return {
    totalRequests: 0,
    canaryRequests: 0,
    postgresRequests: 0,
    valkeyRequests: 0,
    fallbackCount: 0,
    createdSessions: 0,
    consumedSessions: 0,
    expiredSessions: 0,
    lookupFailures: 0,
    backendFailures: 0,
    totalValkeyLatencyMs: 0,
    valkeyLatencyCount: 0,
    totalPostgresLatencyMs: 0,
    postgresLatencyCount: 0,
  }
}

export class DeliverySessionMetricsService {
  private metrics = createEmptyMetrics()

  incrementCreated(): void {
    this.metrics.createdSessions += 1
  }

  incrementConsumed(): void {
    this.metrics.consumedSessions += 1
  }

  incrementExpired(): void {
    this.metrics.expiredSessions += 1
  }

  incrementLookupFailure(): void {
    this.metrics.lookupFailures += 1
  }

  incrementBackendFailure(): void {
    this.metrics.backendFailures += 1
  }

  recordLatency(backend: DeliverySessionBackend, latencyMs: number): void {
    if (backend === 'valkey') {
      this.metrics.totalValkeyLatencyMs += latencyMs
      this.metrics.valkeyLatencyCount += 1
    } else {
      this.metrics.totalPostgresLatencyMs += latencyMs
      this.metrics.postgresLatencyCount += 1
    }
  }

  recordRolloutRequest(backend: DeliverySessionBackend, fallback = false): void {
    this.metrics.totalRequests += 1
    if (fallback) {
      this.metrics.fallbackCount += 1
      this.metrics.postgresRequests += 1
      return
    }
    if (backend === 'postgres') {
      this.metrics.postgresRequests += 1
    } else {
      this.metrics.valkeyRequests += 1
      this.metrics.canaryRequests += 1
    }
  }

  snapshot(env: Record<string, string | undefined> = process.env): DeliverySessionRolloutMetricsSnapshot {
    const config = parseDeliverySessionRuntimeConfig(env)
    return {
      mode: config.mode,
      canaryPercentage: config.canaryPercentage,
      totalRequests: this.metrics.totalRequests,
      canaryRequests: this.metrics.canaryRequests,
      postgresRequests: this.metrics.postgresRequests,
      valkeyRequests: this.metrics.valkeyRequests,
      fallbackCount: this.metrics.fallbackCount,
      createdSessions: this.metrics.createdSessions,
      consumedSessions: this.metrics.consumedSessions,
      expiredSessions: this.metrics.expiredSessions,
      lookupFailures: this.metrics.lookupFailures,
      backendFailures: this.metrics.backendFailures,
      avgValkeyLatencyMs: this.metrics.valkeyLatencyCount === 0
        ? null
        : this.metrics.totalValkeyLatencyMs / this.metrics.valkeyLatencyCount,
      avgPostgresLatencyMs: this.metrics.postgresLatencyCount === 0
        ? null
        : this.metrics.totalPostgresLatencyMs / this.metrics.postgresLatencyCount,
    }
  }

  reset(): void {
    this.metrics = createEmptyMetrics()
  }
}

const deliverySessionMetricsService = new DeliverySessionMetricsService()

export function getDeliverySessionMetricsService(): DeliverySessionMetricsService {
  return deliverySessionMetricsService
}

export function getDeliverySessionRolloutMetrics(
  env: Record<string, string | undefined> = process.env
): DeliverySessionRolloutMetricsSnapshot {
  return deliverySessionMetricsService.snapshot(env)
}

export function resetDeliverySessionMetricsForTests(): void {
  deliverySessionMetricsService.reset()
}
