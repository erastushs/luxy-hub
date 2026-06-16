import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/lib/services/key-service', () => ({
  createKeyWithExpiration: vi.fn(),
}))

import { createKeyWithExpiration } from '@/app/lib/services/key-service'
import { issuePaidKey, resolvePaidKeyExpiration } from '@/app/lib/services/paid-key-service'

const mockedCreateKeyWithExpiration = vi.mocked(createKeyWithExpiration)

describe('paid key service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-16T00:00:00.000Z'))
  })

  it('issues weekly keys with a seven day expiration', async () => {
    mockedCreateKeyWithExpiration.mockResolvedValue('LUXY-WEEK-BBBB-CCCC')

    const result = await issuePaidKey({ duration: 'weekly' })

    expect(mockedCreateKeyWithExpiration).toHaveBeenCalledWith(new Date('2026-06-23T00:00:00.000Z'))
    expect(result).toEqual({
      key: 'LUXY-WEEK-BBBB-CCCC',
      expires_at: '2026-06-23T00:00:00.000Z',
      duration: 'weekly',
    })
  })

  it('issues monthly keys with a thirty day expiration', async () => {
    mockedCreateKeyWithExpiration.mockResolvedValue('LUXY-MNTH-BBBB-CCCC')

    const result = await issuePaidKey({ duration: 'monthly' })

    expect(mockedCreateKeyWithExpiration).toHaveBeenCalledWith(new Date('2026-07-16T00:00:00.000Z'))
    expect(result.expires_at).toBe('2026-07-16T00:00:00.000Z')
  })

  it('accepts valid custom expirations', () => {
    const expiresAt = resolvePaidKeyExpiration({ duration: 'custom', expiresAt: '2026-07-01T12:30:00.000Z' })

    expect(expiresAt.toISOString()).toBe('2026-07-01T12:30:00.000Z')
  })

  it('rejects invalid or past custom expirations', () => {
    expect(() => resolvePaidKeyExpiration({ duration: 'custom', expiresAt: 'not-a-date' })).toThrow('valid date')
    expect(() => resolvePaidKeyExpiration({ duration: 'custom', expiresAt: '2026-06-15T00:00:00.000Z' })).toThrow('future')
  })
})
