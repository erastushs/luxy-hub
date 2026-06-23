import { NextResponse } from 'next/server'
import {
  getRateLimitRolloutMetrics,
  getRateLimitShadowHealth,
  getRateLimitShadowMetrics,
} from '@/app/lib/rate-limit/metrics-service'
import { checkValkeyHealth } from '@/app/lib/valkey/health'

type OverallStatus = 'healthy' | 'degraded' | 'unhealthy'
type ServiceStatus = OverallStatus | 'disabled'

const RUNTIME_STARTED_AT_MS = Date.now() - Math.floor(process.uptime() * 1000)
const OPERATIONAL_NOTES = [
  'PostgreSQL remains authoritative by default.',
  'Valkey operates in shadow mode unless an explicit canary configuration is enabled.',
  'No production traffic is routed exclusively to Valkey by default.',
] as const

function uptimeSecondsSince(timestamp: string | null): number | null {
  if (!timestamp) {
    return null
  }

  const parsed = Date.parse(timestamp)
  return Number.isFinite(parsed) ? Math.max(0, Math.floor((Date.now() - parsed) / 1000)) : null
}

function runtimeMetadata() {
  return {
    phase: '7',
    milestone: '7E.1',
    release: 'RC1',
    startedAt: new Date(RUNTIME_STARTED_AT_MS).toISOString(),
    uptimeSeconds: Math.max(0, Math.floor(process.uptime())),
  }
}

function getPostgresHealth(env: Record<string, string | undefined> = process.env) {
  const configured = Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL &&
    (env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  )

  return {
    status: configured ? 'healthy' : 'unhealthy',
    connected: configured,
  }
}

function getRateLimitHealthStatus(params: {
  runtimeMode: string
  healthStatus: string
  backendFailures: number
  comparisonFailures: number
}): string {
  if (params.healthStatus !== 'disabled') {
    return params.healthStatus
  }

  if (params.runtimeMode !== 'valkey_canary') {
    return params.healthStatus
  }

  if (params.backendFailures > 0 || params.comparisonFailures > 0) {
    return 'degraded'
  }

  return 'healthy'
}

function resolveOverallStatus(params: {
  postgresStatus: string
  valkeyEnabled: boolean
  valkeyStatus: string
  rateLimitHealth: string
}): OverallStatus {
  if (params.postgresStatus === 'unhealthy' || params.rateLimitHealth === 'unhealthy') {
    return 'unhealthy'
  }

  if (
    (params.valkeyEnabled && params.valkeyStatus === 'unhealthy') ||
    params.rateLimitHealth === 'degraded'
  ) {
    return 'degraded'
  }

  return 'healthy'
}

function createServiceSummary(statuses: ServiceStatus[], overall: OverallStatus) {
  return {
    healthyServices: statuses.filter((status) => status === 'healthy' || status === 'disabled').length,
    degradedServices: statuses.filter((status) => status === 'degraded').length,
    unhealthyServices: statuses.filter((status) => status === 'unhealthy').length,
    overall,
  }
}

function createPerformanceReport(params: {
  postgresAverageMs: number | null
  valkeyAverageMs: number | null
}) {
  const { postgresAverageMs, valkeyAverageMs } = params

  if (postgresAverageMs == null || valkeyAverageMs == null || valkeyAverageMs === 0) {
    return {
      latencyDifferenceMs: null,
      direction: null,
      speedup: null,
    }
  }

  const latencyDifferenceMs = Math.abs(postgresAverageMs - valkeyAverageMs)
  const direction = postgresAverageMs === valkeyAverageMs
    ? 'equal'
    : postgresAverageMs > valkeyAverageMs
      ? 'valkey_faster'
      : 'postgres_faster'

  return {
    latencyDifferenceMs,
    direction,
    speedup: postgresAverageMs / valkeyAverageMs,
  }
}

export async function GET() {
  const timestamp = new Date().toISOString()

  try {
    const postgres = getPostgresHealth()
    const valkeyHealth = await checkValkeyHealth()
    const rateLimitHealthSnapshot = getRateLimitShadowHealth()
    const rateLimitMetrics = getRateLimitShadowMetrics()
    const rollout = getRateLimitRolloutMetrics()
    const rolloutWithWriteCounters = {
      ...rollout,
      postgresAuthoritativeWrites: rollout.postgresAuthoritativeWrites,
      valkeyAuthoritativeWrites: rollout.valkeyAuthoritativeWrites,
    }
    const parity = rateLimitMetrics.totalComparisons === 0
      ? null
      : rateLimitMetrics.identical / rateLimitMetrics.totalComparisons
    const rateLimitHealth = getRateLimitHealthStatus({
      runtimeMode: rateLimitHealthSnapshot.runtimeMode,
      healthStatus: rateLimitHealthSnapshot.status,
      backendFailures: rateLimitMetrics.backendFailures,
      comparisonFailures: rateLimitMetrics.comparisonFailures,
    })
    const valkey = {
      enabled: valkeyHealth.enabled,
      connected: valkeyHealth.connectionState === 'ready',
      status: valkeyHealth.status,
      connectionState: valkeyHealth.connectionState,
      latencyMs: valkeyHealth.latencyMs,
      memoryUsedBytes: valkeyHealth.memoryUsedBytes,
      version: valkeyHealth.version,
      uptimeSeconds: uptimeSecondsSince(valkeyHealth.connectedSince),
    }
    const rateLimit = {
      runtimeMode: rateLimitHealthSnapshot.runtimeMode,
      health: rateLimitHealth,
      backendFailures: rateLimitMetrics.backendFailures,
      comparisonFailures: rateLimitMetrics.comparisonFailures,
      mismatchRate: rateLimitMetrics.mismatchRate,
      parity,
      averageLatencyDeltaMs: rateLimitMetrics.avgLatencyDeltaMs,
    }
    const status = resolveOverallStatus({
      postgresStatus: postgres.status,
      valkeyEnabled: valkey.enabled,
      valkeyStatus: valkey.status,
      rateLimitHealth: rateLimit.health,
    })
    const summary = createServiceSummary([
      postgres.status as ServiceStatus,
      valkey.status as ServiceStatus,
      rateLimit.health as ServiceStatus,
      'healthy',
    ], status)
    const performance = createPerformanceReport({
      postgresAverageMs: rateLimitMetrics.avgPostgresLatencyMs,
      valkeyAverageMs: rateLimitMetrics.avgValkeyLatencyMs,
    })

    return NextResponse.json({
      status,
      timestamp,
      summary,
      postgres,
      valkey,
      rateLimit,
      rollout: rolloutWithWriteCounters,
      performance,
      notes: OPERATIONAL_NOTES,
      runtime: runtimeMetadata(),
    })
  } catch {
    const status = 'unhealthy'

    return NextResponse.json({
      status,
      timestamp,
      summary: createServiceSummary([
        getPostgresHealth().status as ServiceStatus,
        'unhealthy',
        'unhealthy',
        'healthy',
      ], status),
      postgres: getPostgresHealth(),
      error: 'health_check_unavailable',
      notes: OPERATIONAL_NOTES,
      runtime: runtimeMetadata(),
    })
  }

}
