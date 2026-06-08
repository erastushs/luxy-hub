import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DeliveryBuildSummaryRow } from '@/app/lib/repositories/delivery-build-repository'
import type { ScriptRow } from '@/app/lib/repositories/script-repository'

vi.mock('@/app/lib/repositories/delivery-build-repository', () => ({
  listLatestBuildSummariesByVersionIds: vi.fn(),
}))

import { listLatestBuildSummariesByVersionIds } from '@/app/lib/repositories/delivery-build-repository'
import { getDashboardBuildInfoForScripts } from '@/app/lib/services/dashboard-build-service'

const OWNER_A = '00000000-0000-0000-0000-00000000000a'
const OWNER_B = '00000000-0000-0000-0000-00000000000b'

const mockedListLatestBuildSummariesByVersionIds = vi.mocked(listLatestBuildSummariesByVersionIds)

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

function buildSummary(overrides: Partial<DeliveryBuildSummaryRow> = {}): DeliveryBuildSummaryRow {
  return {
    id: 'build-uuid-1',
    script_id: 'script-uuid-1',
    version_id: 'version-uuid-1',
    build_status: 'ready',
    build_version: 'delivery-build-v1',
    payload_format_version: 'inline-json-v1',
    invalidated_reason: null,
    build_error_code: null,
    build_error_message: null,
    built_at: '2026-01-01T00:01:00.000Z',
    invalidated_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:01:00.000Z',
    ...overrides,
  }
}

describe('Phase 6A dashboard build service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns safe build visibility data for owned current versions', async () => {
    mockedListLatestBuildSummariesByVersionIds.mockResolvedValue([buildSummary()])

    const result = await getDashboardBuildInfoForScripts(OWNER_A, [scriptRow()])

    expect(mockedListLatestBuildSummariesByVersionIds).toHaveBeenCalledWith(['version-uuid-1'])
    expect(result['version-uuid-1']).toEqual({
      buildId: 'build-uuid-1',
      scriptId: 'script-uuid-1',
      versionId: 'version-uuid-1',
      status: 'ready',
      buildVersion: 'delivery-build-v1',
      payloadFormatVersion: 'inline-json-v1',
      invalidatedReason: null,
      errorCode: null,
      errorMessage: null,
      lastBuildAt: '2026-01-01T00:01:00.000Z',
      invalidatedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:01:00.000Z',
    })
    expect(result['version-uuid-1']).not.toHaveProperty('payload_ciphertext')
    expect(result['version-uuid-1']).not.toHaveProperty('source_sha256')
    expect(result['version-uuid-1']).not.toHaveProperty('payload_sha256')
  })

  it('filters scripts that do not belong to the owner', async () => {
    mockedListLatestBuildSummariesByVersionIds.mockResolvedValue([
      buildSummary({ version_id: 'foreign-version', script_id: 'foreign-script' }),
    ])

    const result = await getDashboardBuildInfoForScripts(OWNER_A, [
      scriptRow({ creator_id: OWNER_B, current_version_id: 'foreign-version' }),
    ])

    expect(mockedListLatestBuildSummariesByVersionIds).toHaveBeenCalledWith([])
    expect(result).toEqual({})
  })

  it('surfaces invalidated build status when it is the latest build', async () => {
    mockedListLatestBuildSummariesByVersionIds.mockResolvedValue([
      buildSummary({
        build_status: 'invalidated',
        built_at: null,
        invalidated_at: '2026-01-01T00:02:00.000Z',
        updated_at: '2026-01-01T00:02:00.000Z',
      }),
    ])

    const result = await getDashboardBuildInfoForScripts(OWNER_A, [scriptRow()])

    expect(result['version-uuid-1'].status).toBe('invalidated')
    expect(result['version-uuid-1'].lastBuildAt).toBe('2026-01-01T00:02:00.000Z')
  })
})
