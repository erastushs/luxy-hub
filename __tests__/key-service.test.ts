import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/lib/repositories/key-repository', () => ({
  findKey: vi.fn(),
  insertKey: vi.fn(),
  deactivateExpiredKeys: vi.fn(),
}))

vi.mock('@/app/lib/key-generator', () => ({
  generateKey: vi.fn(),
}))

import { createKey, validateKey } from '@/app/lib/services/key-service'
import { findKey, insertKey } from '@/app/lib/repositories/key-repository'
import { generateKey } from '@/app/lib/key-generator'
import { getFreeKeyFormat, isValidKeyFormat } from '@/app/lib/validators'

const mockedFindKey = vi.mocked(findKey)
const mockedInsertKey = vi.mocked(insertKey)
const mockedGenerateKey = vi.mocked(generateKey)

function keyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'key-uuid-1',
    key: 'LUXY-FREE-ABCD-1234-EFGH',
    is_active: true,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('key service authorization', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('authorizes a valid active key', async () => {
    mockedFindKey.mockResolvedValue(keyRow())

    await expect(validateKey('LUXY-FREE-ABCD-1234-EFGH')).resolves.toEqual({ valid: true })
    expect(mockedFindKey).toHaveBeenCalledWith('LUXY-FREE-ABCD-1234-EFGH')
  })

  it('accepts active legacy key format without rewriting it', async () => {
    mockedFindKey.mockResolvedValue(keyRow({ key: 'LUXY-ABCD-1234-EFGH' }))

    await expect(validateKey('LUXY-ABCD-1234-EFGH')).resolves.toEqual({ valid: true })
    expect(mockedFindKey).toHaveBeenCalledWith('LUXY-ABCD-1234-EFGH')
  })

  it('classifies free key formats centrally', () => {
    expect(isValidKeyFormat('LUXY-FREE-ABCD-1234-EFGH')).toBe(true)
    expect(getFreeKeyFormat('LUXY-FREE-ABCD-1234-EFGH')).toBe('current')
    expect(isValidKeyFormat('LUXY-ABCD-1234-EFGH')).toBe(true)
    expect(getFreeKeyFormat('LUXY-ABCD-1234-EFGH')).toBe('legacy')
    expect(isValidKeyFormat('LUXY-PREM-ABCD-1234-EFGH')).toBe(false)
  })

  it('rejects invalid key format before repository lookup', async () => {
    await expect(validateKey('BAD-KEY')).resolves.toEqual({
      valid: false,
      status: 403,
      message: 'Invalid key',
    })
    expect(mockedFindKey).not.toHaveBeenCalled()
  })

  it('rejects disabled keys', async () => {
    mockedFindKey.mockResolvedValue(keyRow({ is_active: false }))

    await expect(validateKey('LUXY-FREE-ABCD-1234-EFGH')).resolves.toEqual({
      valid: false,
      status: 403,
      message: 'Invalid key',
    })
  })

  it('rejects expired keys', async () => {
    mockedFindKey.mockResolvedValue(keyRow({ expires_at: new Date(Date.now() - 60_000).toISOString() }))

    await expect(validateKey('LUXY-FREE-ABCD-1234-EFGH')).resolves.toEqual({
      valid: false,
      status: 403,
      message: 'Invalid key',
    })
  })

  it('retries key creation after an insert collision', async () => {
    mockedGenerateKey
      .mockReturnValueOnce('LUXY-FREE-COLL-ISION-0001')
      .mockReturnValueOnce('LUXY-FREE-UNIQ-UE00-0002')
    mockedInsertKey.mockResolvedValueOnce(false).mockResolvedValueOnce(true)

    await expect(createKey()).resolves.toBe('LUXY-FREE-UNIQ-UE00-0002')
    expect(mockedInsertKey).toHaveBeenCalledTimes(2)
  })

  it('fails safely when duplicate generation exhausts retries', async () => {
    mockedGenerateKey.mockReturnValue('LUXY-FREE-DUPL-ICAT-0001')
    mockedInsertKey.mockResolvedValue(false)

    await expect(createKey()).rejects.toThrow('Failed to generate unique key after 5 attempts')
    expect(mockedInsertKey).toHaveBeenCalledTimes(5)
  })

  it('supports concurrent key generation with independent inserts', async () => {
    mockedGenerateKey
      .mockReturnValueOnce('LUXY-FREE-CONC-URRE-0001')
      .mockReturnValueOnce('LUXY-FREE-CONC-URRE-0002')
    mockedInsertKey.mockResolvedValue(true)

    await expect(Promise.all([createKey(), createKey()])).resolves.toEqual([
      'LUXY-FREE-CONC-URRE-0001',
      'LUXY-FREE-CONC-URRE-0002',
    ])
    expect(mockedInsertKey).toHaveBeenCalledTimes(2)
  })
})
