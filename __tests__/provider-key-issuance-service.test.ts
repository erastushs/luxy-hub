import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/lib/providers/registry', () => ({
  getProvider: vi.fn(),
}))

vi.mock('@/app/lib/services/key-service', () => ({
  DEFAULT_KEY_DURATION_MS: 24 * 60 * 60 * 1000,
  createKeyRecord: vi.fn(),
}))

import { getProvider } from '@/app/lib/providers/registry'
import { createKeyRecord } from '@/app/lib/services/key-service'
import { issueProviderKey } from '@/app/lib/services/provider-key-issuance-service'
import type { KeyProvider } from '@/app/lib/providers/types'

const mockedGetProvider = vi.mocked(getProvider)
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
      verifyToken: vi.fn().mockResolvedValue(verification),
    }
    mockedGetProvider.mockReturnValue(provider)
    mockedCreateKeyRecord.mockResolvedValue({ key: 'LUXY-AAAA-BBBB-CCCC', expires_at: '2026-06-17T00:00:00.000Z' })

    const result = await issueProviderKey({ providerKey: 'workink', token: 'token-1', clientIP: '127.0.0.1' })

    expect(mockedGetProvider).toHaveBeenCalledWith('workink')
    expect(provider.verifyToken).toHaveBeenCalledWith({ token: 'token-1', clientIP: '127.0.0.1' })
    expect(mockedCreateKeyRecord).toHaveBeenCalledWith(new Date('2026-06-17T00:00:00.000Z'))
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
      verifyToken: vi.fn().mockResolvedValue(verification),
    }
    mockedGetProvider.mockReturnValue(provider)

    const result = await issueProviderKey({ providerKey: 'workink', token: 'bad', clientIP: '127.0.0.1' })

    expect(mockedCreateKeyRecord).not.toHaveBeenCalled()
    expect(result).toEqual({ success: false, message: 'Invalid token', verification })
  })
})
