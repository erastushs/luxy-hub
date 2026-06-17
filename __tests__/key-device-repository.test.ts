import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

vi.mock('@/app/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

import { supabaseAdmin } from '@/app/lib/supabase'
import {
  countDevices,
  countDevicesForKeys,
  findDevice,
  listDevices,
  registerDevice,
  updateDeviceLastSeen,
} from '@/app/lib/repositories/key-device-repository'

type QueryChain = {
  select: Mock
  eq: Mock
  in: Mock
  insert: Mock
  update: Mock
  order: Mock
  single: Mock
  then: (resolve: (value: { data?: unknown; error: unknown; count?: number }) => void) => void
}

function deviceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'device-1',
    key_id: 'key-1',
    fingerprint_hash: 'a'.repeat(64),
    first_seen_at: '2026-06-17T00:00:00.000Z',
    last_seen_at: '2026-06-17T00:00:00.000Z',
    created_at: '2026-06-17T00:00:00.000Z',
    updated_at: '2026-06-17T00:00:00.000Z',
    ...overrides,
  }
}

function createQueryChain(data: unknown = null, error: unknown = null, count?: number): QueryChain {
  const chain = {} as QueryChain
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.in = vi.fn(() => chain)
  chain.insert = vi.fn(() => chain)
  chain.update = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.single = vi.fn(async () => ({ data, error }))
  chain.then = (resolve) => {
    resolve({ data, error, count })
  }
  return chain
}

describe('key device repository', () => {
  const mockedFrom = supabaseAdmin.from as unknown as Mock

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('counts devices for a key', async () => {
    const chain = createQueryChain(null, null, 2)
    mockedFrom.mockReturnValue(chain)

    await expect(countDevices('key-1')).resolves.toBe(2)

    expect(chain.select).toHaveBeenCalledWith('id', { count: 'exact', head: true })
    expect(chain.eq).toHaveBeenCalledWith('key_id', 'key-1')
  })

  it('counts devices for dashboard key lists', async () => {
    const chain = createQueryChain([{ key_id: 'key-1' }, { key_id: 'key-1' }, { key_id: 'key-2' }])
    mockedFrom.mockReturnValue(chain)

    await expect(countDevicesForKeys(['key-1', 'key-2'])).resolves.toEqual({ 'key-1': 2, 'key-2': 1 })

    expect(chain.in).toHaveBeenCalledWith('key_id', ['key-1', 'key-2'])
  })

  it('finds a registered device by hashed fingerprint', async () => {
    const row = deviceRow()
    const chain = createQueryChain(row)
    mockedFrom.mockReturnValue(chain)

    await expect(findDevice('key-1', 'a'.repeat(64))).resolves.toEqual(row)

    expect(chain.eq).toHaveBeenCalledWith('key_id', 'key-1')
    expect(chain.eq).toHaveBeenCalledWith('fingerprint_hash', 'a'.repeat(64))
  })

  it('registers a hashed device fingerprint without raw identifiers', async () => {
    const row = deviceRow()
    const chain = createQueryChain(row)
    mockedFrom.mockReturnValue(chain)

    await expect(registerDevice('key-1', 'a'.repeat(64))).resolves.toEqual(row)

    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
      key_id: 'key-1',
      fingerprint_hash: 'a'.repeat(64),
    }))
    expect(JSON.stringify(chain.insert.mock.calls[0][0])).not.toContain('executor')
    expect(JSON.stringify(chain.insert.mock.calls[0][0])).not.toContain('client')
  })

  it('updates last_seen_at for an existing device', async () => {
    const row = deviceRow()
    const chain = createQueryChain(row)
    mockedFrom.mockReturnValue(chain)

    await expect(updateDeviceLastSeen('device-1')).resolves.toEqual(row)

    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({
      last_seen_at: expect.any(String),
      updated_at: expect.any(String),
    }))
    expect(chain.eq).toHaveBeenCalledWith('id', 'device-1')
  })

  it('lists devices by last seen time', async () => {
    const row = deviceRow()
    const chain = createQueryChain([row])
    mockedFrom.mockReturnValue(chain)

    await expect(listDevices('key-1')).resolves.toEqual([row])

    expect(chain.eq).toHaveBeenCalledWith('key_id', 'key-1')
    expect(chain.order).toHaveBeenCalledWith('last_seen_at', { ascending: false })
  })
})
