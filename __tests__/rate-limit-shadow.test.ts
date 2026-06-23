import { beforeEach, describe, expect, it, vi } from 'vitest'
import { executeRateLimitShadow } from '@/app/lib/rate-limit/shadow'
import type { RateLimitResult } from '@/app/lib/rate-limit/types'

const baseContext = {
  bucket: 'ip-hash:test-bucket',
  limitKey: 'VALIDATE',
  windowMs: 60_000,
  authoritativeBackend: 'postgres' as const,
  shadowBackend: 'postgres' as const,
}

function allowed(): Promise<RateLimitResult> {
  return Promise.resolve({ allowed: true })
}

function denied(retryAfter: number): Promise<RateLimitResult> {
  return Promise.resolve({ allowed: false, retryAfter })
}

describe('rate-limit shadow executor', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('returns the authoritative result when both adapters allow', async () => {
    const execution = await executeRateLimitShadow({
      context: baseContext,
      authoritative: allowed,
      shadow: allowed,
    })

    expect(execution.result).toEqual({ allowed: true })
    expect(execution.comparison).toMatchObject({
      bucket: 'ip-hash:test-bucket',
      limitKey: 'VALIDATE',
      windowMs: 60_000,
      authoritativeBackend: 'postgres',
      shadowBackend: 'postgres',
      authoritativeAllowed: true,
      shadowAllowed: true,
      authoritativeRetryAfter: null,
      shadowRetryAfter: null,
      parity: true,
      mismatchReason: null,
    })
    expect(execution.comparison.executedAt).toEqual(expect.any(String))
    expect(execution.comparison.authoritativeLatencyMs).toEqual(expect.any(Number))
    expect(execution.comparison.shadowLatencyMs).toEqual(expect.any(Number))
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('compares retry-after values for denied decisions', async () => {
    const execution = await executeRateLimitShadow({
      context: baseContext,
      authoritative: () => denied(60),
      shadow: () => denied(60),
    })

    expect(execution.result).toEqual({ allowed: false, retryAfter: 60 })
    expect(execution.comparison).toMatchObject({
      authoritativeAllowed: false,
      shadowAllowed: false,
      authoritativeRetryAfter: 60,
      shadowRetryAfter: 60,
      parity: true,
      mismatchReason: null,
    })
  })

  it('detects decision mismatches while preserving authoritative result', async () => {
    const execution = await executeRateLimitShadow({
      context: baseContext,
      authoritative: allowed,
      shadow: () => denied(60),
    })

    expect(execution.result).toEqual({ allowed: true })
    expect(execution.comparison).toMatchObject({
      authoritativeAllowed: true,
      shadowAllowed: false,
      parity: false,
      mismatchReason: 'decision_mismatch',
    })
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('shadow_mismatch'))
  })

  it('detects retry-after mismatches', async () => {
    const execution = await executeRateLimitShadow({
      context: baseContext,
      authoritative: () => denied(60),
      shadow: () => denied(30),
    })

    expect(execution.result).toEqual({ allowed: false, retryAfter: 60 })
    expect(execution.comparison).toMatchObject({
      parity: false,
      mismatchReason: 'retry_after_mismatch',
      authoritativeRetryAfter: 60,
      shadowRetryAfter: 30,
    })
  })

  it('detects error state mismatches without throwing', async () => {
    const execution = await executeRateLimitShadow({
      context: baseContext,
      authoritative: allowed,
      shadow: async () => {
        throw new Error('shadow failed')
      },
    })

    expect(execution.result).toEqual({ allowed: true })
    expect(execution.comparison).toMatchObject({
      authoritativeError: null,
      shadowError: { name: 'Error', message: 'shadow failed' },
      parity: false,
      mismatchReason: 'error_state_mismatch',
    })
  })

  it('returns fail-closed fallback only if the authoritative operation throws', async () => {
    const execution = await executeRateLimitShadow({
      context: baseContext,
      authoritative: async () => {
        throw new Error('authoritative failed')
      },
      shadow: allowed,
    })

    expect(execution.result).toEqual({ allowed: false, retryAfter: 0 })
    expect(execution.comparison).toMatchObject({
      authoritativeAllowed: null,
      shadowAllowed: true,
      authoritativeError: { name: 'Error', message: 'authoritative failed' },
      parity: false,
      mismatchReason: 'error_state_mismatch',
    })
  })

  it('records backend names and latency fields', async () => {
    const execution = await executeRateLimitShadow({
      context: {
        ...baseContext,
        authoritativeBackend: 'postgres',
        shadowBackend: 'valkey',
      },
      authoritative: allowed,
      shadow: allowed,
    })

    expect(execution.comparison.authoritativeBackend).toBe('postgres')
    expect(execution.comparison.shadowBackend).toBe('valkey')
    expect(execution.comparison.authoritativeLatencyMs).toEqual(expect.any(Number))
    expect(execution.comparison.shadowLatencyMs).toEqual(expect.any(Number))
  })

  it('does not log sensitive bucket identity on mismatch', async () => {
    await executeRateLimitShadow({
      context: {
        ...baseContext,
        bucket: 'raw-ip-or-token-that-must-not-be-logged',
      },
      authoritative: allowed,
      shadow: () => denied(60),
    })

    const output = vi.mocked(console.warn).mock.calls.flat().join('\n')
    expect(output).toContain('shadow_mismatch')
    expect(output).not.toContain('raw-ip-or-token-that-must-not-be-logged')
  })

  it('does not allow logging failures to affect authoritative result', async () => {
    vi.mocked(console.warn).mockImplementation(() => {
      throw new Error('logger failed')
    })

    const execution = await executeRateLimitShadow({
      context: baseContext,
      authoritative: allowed,
      shadow: () => denied(60),
    })

    expect(execution.result).toEqual({ allowed: true })
    expect(execution.comparison.mismatchReason).toBe('decision_mismatch')
  })
})
