import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

vi.mock('@/app/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

import { supabaseAdmin } from '@/app/lib/supabase'
import { insertKey } from '@/app/lib/repositories/key-repository'

type QueryChain = {
  insert: Mock
}

function createInsertChain(error: unknown = null): QueryChain {
  const chain = {} as QueryChain
  chain.insert = vi.fn(() => ({ error }))
  return chain
}

describe('key repository', () => {
  const mockedFrom = supabaseAdmin.from as unknown as Mock

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('defaults free keys to one max device from key type', async () => {
    const chain = createInsertChain()
    mockedFrom.mockReturnValue(chain)

    await expect(insertKey({
      key: 'LUXY-FREE-AAAA-BBBB',
      expiresAt: '2026-06-18T00:00:00.000Z',
      keyCategory: 'free',
      keyType: 'free',
    })).resolves.toBe(true)

    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
      key_category: 'free',
      key_type: 'free',
      max_devices: 1,
    }))
  })

  it('defaults weekly keys to one max device from key type', async () => {
    const chain = createInsertChain()
    mockedFrom.mockReturnValue(chain)

    await insertKey({
      key: 'LUXY-PREM-WEEK-BBBB',
      expiresAt: '2026-06-18T00:00:00.000Z',
      keyCategory: 'premium',
      keyType: 'weekly',
    })

    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ max_devices: 1 }))
  })

  it('defaults monthly keys to three max devices from key type', async () => {
    const chain = createInsertChain()
    mockedFrom.mockReturnValue(chain)

    await insertKey({
      key: 'LUXY-PREM-MNTH-BBBB',
      expiresAt: '2026-06-18T00:00:00.000Z',
      keyCategory: 'premium',
      keyType: 'monthly',
    })

    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ max_devices: 3 }))
  })

  it('keeps legacy keys unlimited by default', async () => {
    const chain = createInsertChain()
    mockedFrom.mockReturnValue(chain)

    await insertKey({
      key: 'LUXY-AAAA-BBBB-CCCC',
      expiresAt: '2026-06-18T00:00:00.000Z',
    })

    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
      key_category: 'legacy',
      key_type: 'legacy',
      max_devices: null,
    }))
  })

  it('uses explicit custom max device configuration', async () => {
    const chain = createInsertChain()
    mockedFrom.mockReturnValue(chain)

    await insertKey({
      key: 'LUXY-PREM-CUST-BBBB',
      expiresAt: '2026-06-18T00:00:00.000Z',
      keyCategory: 'premium',
      keyType: 'custom',
      maxDevices: 5,
    })

    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ max_devices: 5 }))
  })

  it('stores custom keys as unlimited when max devices is null', async () => {
    const chain = createInsertChain()
    mockedFrom.mockReturnValue(chain)

    await insertKey({
      key: 'LUXY-PREM-CUST-BBBB',
      expiresAt: '2026-06-18T00:00:00.000Z',
      keyCategory: 'premium',
      keyType: 'custom',
      maxDevices: null,
    })

    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ max_devices: null }))
  })
})
