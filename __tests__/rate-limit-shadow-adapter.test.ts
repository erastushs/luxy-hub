import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ShadowRateLimitAdapter } from '@/app/lib/rate-limit/shadow-adapter'
import {
  getRateLimitShadowParityReport,
  resetRateLimitShadowMetricsForTests,
} from '@/app/lib/rate-limit/shadow'
import type { RateLimitAdapter } from '@/app/lib/rate-limit/types'

function adapterStub(overrides: Partial<RateLimitAdapter> = {}): RateLimitAdapter {
  return {
    checkGeneralLimit: vi.fn(async () => ({ allowed: true as const })),
    checkLoginFailure: vi.fn(async () => ({ allowed: true as const })),
    recordLoginFailure: vi.fn(async () => {}),
    clearLoginFailures: vi.fn(async () => {}),
    checkEventLimit: vi.fn(async () => ({ allowed: true as const })),
    ...overrides,
  }
}

describe('ShadowRateLimitAdapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetRateLimitShadowMetricsForTests()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('returns PostgreSQL authoritative general decisions while executing Valkey shadow', async () => {
    const postgres = adapterStub({
      checkGeneralLimit: vi.fn(async () => ({ allowed: false as const, retryAfter: 60 })),
    })
    const valkey = adapterStub({
      checkGeneralLimit: vi.fn(async () => ({ allowed: true as const })),
    })
    const adapter = new ShadowRateLimitAdapter(postgres, valkey)

    const result = await adapter.checkGeneralLimit('203.0.113.10', 'VALIDATE')

    expect(result).toEqual({ allowed: false, retryAfter: 60 })
    expect(postgres.checkGeneralLimit).toHaveBeenCalledWith('203.0.113.10', 'VALIDATE')
    expect(valkey.checkGeneralLimit).toHaveBeenCalledWith('203.0.113.10', 'VALIDATE')
    expect(getRateLimitShadowParityReport()).toMatchObject({
      totalComparisons: 1,
      mismatches: 1,
    })
  })

  it('preserves PostgreSQL when Valkey shadow evaluation throws', async () => {
    const postgres = adapterStub({
      checkGeneralLimit: vi.fn(async () => ({ allowed: true as const })),
    })
    const valkey = adapterStub({
      checkGeneralLimit: vi.fn(async () => {
        throw new Error('valkey unavailable')
      }),
    })
    const adapter = new ShadowRateLimitAdapter(postgres, valkey)

    await expect(adapter.checkGeneralLimit('203.0.113.10', 'VALIDATE')).resolves.toEqual({
      allowed: true,
    })
    expect(getRateLimitShadowParityReport()).toMatchObject({
      totalComparisons: 1,
      backendFailures: 1,
      mismatches: 1,
    })
  })

  it('continues fail-closed when PostgreSQL authoritative evaluation throws', async () => {
    const postgres = adapterStub({
      checkEventLimit: vi.fn(async () => {
        throw new Error('postgres unavailable')
      }),
    })
    const valkey = adapterStub({
      checkEventLimit: vi.fn(async () => ({ allowed: true as const })),
    })
    const adapter = new ShadowRateLimitAdapter(postgres, valkey)

    await expect(adapter.checkEventLimit('session-1')).resolves.toEqual({
      allowed: false,
      retryAfter: 0,
    })
    expect(getRateLimitShadowParityReport()).toMatchObject({
      totalComparisons: 1,
      backendFailures: 1,
      mismatches: 1,
    })
  })

  it('executes login checks through both adapters', async () => {
    const postgres = adapterStub({
      checkLoginFailure: vi.fn(async () => ({ allowed: true as const })),
    })
    const valkey = adapterStub({
      checkLoginFailure: vi.fn(async () => ({ allowed: true as const })),
    })
    const adapter = new ShadowRateLimitAdapter(postgres, valkey)

    await expect(adapter.checkLoginFailure('203.0.113.10', 'creator@example.com')).resolves.toEqual({
      allowed: true,
    })
    expect(postgres.checkLoginFailure).toHaveBeenCalledWith('203.0.113.10', 'creator@example.com')
    expect(valkey.checkLoginFailure).toHaveBeenCalledWith('203.0.113.10', 'creator@example.com')
    expect(getRateLimitShadowParityReport().identical).toBe(1)
  })

  it('executes shadow login mutations without changing PostgreSQL mutation behavior', async () => {
    const postgres = adapterStub()
    const valkey = adapterStub({
      recordLoginFailure: vi.fn(async () => {
        throw new Error('shadow write failed')
      }),
      clearLoginFailures: vi.fn(async () => {
        throw new Error('shadow clear failed')
      }),
    })
    const adapter = new ShadowRateLimitAdapter(postgres, valkey)

    await expect(adapter.recordLoginFailure('203.0.113.10', 'creator@example.com')).resolves.toBeUndefined()
    await expect(adapter.clearLoginFailures('203.0.113.10', 'creator@example.com')).resolves.toBeUndefined()

    expect(postgres.recordLoginFailure).toHaveBeenCalledWith('203.0.113.10', 'creator@example.com')
    expect(postgres.clearLoginFailures).toHaveBeenCalledWith('203.0.113.10', 'creator@example.com')
    expect(console.warn).not.toHaveBeenCalled()
  })
})
