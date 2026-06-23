import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/lib/auth/session-auth', () => {
  class AuthError extends Error {
    status: number

    constructor(message: string, status = 401) {
      super(message)
      this.name = 'AuthError'
      this.status = status
    }
  }

  return {
    AuthError,
    requireRole: vi.fn(),
  }
})

vi.mock('@/app/lib/rate-limit/metrics-service', () => ({
  getRateLimitRolloutMetrics: vi.fn(),
  getRateLimitShadowHealth: vi.fn(),
  getRateLimitShadowMetrics: vi.fn(),
  getRateLimitShadowOperationalSnapshot: vi.fn(),
  getRateLimitShadowParityReport: vi.fn(),
}))

vi.mock('@/app/lib/valkey/health', () => ({
  checkValkeyHealth: vi.fn(),
}))

import { AuthError, requireRole } from '@/app/lib/auth/session-auth'
import {
  getRateLimitRolloutMetrics,
  getRateLimitShadowHealth,
  getRateLimitShadowMetrics,
  getRateLimitShadowOperationalSnapshot,
  getRateLimitShadowParityReport,
} from '@/app/lib/rate-limit/metrics-service'
import { checkValkeyHealth } from '@/app/lib/valkey/health'
import { GET } from '@/app/api/internal/rate-limit-shadow/route'

function mockHealthyMetrics() {
  vi.mocked(getRateLimitShadowHealth).mockReturnValue({
    enabled: true,
    runtimeMode: 'shadow',
    totalComparisons: 154_203,
    mismatchRate: 0.000006,
    backendFailures: 0,
    status: 'healthy',
    checkedAt: '2026-06-23T00:00:00.000Z',
  })
  vi.mocked(getRateLimitShadowMetrics).mockReturnValue({
    totalComparisons: 154_203,
    identical: 154_202,
    mismatches: 1,
    mismatchRate: 0.000006,
    backendFailures: 0,
    authoritativeBackendFailures: 0,
    comparisonFailures: 0,
    avgPostgresLatencyMs: 7.12,
    avgValkeyLatencyMs: 7.3,
    avgLatencyDeltaMs: 0.18,
    decisionParity: {
      allow: { total: 100_000, identical: 99_999, rate: 0.99999 },
      deny: { total: 54_203, identical: 54_203, rate: 1 },
    },
    retryAfterParity: { total: 54_203, identical: 54_203, rate: 1 },
    lastUpdatedAt: '2026-06-23T00:00:00.000Z',
    runtimeMode: 'shadow',
    canaryRequests: 0,
    postgresRequests: 0,
    valkeyRequests: 0,
    fallbackCount: 0,
    canaryPercentage: 0,
  })
  vi.mocked(getRateLimitShadowParityReport).mockReturnValue({
    totalComparisons: 154_203,
    identical: 154_202,
    mismatches: 1,
    mismatchRate: 0.000006,
    backendFailures: 0,
    authoritativeBackendFailures: 0,
    comparisonFailures: 0,
    avgPostgresLatencyMs: 7.12,
    avgValkeyLatencyMs: 7.3,
    avgLatencyDeltaMs: 0.18,
    decisionParity: {
      allow: { total: 100_000, identical: 99_999, rate: 0.99999 },
      deny: { total: 54_203, identical: 54_203, rate: 1 },
    },
    retryAfterParity: { total: 54_203, identical: 54_203, rate: 1 },
    lastUpdatedAt: '2026-06-23T00:00:00.000Z',
    runtimeMode: 'shadow',
    canaryRequests: 0,
    postgresRequests: 0,
    valkeyRequests: 0,
    fallbackCount: 0,
    canaryPercentage: 0,
  })
  vi.mocked(getRateLimitRolloutMetrics).mockReturnValue({
    mode: 'shadow',
    canaryPercentage: 0,
    canaryRequests: 0,
    postgresRequests: 0,
    valkeyRequests: 0,
    fallbackCount: 0,
  })
  vi.mocked(getRateLimitShadowOperationalSnapshot).mockReturnValue({
    runtimeMode: 'shadow',
    comparisons: 154_203,
    parityRate: 0.999994,
    backendFailures: 0,
    comparisonFailures: 0,
    averageLatencyDeltaMs: 0.18,
    status: 'healthy',
    summary: [
      'Runtime Mode: shadow',
      'Comparisons: 154,203',
      'Parity: 99.9994%',
      'Backend Failures: 0',
      'Comparison Failures: 0',
      'Latency: Postgres 7.12 ms, Valkey 7.30 ms, Delta 0.18 ms',
      'Status: Healthy',
    ].join('\n'),
  })
  vi.mocked(checkValkeyHealth).mockResolvedValue({
    status: 'healthy',
    enabled: true,
    connectionState: 'ready',
    latencyMs: 4,
    ping: 'ok',
    version: '7.2.5',
    memoryUsedBytes: 12_345_678,
    connectedSince: new Date(Date.now() - 30_000).toISOString(),
    lastSuccessfulPingAt: '2026-06-23T00:00:00.000Z',
    lastFailedHealthCheckAt: null,
    lastReconnectAt: null,
    totalReconnectCount: 0,
    errors: [],
    checkedAt: '2026-06-23T00:00:00.000Z',
  })
}

describe('GET /api/internal/rate-limit-shadow', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(requireRole).mockResolvedValue({
      id: 'admin-user',
      email: 'admin@example.test',
      role: 'admin',
      profile: {
        id: 'admin-user',
        username: 'admin',
        display_name: 'Admin',
        avatar_url: null,
        role: 'admin',
        created_at: '2026-06-23T00:00:00.000Z',
        updated_at: '2026-06-23T00:00:00.000Z',
      },
    })
    mockHealthyMetrics()
  })

  it('rejects unauthenticated requests', async () => {
    vi.mocked(requireRole).mockRejectedValue(new AuthError('Unauthorized', 401))

    const response = await GET()

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ success: false, error: 'Unauthorized' })
    expect(getRateLimitShadowMetrics).not.toHaveBeenCalled()
  })

  it('rejects non-admin requests', async () => {
    vi.mocked(requireRole).mockRejectedValue(new AuthError('Forbidden', 403))

    const response = await GET()

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ success: false, error: 'Forbidden' })
    expect(requireRole).toHaveBeenCalledWith('admin')
    expect(getRateLimitShadowMetrics).not.toHaveBeenCalled()
  })

  it('returns aggregate metrics for dashboard admins', async () => {
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      enabled: true,
      runtimeMode: 'shadow',
      runtime: {
        phase: '7D',
        release: 'RC1',
        runtimeMode: 'shadow',
        startedAt: expect.any(String),
        uptimeSeconds: expect.any(Number),
      },
      rollout: {
        mode: 'shadow',
        canaryPercentage: 0,
        canaryRequests: 0,
        postgresRequests: 0,
        valkeyRequests: 0,
        fallbackCount: 0,
      },
      health: {
        status: 'healthy',
        backendFailures: 0,
        comparisonFailures: 0,
      },
      metrics: {
        totalComparisons: 154_203,
        identical: 154_202,
        mismatches: 1,
        mismatchRate: 0.000006,
        latency: {
          postgresAverageMs: 7.12,
          valkeyAverageMs: 7.3,
          deltaAverageMs: 0.18,
        },
        averageLatencyDeltaMs: 0.18,
      },
      decisionParity: {
        allow: { total: 100_000, identical: 99_999, rate: 0.99999 },
        deny: { total: 54_203, identical: 54_203, rate: 1 },
      },
      retryAfterParity: { total: 54_203, identical: 54_203, rate: 1 },
      valkey: {
        enabled: true,
        connected: true,
        status: 'healthy',
        connectionState: 'ready',
        latencyMs: 4,
        memoryUsedBytes: 12_345_678,
        version: '7.2.5',
        uptimeSeconds: expect.any(Number),
        checkedAt: '2026-06-23T00:00:00.000Z',
      },
      lastUpdatedAt: '2026-06-23T00:00:00.000Z',
      operationalSummary: expect.stringMatching(/^Runtime Mode: shadow \| Parity: 99\.9994% \| Backend Failures: 0 \| Comparison Failures: 0 \| Latency: Postgres 7\.12 ms, Valkey 7\.30 ms, Delta 0\.18 ms \| Valkey: ready \| Uptime: \d+s \| Status: healthy$/),
    })
    expect(body.runtime.uptimeSeconds).toBeGreaterThanOrEqual(0)
    expect(body.valkey.uptimeSeconds).toBeGreaterThanOrEqual(0)
  })

  it('returns a healthy response shape', async () => {
    const response = await GET()
    const body = await response.json()

    expect(body.enabled).toBe(true)
    expect(body.runtimeMode).toBe('shadow')
    expect(body.health).toMatchObject({
      status: 'healthy',
      backendFailures: 0,
      comparisonFailures: 0,
    })
    expect(body.metrics.latency).toEqual({
      postgresAverageMs: 7.12,
      valkeyAverageMs: 7.3,
      deltaAverageMs: 0.18,
    })
    expect(body.runtime).toMatchObject({
      phase: '7D',
      release: 'RC1',
      runtimeMode: 'shadow',
      startedAt: expect.any(String),
      uptimeSeconds: expect.any(Number),
    })
    expect(body.rollout).toEqual({
      mode: 'shadow',
      canaryPercentage: 0,
      canaryRequests: 0,
      postgresRequests: 0,
      valkeyRequests: 0,
      fallbackCount: 0,
    })
    expect(body.valkey).toMatchObject({
      connected: true,
      connectionState: 'ready',
      latencyMs: 4,
      memoryUsedBytes: 12_345_678,
      version: '7.2.5',
      uptimeSeconds: expect.any(Number),
    })
  })

  it('returns shadow disabled state with empty metrics', async () => {
    vi.mocked(getRateLimitShadowHealth).mockReturnValue({
      enabled: false,
      runtimeMode: 'postgres',
      totalComparisons: 0,
      mismatchRate: 0,
      backendFailures: 0,
      status: 'disabled',
      checkedAt: '2026-06-23T00:00:00.000Z',
    })
    vi.mocked(getRateLimitShadowMetrics).mockReturnValue({
      totalComparisons: 0,
      identical: 0,
      mismatches: 0,
      mismatchRate: 0,
      backendFailures: 0,
      authoritativeBackendFailures: 0,
      comparisonFailures: 0,
      avgPostgresLatencyMs: null,
      avgValkeyLatencyMs: null,
      avgLatencyDeltaMs: 0,
      decisionParity: {
        allow: { total: 0, identical: 0, rate: 0 },
        deny: { total: 0, identical: 0, rate: 0 },
      },
      retryAfterParity: { total: 0, identical: 0, rate: 0 },
      lastUpdatedAt: null,
      runtimeMode: 'postgres',
      canaryRequests: 0,
      postgresRequests: 0,
      valkeyRequests: 0,
      fallbackCount: 0,
      canaryPercentage: 0,
    })
    vi.mocked(getRateLimitShadowParityReport).mockReturnValue({
      totalComparisons: 0,
      identical: 0,
      mismatches: 0,
      mismatchRate: 0,
      backendFailures: 0,
      authoritativeBackendFailures: 0,
      comparisonFailures: 0,
      avgPostgresLatencyMs: null,
      avgValkeyLatencyMs: null,
      avgLatencyDeltaMs: 0,
      decisionParity: {
        allow: { total: 0, identical: 0, rate: 0 },
        deny: { total: 0, identical: 0, rate: 0 },
      },
      retryAfterParity: { total: 0, identical: 0, rate: 0 },
      lastUpdatedAt: null,
      runtimeMode: 'postgres',
      canaryRequests: 0,
      postgresRequests: 0,
      valkeyRequests: 0,
      fallbackCount: 0,
      canaryPercentage: 0,
    })
    vi.mocked(getRateLimitRolloutMetrics).mockReturnValue({
      mode: 'postgres',
      canaryPercentage: 0,
      canaryRequests: 0,
      postgresRequests: 0,
      valkeyRequests: 0,
      fallbackCount: 0,
    })
    vi.mocked(getRateLimitShadowOperationalSnapshot).mockReturnValue({
      runtimeMode: 'postgres',
      comparisons: 0,
      parityRate: 0,
      backendFailures: 0,
      comparisonFailures: 0,
      averageLatencyDeltaMs: 0,
      status: 'disabled',
      summary: 'Runtime Mode: postgres\nComparisons: 0\nParity: 0.0000%\nBackend Failures: 0\nAverage Latency Delta: 0.00 ms\nStatus: Disabled',
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      enabled: false,
      runtimeMode: 'postgres',
      health: { status: 'disabled', backendFailures: 0, comparisonFailures: 0 },
      metrics: {
        totalComparisons: 0,
        identical: 0,
        mismatches: 0,
        mismatchRate: 0,
        averageLatencyDeltaMs: 0,
      },
      rollout: {
        mode: 'postgres',
        canaryPercentage: 0,
        postgresRequests: 0,
        valkeyRequests: 0,
        fallbackCount: 0,
      },
      lastUpdatedAt: null,
    })
  })

  it('returns 503 when internal metrics are unavailable', async () => {
    vi.mocked(getRateLimitShadowHealth).mockImplementation(() => {
      throw new Error('metrics failed')
    })

    const response = await GET()

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'rate_limit_shadow_metrics_unavailable',
      message: 'Rate-limit shadow metrics are unavailable',
    })
  })

  it('does not expose sensitive fields or individual comparison data', async () => {
    const response = await GET()
    const output = JSON.stringify(await response.json())

    expect(output).not.toContain('ip')
    expect(output).not.toContain('email')
    expect(output).not.toContain('token')
    expect(output).not.toContain('session')
    expect(output).not.toContain('raw')
    expect(output).not.toContain('bucket')
    expect(output).not.toContain('comparisonHistory')
    expect(output).not.toContain('admin@example.test')
    expect(output).not.toContain('admin-user')
  })
})
