import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScriptAccessMode } from '@/app/lib/repositories/script-repository'

vi.mock('@/app/lib/services/key-service', () => ({
  validateKey: vi.fn(),
}))

import { authorizeDeliveryAccess } from '@/app/lib/services/delivery-authorization-service'
import { validateKey } from '@/app/lib/services/key-service'

const mockedValidateKey = vi.mocked(validateKey)

function scriptWithAccessMode(accessMode: ScriptAccessMode) {
  return { access_mode: accessMode }
}

describe('delivery authorization service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('authorizes public delivery access without key validation', async () => {
    const result = await authorizeDeliveryAccess({ script: scriptWithAccessMode('public') })
    expect(result).toEqual({
      success: true,
      accessMode: 'public',
    })
    expect(mockedValidateKey).not.toHaveBeenCalled()
  })

  it('authorizes public delivery access even when a key is provided', async () => {
    const result = await authorizeDeliveryAccess({
      script: scriptWithAccessMode('public'),
      key: 'LUXY-ABCD-1234-EFGH',
    })
    expect(result).toEqual({
      success: true,
      accessMode: 'public',
    })
    expect(mockedValidateKey).not.toHaveBeenCalled()
  })

  it('authorizes key_required access with a valid key', async () => {
    mockedValidateKey.mockResolvedValue({ valid: true })

    const result = await authorizeDeliveryAccess({
      script: scriptWithAccessMode('key_required'),
      key: 'LUXY-ABCD-1234-EFGH',
    })

    expect(result).toEqual({
      success: true,
      accessMode: 'key_required',
    })
    expect(mockedValidateKey).toHaveBeenCalledWith('LUXY-ABCD-1234-EFGH')
  })

  it('rejects key_required access when no key is provided', async () => {
    const result = await authorizeDeliveryAccess({
      script: scriptWithAccessMode('key_required'),
    })

    expect(result).toEqual({
      success: false,
      status: 403,
      message: 'Key is required',
    })
    expect(mockedValidateKey).not.toHaveBeenCalled()
  })

  it('rejects key_required access when the key is empty string', async () => {
    const result = await authorizeDeliveryAccess({
      script: scriptWithAccessMode('key_required'),
      key: '',
    })

    expect(result).toEqual({
      success: false,
      status: 403,
      message: 'Key is required',
    })
    expect(mockedValidateKey).not.toHaveBeenCalled()
  })

  it('rejects key_required access with an invalid key', async () => {
    mockedValidateKey.mockResolvedValue({ valid: false, message: 'Invalid key', status: 403 })

    const result = await authorizeDeliveryAccess({
      script: scriptWithAccessMode('key_required'),
      key: 'BAD-KEY-XXXX-YYYY',
    })

    expect(result).toEqual({
      success: false,
      status: 403,
      message: 'Invalid key',
    })
    expect(mockedValidateKey).toHaveBeenCalledWith('BAD-KEY-XXXX-YYYY')
  })

  it('rejects key_required access with an expired key', async () => {
    mockedValidateKey.mockResolvedValue({ valid: false, message: 'Invalid key', status: 403 })

    const result = await authorizeDeliveryAccess({
      script: scriptWithAccessMode('key_required'),
      key: 'LUXY-EXPIRED-KEY1',
    })

    expect(result).toEqual({
      success: false,
      status: 403,
      message: 'Invalid key',
    })
    expect(mockedValidateKey).toHaveBeenCalledWith('LUXY-EXPIRED-KEY1')
  })

  it('returns not implemented for license-required delivery access', async () => {
    const result = await authorizeDeliveryAccess({
      script: scriptWithAccessMode('license_required'),
    })

    expect(result).toEqual({
      success: false,
      status: 501,
      message: 'Delivery access mode not implemented',
    })
    expect(mockedValidateKey).not.toHaveBeenCalled()
  })

  it('returns not implemented for license-required even when a key is provided', async () => {
    const result = await authorizeDeliveryAccess({
      script: scriptWithAccessMode('license_required'),
      key: 'LUXY-ABCD-1234-EFGH',
    })

    expect(result).toEqual({
      success: false,
      status: 501,
      message: 'Delivery access mode not implemented',
    })
    expect(mockedValidateKey).not.toHaveBeenCalled()
  })
})
