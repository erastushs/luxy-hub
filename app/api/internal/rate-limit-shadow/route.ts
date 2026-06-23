import { NextResponse } from 'next/server'
import { AuthError, requireRole } from '@/app/lib/auth/session-auth'
import {
  getRateLimitShadowHealth,
  getRateLimitShadowMetrics,
  getRateLimitShadowOperationalSnapshot,
  getRateLimitShadowParityReport,
} from '@/app/lib/rate-limit/metrics-service'
import { checkValkeyHealth } from '@/app/lib/valkey/health'

const RUNTIME_STARTED_AT_MS = Date.now() - Math.floor(process.uptime() * 1000)

function runtimeMetadata(runtimeMode: string) {
  const uptimeSeconds = Math.max(0, Math.floor(process.uptime()))

  return {
    phase: '7D',
    release: 'RC1',
    runtimeMode,
    startedAt: new Date(RUNTIME_STARTED_AT_MS).toISOString(),
    uptimeSeconds,
  }
}

function uptimeSecondsSince(timestamp: string | null): number | null {
  if (!timestamp) {
    return null
  }

  const parsed = Date.parse(timestamp)
  return Number.isFinite(parsed) ? Math.max(0, Math.floor((Date.now() - parsed) / 1000)) : null
}

function formatLatency(value: number | null): string {
  return value == null ? 'unavailable' : `${value.toFixed(2)} ms`
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(4)}%`
}

export async function GET() {
  try {
    await requireRole('admin')

    const health = getRateLimitShadowHealth()
    const metrics = getRateLimitShadowMetrics()
    const parityReport = getRateLimitShadowParityReport()
    const operationalSnapshot = getRateLimitShadowOperationalSnapshot()
    const valkeyHealth = await checkValkeyHealth()
    const runtime = runtimeMetadata(health.runtimeMode)
    const parity = operationalSnapshot.parityRate
    const latency = {
      postgresAverageMs: metrics.avgPostgresLatencyMs,
      valkeyAverageMs: metrics.avgValkeyLatencyMs,
      deltaAverageMs: metrics.avgLatencyDeltaMs,
    }
    const valkey = {
      enabled: valkeyHealth.enabled,
      connected: valkeyHealth.connectionState === 'ready',
      status: valkeyHealth.status,
      connectionState: valkeyHealth.connectionState,
      latencyMs: valkeyHealth.latencyMs,
      memoryUsedBytes: valkeyHealth.memoryUsedBytes,
      version: valkeyHealth.version,
      uptimeSeconds: uptimeSecondsSince(valkeyHealth.connectedSince),
      checkedAt: valkeyHealth.checkedAt,
    }
    const operationalSummary = [
      `Runtime Mode: ${health.runtimeMode}`,
      `Parity: ${formatPercent(parity)}`,
      `Backend Failures: ${metrics.backendFailures}`,
      `Comparison Failures: ${metrics.comparisonFailures}`,
      `Latency: Postgres ${formatLatency(latency.postgresAverageMs)}, Valkey ${formatLatency(latency.valkeyAverageMs)}, Delta ${formatLatency(latency.deltaAverageMs)}`,
      `Valkey: ${valkey.connectionState}`,
      `Uptime: ${runtime.uptimeSeconds}s`,
      `Status: ${health.status}`,
    ].join(' | ')

    return NextResponse.json({
      enabled: health.enabled,
      runtimeMode: health.runtimeMode,
      runtime,
      health: {
        status: health.status,
        backendFailures: health.backendFailures,
        comparisonFailures: metrics.comparisonFailures,
      },
      metrics: {
        totalComparisons: metrics.totalComparisons,
        identical: metrics.identical,
        mismatches: metrics.mismatches,
        mismatchRate: metrics.mismatchRate,
        latency,
        averageLatencyDeltaMs: metrics.avgLatencyDeltaMs,
      },
      decisionParity: parityReport.decisionParity,
      retryAfterParity: parityReport.retryAfterParity,
      valkey,
      lastUpdatedAt: metrics.lastUpdatedAt,
      operationalSummary,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'rate_limit_shadow_metrics_unavailable',
        message: 'Rate-limit shadow metrics are unavailable',
      },
      { status: 503 }
    )
  }
}
