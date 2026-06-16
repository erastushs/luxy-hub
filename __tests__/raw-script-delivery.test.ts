import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/lib/repositories/script-repository', () => ({
  findScriptBySlug: vi.fn(),
  findScriptBySlugForOwner: vi.fn(),
  listScripts: vi.fn(),
  listScriptsForOwner: vi.fn(),
  createScript: vi.fn(),
  updateScript: vi.fn(),
  deleteScript: vi.fn(),
  createVersion: vi.fn(),
  getLatestVersion: vi.fn(),
  getScriptStatsForOwner: vi.fn(),
  recordDownload: vi.fn(),
  hashIdentifier: vi.fn(),
  listVersionsForScript: vi.fn(),
  listVersionSummariesByIds: vi.fn(),
  getVersionById: vi.fn(),
  ScriptConflictError: class extends Error {},
}))

vi.mock('@/app/lib/services/delivery-authorization-service', () => ({
  authorizeDeliveryAccess: vi.fn(),
}))

vi.mock('@/app/lib/services/license-service', () => ({
  recordLicenseDelivery: vi.fn(),
}))

vi.mock('@/app/lib/services/audit-service', () => ({
  logAuditEvent: vi.fn(),
}))

vi.mock('@/app/lib/services/build-automation-service', () => ({
  runAutoBuildForVersion: vi.fn(),
}))

import { getRawContent } from '@/app/lib/services/script-service'
import { findScriptBySlug, getLatestVersion, recordDownload, type ScriptRow } from '@/app/lib/repositories/script-repository'
import { authorizeDeliveryAccess } from '@/app/lib/services/delivery-authorization-service'
import { recordLicenseDelivery } from '@/app/lib/services/license-service'
import { logAuditEvent } from '@/app/lib/services/audit-service'

const mockedFindScriptBySlug = vi.mocked(findScriptBySlug)
const mockedGetLatestVersion = vi.mocked(getLatestVersion)
const mockedAuthorizeDeliveryAccess = vi.mocked(authorizeDeliveryAccess)
const mockedRecordLicenseDelivery = vi.mocked(recordLicenseDelivery)
const mockedRecordDownload = vi.mocked(recordDownload)
const mockedLogAuditEvent = vi.mocked(logAuditEvent)

function script(overrides: Partial<ScriptRow> = {}): ScriptRow {
  return {
    id: 'script-1',
    slug: 'secure-script',
    name: 'Secure Script',
    description: null,
    visibility: 'public' as const,
    access_mode: 'public' as const,
    creator_id: 'creator-1',
    current_version_id: 'version-1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('raw script delivery hardening', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedFindScriptBySlug.mockResolvedValue(script())
    mockedGetLatestVersion.mockResolvedValue({
      id: 'version-1',
      script_id: 'script-1',
      version: '1.0.0',
      content: 'print("ok")',
      changelog: null,
      created_at: '2026-01-01T00:00:00.000Z',
    })
    mockedRecordDownload.mockResolvedValue(true)
    mockedRecordLicenseDelivery.mockResolvedValue(undefined)
  })

  it('allows public scripts through the delivery authorization pipeline', async () => {
    mockedAuthorizeDeliveryAccess.mockResolvedValue({ success: true, accessMode: 'public' })

    await expect(getRawContent('secure-script')).resolves.toEqual({ success: true, content: 'print("ok")' })
    expect(mockedAuthorizeDeliveryAccess).toHaveBeenCalledWith(expect.objectContaining({
      script: expect.objectContaining({ access_mode: 'public' }),
    }))
    expect(mockedLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'script.raw_delivered' }))
  })

  it('denies private scripts without admin authentication', async () => {
    mockedFindScriptBySlug.mockResolvedValue(script({ visibility: 'private' }))

    await expect(getRawContent('secure-script')).resolves.toEqual({
      success: false,
      message: 'This script is private',
      status: 403,
    })
    expect(mockedAuthorizeDeliveryAccess).not.toHaveBeenCalled()
  })

  it('denies key_required scripts without a valid key', async () => {
    mockedFindScriptBySlug.mockResolvedValue(script({ access_mode: 'key_required' }))
    mockedAuthorizeDeliveryAccess.mockResolvedValue({ success: false, status: 403, message: 'Key is required' })

    await expect(getRawContent('secure-script')).resolves.toEqual({
      success: false,
      message: 'Key is required',
      status: 403,
    })
  })

  it('allows key_required scripts with a valid key', async () => {
    mockedFindScriptBySlug.mockResolvedValue(script({ access_mode: 'key_required' }))
    mockedAuthorizeDeliveryAccess.mockResolvedValue({ success: true, accessMode: 'key_required' })

    await expect(getRawContent('secure-script', { key: 'LUXY-FREE-ABCD-1234-EFGH' })).resolves.toEqual({
      success: true,
      content: 'print("ok")',
    })
    expect(mockedAuthorizeDeliveryAccess).toHaveBeenCalledWith(expect.objectContaining({ key: 'LUXY-FREE-ABCD-1234-EFGH' }))
  })

  it('denies license_required scripts without a valid license', async () => {
    mockedFindScriptBySlug.mockResolvedValue(script({ access_mode: 'license_required' }))
    mockedAuthorizeDeliveryAccess.mockResolvedValue({ success: false, status: 403, message: 'License is required' })

    await expect(getRawContent('secure-script')).resolves.toEqual({
      success: false,
      message: 'License is required',
      status: 403,
    })
  })

  it('allows license_required scripts with a valid license and records delivery counters', async () => {
    mockedFindScriptBySlug.mockResolvedValue(script({ access_mode: 'license_required' }))
    mockedAuthorizeDeliveryAccess.mockResolvedValue({
      success: true,
      accessMode: 'license_required',
      license: { id: 'license-1' } as never,
      assignment: undefined,
      assignmentCreated: false,
    })

    await expect(getRawContent('secure-script', {
      license: 'LUXY-PREM-ABCD-1234-EFGH',
      customerIdentifier: 'customer@example.com',
    })).resolves.toEqual({ success: true, content: 'print("ok")' })

    expect(mockedRecordLicenseDelivery).toHaveBeenCalledWith('license-1')
  })
})
