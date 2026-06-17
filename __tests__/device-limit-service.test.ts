import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KeyRow } from '@/app/lib/repositories/key-repository'

vi.mock('@/app/lib/repositories/key-device-repository', () => ({
  countDevices: vi.fn(),
  findDevice: vi.fn(),
  registerDevice: vi.fn(),
  updateDeviceLastSeen: vi.fn(),
}))

import {
  countDevices,
  findDevice,
  registerDevice,
  updateDeviceLastSeen,
} from '@/app/lib/repositories/key-device-repository'
import { createFingerprintHash, enforceDeviceLimit } from '@/app/lib/services/device-limit-service'

const mockedCountDevices = vi.mocked(countDevices)
const mockedFindDevice = vi.mocked(findDevice)
const mockedRegisterDevice = vi.mocked(registerDevice)
const mockedUpdateDeviceLastSeen = vi.mocked(updateDeviceLastSeen)

function keyRow(overrides: Partial<KeyRow> = {}): KeyRow {
  return {
    id: 'key-1',
    key: 'LUXY-PREM-AAAA-BBBB',
    key_category: 'premium',
    key_type: 'weekly',
    max_devices: 1,
    name: null,
    description: null,
    is_active: true,
    expires_at: '2026-06-18T00:00:00.000Z',
    created_at: '2026-06-17T00:00:00.000Z',
    ...overrides,
  }
}

function fingerprint() {
  return { executorIdentifier: 'executor-1', clientIdentifier: 'client-1' }
}

describe('device limit service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('updates last_seen_at for an existing device and does not reinsert it', async () => {
    mockedFindDevice.mockResolvedValue({
      id: 'device-1',
      key_id: 'key-1',
      fingerprint_hash: 'a'.repeat(64),
      first_seen_at: '2026-06-17T00:00:00.000Z',
      last_seen_at: '2026-06-17T00:00:00.000Z',
      created_at: '2026-06-17T00:00:00.000Z',
      updated_at: '2026-06-17T00:00:00.000Z',
    })

    const result = await enforceDeviceLimit(keyRow(), fingerprint())

    expect(result.allowed).toBe(true)
    expect(mockedUpdateDeviceLastSeen).toHaveBeenCalledWith('device-1')
    expect(mockedRegisterDevice).not.toHaveBeenCalled()
  })

  it('registers the first device when below limit', async () => {
    mockedFindDevice.mockResolvedValue(null)
    mockedCountDevices.mockResolvedValue(0)

    const result = await enforceDeviceLimit(keyRow(), fingerprint())

    expect(result.allowed).toBe(true)
    expect(mockedRegisterDevice).toHaveBeenCalledWith('key-1', createFingerprintHash(fingerprint()))
  })

  it('denies a new device when the limit is reached', async () => {
    mockedFindDevice.mockResolvedValue(null)
    mockedCountDevices.mockResolvedValue(1)

    const result = await enforceDeviceLimit(keyRow(), fingerprint())

    expect(result).toEqual({ allowed: false, message: 'Device limit reached', status: 403 })
    expect(mockedRegisterDevice).not.toHaveBeenCalled()
  })

  it('allows monthly keys up to three devices', async () => {
    mockedFindDevice.mockResolvedValue(null)
    mockedCountDevices.mockResolvedValue(2)

    const result = await enforceDeviceLimit(keyRow({ key_type: 'monthly', max_devices: 3 }), fingerprint())

    expect(result.allowed).toBe(true)
    expect(mockedRegisterDevice).toHaveBeenCalled()
  })

  it('limits free keys to one device', async () => {
    mockedFindDevice.mockResolvedValue(null)
    mockedCountDevices.mockResolvedValue(1)

    const result = await enforceDeviceLimit(keyRow({ key_category: 'free', key_type: 'free', max_devices: 1 }), fingerprint())

    expect(result).toEqual({ allowed: false, message: 'Device limit reached', status: 403 })
  })

  it('uses configured custom key limits', async () => {
    mockedFindDevice.mockResolvedValue(null)
    mockedCountDevices.mockResolvedValue(4)

    const result = await enforceDeviceLimit(keyRow({ key_type: 'custom', max_devices: 5 }), fingerprint())

    expect(result.allowed).toBe(true)
    expect(mockedRegisterDevice).toHaveBeenCalled()
  })

  it('bypasses limits for legacy keys', async () => {
    const result = await enforceDeviceLimit(keyRow({ key_category: 'legacy', key_type: 'legacy', max_devices: null }), fingerprint())

    expect(result).toEqual({ allowed: true, fingerprintHash: null })
    expect(mockedFindDevice).not.toHaveBeenCalled()
    expect(mockedCountDevices).not.toHaveBeenCalled()
    expect(mockedRegisterDevice).not.toHaveBeenCalled()
  })

  it('requires both fingerprint identifiers for limited keys', async () => {
    const result = await enforceDeviceLimit(keyRow(), { executorIdentifier: 'executor-1' })

    expect(result).toEqual({ allowed: false, message: 'Device fingerprint is required', status: 400 })
    expect(mockedRegisterDevice).not.toHaveBeenCalled()
  })
})
