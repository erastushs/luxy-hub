import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/app/lib/auth/session-auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('@/app/lib/repositories/script-repository', () => ({
  findScriptByIdForOwner: vi.fn(),
}))

vi.mock('@/app/lib/services/license-service', () => ({
  createAssignment: vi.fn(),
  createLicense: vi.fn(),
  disableLicense: vi.fn(),
  enableLicense: vi.fn(),
  getAssignments: vi.fn(),
  getOwnedLicense: vi.fn(),
  removeAssignment: vi.fn(),
  revokeLicense: vi.fn(),
}))

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/app/lib/auth/session-auth'
import { findScriptByIdForOwner } from '@/app/lib/repositories/script-repository'
import {
  createAssignment,
  createLicense,
  disableLicense,
  getAssignments,
  getOwnedLicense,
  removeAssignment,
} from '@/app/lib/services/license-service'
import {
  createLicenseAction,
  createLicenseAssignmentAction,
  removeLicenseAssignmentAction,
  updateLicenseStatusAction,
} from '@/app/actions/licenses'

const mockedRequireAuth = vi.mocked(requireAuth)
const mockedFindScriptByIdForOwner = vi.mocked(findScriptByIdForOwner)
const mockedCreateLicense = vi.mocked(createLicense)
const mockedGetOwnedLicense = vi.mocked(getOwnedLicense)
const mockedDisableLicense = vi.mocked(disableLicense)
const mockedCreateAssignment = vi.mocked(createAssignment)
const mockedGetAssignments = vi.mocked(getAssignments)
const mockedRemoveAssignment = vi.mocked(removeAssignment)
const mockedRevalidatePath = vi.mocked(revalidatePath)

const actor = { id: 'creator-1', email: 'creator@example.com', role: 'creator', profile: null }
const licenseRow = {
  id: 'license-1',
  script_id: 'script-1',
  creator_id: 'creator-1',
  key_hash: 'hash',
  key_lookup_hash: 'lookup',
  max_assignments: 1,
  status: 'active' as const,
  activation_count: 0,
  delivery_count: 0,
  last_activation_at: null,
  last_delivery_at: null,
  expires_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}
const assignmentRow = {
  id: 'assignment-1',
  license_id: 'license-1',
  customer_identifier_hash: 'hash',
  display_name: 'Customer',
  status: 'active' as const,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

describe('license server actions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedRequireAuth.mockResolvedValue(actor as never)
  })

  it('creates licenses for owned scripts through a Server Action', async () => {
    mockedFindScriptByIdForOwner.mockResolvedValue({ id: 'script-1' } as never)
    mockedCreateLicense.mockResolvedValue({ license: licenseRow, raw_key: 'LUXY-PREM-ABCD-1234-EFGH' })

    await expect(createLicenseAction({
      scriptId: 'script-1',
      maxAssignments: 1,
      expiresAt: null,
    })).resolves.toEqual({ success: true, license: 'LUXY-PREM-ABCD-1234-EFGH' })
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/dashboard/licenses')
  })

  it('rejects license creation for non-owned scripts', async () => {
    mockedFindScriptByIdForOwner.mockResolvedValue(null)

    await expect(createLicenseAction({
      scriptId: 'script-1',
      maxAssignments: 1,
      expiresAt: null,
    })).resolves.toEqual({ success: false, message: 'Script not found', status: 404 })
    expect(mockedCreateLicense).not.toHaveBeenCalled()
  })

  it('updates license status for owned licenses', async () => {
    mockedGetOwnedLicense.mockResolvedValue(licenseRow)
    mockedDisableLicense.mockResolvedValue({ ...licenseRow, status: 'disabled' })

    await expect(updateLicenseStatusAction('license-1', 'disable')).resolves.toEqual({
      success: true,
      license: expect.objectContaining({ id: 'license-1', status: 'disabled' }),
    })
  })

  it('creates and removes assignments for owned licenses', async () => {
    mockedGetOwnedLicense.mockResolvedValue(licenseRow)
    mockedCreateAssignment.mockResolvedValue(assignmentRow)
    mockedGetAssignments.mockResolvedValue([assignmentRow])
    mockedRemoveAssignment.mockResolvedValue(assignmentRow)

    await expect(createLicenseAssignmentAction({
      licenseId: 'license-1',
      customerIdentifier: 'customer@example.com',
      displayName: 'Customer',
    })).resolves.toEqual({
      success: true,
      assignment: { id: 'assignment-1', display_name: 'Customer', created_at: '2026-01-01T00:00:00.000Z' },
    })

    await expect(removeLicenseAssignmentAction('license-1', 'assignment-1')).resolves.toEqual({
      success: true,
      assignment: { id: 'assignment-1', display_name: 'Customer', created_at: '2026-01-01T00:00:00.000Z' },
    })
  })
})
