import { parseRateLimitRuntimeConfig, type RateLimitRuntimeMode } from './config'
import type { RateLimitComparisonResult } from './types'

export type RateLimitParityMetric = {
  total: number
  identical: number
  rate: number
}

export type RateLimitShadowMetricsSnapshot = {
  totalComparisons: number
  identical: number
  mismatches: number
  mismatchRate: number
  backendFailures: number
  authoritativeBackendFailures: number
  comparisonFailures: number
  avgPostgresLatencyMs: number | null
  avgValkeyLatencyMs: number | null
  avgLatencyDeltaMs: number
  decisionParity: {
    allow: RateLimitParityMetric
    deny: RateLimitParityMetric
  }
  retryAfterParity: RateLimitParityMetric
  lastUpdatedAt: string | null
  runtimeMode: RateLimitRuntimeMode
  canaryRequests: number
  postgresRequests: number
  valkeyRequests: number
  fallbackCount: number
  canaryPercentage: number
}

export type RateLimitRolloutMetricsSnapshot = {
  mode: RateLimitRuntimeMode
  canaryPercentage: number
  canaryRequests: number
  postgresRequests: number
  valkeyRequests: number
  fallbackCount: number
  postgresAuthoritativeWrites: number
  valkeyAuthoritativeWrites: number
}

export type RateLimitShadowHealthStatus = 'disabled' | 'healthy' | 'degraded' | 'unhealthy'

export type RateLimitShadowHealth = {
  enabled: boolean
  runtimeMode: RateLimitRuntimeMode
  totalComparisons: number
  mismatchRate: number
  backendFailures: number
  status: RateLimitShadowHealthStatus
  checkedAt: string
}

export type RateLimitShadowOperationalSnapshot = {
  runtimeMode: RateLimitRuntimeMode
  comparisons: number
  parityRate: number
  backendFailures: number
  comparisonFailures: number
  averageLatencyDeltaMs: number
  status: RateLimitShadowHealthStatus
  summary: string
}

export type RateLimitShadowAlertThresholds = {
  mismatchRate: number
  backendFailures: number
  latencyDeltaMs: number
  comparisonFailures: number
}

type MutableParityMetric = Omit<RateLimitParityMetric, 'rate'>

type MutableRateLimitShadowMetrics = {
  totalComparisons: number
  identical: number
  mismatches: number
  backendFailures: number
  authoritativeBackendFailures: number
  comparisonFailures: number
  totalPostgresLatencyMs: number
  postgresLatencyCount: number
  totalValkeyLatencyMs: number
  valkeyLatencyCount: number
  totalLatencyDeltaMs: number
  decisionParity: {
    allow: MutableParityMetric
    deny: MutableParityMetric
  }
  retryAfterParity: MutableParityMetric
  lastUpdatedAt: string | null
  canaryRequests: number
  postgresRequests: number
  valkeyRequests: number
  fallbackCount: number
}

export const DEFAULT_RATE_LIMIT_SHADOW_ALERT_THRESHOLDS: RateLimitShadowAlertThresholds = {
  mismatchRate: 0.001,
  backendFailures: 1,
  latencyDeltaMs: 25,
  comparisonFailures: 1,
}

function createEmptyMetrics(): MutableRateLimitShadowMetrics {
  return {
    totalComparisons: 0,
    identical: 0,
    mismatches: 0,
    backendFailures: 0,
    authoritativeBackendFailures: 0,
    comparisonFailures: 0,
    totalPostgresLatencyMs: 0,
    postgresLatencyCount: 0,
    totalValkeyLatencyMs: 0,
    valkeyLatencyCount: 0,
    totalLatencyDeltaMs: 0,
    decisionParity: {
      allow: { total: 0, identical: 0 },
      deny: { total: 0, identical: 0 },
    },
    retryAfterParity: { total: 0, identical: 0 },
    lastUpdatedAt: null,
    canaryRequests: 0,
    postgresRequests: 0,
    valkeyRequests: 0,
    fallbackCount: 0,
  }
}

function metricRate(metric: MutableParityMetric): RateLimitParityMetric {
  return {
    total: metric.total,
    identical: metric.identical,
    rate: metric.total === 0 ? 0 : metric.identical / metric.total,
  }
}

function latencyDeltaMs(comparison: RateLimitComparisonResult): number {
  return comparison.shadowLatencyMs - comparison.authoritativeLatencyMs
}

function getRuntimeConfig(env: Record<string, string | undefined>) {
  return parseRateLimitRuntimeConfig(env)
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(4)}%`
}

function formatLatency(value: number): string {
  return `${value.toFixed(2)} ms`
}

function formatNullableLatency(value: number | null): string {
  return value == null ? 'unavailable' : formatLatency(value)
}

function statusLabel(status: RateLimitShadowHealthStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export class RateLimitShadowMetricsService {
  private metrics = createEmptyMetrics()

  increment(comparison: RateLimitComparisonResult): void {
    try {
      this.metrics.totalComparisons += 1
      this.metrics.totalLatencyDeltaMs += latencyDeltaMs(comparison)
      this.recordBackendLatency(comparison.authoritativeBackend, comparison.authoritativeLatencyMs)
      this.recordBackendLatency(comparison.shadowBackend, comparison.shadowLatencyMs)
      this.metrics.lastUpdatedAt = new Date().toISOString()

      if (comparison.parity) {
        this.metrics.identical += 1
      } else {
        this.metrics.mismatches += 1
      }

      if (comparison.authoritativeError || comparison.shadowError) {
        this.metrics.backendFailures += 1
      }

      if (comparison.authoritativeError) {
        this.metrics.authoritativeBackendFailures += 1
      }

      if (comparison.mismatchReason === 'comparison_failed') {
        this.metrics.comparisonFailures += 1
      }

      if (comparison.authoritativeAllowed === true) {
        this.metrics.decisionParity.allow.total += 1
        if (comparison.shadowAllowed === true) {
          this.metrics.decisionParity.allow.identical += 1
        }
      }

      if (comparison.authoritativeAllowed === false) {
        this.metrics.decisionParity.deny.total += 1
        if (comparison.shadowAllowed === false) {
          this.metrics.decisionParity.deny.identical += 1
        }
      }

      if (comparison.authoritativeRetryAfter !== null) {
        this.metrics.retryAfterParity.total += 1
        if (comparison.authoritativeRetryAfter === comparison.shadowRetryAfter) {
          this.metrics.retryAfterParity.identical += 1
        }
      }
    } catch {
      // Metrics collection must never affect request success.
    }
  }

  merge(snapshot: RateLimitShadowMetricsSnapshot): void {
    try {
      this.metrics.totalComparisons += snapshot.totalComparisons
      this.metrics.identical += snapshot.identical
      this.metrics.mismatches += snapshot.mismatches
      this.metrics.backendFailures += snapshot.backendFailures
      this.metrics.authoritativeBackendFailures += snapshot.authoritativeBackendFailures ?? 0
      this.metrics.comparisonFailures += snapshot.comparisonFailures
      this.metrics.totalLatencyDeltaMs += snapshot.avgLatencyDeltaMs * snapshot.totalComparisons
      if (snapshot.avgPostgresLatencyMs != null) {
        this.metrics.totalPostgresLatencyMs += snapshot.avgPostgresLatencyMs * snapshot.totalComparisons
        this.metrics.postgresLatencyCount += snapshot.totalComparisons
      }
      if (snapshot.avgValkeyLatencyMs != null) {
        this.metrics.totalValkeyLatencyMs += snapshot.avgValkeyLatencyMs * snapshot.totalComparisons
        this.metrics.valkeyLatencyCount += snapshot.totalComparisons
      }
      this.metrics.decisionParity.allow.total += snapshot.decisionParity.allow.total
      this.metrics.decisionParity.allow.identical += snapshot.decisionParity.allow.identical
      this.metrics.decisionParity.deny.total += snapshot.decisionParity.deny.total
      this.metrics.decisionParity.deny.identical += snapshot.decisionParity.deny.identical
      this.metrics.retryAfterParity.total += snapshot.retryAfterParity.total
      this.metrics.retryAfterParity.identical += snapshot.retryAfterParity.identical

      if (snapshot.lastUpdatedAt) {
        this.metrics.lastUpdatedAt = this.metrics.lastUpdatedAt
          ? new Date(Math.max(
            Date.parse(this.metrics.lastUpdatedAt),
            Date.parse(snapshot.lastUpdatedAt)
          )).toISOString()
          : snapshot.lastUpdatedAt
      }
    } catch {
      // Metrics merge must never affect request success.
    }
  }

  reset(): void {
    this.metrics = createEmptyMetrics()
  }

  recordRolloutRequest(backend: 'postgres' | 'valkey', fallback = false): void {
    try {
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
    } catch {
      // Rollout metrics must never affect request handling.
    }
  }

  snapshot(env: Record<string, string | undefined> = process.env): RateLimitShadowMetricsSnapshot {
    const totalComparisons = this.metrics.totalComparisons
    const runtimeConfig = getRuntimeConfig(env)

    return {
      totalComparisons,
      identical: this.metrics.identical,
      mismatches: this.metrics.mismatches,
      mismatchRate: totalComparisons === 0 ? 0 : this.metrics.mismatches / totalComparisons,
      backendFailures: this.metrics.backendFailures,
      authoritativeBackendFailures: this.metrics.authoritativeBackendFailures,
      comparisonFailures: this.metrics.comparisonFailures,
      avgPostgresLatencyMs: this.metrics.postgresLatencyCount === 0
        ? null
        : this.metrics.totalPostgresLatencyMs / this.metrics.postgresLatencyCount,
      avgValkeyLatencyMs: this.metrics.valkeyLatencyCount === 0
        ? null
        : this.metrics.totalValkeyLatencyMs / this.metrics.valkeyLatencyCount,
      avgLatencyDeltaMs: totalComparisons === 0
        ? 0
        : this.metrics.totalLatencyDeltaMs / totalComparisons,
      decisionParity: {
        allow: metricRate(this.metrics.decisionParity.allow),
        deny: metricRate(this.metrics.decisionParity.deny),
      },
      retryAfterParity: metricRate(this.metrics.retryAfterParity),
      lastUpdatedAt: this.metrics.lastUpdatedAt,
      runtimeMode: runtimeConfig.mode,
      canaryRequests: this.metrics.canaryRequests,
      postgresRequests: this.metrics.postgresRequests,
      valkeyRequests: this.metrics.valkeyRequests,
      fallbackCount: this.metrics.fallbackCount,
      canaryPercentage: runtimeConfig.canaryPercentage,
    }
  }

  health(env: Record<string, string | undefined> = process.env): RateLimitShadowHealth {
    const checkedAt = new Date().toISOString()
    const snapshot = this.snapshot(env)
    const enabled = snapshot.runtimeMode === 'shadow'

    return {
      enabled,
      runtimeMode: snapshot.runtimeMode,
      totalComparisons: snapshot.totalComparisons,
      mismatchRate: snapshot.mismatchRate,
      backendFailures: snapshot.backendFailures,
      status: this.resolveHealthStatus(snapshot, enabled),
      checkedAt,
    }
  }

  operationalSnapshot(
    env: Record<string, string | undefined> = process.env
  ): RateLimitShadowOperationalSnapshot {
    const snapshot = this.snapshot(env)
    const health = this.health(env)
    const parityRate = snapshot.totalComparisons === 0
      ? 0
      : snapshot.identical / snapshot.totalComparisons

    const summary = [
      `Runtime Mode: ${snapshot.runtimeMode}`,
      `Comparisons: ${formatNumber(snapshot.totalComparisons)}`,
      `Parity: ${formatPercent(parityRate)}`,
      `Backend Failures: ${formatNumber(snapshot.backendFailures)}`,
      `Comparison Failures: ${formatNumber(snapshot.comparisonFailures)}`,
      `Latency: Postgres ${formatNullableLatency(snapshot.avgPostgresLatencyMs)}, Valkey ${formatNullableLatency(snapshot.avgValkeyLatencyMs)}, Delta ${formatLatency(snapshot.avgLatencyDeltaMs)}`,
      `Status: ${statusLabel(health.status)}`,
    ].join('\n')

    return {
      runtimeMode: snapshot.runtimeMode,
      comparisons: snapshot.totalComparisons,
      parityRate,
      backendFailures: snapshot.backendFailures,
      comparisonFailures: snapshot.comparisonFailures,
      averageLatencyDeltaMs: snapshot.avgLatencyDeltaMs,
      status: health.status,
      summary,
    }
  }

  rolloutSnapshot(env: Record<string, string | undefined> = process.env): RateLimitRolloutMetricsSnapshot {
    const snapshot = this.snapshot(env)

    return {
      mode: snapshot.runtimeMode,
      canaryPercentage: snapshot.canaryPercentage,
      canaryRequests: snapshot.canaryRequests,
      postgresRequests: snapshot.postgresRequests,
      valkeyRequests: snapshot.valkeyRequests,
      fallbackCount: snapshot.fallbackCount,
      postgresAuthoritativeWrites: snapshot.postgresRequests,
      valkeyAuthoritativeWrites: snapshot.valkeyRequests,
    }
  }

  private recordBackendLatency(backend: RateLimitComparisonResult['authoritativeBackend'], latencyMs: number): void {
    if (backend === 'postgres') {
      this.metrics.totalPostgresLatencyMs += latencyMs
      this.metrics.postgresLatencyCount += 1
      return
    }

    if (backend === 'valkey') {
      this.metrics.totalValkeyLatencyMs += latencyMs
      this.metrics.valkeyLatencyCount += 1
    }
  }

  private resolveHealthStatus(
    snapshot: RateLimitShadowMetricsSnapshot,
    enabled: boolean
  ): RateLimitShadowHealthStatus {
    if (!enabled) {
      return 'disabled'
    }

    if (snapshot.authoritativeBackendFailures > 0) {
      return 'unhealthy'
    }

    if (
      snapshot.backendFailures >= DEFAULT_RATE_LIMIT_SHADOW_ALERT_THRESHOLDS.backendFailures ||
      snapshot.comparisonFailures >= DEFAULT_RATE_LIMIT_SHADOW_ALERT_THRESHOLDS.comparisonFailures ||
      snapshot.mismatchRate > DEFAULT_RATE_LIMIT_SHADOW_ALERT_THRESHOLDS.mismatchRate
    ) {
      return 'degraded'
    }

    return 'healthy'
  }
}

const rateLimitShadowMetricsService = new RateLimitShadowMetricsService()

export function getRateLimitShadowMetricsService(): RateLimitShadowMetricsService {
  return rateLimitShadowMetricsService
}

export function getRateLimitShadowMetrics(
  env: Record<string, string | undefined> = process.env
): RateLimitShadowMetricsSnapshot {
  return rateLimitShadowMetricsService.snapshot(env)
}

export function getRateLimitShadowParityReport(
  env: Record<string, string | undefined> = process.env
): RateLimitShadowMetricsSnapshot {
  return rateLimitShadowMetricsService.snapshot(env)
}

export function getRateLimitShadowHealth(
  env: Record<string, string | undefined> = process.env
): RateLimitShadowHealth {
  return rateLimitShadowMetricsService.health(env)
}

export function getRateLimitShadowOperationalSnapshot(
  env: Record<string, string | undefined> = process.env
): RateLimitShadowOperationalSnapshot {
  return rateLimitShadowMetricsService.operationalSnapshot(env)
}

export function getRateLimitRolloutMetrics(
  env: Record<string, string | undefined> = process.env
): RateLimitRolloutMetricsSnapshot {
  return rateLimitShadowMetricsService.rolloutSnapshot(env)
}

export function recordRateLimitRolloutRequest(
  backend: 'postgres' | 'valkey',
  fallback = false
): void {
  rateLimitShadowMetricsService.recordRolloutRequest(backend, fallback)
}

export function resetRateLimitShadowMetricsForTests(): void {
  rateLimitShadowMetricsService.reset()
}
