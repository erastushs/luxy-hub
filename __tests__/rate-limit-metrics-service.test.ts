import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_RATE_LIMIT_SHADOW_ALERT_THRESHOLDS,
  RateLimitShadowMetricsService,
  getRateLimitShadowHealth,
  getRateLimitShadowMetrics,
  getRateLimitShadowOperationalSnapshot,
  resetRateLimitShadowMetricsForTests,
  type RateLimitShadowMetricsSnapshot,
} from '@/app/lib/rate-limit/metrics-service'
import type { RateLimitComparisonResult } from '@/app/lib/rate-limit/types'

function comparison(overrides: Partial<RateLimitComparisonResult> = {}): RateLimitComparisonResult {
  return {
    bucket: 'general',
    limitKey: 'VALIDATE',
    windowMs: 60_000,
    authoritativeBackend: 'postgres',
    shadowBackend: 'valkey',
    authoritativeAllowed: true,
    shadowAllowed: true,
    authoritativeRetryAfter: null,
    shadowRetryAfter: null,
    authoritativeLatencyMs: 2,
    shadowLatencyMs: 3,
    authoritativeError: null,
    shadowError: null,
    parity: true,
    mismatchReason: null,
    executedAt: '2026-06-23T00:00:00.000Z',
    ...overrides,
  }
}

function snapshot(overrides: Partial<RateLimitShadowMetricsSnapshot> = {}): RateLimitShadowMetricsSnapshot {
  return {
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
    ...overrides,
  }
}

describe('RateLimitShadowMetricsService', () => {
  beforeEach(() => {
    resetRateLimitShadowMetricsForTests()
  })

  it('returns an empty snapshot before comparisons', () => {
    const service = new RateLimitShadowMetricsService()

    expect(service.snapshot({ RATE_LIMIT_MODE: 'shadow' })).toEqual({
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
      runtimeMode: 'shadow',
      canaryRequests: 0,
      postgresRequests: 0,
      valkeyRequests: 0,
      fallbackCount: 0,
      canaryPercentage: 0,
    })
  })

  it('reports rollout metrics and configured canary percentage', () => {
    const service = new RateLimitShadowMetricsService()

    service.recordRolloutRequest('postgres')
    service.recordRolloutRequest('valkey')
    service.recordRolloutRequest('postgres', true)

    expect(service.snapshot({
      RATE_LIMIT_MODE: 'valkey_canary',
      RATE_LIMIT_CANARY_PERCENT: '5',
    })).toMatchObject({
      runtimeMode: 'valkey_canary',
      canaryPercentage: 5,
      canaryRequests: 1,
      postgresRequests: 2,
      valkeyRequests: 1,
      fallbackCount: 1,
    })
    const rollout = service.rolloutSnapshot({
      RATE_LIMIT_MODE: 'valkey_canary',
      RATE_LIMIT_CANARY_PERCENT: '5',
    })

    expect(rollout).toMatchObject({
      mode: 'valkey_canary',
      canaryPercentage: 5,
      configuredCanaryPercentage: 5,
      totalRequests: 3,
      nonCanaryRequests: 1,
      canaryRequests: 1,
      postgresRequests: 2,
      valkeyRequests: 1,
      fallbackCount: 1,
      postgresAuthoritativeWrites: 2,
      valkeyAuthoritativeWrites: 1,
    })
    expect(rollout.effectiveCanaryPercentage).toBeCloseTo(100 / 3)
    expect(rollout.effectivePostgresPercentage).toBeCloseTo(200 / 3)
    expect(rollout.effectiveValkeyPercentage).toBeCloseTo(100 / 3)
    expect(rollout.fallbackPercentage).toBeCloseTo(100 / 3)
  })

  it('aggregates parity, retry-after, backend, comparison, and latency metrics', () => {
    const service = new RateLimitShadowMetricsService()

    service.increment(comparison())
    service.increment(comparison({
      authoritativeAllowed: false,
      shadowAllowed: false,
      authoritativeRetryAfter: 60,
      shadowRetryAfter: 30,
      authoritativeLatencyMs: 7,
      shadowLatencyMs: 11,
      parity: false,
      mismatchReason: 'retry_after_mismatch',
    }))
    service.increment(comparison({
      shadowAllowed: null,
      shadowError: { name: 'Error', message: 'valkey unavailable' },
      parity: false,
      mismatchReason: 'error_state_mismatch',
    }))
    service.increment(comparison({
      authoritativeAllowed: null,
      shadowAllowed: null,
      parity: false,
      mismatchReason: 'comparison_failed',
    }))

    expect(service.snapshot({ RATE_LIMIT_MODE: 'shadow' })).toMatchObject({
      totalComparisons: 4,
      identical: 1,
      mismatches: 3,
      mismatchRate: 0.75,
      backendFailures: 1,
      authoritativeBackendFailures: 0,
      comparisonFailures: 1,
      avgPostgresLatencyMs: 3.25,
      avgValkeyLatencyMs: 5,
      avgLatencyDeltaMs: 1.75,
      decisionParity: {
        allow: { total: 2, identical: 1, rate: 0.5 },
        deny: { total: 1, identical: 1, rate: 1 },
      },
      retryAfterParity: { total: 1, identical: 0, rate: 0 },
      runtimeMode: 'shadow',
    })
    expect(service.snapshot().lastUpdatedAt).toEqual(expect.any(String))
  })

  it('resets counters', () => {
    const service = new RateLimitShadowMetricsService()
    service.increment(comparison())

    service.reset()

    expect(service.snapshot()).toMatchObject({
      totalComparisons: 0,
      identical: 0,
      mismatches: 0,
      lastUpdatedAt: null,
    })
  })

  it('merges snapshots without persistence', () => {
    const service = new RateLimitShadowMetricsService()
    service.increment(comparison())
    service.merge(snapshot({
      totalComparisons: 3,
      identical: 2,
      mismatches: 1,
      backendFailures: 1,
      authoritativeBackendFailures: 0,
      comparisonFailures: 1,
      avgLatencyDeltaMs: 4,
      avgPostgresLatencyMs: 2,
      avgValkeyLatencyMs: 6,
      decisionParity: {
        allow: { total: 2, identical: 2, rate: 1 },
        deny: { total: 1, identical: 0, rate: 0 },
      },
      retryAfterParity: { total: 1, identical: 0, rate: 0 },
      lastUpdatedAt: '2026-06-23T00:01:00.000Z',
    }))

    expect(service.snapshot()).toMatchObject({
      totalComparisons: 4,
      identical: 3,
      mismatches: 1,
      mismatchRate: 0.25,
      backendFailures: 1,
      authoritativeBackendFailures: 0,
      comparisonFailures: 1,
      avgPostgresLatencyMs: 2,
      avgValkeyLatencyMs: 5.25,
      avgLatencyDeltaMs: 3.25,
      decisionParity: {
        allow: { total: 3, identical: 3, rate: 1 },
        deny: { total: 1, identical: 0, rate: 0 },
      },
      retryAfterParity: { total: 1, identical: 0, rate: 0 },
      lastUpdatedAt: expect.any(String),
    })
  })

  it('handles large counter values', () => {
    const service = new RateLimitShadowMetricsService()
    service.merge(snapshot({
      totalComparisons: 154_203,
      identical: 154_202,
      mismatches: 1,
      mismatchRate: 1 / 154_203,
      backendFailures: 0,
      comparisonFailures: 0,
      avgPostgresLatencyMs: 1,
      avgValkeyLatencyMs: 1.18,
      avgLatencyDeltaMs: 0.18,
      decisionParity: {
        allow: { total: 100_000, identical: 99_999, rate: 0.99999 },
        deny: { total: 54_203, identical: 54_203, rate: 1 },
      },
      retryAfterParity: { total: 54_203, identical: 54_203, rate: 1 },
      lastUpdatedAt: '2026-06-23T00:00:00.000Z',
    }))

    expect(service.snapshot()).toMatchObject({
      totalComparisons: 154_203,
      identical: 154_202,
      mismatches: 1,
      avgPostgresLatencyMs: 1,
      avgValkeyLatencyMs: 1.18,
      avgLatencyDeltaMs: 0.18,
    })
  })

  it('reports internal shadow health fields', () => {
    const service = new RateLimitShadowMetricsService()
    service.increment(comparison())

    expect(service.health({ RATE_LIMIT_MODE: 'shadow' })).toMatchObject({
      enabled: true,
      runtimeMode: 'shadow',
      operationalState: 'shadow_comparison_active',
      observabilityStatus: 'healthy',
      totalComparisons: 1,
      mismatchRate: 0,
      backendFailures: 0,
      status: 'healthy',
      checkedAt: expect.any(String),
    })
    expect(service.health({ RATE_LIMIT_MODE: 'postgres' })).toMatchObject({
      enabled: false,
      runtimeMode: 'postgres',
      operationalState: 'postgres_authoritative',
      observabilityStatus: 'standby',
      status: 'disabled',
    })
    expect(service.health({ RATE_LIMIT_MODE: 'valkey_canary' })).toMatchObject({
      enabled: true,
      runtimeMode: 'valkey_canary',
      operationalState: 'valkey_canary_active',
      observabilityStatus: 'healthy',
      status: 'healthy',
    })
  })

  it('keeps latency-only differences healthy when parity and failures are clean', () => {
    const service = new RateLimitShadowMetricsService()

    service.increment(comparison({
      authoritativeLatencyMs: 90,
      shadowLatencyMs: 10,
    }))

    expect(service.snapshot({ RATE_LIMIT_MODE: 'shadow' })).toMatchObject({
      avgPostgresLatencyMs: 90,
      avgValkeyLatencyMs: 10,
      avgLatencyDeltaMs: -80,
      mismatchRate: 0,
      backendFailures: 0,
      comparisonFailures: 0,
    })
    expect(service.health({ RATE_LIMIT_MODE: 'shadow' }).status).toBe('healthy')
  })

  it('marks shadow health degraded for parity or shadow failures', () => {
    const degraded = new RateLimitShadowMetricsService()
    degraded.increment(comparison({
      shadowAllowed: false,
      parity: false,
      mismatchReason: 'decision_mismatch',
    }))

    const shadowFailure = new RateLimitShadowMetricsService()
    shadowFailure.increment(comparison({
      shadowError: { name: 'Error', message: 'valkey unavailable' },
      shadowAllowed: null,
      parity: false,
      mismatchReason: 'error_state_mismatch',
    }))

    expect(DEFAULT_RATE_LIMIT_SHADOW_ALERT_THRESHOLDS).toEqual({
      mismatchRate: 0.001,
      backendFailures: 1,
      latencyDeltaMs: 25,
      comparisonFailures: 1,
    })
    expect(degraded.health({ RATE_LIMIT_MODE: 'shadow' }).status).toBe('degraded')
    expect(shadowFailure.health({ RATE_LIMIT_MODE: 'shadow' }).status).toBe('degraded')
  })

  it('marks shadow health unhealthy when the authoritative backend fails', () => {
    const service = new RateLimitShadowMetricsService()

    service.increment(comparison({
      authoritativeError: { name: 'Error', message: 'postgres unavailable' },
      authoritativeAllowed: null,
      parity: false,
      mismatchReason: 'error_state_mismatch',
    }))

    expect(service.snapshot({ RATE_LIMIT_MODE: 'shadow' })).toMatchObject({
      backendFailures: 1,
      authoritativeBackendFailures: 1,
    })
    expect(service.health({ RATE_LIMIT_MODE: 'shadow' }).status).toBe('unhealthy')
  })

  it('formats an operational summary for future dashboards', () => {
    const service = new RateLimitShadowMetricsService()
    service.merge(snapshot({
      totalComparisons: 154_203,
      identical: 154_202,
      mismatches: 1,
      backendFailures: 0,
      comparisonFailures: 0,
      avgPostgresLatencyMs: 1,
      avgValkeyLatencyMs: 1.18,
      avgLatencyDeltaMs: 0.18,
    }))

    expect(service.operationalSnapshot({ RATE_LIMIT_MODE: 'shadow' }).summary).toBe([
      'Runtime Mode: shadow',
      'Comparisons: 154,203',
      'Parity: 99.9994%',
      'Backend Failures: 0',
      'Comparison Failures: 0',
      'Latency: Postgres 1.00 ms, Valkey 1.18 ms, Delta 0.18 ms',
      'Status: Healthy',
    ].join('\n'))
    expect(service.operationalSnapshot({ RATE_LIMIT_MODE: 'shadow' })).toMatchObject({
      operationalState: 'shadow_comparison_active',
      observabilityStatus: 'healthy',
    })
  })

  it('exposes singleton internal report, health, and operational helpers', () => {
    resetRateLimitShadowMetricsForTests()
    expect(getRateLimitShadowMetrics({ RATE_LIMIT_MODE: 'shadow' })).toMatchObject({
      totalComparisons: 0,
      runtimeMode: 'shadow',
    })
    expect(getRateLimitShadowHealth({ RATE_LIMIT_MODE: 'shadow' })).toMatchObject({
      enabled: true,
      runtimeMode: 'shadow',
      operationalState: 'shadow_comparison_active',
      totalComparisons: 0,
    })
    expect(getRateLimitShadowOperationalSnapshot({ RATE_LIMIT_MODE: 'shadow' })).toMatchObject({
      runtimeMode: 'shadow',
      comparisons: 0,
      parityRate: 0,
    })
  })
})
