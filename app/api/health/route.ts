import { NextResponse } from 'next/server'
import {
  getRateLimitRolloutMetrics,
  getRateLimitShadowHealth,
  getRateLimitShadowMetrics,
} from '@/app/lib/rate-limit/metrics-service'
import { checkValkeyHealth } from '@/app/lib/valkey/health'

type OverallStatus = 'healthy' | 'degraded' | 'unhealthy'

const RUNTIME_STARTED_AT_MS = Date.now() - Math.floor(process.uptime() * 1000)

function uptimeSecondsSince(timestamp: string | null): number | null {
  if (!timestamp) {
    return null
  }

  const parsed = Date.parse(timestamp)
  return Number.isFinite(parsed) ? Math.max(0, Math.floor((Date.now() - parsed) / 1000)) : null
}

function runtimeMetadata() {
  return {
    phase: '7E',
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

export async function GET() {
  const timestamp = new Date().toISOString()

  try {
    const postgres = getPostgresHealth()
    const valkeyHealth = await checkValkeyHealth()
    const rateLimitHealthSnapshot = getRateLimitShadowHealth()
    const rateLimitMetrics = getRateLimitShadowMetrics()
    const rollout = getRateLimitRolloutMetrics()
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
    }
    const status = resolveOverallStatus({
      postgresStatus: postgres.status,
      valkeyEnabled: valkey.enabled,
      valkeyStatus: valkey.status,
      rateLimitHealth: rateLimit.health,
    })

    return NextResponse.json({
      status,
      timestamp,
      postgres,
      valkey,
      rateLimit,
      rollout,
      runtime: runtimeMetadata(),
    })
  } catch {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp,
      postgres: getPostgresHealth(),
      error: 'health_check_unavailable',
      runtime: runtimeMetadata(),
    })
  }

}
