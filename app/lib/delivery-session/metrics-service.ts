import { parseDeliverySessionRuntimeConfig } from './config'
import type {
  DeliverySessionBackend,
  DeliverySessionRolloutMetricsSnapshot,
  DeliveryComparisonOperation,
  ComparisonBreakdown,
} from './types'

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
  comparisonFailures: number
  totalComparisons: number
  identicalComparisons: number
  totalValkeyLatencyMs: number
  valkeyLatencyCount: number
  totalPostgresLatencyMs: number
  postgresLatencyCount: number
  activeSessions: number
  estimatedMemoryBytes: number
  estimatedAverageSessionSize: number
  comparisonBreakdown: Record<DeliveryComparisonOperation, MutableComparisonBreakdownEntry>
}

type MutableComparisonBreakdownEntry = {
  total: number
  identical: number
  mismatches: number
}

function createEmptyBreakdownEntry(): MutableComparisonBreakdownEntry {
  return { total: 0, identical: 0, mismatches: 0 }
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
    comparisonFailures: 0,
    totalComparisons: 0,
    identicalComparisons: 0,
    totalValkeyLatencyMs: 0,
    valkeyLatencyCount: 0,
    totalPostgresLatencyMs: 0,
    postgresLatencyCount: 0,
    activeSessions: 0,
    estimatedMemoryBytes: 0,
    estimatedAverageSessionSize: 0,
    comparisonBreakdown: {
      create: createEmptyBreakdownEntry(),
      lookup: createEmptyBreakdownEntry(),
      consume: createEmptyBreakdownEntry(),
    },
  }
}

export class DeliverySessionMetricsService {
  private metrics = createEmptyMetrics()

  incrementCreated(): void {
    this.metrics.activeSessions += 1
    this.metrics.createdSessions += 1
    this.estimateMemory()
  }

  incrementConsumed(): void {
    this.metrics.activeSessions = Math.max(0, this.metrics.activeSessions - 1)
    this.metrics.consumedSessions += 1
    this.estimateMemory()
  }

  incrementExpired(): void {
    this.metrics.activeSessions = Math.max(0, this.metrics.activeSessions - 1)
    this.metrics.expiredSessions += 1
    this.estimateMemory()
  }

  incrementLookupFailure(): void {
    this.metrics.lookupFailures += 1
  }

  incrementBackendFailure(): void {
    this.metrics.backendFailures += 1
  }

  recordComparison(params: {
    operation: DeliveryComparisonOperation
    identical: boolean
  }): void {
    this.metrics.totalComparisons += 1
    if (params.identical) {
      this.metrics.identicalComparisons += 1
    } else {
      this.metrics.comparisonFailures += 1
    }

    const entry = this.metrics.comparisonBreakdown[params.operation]
    if (entry) {
      entry.total += 1
      if (params.identical) {
        entry.identical += 1
      } else {
        entry.mismatches += 1
      }
    }
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
    const totalComparisons = this.metrics.totalComparisons
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
      comparisonFailures: this.metrics.comparisonFailures,
      totalComparisons,
      identicalComparisons: this.metrics.identicalComparisons,
      mismatches: totalComparisons - this.metrics.identicalComparisons,
      parity: totalComparisons === 0 ? null : this.metrics.identicalComparisons / totalComparisons,
      mismatchRate: totalComparisons === 0 ? 0 : (totalComparisons - this.metrics.identicalComparisons) / totalComparisons,
      avgValkeyLatencyMs: this.metrics.valkeyLatencyCount === 0
        ? null
        : this.metrics.totalValkeyLatencyMs / this.metrics.valkeyLatencyCount,
      avgPostgresLatencyMs: this.metrics.postgresLatencyCount === 0
        ? null
        : this.metrics.totalPostgresLatencyMs / this.metrics.postgresLatencyCount,
      deltaAverageMs: this.metrics.valkeyLatencyCount === 0 || this.metrics.postgresLatencyCount === 0
        ? 0
        : (this.metrics.totalValkeyLatencyMs / this.metrics.valkeyLatencyCount)
        - (this.metrics.totalPostgresLatencyMs / this.metrics.postgresLatencyCount),
      activeSessions: this.metrics.activeSessions,
      estimatedMemoryBytes: this.metrics.estimatedMemoryBytes,
      estimatedAverageSessionSize: this.metrics.estimatedAverageSessionSize,
      comparisonBreakdown: buildComparisonBreakdown(this.metrics.comparisonBreakdown),
    }
  }

  reset(): void {
    this.metrics = createEmptyMetrics()
  }

  private estimateMemory(): void {
    const avgSerializedSize = 320
    this.metrics.estimatedAverageSessionSize = avgSerializedSize
    this.metrics.estimatedMemoryBytes = this.metrics.activeSessions * avgSerializedSize
  }
}

function buildComparisonBreakdown(
  raw: Record<DeliveryComparisonOperation, MutableComparisonBreakdownEntry>
): ComparisonBreakdown {
  const result: ComparisonBreakdown = {}
  for (const op of ['create', 'lookup', 'consume'] as const) {
    const entry = raw[op]
    if (!entry || entry.total === 0) continue
    result[op] = {
      total: entry.total,
      identical: entry.identical,
      mismatches: entry.mismatches,
      parity: entry.total === 0 ? null : entry.identical / entry.total,
    }
  }
  return result
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
