import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DeliveryBuildDashboardRow, DeliveryBuildRow } from '@/app/lib/repositories/delivery-build-repository'
import type { ScriptRow, VersionSummaryRow } from '@/app/lib/repositories/script-repository'

vi.mock('@/app/lib/auth/ownership', () => ({
  assertScriptOwner: vi.fn(),
  OwnershipError: class extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.name = 'OwnershipError'
      this.status = status
    }
  },
}))

vi.mock('@/app/lib/repositories/delivery-build-repository', () => ({
  listBuildsForScript: vi.fn(),
  getBuildDashboardById: vi.fn(),
  getLatestBuild: vi.fn(),
  listLatestBuildSummariesByVersionIds: vi.fn(),
}))

vi.mock('@/app/lib/services/delivery-build-service', () => ({
  rebuildVersion: vi.fn(),
}))

import { assertScriptOwner, OwnershipError } from '@/app/lib/auth/ownership'
import {
  getBuildDashboardById,
  getLatestBuild,
  listBuildsForScript,
  listLatestBuildSummariesByVersionIds,
} from '@/app/lib/repositories/delivery-build-repository'
import { rebuildVersion } from '@/app/lib/services/delivery-build-service'
import {
  getBuildDetails,
  getBuildStatusesForVersions,
  getLatestBuildStatus,
  listBuildHistory,
  rebuildLatestVersion,
} from '@/app/lib/services/build-operations-service'

const OWNER_A = '00000000-0000-0000-0000-00000000000a'

const mockedAssertScriptOwner = vi.mocked(assertScriptOwner)
const mockedListBuildsForScript = vi.mocked(listBuildsForScript)
const mockedGetBuildDashboardById = vi.mocked(getBuildDashboardById)
const mockedGetLatestBuild = vi.mocked(getLatestBuild)
const mockedListLatestBuildSummariesByVersionIds = vi.mocked(listLatestBuildSummariesByVersionIds)
const mockedRebuildVersion = vi.mocked(rebuildVersion)

function scriptRow(overrides: Partial<ScriptRow> = {}): ScriptRow {
  return {
    id: 'script-uuid-1',
    slug: 'my-script',
    name: 'My Script',
    description: null,
    visibility: 'private',
    creator_id: OWNER_A,
    current_version_id: 'version-uuid-1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function dashboardBuild(overrides: Partial<DeliveryBuildDashboardRow> = {}): DeliveryBuildDashboardRow {
  return {
    id: 'build-uuid-1',
    script_id: 'script-uuid-1',
    version_id: 'version-uuid-1',
    build_status: 'ready',
    payload_storage_kind: 'inline_encrypted',
    payload_content_type: 'application/vnd.luxyhub.delivery-payload.v1+json',
    payload_byte_size: 256,
    build_version: 'delivery-build-v1',
    payload_format_version: 'inline-json-v1',
    encryption_scheme: 'aes-256-gcm:v1',
    invalidated_reason: null,
    build_error_code: null,
    build_error_message: null,
    metadata: { normalized_byte_size: 14 },
    built_at: '2026-01-01T00:01:00.000Z',
    invalidated_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:01:00.000Z',
    ...overrides,
  }
}

function fullBuild(overrides: Partial<DeliveryBuildRow> = {}): DeliveryBuildRow {
  return {
    ...dashboardBuild(),
    payload_ciphertext: 'encrypted-payload',
    source_sha256: '0'.repeat(64),
    payload_sha256: '1'.repeat(64),
    encryption_key_id: 'test-key',
    ...overrides,
  }
}

function versionSummary(overrides: Partial<VersionSummaryRow> = {}): VersionSummaryRow {
  return {
    id: 'version-uuid-1',
    script_id: 'script-uuid-1',
    version: '1.0.0',
    changelog: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('Phase 6B build operations service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('lists build history with pagination for an owned script', async () => {
    mockedAssertScriptOwner.mockResolvedValue(scriptRow())
    mockedListBuildsForScript.mockResolvedValue({
      builds: [dashboardBuild(), dashboardBuild({ id: 'build-uuid-2', build_status: 'failed' })],
      total: 12,
    })

    const result = await listBuildHistory(OWNER_A, 'my-script', { limit: 10, offset: 10 })

    expect(result.success).toBe(true)
    expect(mockedAssertScriptOwner).toHaveBeenCalledWith('my-script', OWNER_A)
    expect(mockedListBuildsForScript).toHaveBeenCalledWith('script-uuid-1', 10, 10)
    if (result.success) {
      expect(result.total).toBe(12)
      expect(result.builds).toHaveLength(2)
      expect(result.builds[0]).not.toHaveProperty('payload_ciphertext')
      expect(result.builds[0]).not.toHaveProperty('source_sha256')
      expect(result.builds[0]).not.toHaveProperty('payload_sha256')
    }
  })

  it('rejects invalid pagination before ownership lookup', async () => {
    const result = await listBuildHistory(OWNER_A, 'my-script', { limit: 100, offset: 0 })

    expect(result.success).toBe(false)
    expect(mockedAssertScriptOwner).not.toHaveBeenCalled()
    if (!result.success) {
      expect(result.status).toBe(400)
    }
  })

  it('retrieves safe build details for an owned script', async () => {
    mockedAssertScriptOwner.mockResolvedValue(scriptRow())
    mockedGetBuildDashboardById.mockResolvedValue(dashboardBuild())

    const result = await getBuildDetails(OWNER_A, 'my-script', 'build-uuid-1')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.build.encryptionScheme).toBe('aes-256-gcm:v1')
      expect(result.build.metadata).toEqual({ normalized_byte_size: 14 })
      expect(result.build).not.toHaveProperty('payload_ciphertext')
      expect(result.build).not.toHaveProperty('encryption_key_id')
    }
  })

  it('isolates build details that belong to another script', async () => {
    mockedAssertScriptOwner.mockResolvedValue(scriptRow())
    mockedGetBuildDashboardById.mockResolvedValue(dashboardBuild({ script_id: 'foreign-script' }))

    const result = await getBuildDetails(OWNER_A, 'my-script', 'build-uuid-1')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(404)
    }
  })

  it('propagates ownership failures without repository access', async () => {
    mockedAssertScriptOwner.mockRejectedValue(new OwnershipError('Script not found', 404))

    const result = await listBuildHistory(OWNER_A, 'foreign-script')

    expect(result.success).toBe(false)
    expect(mockedListBuildsForScript).not.toHaveBeenCalled()
    if (!result.success) {
      expect(result.status).toBe(404)
    }
  })

  it('returns failed build details for safe dashboard presentation', async () => {
    mockedAssertScriptOwner.mockResolvedValue(scriptRow())
    mockedGetBuildDashboardById.mockResolvedValue(dashboardBuild({
      build_status: 'failed',
      build_error_code: 'empty_source',
      build_error_message: 'Source content is empty after normalization',
      built_at: null,
    }))

    const result = await getBuildDetails(OWNER_A, 'my-script', 'build-uuid-1')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.build.status).toBe('failed')
      expect(result.build.errorCode).toBe('empty_source')
      expect(result.build.errorMessage).toBe('Source content is empty after normalization')
    }
  })

  it('retrieves the latest build for the current version', async () => {
    mockedAssertScriptOwner.mockResolvedValue(scriptRow())
    mockedGetLatestBuild.mockResolvedValue(dashboardBuild())

    const result = await getLatestBuildStatus(OWNER_A, 'my-script')

    expect(result.success).toBe(true)
    expect(mockedGetLatestBuild).toHaveBeenCalledWith('version-uuid-1')
    if (result.success) {
      expect(result.build?.status).toBe('ready')
    }
  })

  it('retrieves latest build statuses for owned version history rows', async () => {
    mockedAssertScriptOwner.mockResolvedValue(scriptRow())
    mockedListLatestBuildSummariesByVersionIds.mockResolvedValue([
      dashboardBuild(),
      dashboardBuild({ version_id: 'foreign-version' }),
    ])

    const result = await getBuildStatusesForVersions(OWNER_A, 'my-script', [
      versionSummary(),
      versionSummary({ id: 'foreign-version', script_id: 'foreign-script' }),
    ])

    expect(result.success).toBe(true)
    expect(mockedListLatestBuildSummariesByVersionIds).toHaveBeenCalledWith(['version-uuid-1'])
    if (result.success) {
      expect(result.buildsByVersionId['version-uuid-1'].status).toBe('ready')
      expect(result.buildsByVersionId['foreign-version']).toBeUndefined()
    }
  })

  it('rebuilds only the latest script version', async () => {
    mockedAssertScriptOwner.mockResolvedValue(scriptRow({ current_version_id: 'latest-version' }))
    mockedRebuildVersion.mockResolvedValue({ success: true, build: fullBuild({ version_id: 'latest-version' }) })

    const result = await rebuildLatestVersion(OWNER_A, 'my-script')

    expect(result.success).toBe(true)
    expect(mockedRebuildVersion).toHaveBeenCalledWith('latest-version')
    if (result.success) {
      expect(result.build.versionId).toBe('latest-version')
      expect(result.build).not.toHaveProperty('payload_ciphertext')
      expect(result.build).not.toHaveProperty('source_sha256')
    }
  })
})
