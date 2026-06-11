import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'
import type { ScriptRow } from '@/app/lib/repositories/script-repository'
import type { LicenseAssignmentRow, LicenseRow } from '@/app/lib/repositories/license-repository'

vi.mock('@/app/lib/auth/session-auth', () => ({
  AuthError: class AuthError extends Error {
    status: number

    constructor(message: string, status: number = 401) {
      super(message)
      this.name = 'AuthError'
      this.status = status
    }
  },
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
  getLicensesForScript: vi.fn(),
  getOwnedLicense: vi.fn(),
  removeAssignment: vi.fn(),
  revokeLicense: vi.fn(),
}))

import { requireAuth } from '@/app/lib/auth/session-auth'
import { findScriptByIdForOwner } from '@/app/lib/repositories/script-repository'
import {
  createAssignment,
  createLicense,
  disableLicense,
  enableLicense,
  getAssignments,
  getLicensesForScript,
  getOwnedLicense,
  removeAssignment,
  revokeLicense,
} from '@/app/lib/services/license-service'
import { GET as listLicensesRoute, POST as createLicenseRoute } from '@/app/api/licenses/route'
import { POST as disableLicenseRoute } from '@/app/api/licenses/[id]/disable/route'
import { POST as enableLicenseRoute } from '@/app/api/licenses/[id]/enable/route'
import { POST as revokeLicenseRoute } from '@/app/api/licenses/[id]/revoke/route'
import {
  GET as listAssignmentsRoute,
  POST as createAssignmentRoute,
} from '@/app/api/licenses/[id]/assignments/route'
import { DELETE as removeAssignmentRoute } from '@/app/api/licenses/[id]/assignments/[assignmentId]/route'

const OWNER_ID = 'creator-uuid-1'
const OTHER_OWNER_ID = 'creator-uuid-2'

const mockedRequireAuth = vi.mocked(requireAuth)
const mockedFindScriptByIdForOwner = vi.mocked(findScriptByIdForOwner)
const mockedCreateAssignment = vi.mocked(createAssignment)
const mockedCreateLicense = vi.mocked(createLicense)
const mockedDisableLicense = vi.mocked(disableLicense)
const mockedEnableLicense = vi.mocked(enableLicense)
const mockedGetAssignments = vi.mocked(getAssignments)
const mockedGetLicensesForScript = vi.mocked(getLicensesForScript)
const mockedGetOwnedLicense = vi.mocked(getOwnedLicense)
const mockedRemoveAssignment = vi.mocked(removeAssignment)
const mockedRevokeLicense = vi.mocked(revokeLicense)

function jsonRequest(url: string, body?: Record<string, unknown>): NextRequest {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }) as NextRequest
}

function mockScript(overrides: Partial<ScriptRow> = {}): ScriptRow {
  return {
    id: 'script-uuid-1',
    slug: 'my-script',
    name: 'My Script',
    description: 'Test script',
    visibility: 'private',
    creator_id: OWNER_ID,
    current_version_id: 'version-uuid-1',
    created_at: '2026-06-11T00:00:00.000Z',
    updated_at: '2026-06-11T00:00:00.000Z',
    ...overrides,
  }
}

function mockLicense(overrides: Partial<LicenseRow> = {}): LicenseRow {
  return {
    id: 'license-uuid-1',
    script_id: 'script-uuid-1',
    creator_id: OWNER_ID,
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

function mockAssignment(overrides: Partial<LicenseAssignmentRow> = {}): LicenseAssignmentRow {
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

function params<T extends Record<string, string>>(value: T) {
  return { params: Promise.resolve(value) }
}

describe('internal license API', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedRequireAuth.mockResolvedValue({
      id: OWNER_ID,
      email: 'creator@example.test',
      role: 'creator',
      profile: {} as Awaited<ReturnType<typeof requireAuth>>['profile'],
    })
  })

  it('creates a license for an owned script and returns the raw key once', async () => {
    mockedFindScriptByIdForOwner.mockResolvedValue(mockScript())
    mockedCreateLicense.mockResolvedValue({
      license: mockLicense(),
      raw_key: 'LUXY-PREM-XXXX-XXXX-XXXX',
    })

    const response = await createLicenseRoute(jsonRequest('https://example.test/api/licenses', {
      script_id: 'script-uuid-1',
      max_assignments: 3,
      expires_at: null,
    }))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body).toEqual({ success: true, license: 'LUXY-PREM-XXXX-XXXX-XXXX' })
    expect(mockedFindScriptByIdForOwner).toHaveBeenCalledWith('script-uuid-1', OWNER_ID)
    expect(mockedCreateLicense).toHaveBeenCalledWith({
      script_id: 'script-uuid-1',
      creator_id: OWNER_ID,
      max_assignments: 3,
      expires_at: null,
    })
  })

  it('lists licenses for an owned script without returning raw keys or hashes', async () => {
    mockedFindScriptByIdForOwner.mockResolvedValue(mockScript())
    mockedGetLicensesForScript.mockResolvedValue([mockLicense()])

    const response = await listLicensesRoute(jsonRequest('https://example.test/api/licenses?script_id=script-uuid-1'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.licenses).toEqual([{ id: 'license-uuid-1', status: 'active', max_assignments: 3, activation_count: 0, delivery_count: 0, expires_at: null, created_at: '2026-06-11T00:00:00.000Z' }])
    expect(JSON.stringify(body)).not.toContain('LUXY-PREM')
    expect(JSON.stringify(body)).not.toContain('key_hash')
  })

  it('rejects non-owner access to script licenses', async () => {
    mockedFindScriptByIdForOwner.mockResolvedValue(null)

    const response = await listLicensesRoute(jsonRequest('https://example.test/api/licenses?script_id=foreign-script'))
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({ success: false, message: 'Script not found' })
    expect(mockedGetLicensesForScript).not.toHaveBeenCalled()
  })

  it('disables an owned license', async () => {
    mockedGetOwnedLicense.mockResolvedValue(mockLicense())
    mockedDisableLicense.mockResolvedValue(mockLicense({ status: 'disabled' }))

    const response = await disableLicenseRoute(jsonRequest('https://example.test/api/licenses/license-uuid-1/disable'), params({ id: 'license-uuid-1' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.license.status).toBe('disabled')
    expect(mockedGetOwnedLicense).toHaveBeenCalledWith('license-uuid-1', OWNER_ID)
    expect(mockedDisableLicense).toHaveBeenCalledWith('license-uuid-1')
  })

  it('enables an owned license', async () => {
    mockedGetOwnedLicense.mockResolvedValue(mockLicense({ status: 'disabled' }))
    mockedEnableLicense.mockResolvedValue(mockLicense({ status: 'active' }))

    const response = await enableLicenseRoute(jsonRequest('https://example.test/api/licenses/license-uuid-1/enable'), params({ id: 'license-uuid-1' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.license.status).toBe('active')
    expect(mockedEnableLicense).toHaveBeenCalledWith('license-uuid-1')
  })

  it('revokes an owned license', async () => {
    mockedGetOwnedLicense.mockResolvedValue(mockLicense())
    mockedRevokeLicense.mockResolvedValue(mockLicense({ status: 'revoked' }))

    const response = await revokeLicenseRoute(jsonRequest('https://example.test/api/licenses/license-uuid-1/revoke'), params({ id: 'license-uuid-1' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.license.status).toBe('revoked')
    expect(mockedRevokeLicense).toHaveBeenCalledWith('license-uuid-1')
  })

  it('rejects non-owner access to license mutation routes', async () => {
    mockedRequireAuth.mockResolvedValue({
      id: OTHER_OWNER_ID,
      email: 'other@example.test',
      role: 'creator',
      profile: {} as Awaited<ReturnType<typeof requireAuth>>['profile'],
    })
    mockedGetOwnedLicense.mockResolvedValue(null)

    const response = await disableLicenseRoute(jsonRequest('https://example.test/api/licenses/license-uuid-1/disable'), params({ id: 'license-uuid-1' }))
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({ success: false, message: 'License not found' })
    expect(mockedDisableLicense).not.toHaveBeenCalled()
  })

  it('lists assignments for an owned license', async () => {
    mockedGetOwnedLicense.mockResolvedValue(mockLicense())
    mockedGetAssignments.mockResolvedValue([mockAssignment()])

    const response = await listAssignmentsRoute(jsonRequest('https://example.test/api/licenses/license-uuid-1/assignments'), params({ id: 'license-uuid-1' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.assignments).toEqual([{ id: 'assignment-uuid-1', license_id: 'license-uuid-1', customer_identifier_hash: 'b'.repeat(64), display_name: 'Customer 1', status: 'active', created_at: '2026-06-11T00:00:00.000Z', updated_at: '2026-06-11T00:00:00.000Z' }])
  })

  it('creates an assignment for an owned license', async () => {
    mockedGetOwnedLicense.mockResolvedValue(mockLicense())
    mockedCreateAssignment.mockResolvedValue(mockAssignment())

    const response = await createAssignmentRoute(jsonRequest('https://example.test/api/licenses/license-uuid-1/assignments', {
      customer_identifier: 'customer-1',
      display_name: 'Customer 1',
    }), params({ id: 'license-uuid-1' }))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.assignment.id).toBe('assignment-uuid-1')
    expect(mockedCreateAssignment).toHaveBeenCalledWith({
      license_id: 'license-uuid-1',
      customer_identifier: 'customer-1',
      display_name: 'Customer 1',
    })
  })

  it('removes an owned assignment', async () => {
    mockedGetOwnedLicense.mockResolvedValue(mockLicense())
    mockedGetAssignments.mockResolvedValue([mockAssignment()])
    mockedRemoveAssignment.mockResolvedValue(mockAssignment())

    const response = await removeAssignmentRoute(
      jsonRequest('https://example.test/api/licenses/license-uuid-1/assignments/assignment-uuid-1'),
      params({ id: 'license-uuid-1', assignmentId: 'assignment-uuid-1' })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.assignment.id).toBe('assignment-uuid-1')
    expect(mockedRemoveAssignment).toHaveBeenCalledWith('assignment-uuid-1')
  })

  it('rejects removal when assignment does not belong to the owned license', async () => {
    mockedGetOwnedLicense.mockResolvedValue(mockLicense())
    mockedGetAssignments.mockResolvedValue([mockAssignment({ id: 'assignment-uuid-2' })])

    const response = await removeAssignmentRoute(
      jsonRequest('https://example.test/api/licenses/license-uuid-1/assignments/assignment-uuid-1'),
      params({ id: 'license-uuid-1', assignmentId: 'assignment-uuid-1' })
    )
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({ success: false, message: 'Assignment not found' })
    expect(mockedRemoveAssignment).not.toHaveBeenCalled()
  })
})
