import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/lib/repositories/key-repository', () => ({
  findKey: vi.fn(),
  insertKey: vi.fn(),
  deactivateExpiredKeys: vi.fn(),
}))

import { validateKey } from '@/app/lib/services/key-service'
import { findKey } from '@/app/lib/repositories/key-repository'

const mockedFindKey = vi.mocked(findKey)

function keyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'key-uuid-1',
    key: 'LUXY-ABCD-1234-EFGH',
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

    await expect(validateKey('LUXY-ABCD-1234-EFGH')).resolves.toEqual({ valid: true })
    expect(mockedFindKey).toHaveBeenCalledWith('LUXY-ABCD-1234-EFGH')
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

    await expect(validateKey('LUXY-ABCD-1234-EFGH')).resolves.toEqual({
      valid: false,
      status: 403,
      message: 'Invalid key',
    })
  })

  it('rejects expired keys', async () => {
    mockedFindKey.mockResolvedValue(keyRow({ expires_at: new Date(Date.now() - 60_000).toISOString() }))

    await expect(validateKey('LUXY-ABCD-1234-EFGH')).resolves.toEqual({
      valid: false,
      status: 403,
      message: 'Invalid key',
    })
  })
})
