import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/lib/providers/registry', () => ({
  resolveEnabledProvider: vi.fn(),
}))

vi.mock('@/app/lib/services/key-service', () => ({
  DEFAULT_KEY_DURATION_MS: 24 * 60 * 60 * 1000,
  createKeyRecord: vi.fn(),
}))

import { resolveEnabledProvider } from '@/app/lib/providers/registry'
import { createKeyRecord } from '@/app/lib/services/key-service'
import { issueProviderKey } from '@/app/lib/services/provider-key-issuance-service'
import type { KeyProvider } from '@/app/lib/providers/types'

const mockedResolveEnabledProvider = vi.mocked(resolveEnabledProvider)
const mockedCreateKeyRecord = vi.mocked(createKeyRecord)

describe('provider key issuance service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useRealTimers()
  })

  it('verifies through the selected provider before issuing a key', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-16T00:00:00.000Z'))

    const verification = { success: true, message: 'Token verified', validToken: true, tokenInfo: { offer: 'ok' } }
    const provider: KeyProvider = {
      key: 'workink',
      metadata: {
        key: 'workink',
        displayName: 'Work.ink',
        description: 'Verify with Work.ink',
        enabled: true,
        order: 10,
        ctaLabel: 'Generate Key via Work.ink',
        estimatedTimeLabel: 'Usually 30-60 seconds',
      },
      verifyToken: vi.fn().mockResolvedValue(verification),
    }
    mockedResolveEnabledProvider.mockReturnValue(provider)
    mockedCreateKeyRecord.mockResolvedValue({ key: 'LUXY-AAAA-BBBB-CCCC', expires_at: '2026-06-17T00:00:00.000Z' })

    const result = await issueProviderKey({ providerKey: 'workink', token: 'token-1', clientIP: '127.0.0.1' })

    expect(mockedResolveEnabledProvider).toHaveBeenCalledWith('workink')
    expect(provider.verifyToken).toHaveBeenCalledWith({ token: 'token-1', clientIP: '127.0.0.1' })
    expect(mockedCreateKeyRecord).toHaveBeenCalledWith({
      expiresAt: new Date('2026-06-17T00:00:00.000Z'),
      keyCategory: 'free',
    })
    expect(result).toEqual({
      success: true,
      key: 'LUXY-AAAA-BBBB-CCCC',
      expires_at: '2026-06-17T00:00:00.000Z',
      verification,
    })
  })

  it('does not issue a key when provider verification fails', async () => {
    const verification = { success: false, message: 'Invalid token', validToken: false }
    const provider: KeyProvider = {
      key: 'workink',
      metadata: {
        key: 'workink',
        displayName: 'Work.ink',
        description: 'Verify with Work.ink',
        enabled: true,
        order: 10,
        ctaLabel: 'Generate Key via Work.ink',
        estimatedTimeLabel: 'Usually 30-60 seconds',
      },
      verifyToken: vi.fn().mockResolvedValue(verification),
    }
    mockedResolveEnabledProvider.mockReturnValue(provider)

    const result = await issueProviderKey({ providerKey: 'workink', token: 'bad', clientIP: '127.0.0.1' })

    expect(mockedCreateKeyRecord).not.toHaveBeenCalled()
    expect(result).toEqual({ success: false, message: 'Invalid token', errorCode: 'invalid_token', verification })
  })

  it('rejects disabled or unknown providers without issuing a key', async () => {
    mockedResolveEnabledProvider.mockReturnValue(null)

    const result = await issueProviderKey({ providerKey: 'missing', token: 'token', clientIP: '127.0.0.1' })

    expect(mockedCreateKeyRecord).not.toHaveBeenCalled()
    expect(result).toEqual({
      success: false,
      message: 'Provider unavailable',
      errorCode: 'provider_unavailable',
      verification: {
        success: false,
        message: 'Provider unavailable',
        validToken: false,
        errorCode: 'provider_unavailable',
      },
    })
  })
})
