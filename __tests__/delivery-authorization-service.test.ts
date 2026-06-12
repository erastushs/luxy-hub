import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScriptAccessMode } from '@/app/lib/repositories/script-repository'

vi.mock('@/app/lib/services/key-service', () => ({
  validateKey: vi.fn(),
}))

vi.mock('@/app/lib/services/license-service', () => ({
  validateLicense: vi.fn(),
}))

import { authorizeDeliveryAccess } from '@/app/lib/services/delivery-authorization-service'
import { validateKey } from '@/app/lib/services/key-service'
import { validateLicense } from '@/app/lib/services/license-service'

const mockedValidateKey = vi.mocked(validateKey)
const mockedValidateLicense = vi.mocked(validateLicense)

function scriptWithAccessMode(accessMode: ScriptAccessMode) {
  return { id: 'script-uuid-1', access_mode: accessMode }
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
    expect(mockedValidateLicense).not.toHaveBeenCalled()
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
    expect(mockedValidateLicense).not.toHaveBeenCalled()
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
    expect(mockedValidateLicense).not.toHaveBeenCalled()
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
    expect(mockedValidateLicense).not.toHaveBeenCalled()
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
    expect(mockedValidateLicense).not.toHaveBeenCalled()
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
    expect(mockedValidateLicense).not.toHaveBeenCalled()
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
    expect(mockedValidateLicense).not.toHaveBeenCalled()
  })

  it('rejects license-required delivery access when no license is provided', async () => {
    mockedValidateLicense.mockResolvedValue({ success: false, status: 403, message: 'License is required', reason: 'license_required' })

    const result = await authorizeDeliveryAccess({
      script: scriptWithAccessMode('license_required'),
    })

    expect(result).toEqual({
      success: false,
      status: 403,
      message: 'License is required',
    })
    expect(mockedValidateKey).not.toHaveBeenCalled()
    expect(mockedValidateLicense).toHaveBeenCalledWith({
      scriptId: 'script-uuid-1',
      license: undefined,
      customerIdentifier: undefined,
    })
  })

  it('authorizes license-required delivery access with a valid license', async () => {
    const license = {} as Awaited<ReturnType<typeof validateLicense>> extends { success: true; license: infer T } ? T : never
    const assignment = {} as Awaited<ReturnType<typeof validateLicense>> extends { success: true; assignment: infer T } ? T : never
    mockedValidateLicense.mockResolvedValue({
      success: true,
      license,
      assignment,
      assignmentCreated: false,
    })

    const result = await authorizeDeliveryAccess({
      script: scriptWithAccessMode('license_required'),
      license: 'LUXY-PREM-XXXX-XXXX-XXXX',
      customerIdentifier: 'customer-1',
    })

    expect(result).toEqual({
      success: true,
      accessMode: 'license_required',
      license,
      assignment,
      assignmentCreated: false,
    })
    expect(mockedValidateKey).not.toHaveBeenCalled()
    expect(mockedValidateLicense).toHaveBeenCalledWith({
      scriptId: 'script-uuid-1',
      license: 'LUXY-PREM-XXXX-XXXX-XXXX',
      customerIdentifier: 'customer-1',
    })
  })
})
