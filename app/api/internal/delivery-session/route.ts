import { NextResponse } from 'next/server'
import { MonitorAuthError, requireMonitorAuth } from '@/app/lib/monitor/auth'
import { getDeliverySessionRolloutMetrics } from '@/app/lib/delivery-session/metrics-service'
import { parseDeliverySessionRuntimeConfig } from '@/app/lib/delivery-session/config'
import { checkValkeyHealth } from '@/app/lib/valkey/health'

const RUNTIME_STARTED_AT_MS = Date.now() - Math.floor(process.uptime() * 1000)

type OperationalState = 'postgres_authoritative' | 'shadow_comparison_active' | 'valkey_canary_active' | 'valkey_authoritative'

function resolveOperationalState(mode: string): OperationalState {
  if (mode === 'shadow') return 'shadow_comparison_active'
  if (mode === 'valkey_canary') return 'valkey_canary_active'
  if (mode === 'valkey') return 'valkey_authoritative'
  return 'postgres_authoritative'
}

function uptimeSecondsSince(timestamp: string | null): number | null {
  if (!timestamp) return null
  const parsed = Date.parse(timestamp)
  return Number.isFinite(parsed) ? Math.max(0, Math.floor((Date.now() - parsed) / 1000)) : null
}

function healthStatus(params: { mode: string; backendFailures: number }): string {
  if (params.mode === 'valkey') {
    return params.backendFailures > 0 ? 'unhealthy' : 'healthy'
  }
  return params.backendFailures > 0 ? 'degraded' : 'healthy'
}

export async function GET() {
  try {
    await requireMonitorAuth()

    const config = parseDeliverySessionRuntimeConfig()
    const metrics = getDeliverySessionRolloutMetrics()
    const valkeyHealth = await checkValkeyHealth()
    const isValkeyAuthoritative = config.mode === 'valkey'
    const runtimeMode = config.mode
    const operationalState = resolveOperationalState(runtimeMode)

    const runtime = {
      phase: '8',
      milestone: '8A.1',
      release: 'Production',
      mode: runtimeMode,
      operationalState,
      startedAt: new Date(RUNTIME_STARTED_AT_MS).toISOString(),
      uptimeSeconds: Math.max(0, Math.floor(process.uptime())),
    }

    const valkey = {
      status: valkeyHealth.status,
      connectionState: valkeyHealth.connectionState,
      latencyMs: valkeyHealth.latencyMs,
      memoryUsedBytes: valkeyHealth.memoryUsedBytes,
      version: valkeyHealth.version,
      uptimeSeconds: uptimeSecondsSince(valkeyHealth.connectedSince),
      checkedAt: valkeyHealth.checkedAt,
    }

    const operationalSummary = [
      `Runtime Mode: ${runtimeMode}`,
      `Operational: ${operationalState}`,
      ...(isValkeyAuthoritative
        ? ['Comparison: disabled']
        : [
            `Parity: ${metrics.parity == null ? 'n/a' : `${(metrics.parity * 100).toFixed(4)}%`}`,
            `Comparison Failures: ${metrics.comparisonFailures}`,
          ]
      ),
      `Backend Failures: ${metrics.backendFailures}`,
      `Fallback: ${metrics.fallbackCount}`,
      ...(isValkeyAuthoritative
        ? []
        : [`Latency: Postgres ${metrics.avgPostgresLatencyMs == null ? 'n/a' : `${metrics.avgPostgresLatencyMs.toFixed(2)} ms`}, Valkey ${metrics.avgValkeyLatencyMs == null ? 'n/a' : `${metrics.avgValkeyLatencyMs.toFixed(2)} ms`}, Delta ${metrics.deltaAverageMs == null ? 'n/a' : `${metrics.deltaAverageMs.toFixed(2)} ms`}`]
      ),
      `Valkey: ${valkeyHealth.connectionState}`,
      `Status: ${healthStatus({ mode: runtimeMode, backendFailures: metrics.backendFailures })}`,
    ].join(' | ')

    return NextResponse.json({
      runtime,
      rollout: {
        configuredCanaryPercentage: metrics.canaryPercentage,
        effectiveCanaryPercentage: metrics.totalRequests === 0
          ? 0
          : (metrics.valkeyRequests / metrics.totalRequests) * 100,
        postgresRequests: metrics.postgresRequests,
        valkeyRequests: metrics.valkeyRequests,
        fallbackCount: metrics.fallbackCount,
      },
      metrics: {
        createdSessions: metrics.createdSessions,
        consumedSessions: metrics.consumedSessions,
        expiredSessions: metrics.expiredSessions,
        lookupFailures: metrics.lookupFailures,
        backendFailures: metrics.backendFailures,
        comparisonFailures: metrics.comparisonFailures,
        activeSessions: metrics.activeSessions,
        estimatedMemoryBytes: metrics.estimatedMemoryBytes,
        estimatedAverageSessionSize: metrics.estimatedAverageSessionSize,
      },
      comparison: {
        totalComparisons: metrics.totalComparisons,
        identical: metrics.identicalComparisons,
        mismatches: metrics.mismatches,
        parity: metrics.parity,
        mismatchRate: metrics.mismatchRate,
        breakdown: metrics.comparisonBreakdown,
      },
      latency: {
        postgresAverageMs: metrics.avgPostgresLatencyMs,
        valkeyAverageMs: metrics.avgValkeyLatencyMs,
        deltaAverageMs: metrics.deltaAverageMs,
      },
      valkey,
      timestamp: new Date().toISOString(),
      operationalSummary,
    })
  } catch (error) {
    if (error instanceof MonitorAuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'delivery_session_metrics_unavailable',
        message: 'Delivery session metrics are unavailable',
      },
      { status: 503 }
    )
  }
}
