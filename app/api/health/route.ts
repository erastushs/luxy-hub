import { NextResponse } from 'next/server'
import {
  getRateLimitRolloutMetrics,
  getRateLimitShadowHealth,
  getRateLimitShadowMetrics,
} from '@/app/lib/rate-limit/metrics-service'
import { checkValkeyHealth } from '@/app/lib/valkey/health'
import { getDeliverySessionRolloutMetrics } from '@/app/lib/delivery-session/metrics-service'
import { parseDeliverySessionRuntimeConfig } from '@/app/lib/delivery-session/config'

type OverallStatus = 'healthy' | 'degraded' | 'unhealthy'
type ServiceStatus = OverallStatus | 'disabled'

const RUNTIME_STARTED_AT_MS = Date.now() - Math.floor(process.uptime() * 1000)
const OPERATIONAL_NOTES = [
  'Rate Limiter runs on Valkey.',
  'Delivery Sessions run on Valkey.',
  'PostgreSQL stores persistent application data.',
  'Rollback remains available through environment configuration.',
] as const

type DeliverySessionOperationalState = 'postgres_authoritative' | 'shadow_comparison_active' | 'valkey_canary_active' | 'valkey_authoritative'

function resolveDeliverySessionOperationalState(mode: string): DeliverySessionOperationalState {
  if (mode === 'shadow') return 'shadow_comparison_active'
  if (mode === 'valkey_canary') return 'valkey_canary_active'
  if (mode === 'valkey') return 'valkey_authoritative'
  return 'postgres_authoritative'
}

function getDeliverySessionHealthStatus(mode: string, backendFailures: number): string {
  if (mode === 'valkey') {
    return backendFailures > 0 ? 'unhealthy' : 'healthy'
  }
  return backendFailures > 0 ? 'degraded' : 'healthy'
}

function optionalBuildMetadata(env: Record<string, string | undefined> = process.env) {
  const build = {
    deployment: env.VERCEL_ENV,
    commitSha: env.VERCEL_GIT_COMMIT_SHA,
    commitRef: env.VERCEL_GIT_COMMIT_REF,
  }
  const entries = Object.entries(build).filter((entry): entry is [string, string] => Boolean(entry[1]))

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function uptimeSecondsSince(timestamp: string | null): number | null {
  if (!timestamp) {
    return null
  }

  const parsed = Date.parse(timestamp)
  return Number.isFinite(parsed) ? Math.max(0, Math.floor((Date.now() - parsed) / 1000)) : null
}

function runtimeMetadata() {
  const build = optionalBuildMetadata()

  return {
    phase: '8A',
    milestone: '8A.4',
    release: 'Production',
    startedAt: new Date(RUNTIME_STARTED_AT_MS).toISOString(),
    uptimeSeconds: Math.max(0, Math.floor(process.uptime())),
    ...(build ? { build } : {}),
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
  if (params.runtimeMode === 'valkey') {
    return params.backendFailures > 0 ? 'unhealthy' : 'healthy'
  }

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
    const isValkeyAuthoritative = rateLimitHealthSnapshot.runtimeMode === 'valkey'
    const rollout = getRateLimitRolloutMetrics()
    const rolloutWithWriteCounters = {
      ...rollout,
      postgresAuthoritativeWrites: rollout.postgresAuthoritativeWrites,
      valkeyAuthoritativeWrites: rollout.valkeyAuthoritativeWrites,
    }
    const parity = isValkeyAuthoritative
      ? null
      : rateLimitMetrics.totalComparisons === 0
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
      operationalState: rateLimitHealthSnapshot.operationalState,
      health: rateLimitHealth,
      backendFailures: rateLimitMetrics.backendFailures,
      ...(isValkeyAuthoritative
        ? { observabilityStatus: 'healthy', comparisonFailures: 0, mismatchRate: 0, parity: null, averageLatencyDeltaMs: 0 }
        : {
            observabilityStatus: rateLimitHealthSnapshot.observabilityStatus ?? rateLimitHealth,
            comparisonFailures: rateLimitMetrics.comparisonFailures,
            mismatchRate: rateLimitMetrics.mismatchRate,
            parity,
            averageLatencyDeltaMs: rateLimitMetrics.avgLatencyDeltaMs,
          }),
    }
    const deliverySessionConfig = parseDeliverySessionRuntimeConfig()
    const deliverySessionMetrics = getDeliverySessionRolloutMetrics()
    const deliverySession = {
      runtimeMode: deliverySessionConfig.mode,
      operationalState: resolveDeliverySessionOperationalState(deliverySessionConfig.mode),
      health: getDeliverySessionHealthStatus(deliverySessionConfig.mode, deliverySessionMetrics.backendFailures),
      backendFailures: deliverySessionMetrics.backendFailures,
      comparisonFailures: deliverySessionMetrics.comparisonFailures,
      fallbackCount: deliverySessionMetrics.fallbackCount,
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
    const performance = isValkeyAuthoritative
      ? { latencyDifferenceMs: null, direction: null, speedup: null }
      : createPerformanceReport({
          postgresAverageMs: rateLimitMetrics.avgPostgresLatencyMs,
          valkeyAverageMs: rateLimitMetrics.avgValkeyLatencyMs,
        })

    const services = {
      postgres,
      valkey,
      rateLimit,
      deliverySession,
    }

    const runtimeBackends = {
      rateLimit: {
        mode: rateLimit.runtimeMode,
        state: rateLimit.operationalState,
        health: rateLimit.health,
        backendFailures: rateLimit.backendFailures,
        fallback: rolloutWithWriteCounters.fallbackCount,
        parity: isValkeyAuthoritative ? 'not applicable' : (parity !== null ? parity : 'not applicable'),
        comparison: isValkeyAuthoritative ? 'disabled' : 'active',
      },
      deliverySession: {
        mode: deliverySession.runtimeMode,
        state: deliverySession.operationalState,
        health: deliverySession.health,
        backendFailures: deliverySession.backendFailures,
        fallback: deliverySession.fallbackCount,
        activeSessions: deliverySessionMetrics.activeSessions ?? 0,
        lookupFailures: deliverySessionMetrics.lookupFailures ?? 0,
      },
    }

    return NextResponse.json({
      status,
      timestamp,
      summary,
      runtime: runtimeMetadata(),
      services,
      performance,
      runtimeBackends,
      postgres,
      valkey,
      rateLimit,
      deliverySession,
      rollout: rolloutWithWriteCounters,
      notes: OPERATIONAL_NOTES,
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
