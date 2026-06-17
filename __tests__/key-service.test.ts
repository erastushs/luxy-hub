import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/lib/repositories/key-repository', () => ({
  findKey: vi.fn(),
  insertKey: vi.fn(),
  deactivateExpiredKeys: vi.fn(),
  listKeys: vi.fn(),
  setKeyActiveState: vi.fn(),
}))

vi.mock('@/app/lib/key-generator', () => ({
  generateKey: vi.fn(),
}))

import { generateKey } from '@/app/lib/key-generator'
import { insertKey, listKeys, setKeyActiveState } from '@/app/lib/repositories/key-repository'
import { createKey, createKeyWithExpiration, getDashboardKeyStatus, listDashboardKeys, updateDashboardKeyState } from '@/app/lib/services/key-service'

const mockedGenerateKey = vi.mocked(generateKey)
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
    ])

    const result = await listDashboardKeys('AAAA')

    expect(mockedListKeys).toHaveBeenCalledWith({ search: 'AAAA', limit: 200 })
    expect(result.keys.map((key) => key.status)).toEqual(['active', 'expired', 'disabled'])
    expect(result.summary).toEqual({ total: 3, active: 1, expired: 1, disabled: 1 })
  })

  it('updates dashboard key active state', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-17T00:00:00.000Z'))
    mockedSetKeyActiveState.mockResolvedValue({
      id: 'key-1',
      key: 'LUXY-AAAA-BBBB-CCCC',
      is_active: false,
      expires_at: '2026-06-18T00:00:00.000Z',
      created_at: '2026-06-16T00:00:00.000Z',
    })

    const result = await updateDashboardKeyState('key-1', false)

    expect(mockedSetKeyActiveState).toHaveBeenCalledWith('key-1', false)
    expect(result?.status).toBe('disabled')
  })
})
