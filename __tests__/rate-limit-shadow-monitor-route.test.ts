import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/lib/monitor/auth', () => {
  class MonitorAuthError extends Error {
    status: number

    constructor(message = 'Unauthorized', status = 401) {
      super(message)
      this.name = 'MonitorAuthError'
      this.status = status
    }
  }

  return {
    MonitorAuthError,
    requireMonitorAuth: vi.fn(),
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

import { MonitorAuthError, requireMonitorAuth } from '@/app/lib/monitor/auth'
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
    operationalState: 'shadow_comparison_active',
    observabilityStatus: 'healthy',
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
    configuredCanaryPercentage: 0,
    effectiveCanaryPercentage: 0,
    effectivePostgresPercentage: 0,
    effectiveValkeyPercentage: 0,
    fallbackPercentage: 0,
    totalRequests: 0,
    nonCanaryRequests: 0,
    canaryRequests: 0,
    postgresRequests: 0,
    valkeyRequests: 0,
    fallbackCount: 0,
    postgresAuthoritativeWrites: 0,
    valkeyAuthoritativeWrites: 0,
  })
  vi.mocked(getRateLimitShadowOperationalSnapshot).mockReturnValue({
    runtimeMode: 'shadow',
    operationalState: 'shadow_comparison_active',
    observabilityStatus: 'healthy',
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
    ].join('\\n'),
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
    vi.mocked(requireMonitorAuth).mockResolvedValue(undefined)
    mockHealthyMetrics()
  })

  it('rejects requests without a monitoring token', async () => {
    vi.mocked(requireMonitorAuth).mockRejectedValue(new MonitorAuthError('Unauthorized', 401))

    const response = await GET()

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ success: false, error: 'Unauthorized' })
    expect(getRateLimitShadowMetrics).not.toHaveBeenCalled()
  })

  it('returns aggregate metrics for authenticated monitoring requests', async () => {
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      enabled: true,
      runtimeMode: 'shadow',
      operationalState: 'shadow_comparison_active',
      observabilityStatus: 'healthy',
      runtime: {
        phase: '7',
        milestone: '7E.3',
        release: 'Production',
        runtimeMode: 'shadow',
        startedAt: expect.any(String),
        uptimeSeconds: expect.any(Number),
      },
      rollout: {
        mode: 'shadow',
        canaryPercentage: 0,
        configuredCanaryPercentage: 0,
        effectiveCanaryPercentage: 0,
        effectivePostgresPercentage: 0,
        effectiveValkeyPercentage: 0,
        fallbackPercentage: 0,
        totalRequests: 0,
        nonCanaryRequests: 0,
        canaryRequests: 0,
        postgresRequests: 0,
        valkeyRequests: 0,
        fallbackCount: 0,
        postgresAuthoritativeWrites: 0,
        valkeyAuthoritativeWrites: 0,
      },
      health: {
        status: 'healthy',
        observabilityStatus: 'healthy',
        operationalState: 'shadow_comparison_active',
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
      operationalSummary: expect.stringMatching(/^Runtime Mode: shadow \| Parity: 99\.9994% \| Comparison Failures: 0 \| Backend Failures: 0 \| Latency: Postgres 7\.12 ms, Valkey 7\.30 ms, Delta 0\.18 ms \| Valkey: ready \| Uptime: \d+s \| Status: healthy$/),
    })
    expect(body.runtime.uptimeSeconds).toBeGreaterThanOrEqual(0)
    expect(body.valkey.uptimeSeconds).toBeGreaterThanOrEqual(0)
  })
})
