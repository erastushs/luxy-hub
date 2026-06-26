import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/lib/rate-limit/metrics-service', () => ({
  getRateLimitRolloutMetrics: vi.fn(),
  getRateLimitShadowHealth: vi.fn(),
  getRateLimitShadowMetrics: vi.fn(),
}))

vi.mock('@/app/lib/valkey/health', () => ({
  checkValkeyHealth: vi.fn(),
}))

import {
  getRateLimitRolloutMetrics,
  getRateLimitShadowHealth,
  getRateLimitShadowMetrics,
} from '@/app/lib/rate-limit/metrics-service'
import { checkValkeyHealth } from '@/app/lib/valkey/health'
import { GET } from '@/app/api/health/route'

function mockPostgresEnv() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.example.test'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
}

function mockValkey(overrides = {}) {
  vi.mocked(checkValkeyHealth).mockResolvedValue({
    status: 'healthy',
    enabled: true,
    connectionState: 'ready',
    latencyMs: 2,
    ping: 'ok',
    version: '7.2.5',
    memoryUsedBytes: 12_345_678,
    connectedSince: new Date(Date.now() - 5_000).toISOString(),
    lastSuccessfulPingAt: '2026-06-23T00:00:00.000Z',
    lastFailedHealthCheckAt: null,
    lastReconnectAt: null,
    totalReconnectCount: 0,
    errors: [],
    checkedAt: '2026-06-23T00:00:00.000Z',
    ...overrides,
  })
}

function mockRateLimit(overrides: {
  runtimeMode?: 'postgres' | 'shadow' | 'valkey_canary' | 'valkey'
  health?: 'disabled' | 'healthy' | 'degraded' | 'unhealthy'
  totalComparisons?: number
  identical?: number
  backendFailures?: number
  comparisonFailures?: number
  mismatchRate?: number
  canaryPercentage?: number
  postgresRequests?: number
  valkeyRequests?: number
  fallbackCount?: number
} = {}) {
  const runtimeMode = overrides.runtimeMode ?? 'shadow'
  const totalComparisons = overrides.totalComparisons ?? 10
  const identical = overrides.identical ?? 10
  const backendFailures = overrides.backendFailures ?? 0
  const comparisonFailures = overrides.comparisonFailures ?? 0
  const mismatchRate = overrides.mismatchRate ?? 0
  const canaryPercentage = overrides.canaryPercentage ?? 0
  const postgresRequests = overrides.postgresRequests ?? 1_000
  const valkeyRequests = overrides.valkeyRequests ?? 0
  const fallbackCount = overrides.fallbackCount ?? 0

    vi.mocked(getRateLimitShadowHealth).mockReturnValue({
      enabled: runtimeMode === 'shadow' || runtimeMode === 'valkey_canary' || runtimeMode === 'valkey',
      runtimeMode,
      operationalState: runtimeMode === 'valkey'
        ? 'valkey_authoritative'
        : runtimeMode === 'valkey_canary'
          ? 'valkey_canary_active'
          : runtimeMode === 'shadow'
            ? 'shadow_comparison_active'
            : 'postgres_authoritative',
      observabilityStatus: runtimeMode === 'valkey' ? 'healthy' : (overrides.health === 'disabled' ? 'healthy' : overrides.health ?? 'healthy'),
      totalComparisons,
      mismatchRate,
    backendFailures,
    status: overrides.health ?? 'healthy',
    checkedAt: '2026-06-23T00:00:00.000Z',
  })
  vi.mocked(getRateLimitShadowMetrics).mockReturnValue({
    totalComparisons,
    identical,
    mismatches: totalComparisons - identical,
    mismatchRate,
    backendFailures,
    authoritativeBackendFailures: 0,
    comparisonFailures,
    avgPostgresLatencyMs: 7.12,
    avgValkeyLatencyMs: 7.3,
    avgLatencyDeltaMs: 0.18,
    decisionParity: {
      allow: { total: totalComparisons, identical, rate: totalComparisons === 0 ? 0 : identical / totalComparisons },
      deny: { total: 0, identical: 0, rate: 0 },
    },
    retryAfterParity: { total: 0, identical: 0, rate: 0 },
    lastUpdatedAt: '2026-06-23T00:00:00.000Z',
    runtimeMode,
    canaryRequests: valkeyRequests,
    postgresRequests,
    valkeyRequests,
    fallbackCount,
    canaryPercentage,
  })
    vi.mocked(getRateLimitRolloutMetrics).mockReturnValue({
      mode: runtimeMode,
      canaryPercentage,
      configuredCanaryPercentage: canaryPercentage,
      effectiveCanaryPercentage: valkeyRequests + postgresRequests === 0
        ? 0
        : (valkeyRequests / (valkeyRequests + postgresRequests)) * 100,
      effectivePostgresPercentage: valkeyRequests + postgresRequests === 0
        ? 0
        : (postgresRequests / (valkeyRequests + postgresRequests)) * 100,
      effectiveValkeyPercentage: valkeyRequests + postgresRequests === 0
        ? 0
        : (valkeyRequests / (valkeyRequests + postgresRequests)) * 100,
      fallbackPercentage: valkeyRequests + postgresRequests === 0
        ? 0
        : (fallbackCount / (valkeyRequests + postgresRequests)) * 100,
      totalRequests: valkeyRequests + postgresRequests,
      nonCanaryRequests: Math.max(0, postgresRequests - fallbackCount),
      canaryRequests: valkeyRequests,
      postgresRequests,
    valkeyRequests,
    fallbackCount,
    postgresAuthoritativeWrites: postgresRequests,
    valkeyAuthoritativeWrites: valkeyRequests,
  })
}

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockPostgresEnv()
    mockValkey()
    mockRateLimit()
  })

  it('keeps legacy health fields while exposing PostgreSQL health', async () => {
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('healthy')
    expect(body.timestamp).toEqual(expect.any(String))
    expect(body.postgres).toEqual({ status: 'healthy', connected: true })
    expect(body.runtime).toMatchObject({
      phase: '7',
      milestone: '7E.3',
      release: 'Production',
      startedAt: expect.any(String),
      uptimeSeconds: expect.any(Number),
    })
  })

  it('reports a service summary for PostgreSQL, Valkey, RateLimit, and Application', async () => {
    const response = await GET()
    const body = await response.json()

    expect(body.summary).toEqual({
      healthyServices: 4,
      degradedServices: 0,
      unhealthyServices: 0,
      overall: 'healthy',
    })
  })

  it('reports Valkey disabled without degrading overall health', async () => {
    mockValkey({
      status: 'disabled',
      enabled: false,
      connectionState: 'disabled',
      latencyMs: null,
      version: null,
      memoryUsedBytes: null,
      connectedSince: null,
      ping: 'skipped',
    })

    const response = await GET()
    const body = await response.json()

    expect(body.status).toBe('healthy')
    expect(body.summary).toMatchObject({ healthyServices: 4, overall: 'healthy' })
    expect(body.valkey).toMatchObject({
      enabled: false,
      connected: false,
      status: 'disabled',
      connectionState: 'disabled',
      latencyMs: null,
      memoryUsedBytes: null,
      version: null,
      uptimeSeconds: null,
    })
  })

  it('reports Valkey healthy details from the existing Valkey health service', async () => {
    const response = await GET()
    const body = await response.json()

    expect(checkValkeyHealth).toHaveBeenCalledTimes(1)
    expect(body.valkey).toMatchObject({
      enabled: true,
      connected: true,
      status: 'healthy',
      connectionState: 'ready',
      latencyMs: 2,
      memoryUsedBytes: 12_345_678,
      version: '7.2.5',
      uptimeSeconds: expect.any(Number),
    })
  })

  it('reports shadow runtime health and parity', async () => {
    mockRateLimit({ runtimeMode: 'shadow', health: 'healthy', totalComparisons: 100, identical: 100 })

    const response = await GET()
    const body = await response.json()

    expect(body.rateLimit).toEqual({
      runtimeMode: 'shadow',
      operationalState: 'shadow_comparison_active',
      health: 'healthy',
      observabilityStatus: 'healthy',
      backendFailures: 0,
      comparisonFailures: 0,
      mismatchRate: 0,
      parity: 1,
      averageLatencyDeltaMs: 0.18,
    })
  })

  it('reports canary runtime and rollout metrics', async () => {
    mockRateLimit({
      runtimeMode: 'valkey_canary',
      health: 'healthy',
      totalComparisons: 0,
      identical: 0,
      canaryPercentage: 5,
      postgresRequests: 950,
      valkeyRequests: 50,
      fallbackCount: 2,
    })

    const response = await GET()
    const body = await response.json()

    expect(body.status).toBe('healthy')
    expect(body.rateLimit).toMatchObject({
      runtimeMode: 'valkey_canary',
      health: 'healthy',
      parity: null,
    })
    expect(body.rollout).toEqual({
      mode: 'valkey_canary',
      canaryPercentage: 5,
      configuredCanaryPercentage: 5,
      effectiveCanaryPercentage: 5,
      effectivePostgresPercentage: 95,
      effectiveValkeyPercentage: 5,
      fallbackPercentage: 0.2,
      totalRequests: 1000,
      nonCanaryRequests: 948,
      canaryRequests: 50,
      postgresRequests: 950,
      valkeyRequests: 50,
      fallbackCount: 2,
      postgresAuthoritativeWrites: 950,
      valkeyAuthoritativeWrites: 50,
    })
  })

  it('reports human-readable performance when latency averages are available', async () => {
    const response = await GET()
    const body = await response.json()

    expect(body.rateLimit.averageLatencyDeltaMs).toBe(0.18)
    expect(body.performance).toEqual({
      latencyDifferenceMs: 0.17999999999999972,
      direction: 'postgres_faster',
      speedup: 7.12 / 7.3,
    })
  })

  it('reports valkey_faster speedup when Valkey latency is lower', async () => {
    vi.mocked(getRateLimitShadowMetrics).mockReturnValue({
      totalComparisons: 100,
      identical: 100,
      mismatches: 0,
      mismatchRate: 0,
      backendFailures: 0,
      authoritativeBackendFailures: 0,
      comparisonFailures: 0,
      avgPostgresLatencyMs: 70,
      avgValkeyLatencyMs: 1.1,
      avgLatencyDeltaMs: -68.9,
      decisionParity: {
        allow: { total: 100, identical: 100, rate: 1 },
        deny: { total: 0, identical: 0, rate: 0 },
      },
      retryAfterParity: { total: 0, identical: 0, rate: 0 },
      lastUpdatedAt: '2026-06-23T00:00:00.000Z',
      runtimeMode: 'shadow',
      canaryRequests: 0,
      postgresRequests: 1_000,
      valkeyRequests: 0,
      fallbackCount: 0,
      canaryPercentage: 0,
    })

    const response = await GET()
    const body = await response.json()

    expect(body.rateLimit.averageLatencyDeltaMs).toBe(-68.9)
    expect(body.performance).toEqual({
      latencyDifferenceMs: 68.9,
      direction: 'valkey_faster',
      speedup: 70 / 1.1,
    })
  })

  it('returns null performance values when latency is unavailable or zero', async () => {
    vi.mocked(getRateLimitShadowMetrics).mockReturnValue({
      totalComparisons: 0,
      identical: 0,
      mismatches: 0,
      mismatchRate: 0,
      backendFailures: 0,
      authoritativeBackendFailures: 0,
      comparisonFailures: 0,
      avgPostgresLatencyMs: 7,
      avgValkeyLatencyMs: 0,
      avgLatencyDeltaMs: 0,
      decisionParity: {
        allow: { total: 0, identical: 0, rate: 0 },
        deny: { total: 0, identical: 0, rate: 0 },
      },
      retryAfterParity: { total: 0, identical: 0, rate: 0 },
      lastUpdatedAt: null,
      runtimeMode: 'shadow',
      canaryRequests: 0,
      postgresRequests: 0,
      valkeyRequests: 0,
      fallbackCount: 0,
      canaryPercentage: 0,
    })

    const response = await GET()
    const body = await response.json()

    expect(body.performance).toEqual({
      latencyDifferenceMs: null,
      direction: null,
      speedup: null,
    })
  })

  it('serializes operational notes', async () => {
    const response = await GET()
    const body = await response.json()

    expect(body.notes).toEqual([
      'Migration complete. Valkey is the production rate-limit backend.',
      'PostgreSQL remains available as rollback backend via RATE_LIMIT_MODE=postgres.',
      'Shadow comparison is disabled in Valkey authoritative mode.',
    ])
  })

  it('reports overall degraded when an enabled optional service is unhealthy', async () => {
    mockValkey({ status: 'unhealthy', connectionState: 'error', ping: 'failed' })

    const response = await GET()
    const body = await response.json()

    expect(body.status).toBe('degraded')
    expect(body.summary).toEqual({
      healthyServices: 3,
      degradedServices: 0,
      unhealthyServices: 1,
      overall: 'degraded',
    })
    expect(body.valkey.status).toBe('unhealthy')
  })

  it('reports overall degraded when rate-limit health is degraded', async () => {
    mockRateLimit({ health: 'degraded', backendFailures: 1 })

    const response = await GET()
    const body = await response.json()

    expect(body.status).toBe('degraded')
    expect(body.summary).toEqual({
      healthyServices: 3,
      degradedServices: 1,
      unhealthyServices: 0,
      overall: 'degraded',
    })
    expect(body.rateLimit.health).toBe('degraded')
  })

  it('reports overall unhealthy when PostgreSQL is unavailable', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const response = await GET()
    const body = await response.json()

    expect(body.status).toBe('unhealthy')
    expect(body.summary).toEqual({
      healthyServices: 3,
      degradedServices: 0,
      unhealthyServices: 1,
      overall: 'unhealthy',
    })
    expect(body.postgres).toEqual({ status: 'unhealthy', connected: false })
  })

  it('reports overall unhealthy when internal monitoring fails', async () => {
    vi.mocked(getRateLimitShadowHealth).mockImplementation(() => {
      throw new Error('metrics unavailable')
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('unhealthy')
    expect(body.error).toBe('health_check_unavailable')
    expect(body.runtime).toMatchObject({
      phase: '7',
      milestone: '7E.3',
      release: 'Production',
      uptimeSeconds: expect.any(Number),
    })
    expect(body.notes).toEqual(expect.any(Array))
  })
})
