import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/lib/repositories/key-repository', () => ({
  findKey: vi.fn(),
  insertKey: vi.fn(),
  deactivateExpiredKeys: vi.fn(),
  listKeys: vi.fn(),
  setKeyActiveState: vi.fn(),
}))

vi.mock('@/app/lib/key-generator', () => ({
  generateFreeKey: vi.fn(),
  generateKey: vi.fn(),
  generatePremiumKey: vi.fn(),
}))

import { generateFreeKey, generateKey, generatePremiumKey } from '@/app/lib/key-generator'
import { insertKey, listKeys, setKeyActiveState } from '@/app/lib/repositories/key-repository'
import { createKey, createKeyRecord, createKeyWithExpiration, getDashboardKeyStatus, listDashboardKeys, updateDashboardKeyState } from '@/app/lib/services/key-service'
import { isValidKeyFormat } from '@/app/lib/validators'

const mockedGenerateFreeKey = vi.mocked(generateFreeKey)
const mockedGenerateKey = vi.mocked(generateKey)
const mockedGeneratePremiumKey = vi.mocked(generatePremiumKey)
const mockedInsertKey = vi.mocked(insertKey)
const mockedListKeys = vi.mocked(listKeys)
const mockedSetKeyActiveState = vi.mocked(setKeyActiveState)

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
    expect(mockedInsertKey).toHaveBeenCalledWith({
      key: 'LUXY-AAAA-BBBB-CCCC',
      expiresAt: '2026-06-17T00:00:00.000Z',
      keyCategory: 'legacy',
      keyType: 'legacy',
      name: null,
      description: null,
    })
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

  it('creates free keys with the free format and category', async () => {
    const expiresAt = new Date('2026-06-20T00:00:00.000Z')
    mockedGenerateFreeKey.mockReturnValue('LUXY-FREE-AAAA-BBBB')
    mockedInsertKey.mockResolvedValue(true)

    const record = await createKeyRecord({ expiresAt, keyCategory: 'free' })

    expect(record.key).toBe('LUXY-FREE-AAAA-BBBB')
    expect(mockedInsertKey).toHaveBeenCalledWith({
      key: 'LUXY-FREE-AAAA-BBBB',
      expiresAt: '2026-06-20T00:00:00.000Z',
      keyCategory: 'free',
      keyType: 'legacy',
      name: null,
      description: null,
    })
  })

  it('propagates explicit free key type', async () => {
    const expiresAt = new Date('2026-06-20T00:00:00.000Z')
    mockedGenerateFreeKey.mockReturnValue('LUXY-FREE-AAAA-BBBB')
    mockedInsertKey.mockResolvedValue(true)

    const record = await createKeyRecord({ expiresAt, keyCategory: 'free', keyType: 'free' })

    expect(record.key).toBe('LUXY-FREE-AAAA-BBBB')
    expect(mockedInsertKey).toHaveBeenCalledWith({
      key: 'LUXY-FREE-AAAA-BBBB',
      expiresAt: '2026-06-20T00:00:00.000Z',
      keyCategory: 'free',
      keyType: 'free',
      name: null,
      description: null,
    })
  })

  it('creates premium keys with the premium format, category, and metadata', async () => {
    const expiresAt = new Date('2026-06-20T00:00:00.000Z')
    mockedGeneratePremiumKey.mockReturnValue('LUXY-PREM-AAAA-BBBB')
    mockedInsertKey.mockResolvedValue(true)

    const record = await createKeyRecord({
      expiresAt,
      keyCategory: 'premium',
      name: 'Monthly Discord',
      description: 'June supporter',
    })

    expect(record.key).toBe('LUXY-PREM-AAAA-BBBB')
    expect(mockedInsertKey).toHaveBeenCalledWith({
      key: 'LUXY-PREM-AAAA-BBBB',
      expiresAt: '2026-06-20T00:00:00.000Z',
      keyCategory: 'premium',
      keyType: 'legacy',
      name: 'Monthly Discord',
      description: 'June supporter',
    })
  })

  it('derives dashboard key status from active and expiration fields', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-17T00:00:00.000Z'))

    expect(getDashboardKeyStatus({ is_active: false, expires_at: '2026-06-18T00:00:00.000Z' })).toBe('disabled')
    expect(getDashboardKeyStatus({ is_active: true, expires_at: '2026-06-16T00:00:00.000Z' })).toBe('expired')
    expect(getDashboardKeyStatus({ is_active: true, expires_at: '2026-06-18T00:00:00.000Z' })).toBe('active')
  })

  it('lists dashboard keys with summary counts and search', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-17T00:00:00.000Z'))
    mockedListKeys.mockResolvedValue([
      { id: 'key-1', key: 'LUXY-AAAA-BBBB-CCCC', is_active: true, expires_at: '2026-06-18T00:00:00.000Z', created_at: '2026-06-16T00:00:00.000Z' },
      { id: 'key-2', key: 'LUXY-DDDD-EEEE-FFFF', is_active: true, expires_at: '2026-06-16T00:00:00.000Z', created_at: '2026-06-15T00:00:00.000Z' },
      { id: 'key-3', key: 'LUXY-GGGG-HHHH-IIII', is_active: false, expires_at: '2026-06-18T00:00:00.000Z', created_at: '2026-06-14T00:00:00.000Z' },
    ].map((key) => ({ ...key, key_category: 'premium' as const, key_type: 'weekly' as const, name: 'Premium Key', description: null })))

    const result = await listDashboardKeys('AAAA')

    expect(mockedListKeys).toHaveBeenCalledWith({ search: 'AAAA', limit: 200, category: 'premium' })
    expect(result.keys.map((key) => key.status)).toEqual(['active', 'expired', 'disabled'])
    expect(result.summary).toEqual({ total: 3, active: 1, expired: 1, disabled: 1 })
  })

  it('updates dashboard key active state', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-17T00:00:00.000Z'))
    mockedSetKeyActiveState.mockResolvedValue({
      id: 'key-1',
      key: 'LUXY-AAAA-BBBB-CCCC',
      key_category: 'premium',
      key_type: 'monthly',
      name: 'Monthly Discord',
      description: null,
      is_active: false,
      expires_at: '2026-06-18T00:00:00.000Z',
      created_at: '2026-06-16T00:00:00.000Z',
    })

    const result = await updateDashboardKeyState('key-1', false)

    expect(mockedSetKeyActiveState).toHaveBeenCalledWith('key-1', false)
    expect(result?.status).toBe('disabled')
  })
})
  it('validates legacy, free, and premium key formats', () => {
    expect(isValidKeyFormat('LUXY-AAAA-BBBB-CCCC')).toBe(true)
    expect(isValidKeyFormat('LUXY-FREE-AAAA-BBBB')).toBe(true)
    expect(isValidKeyFormat('LUXY-PREM-AAAA-BBBB')).toBe(true)
    expect(isValidKeyFormat('LUXY-OTHER-AAAA-BBBB')).toBe(false)
  })
