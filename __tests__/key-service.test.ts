import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/lib/repositories/key-repository', () => ({
  findKey: vi.fn(),
  insertKey: vi.fn(),
  deactivateExpiredKeys: vi.fn(),
}))

vi.mock('@/app/lib/key-generator', () => ({
  generateKey: vi.fn(),
}))

import { generateKey } from '@/app/lib/key-generator'
import { insertKey } from '@/app/lib/repositories/key-repository'
import { createKey, createKeyWithExpiration } from '@/app/lib/services/key-service'

const mockedGenerateKey = vi.mocked(generateKey)
const mockedInsertKey = vi.mocked(insertKey)

describe('key service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useRealTimers()
  })

  it('keeps createKey as a 24h compatibility wrapper', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-16T00:00:00.000Z'))
    mockedGenerateKey.mockReturnValue('LUXY-AAAA-BBBB-CCCC')
    mockedInsertKey.mockResolvedValue(true)

    const key = await createKey()

    expect(key).toBe('LUXY-AAAA-BBBB-CCCC')
    expect(mockedInsertKey).toHaveBeenCalledWith('LUXY-AAAA-BBBB-CCCC', '2026-06-17T00:00:00.000Z')
  })

  it('retries when a generated key collides', async () => {
    const expiresAt = new Date('2026-06-20T00:00:00.000Z')
    mockedGenerateKey
      .mockReturnValueOnce('LUXY-DUPE-BBBB-CCCC')
      .mockReturnValueOnce('LUXY-UNIQ-BBBB-CCCC')
    mockedInsertKey.mockResolvedValueOnce(false).mockResolvedValueOnce(true)

    const key = await createKeyWithExpiration(expiresAt)

    expect(key).toBe('LUXY-UNIQ-BBBB-CCCC')
    expect(mockedInsertKey).toHaveBeenCalledTimes(2)
  })
})
