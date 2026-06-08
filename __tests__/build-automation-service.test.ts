import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DeliveryBuildRow } from '@/app/lib/repositories/delivery-build-repository'

vi.mock('@/app/lib/repositories/delivery-build-repository', () => ({
  getLatestBuildRow: vi.fn(),
}))

vi.mock('@/app/lib/services/delivery-build-service', () => ({
  buildVersion: vi.fn(),
  DELIVERY_BUILD_VERSION: 'delivery-build-v1',
  PAYLOAD_FORMAT_VERSION: 'inline-json-v1',
}))

import { getLatestBuildRow } from '@/app/lib/repositories/delivery-build-repository'
import { buildVersion } from '@/app/lib/services/delivery-build-service'
import { ensureAutoBuildForVersion } from '@/app/lib/services/build-automation-service'

const mockedGetLatestBuildRow = vi.mocked(getLatestBuildRow)
const mockedBuildVersion = vi.mocked(buildVersion)

function buildRow(overrides: Partial<DeliveryBuildRow> = {}): DeliveryBuildRow {
  return {
    id: 'build-uuid-1',
    script_id: 'script-uuid-1',
    version_id: 'version-uuid-1',
    build_status: 'ready',
    payload_storage_kind: 'inline_encrypted',
    payload_ciphertext: 'encrypted-payload',
    payload_content_type: 'application/vnd.luxyhub.delivery-payload.v1+json',
    payload_byte_size: 128,
    source_sha256: '0'.repeat(64),
    payload_sha256: '1'.repeat(64),
    build_version: 'delivery-build-v1',
    payload_format_version: 'inline-json-v1',
    encryption_scheme: 'aes-256-gcm:v1',
    encryption_key_id: 'test-key',
    invalidated_reason: null,
    build_error_code: null,
    build_error_message: null,
    metadata: {},
    built_at: '2026-01-01T00:01:00.000Z',
    invalidated_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:01:00.000Z',
    ...overrides,
  }
}

describe('Phase 6C build automation service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('builds when no compatible build exists', async () => {
    const ready = buildRow()
    mockedGetLatestBuildRow.mockResolvedValue(null)
    mockedBuildVersion.mockResolvedValue({ success: true, build: ready })

    const result = await ensureAutoBuildForVersion('version-uuid-1', 'script_created')

    expect(mockedGetLatestBuildRow).toHaveBeenCalledWith('version-uuid-1', {
      buildVersion: 'delivery-build-v1',
      payloadFormatVersion: 'inline-json-v1',
    })
    expect(mockedBuildVersion).toHaveBeenCalledWith('version-uuid-1')
    expect(result.success).toBe(true)
    expect(result.skipped).toBe(false)
  })

  it('skips duplicate build records when latest build is ready', async () => {
    mockedGetLatestBuildRow.mockResolvedValue(buildRow({ build_status: 'ready' }))

    const result = await ensureAutoBuildForVersion('version-uuid-1', 'script_published')

    expect(mockedBuildVersion).not.toHaveBeenCalled()
    expect(result.success).toBe(true)
    expect(result.skipped).toBe(true)
    if (result.success && result.skipped) {
      expect(result.reason).toBe('already_ready')
      expect(result.latestStatus).toBe('ready')
    }
  })

  it('skips duplicate build records when latest build failed and awaits manual rebuild', async () => {
    mockedGetLatestBuildRow.mockResolvedValue(buildRow({ build_status: 'failed' }))

    const result = await ensureAutoBuildForVersion('version-uuid-1', 'script_published')

    expect(mockedBuildVersion).not.toHaveBeenCalled()
    expect(result.success).toBe(true)
    expect(result.skipped).toBe(true)
    if (result.success && result.skipped) {
      expect(result.reason).toBe('failed_requires_manual_rebuild')
    }
  })

  it('rebuilds automatically when latest compatible build is invalidated', async () => {
    mockedGetLatestBuildRow.mockResolvedValue(buildRow({ build_status: 'invalidated' }))
    mockedBuildVersion.mockResolvedValue({ success: true, build: buildRow({ id: 'build-uuid-2' }) })

    const result = await ensureAutoBuildForVersion('version-uuid-1', 'script_published')

    expect(mockedBuildVersion).toHaveBeenCalledWith('version-uuid-1')
    expect(result.success).toBe(true)
    expect(result.skipped).toBe(false)
  })

  it('returns failed build results without throwing', async () => {
    const failed = buildRow({
      build_status: 'failed',
      payload_ciphertext: null,
      payload_sha256: null,
      built_at: null,
      build_error_code: 'empty_source',
      build_error_message: 'Source content is empty after normalization',
    })
    mockedGetLatestBuildRow.mockResolvedValue(null)
    mockedBuildVersion.mockResolvedValue({
      success: false,
      message: 'Source content is empty after normalization',
      status: 422,
      build: failed,
    })

    const result = await ensureAutoBuildForVersion('version-uuid-1', 'version_created')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.build?.build_status).toBe('failed')
      expect(result.status).toBe(422)
    }
  })
})
