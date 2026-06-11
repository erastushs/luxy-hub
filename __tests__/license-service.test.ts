import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  LicenseAssignmentRow,
  LicenseRow,
} from '@/app/lib/repositories/license-repository'

vi.mock('@/app/lib/repositories/license-repository', () => ({
  createLicense: vi.fn(),
  createLicenseAssignment: vi.fn(),
  disableLicense: vi.fn(),
  enableLicense: vi.fn(),
  getLicenseAssignmentByCustomerHash: vi.fn(),
  getLicenseAssignments: vi.fn(),
  getLicenseById: vi.fn(),
  getLicenseForScriptByKeyHash: vi.fn(),
  getLicensesForScript: vi.fn(),
  removeLicenseAssignment: vi.fn(),
  revokeLicense: vi.fn(),
}))

import {
  createAssignment,
  createLicense,
  disableLicense,
  enableLicense,
  generateRawLicenseKey,
  getAssignments,
  getLicense,
  getLicensesForScript,
  hashLicenseSecret,
  removeAssignment,
  revokeLicense,
  validateLicense,
} from '@/app/lib/services/license-service'
import {
  createLicense as createLicenseRow,
  createLicenseAssignment,
  disableLicense as disableLicenseRow,
  enableLicense as enableLicenseRow,
  getLicenseAssignmentByCustomerHash,
  getLicenseAssignments,
  getLicenseById,
  getLicenseForScriptByKeyHash,
  getLicensesForScript as getLicenseRowsForScript,
  removeLicenseAssignment,
  revokeLicense as revokeLicenseRow,
} from '@/app/lib/repositories/license-repository'

const mockedCreateLicenseRow = vi.mocked(createLicenseRow)
const mockedCreateLicenseAssignment = vi.mocked(createLicenseAssignment)
const mockedDisableLicenseRow = vi.mocked(disableLicenseRow)
const mockedEnableLicenseRow = vi.mocked(enableLicenseRow)
const mockedGetLicenseAssignmentByCustomerHash = vi.mocked(getLicenseAssignmentByCustomerHash)
const mockedGetLicenseAssignments = vi.mocked(getLicenseAssignments)
const mockedGetLicenseById = vi.mocked(getLicenseById)
const mockedGetLicenseForScriptByKeyHash = vi.mocked(getLicenseForScriptByKeyHash)
const mockedGetLicenseRowsForScript = vi.mocked(getLicenseRowsForScript)
const mockedRemoveLicenseAssignment = vi.mocked(removeLicenseAssignment)
const mockedRevokeLicenseRow = vi.mocked(revokeLicenseRow)

function futureIso(seconds: number = 60): string {
  return new Date(Date.now() + seconds * 1000).toISOString()
}

function pastIso(seconds: number = 60): string {
  return new Date(Date.now() - seconds * 1000).toISOString()
}

function mockLicenseRow(overrides: Partial<LicenseRow> = {}): LicenseRow {
  return {
    id: 'license-uuid-1',
    script_id: 'script-uuid-1',
    creator_id: 'creator-uuid-1',
    key_hash: 'a'.repeat(64),
    max_assignments: 3,
    status: 'active',
    activation_count: 0,
    delivery_count: 0,
    last_activation_at: null,
    last_delivery_at: null,
    expires_at: null,
    created_at: '2026-06-11T00:00:00.000Z',
    updated_at: '2026-06-11T00:00:00.000Z',
    ...overrides,
  }
}

function mockAssignmentRow(overrides: Partial<LicenseAssignmentRow> = {}): LicenseAssignmentRow {
  return {
    id: 'assignment-uuid-1',
    license_id: 'license-uuid-1',
    customer_identifier_hash: 'b'.repeat(64),
    display_name: 'Customer 1',
    status: 'active',
    created_at: '2026-06-11T00:00:00.000Z',
    updated_at: '2026-06-11T00:00:00.000Z',
    ...overrides,
  }
}

describe('license service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('generates raw license keys in the expected public format', () => {
    expect(generateRawLicenseKey()).toMatch(/^LUXY-PREM-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
  })

  it('creates a license with hash-only storage and returns the raw key once', async () => {
    const row = mockLicenseRow()
    mockedCreateLicenseRow.mockResolvedValue(row)

    const result = await createLicense({
      script_id: 'script-uuid-1',
      creator_id: 'creator-uuid-1',
      max_assignments: 3,
      expires_at: '2026-07-01T00:00:00.000Z',
    })

    expect(result.raw_key).toMatch(/^LUXY-PREM-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    expect(result.license).toEqual(row)

    const createParams = mockedCreateLicenseRow.mock.calls[0][0]
    expect(createParams).toEqual(expect.objectContaining({
      scriptId: 'script-uuid-1',
      creatorId: 'creator-uuid-1',
      maxAssignments: 3,
      expiresAt: '2026-07-01T00:00:00.000Z',
    }))
    expect(createParams.keyHash).toMatch(/^[a-f0-9]{64}$/)
    expect(createParams.keyHash).toBe(hashLicenseSecret(result.raw_key))
    expect(JSON.stringify(createParams)).not.toContain(result.raw_key)
  })

  it('supports nullable expires_at during license creation', async () => {
    mockedCreateLicenseRow.mockResolvedValue(mockLicenseRow({ expires_at: null }))

    await createLicense({
      script_id: 'script-uuid-1',
      creator_id: 'creator-uuid-1',
      max_assignments: 1,
      expires_at: null,
    })

    expect(mockedCreateLicenseRow).toHaveBeenCalledWith(expect.objectContaining({
      expiresAt: null,
    }))
  })

  it('retrieves licenses without exposing a raw key', async () => {
    const row = mockLicenseRow()
    mockedGetLicenseById.mockResolvedValue(row)
    mockedGetLicenseRowsForScript.mockResolvedValue([row])

    await expect(getLicense('license-uuid-1')).resolves.toEqual(row)
    await expect(getLicensesForScript('script-uuid-1')).resolves.toEqual([row])
    expect(await getLicense('license-uuid-1')).not.toHaveProperty('raw_key')
  })

  it('revokes an active license', async () => {
    const active = mockLicenseRow({ status: 'active' })
    const revoked = mockLicenseRow({ status: 'revoked' })
    mockedGetLicenseById.mockResolvedValue(active)
    mockedRevokeLicenseRow.mockResolvedValue(revoked)

    await expect(revokeLicense('license-uuid-1')).resolves.toEqual(revoked)
    expect(mockedRevokeLicenseRow).toHaveBeenCalledWith('license-uuid-1')
  })

  it('does not reactivate or revoke already revoked licenses', async () => {
    const revoked = mockLicenseRow({ status: 'revoked' })
    mockedGetLicenseById.mockResolvedValue(revoked)

    await expect(revokeLicense('license-uuid-1')).resolves.toEqual(revoked)
    await expect(enableLicense('license-uuid-1')).resolves.toEqual(revoked)
    expect(mockedRevokeLicenseRow).not.toHaveBeenCalled()
    expect(mockedEnableLicenseRow).not.toHaveBeenCalled()
  })

  it('disables an active license', async () => {
    const active = mockLicenseRow({ status: 'active' })
    const disabled = mockLicenseRow({ status: 'disabled' })
    mockedGetLicenseById.mockResolvedValue(active)
    mockedDisableLicenseRow.mockResolvedValue(disabled)

    await expect(disableLicense('license-uuid-1')).resolves.toEqual(disabled)
    expect(mockedDisableLicenseRow).toHaveBeenCalledWith('license-uuid-1')
  })

  it('enables a disabled license', async () => {
    const disabled = mockLicenseRow({ status: 'disabled' })
    const active = mockLicenseRow({ status: 'active' })
    mockedGetLicenseById.mockResolvedValue(disabled)
    mockedEnableLicenseRow.mockResolvedValue(active)

    await expect(enableLicense('license-uuid-1')).resolves.toEqual(active)
    expect(mockedEnableLicenseRow).toHaveBeenCalledWith('license-uuid-1')
  })

  it('creates assignments with hash-only customer identifier storage', async () => {
    const row = mockAssignmentRow()
    mockedCreateLicenseAssignment.mockResolvedValue(row)

    const result = await createAssignment({
      license_id: 'license-uuid-1',
      customer_identifier: 'customer@example.com',
      display_name: 'Customer 1',
    })

    expect(result).toEqual(row)
    const createParams = mockedCreateLicenseAssignment.mock.calls[0][0]
    expect(createParams).toEqual({
      licenseId: 'license-uuid-1',
      customerIdentifierHash: hashLicenseSecret('customer@example.com'),
      displayName: 'Customer 1',
    })
    expect(createParams.customerIdentifierHash).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(createParams)).not.toContain('customer@example.com')
  })

  it('supports assignment listing and removal', async () => {
    const row = mockAssignmentRow()
    mockedGetLicenseAssignments.mockResolvedValue([row])
    mockedRemoveLicenseAssignment.mockResolvedValue(row)

    await expect(getAssignments('license-uuid-1')).resolves.toEqual([row])
    expect(mockedGetLicenseAssignments).toHaveBeenCalledWith('license-uuid-1')

    await expect(removeAssignment('assignment-uuid-1')).resolves.toEqual(row)
    expect(mockedRemoveLicenseAssignment).toHaveBeenCalledWith('assignment-uuid-1')
  })

  it('rejects license validation when license is missing', async () => {
    await expect(validateLicense({ scriptId: 'script-uuid-1', license: undefined })).resolves.toEqual({
      success: false,
      status: 403,
      message: 'License is required',
    })
    expect(mockedGetLicenseForScriptByKeyHash).not.toHaveBeenCalled()
  })

  it('rejects license validation when the license does not exist', async () => {
    mockedGetLicenseForScriptByKeyHash.mockResolvedValue(null)

    await expect(validateLicense({
      scriptId: 'script-uuid-1',
      license: 'LUXY-PREM-XXXX-XXXX-XXXX',
    })).resolves.toEqual({ success: false, status: 403, message: 'Invalid license' })
    expect(mockedGetLicenseForScriptByKeyHash).toHaveBeenCalledWith(
      'script-uuid-1',
      hashLicenseSecret('LUXY-PREM-XXXX-XXXX-XXXX')
    )
  })

  it('rejects revoked licenses', async () => {
    mockedGetLicenseForScriptByKeyHash.mockResolvedValue(mockLicenseRow({ status: 'revoked' }))

    await expect(validateLicense({
      scriptId: 'script-uuid-1',
      license: 'LUXY-PREM-XXXX-XXXX-XXXX',
    })).resolves.toEqual({ success: false, status: 403, message: 'Invalid license' })
    expect(mockedGetLicenseAssignmentByCustomerHash).not.toHaveBeenCalled()
  })

  it('rejects disabled licenses', async () => {
    mockedGetLicenseForScriptByKeyHash.mockResolvedValue(mockLicenseRow({ status: 'disabled' }))

    await expect(validateLicense({
      scriptId: 'script-uuid-1',
      license: 'LUXY-PREM-XXXX-XXXX-XXXX',
    })).resolves.toEqual({ success: false, status: 403, message: 'Invalid license' })
    expect(mockedGetLicenseAssignmentByCustomerHash).not.toHaveBeenCalled()
  })

  it('rejects expired licenses', async () => {
    mockedGetLicenseForScriptByKeyHash.mockResolvedValue(mockLicenseRow({ expires_at: pastIso() }))

    await expect(validateLicense({
      scriptId: 'script-uuid-1',
      license: 'LUXY-PREM-XXXX-XXXX-XXXX',
    })).resolves.toEqual({ success: false, status: 403, message: 'Invalid license' })
    expect(mockedGetLicenseAssignmentByCustomerHash).not.toHaveBeenCalled()
  })

  it('allows valid licenses when an assignment already exists', async () => {
    const license = mockLicenseRow({ expires_at: futureIso() })
    const assignment = mockAssignmentRow()
    mockedGetLicenseForScriptByKeyHash.mockResolvedValue(license)
    mockedGetLicenseAssignmentByCustomerHash.mockResolvedValue(assignment)

    await expect(validateLicense({
      scriptId: 'script-uuid-1',
      license: 'LUXY-PREM-XXXX-XXXX-XXXX',
      customerIdentifier: 'customer-1',
    })).resolves.toEqual({ success: true, license, assignment })
    expect(mockedGetLicenseAssignmentByCustomerHash).toHaveBeenCalledWith(
      'license-uuid-1',
      hashLicenseSecret('customer-1')
    )
    expect(mockedCreateLicenseAssignment).not.toHaveBeenCalled()
  })

  it('creates a missing assignment for valid licenses', async () => {
    const license = mockLicenseRow()
    const assignment = mockAssignmentRow()
    mockedGetLicenseForScriptByKeyHash.mockResolvedValue(license)
    mockedGetLicenseAssignmentByCustomerHash.mockResolvedValue(null)
    mockedCreateLicenseAssignment.mockResolvedValue(assignment)

    await expect(validateLicense({
      scriptId: 'script-uuid-1',
      license: 'LUXY-PREM-XXXX-XXXX-XXXX',
    })).resolves.toEqual({ success: true, license, assignment })
    expect(mockedCreateLicenseAssignment).toHaveBeenCalledWith({
      licenseId: 'license-uuid-1',
      customerIdentifierHash: hashLicenseSecret('LUXY-PREM-XXXX-XXXX-XXXX'),
      displayName: null,
    })
  })
})
