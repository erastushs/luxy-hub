import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/lib/services/key-service', () => ({
  createKeyRecord: vi.fn(),
}))

import { createKeyRecord } from '@/app/lib/services/key-service'
import { issuePaidKey, resolvePaidKeyExpiration } from '@/app/lib/services/paid-key-service'

const mockedCreateKeyRecord = vi.mocked(createKeyRecord)

describe('paid key service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-16T00:00:00.000Z'))
  })

  it('issues weekly keys with a seven day expiration', async () => {
    mockedCreateKeyRecord.mockResolvedValue({ key: 'LUXY-PREM-BBBB-CCCC', expires_at: '2026-06-23T00:00:00.000Z' })

    const result = await issuePaidKey({ duration: 'weekly', name: 'Monthly Discord', description: ' supporter ' })

    expect(mockedCreateKeyRecord).toHaveBeenCalledWith({
      expiresAt: new Date('2026-06-23T00:00:00.000Z'),
      keyCategory: 'premium',
      keyType: 'weekly',
      name: 'Monthly Discord',
      description: 'supporter',
    })
    expect(result).toEqual({
      key: 'LUXY-PREM-BBBB-CCCC',
      expires_at: '2026-06-23T00:00:00.000Z',
      duration: 'weekly',
    })
  })

  it('issues monthly keys with a thirty day expiration', async () => {
    mockedCreateKeyRecord.mockResolvedValue({ key: 'LUXY-PREM-MNTH-CCCC', expires_at: '2026-07-16T00:00:00.000Z' })

    const result = await issuePaidKey({ duration: 'monthly', name: 'Tester' })

    expect(mockedCreateKeyRecord).toHaveBeenCalledWith({
      expiresAt: new Date('2026-07-16T00:00:00.000Z'),
      keyCategory: 'premium',
      keyType: 'monthly',
      name: 'Tester',
      description: null,
    })
    expect(result.expires_at).toBe('2026-07-16T00:00:00.000Z')
  })

  it('accepts valid custom expirations', () => {
    const expiresAt = resolvePaidKeyExpiration({ duration: 'custom', expiresAt: '2026-07-01T12:30:00.000Z', name: 'Giveaway Winner' })

    expect(expiresAt.toISOString()).toBe('2026-07-01T12:30:00.000Z')
  })

  it('issues custom keys with custom key type', async () => {
    mockedCreateKeyRecord.mockResolvedValue({ key: 'LUXY-PREM-CUST-CCCC', expires_at: '2026-07-01T12:30:00.000Z' })

    const result = await issuePaidKey({ duration: 'custom', expiresAt: '2026-07-01T12:30:00.000Z', name: 'Giveaway Winner' })

    expect(mockedCreateKeyRecord).toHaveBeenCalledWith({
      expiresAt: new Date('2026-07-01T12:30:00.000Z'),
      keyCategory: 'premium',
      keyType: 'custom',
      name: 'Giveaway Winner',
      description: null,
    })
    expect(result.duration).toBe('custom')
  })

  it('rejects invalid or past custom expirations', () => {
    expect(() => resolvePaidKeyExpiration({ duration: 'custom', expiresAt: 'not-a-date', name: 'Giveaway Winner' })).toThrow('valid date')
    expect(() => resolvePaidKeyExpiration({ duration: 'custom', expiresAt: '2026-06-15T00:00:00.000Z', name: 'Giveaway Winner' })).toThrow('future')
  })

  it('requires premium key names', async () => {
    await expect(issuePaidKey({ duration: 'weekly', name: '   ' })).rejects.toThrow('Premium key name is required')
    expect(mockedCreateKeyRecord).not.toHaveBeenCalled()
  })
})
