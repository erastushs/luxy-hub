import { NextResponse } from 'next/server'
import { MonitorAuthError, requireMonitorAuth } from '@/app/lib/monitor/auth'
import {
  getRateLimitRolloutMetrics,
  getRateLimitShadowHealth,
  getRateLimitShadowMetrics,
  getRateLimitShadowOperationalSnapshot,
  getRateLimitShadowParityReport,
} from '@/app/lib/rate-limit/metrics-service'
import { checkValkeyHealth } from '@/app/lib/valkey/health'

const RUNTIME_STARTED_AT_MS = Date.now() - Math.floor(process.uptime() * 1000)

function optionalBuildMetadata(env: Record<string, string | undefined> = process.env) {
  const build = {
    deployment: env.VERCEL_ENV,
    commitSha: env.VERCEL_GIT_COMMIT_SHA,
    commitRef: env.VERCEL_GIT_COMMIT_REF,
  }
  const entries = Object.entries(build).filter((entry): entry is [string, string] => Boolean(entry[1]))

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function runtimeMetadata(runtimeMode: string) {
  const uptimeSeconds = Math.max(0, Math.floor(process.uptime()))
  const build = optionalBuildMetadata()

  return {
    phase: '7',
    milestone: '7E.3',
    release: 'Production',
    runtimeMode,
    startedAt: new Date(RUNTIME_STARTED_AT_MS).toISOString(),
    uptimeSeconds,
    ...(build ? { build } : {}),
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
    await requireMonitorAuth()

    const health = getRateLimitShadowHealth()
    const metrics = getRateLimitShadowMetrics()
    const parityReport = getRateLimitShadowParityReport()
    const operationalSnapshot = getRateLimitShadowOperationalSnapshot()
    const rollout = getRateLimitRolloutMetrics()
    const valkeyHealth = await checkValkeyHealth()
    const runtime = runtimeMetadata(health.runtimeMode)
    const isValkeyAuthoritative = health.runtimeMode === 'valkey'
    const parity = isValkeyAuthoritative ? null : operationalSnapshot.parityRate
    const latency = isValkeyAuthoritative
      ? { postgresAverageMs: null, valkeyAverageMs: null, deltaAverageMs: null }
      : {
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
      ...(isValkeyAuthoritative
        ? ['Comparison: disabled', 'Operational State: Valkey Authoritative']
        : [
            `Parity: ${formatPercent(parity ?? 0)}`,
            `Comparison Failures: ${metrics.comparisonFailures}`,
          ]
      ),
      `Backend Failures: ${metrics.backendFailures}`,
      ...(isValkeyAuthoritative
        ? []
        : [`Latency: Postgres ${formatLatency(latency.postgresAverageMs ?? 0)}, Valkey ${formatLatency(latency.valkeyAverageMs ?? 0)}, Delta ${formatLatency(latency.deltaAverageMs ?? 0)}`]
      ),
      `Valkey: ${valkey.connectionState}`,
      `Uptime: ${runtime.uptimeSeconds}s`,
      `Status: ${isValkeyAuthoritative ? 'Healthy' : health.observabilityStatus}`,
    ].join(' | ')

    return NextResponse.json({
      enabled: health.enabled,
      runtimeMode: health.runtimeMode,
      operationalState: health.operationalState,
      observabilityStatus: isValkeyAuthoritative ? 'healthy' : health.observabilityStatus,
      runtime,
      rollout,
      health: {
        status: health.status,
        observabilityStatus: isValkeyAuthoritative ? 'healthy' : health.observabilityStatus,
        operationalState: health.operationalState,
        backendFailures: health.backendFailures,
        comparisonFailures: isValkeyAuthoritative ? 0 : metrics.comparisonFailures,
      },
      metrics: isValkeyAuthoritative
        ? {
            totalComparisons: 0,
            identical: 0,
            mismatches: 0,
            mismatchRate: 0,
            latency,
            averageLatencyDeltaMs: 0,
          }
        : {
            totalComparisons: metrics.totalComparisons,
            identical: metrics.identical,
            mismatches: metrics.mismatches,
            mismatchRate: metrics.mismatchRate,
            latency,
            averageLatencyDeltaMs: metrics.avgLatencyDeltaMs,
          },
      decisionParity: isValkeyAuthoritative ? null : parityReport.decisionParity,
      retryAfterParity: isValkeyAuthoritative ? null : parityReport.retryAfterParity,
      valkey,
      lastUpdatedAt: isValkeyAuthoritative ? null : metrics.lastUpdatedAt,
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
        error: 'rate_limit_shadow_metrics_unavailable',
        message: 'Rate-limit shadow metrics are unavailable',
      },
      { status: 503 }
    )
  }
}
