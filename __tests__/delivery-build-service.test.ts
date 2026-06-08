import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VersionRow } from '@/app/lib/repositories/script-repository'
import type { DeliveryBuildRow } from '@/app/lib/repositories/delivery-build-repository'

vi.mock('@/app/lib/repositories/script-repository', () => ({
  getVersionById: vi.fn(),
}))

vi.mock('@/app/lib/repositories/delivery-build-repository', () => ({
  createBuild: vi.fn(),
  getReadyBuild: vi.fn(),
  markBuildReady: vi.fn(),
  markBuildFailed: vi.fn(),
  markBuildInvalidated: vi.fn(),
}))

import {
  buildVersion,
  rebuildVersion,
  invalidateBuild,
  DELIVERY_BUILD_VERSION,
  ENCRYPTION_SCHEME,
  PAYLOAD_CONTENT_TYPE,
  PAYLOAD_FORMAT_VERSION,
} from '@/app/lib/services/delivery-build-service'
import { getVersionById } from '@/app/lib/repositories/script-repository'
import {
  createBuild,
  getReadyBuild,
  markBuildReady,
  markBuildFailed,
  markBuildInvalidated,
} from '@/app/lib/repositories/delivery-build-repository'

const mockedGetVersionById = vi.mocked(getVersionById)
const mockedCreateBuild = vi.mocked(createBuild)
const mockedGetReadyBuild = vi.mocked(getReadyBuild)
const mockedMarkBuildReady = vi.mocked(markBuildReady)
const mockedMarkBuildFailed = vi.mocked(markBuildFailed)
const mockedMarkBuildInvalidated = vi.mocked(markBuildInvalidated)

function mockVersionRow(overrides: Partial<VersionRow> = {}): VersionRow {
  return {
    id: 'version-uuid-1',
    script_id: 'script-uuid-1',
    version: '1.0.0',
    content: 'print("hello")',
    changelog: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function mockBuildRow(overrides: Partial<DeliveryBuildRow> = {}): DeliveryBuildRow {
  return {
    id: 'build-uuid-1',
    script_id: 'script-uuid-1',
    version_id: 'version-uuid-1',
    build_status: 'building',
    payload_storage_kind: 'inline_encrypted',
    payload_ciphertext: null,
    payload_content_type: PAYLOAD_CONTENT_TYPE,
    payload_byte_size: null,
    source_sha256: '0'.repeat(64),
    payload_sha256: null,
    build_version: DELIVERY_BUILD_VERSION,
    payload_format_version: PAYLOAD_FORMAT_VERSION,
    encryption_scheme: ENCRYPTION_SCHEME,
    encryption_key_id: 'test-key',
    invalidated_reason: null,
    build_error_code: null,
    build_error_message: null,
    metadata: {},
    built_at: null,
    invalidated_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('Phase 5B delivery build service', () => {
  let buildCounter = 0
  let buildRows: Map<string, DeliveryBuildRow>

  beforeEach(() => {
    vi.resetAllMocks()
    process.env.DELIVERY_PAYLOAD_SECRET = 'test-delivery-secret'
    process.env.DELIVERY_PAYLOAD_KEY_ID = 'test-key'
    buildCounter = 0
    buildRows = new Map()

    mockedCreateBuild.mockImplementation(async (params) => {
      buildCounter += 1
      const row = mockBuildRow({
        id: `build-uuid-${buildCounter}`,
        script_id: params.scriptId,
        version_id: params.versionId,
        source_sha256: params.sourceSha256,
        build_version: params.buildVersion,
        payload_format_version: params.payloadFormatVersion,
        encryption_scheme: params.encryptionScheme,
        encryption_key_id: params.encryptionKeyId ?? null,
        payload_content_type: params.payloadContentType,
        metadata: params.metadata ?? {},
      })
      buildRows.set(row.id, row)
      return row
    })

    mockedMarkBuildReady.mockImplementation(async (buildId, params) => {
      const previous = buildRows.get(buildId) ?? mockBuildRow({ id: buildId })
      const row = mockBuildRow({
        ...previous,
        build_status: 'ready',
        payload_ciphertext: params.payloadCiphertext,
        payload_sha256: params.payloadSha256,
        payload_byte_size: params.payloadByteSize,
        built_at: '2026-01-01T00:01:00.000Z',
        updated_at: '2026-01-01T00:01:00.000Z',
      })
      buildRows.set(row.id, row)
      return row
    })

    mockedMarkBuildFailed.mockImplementation(async (buildId, params) => {
      const previous = buildRows.get(buildId) ?? mockBuildRow({ id: buildId })
      const row = mockBuildRow({
        ...previous,
        build_status: 'failed',
        payload_ciphertext: null,
        payload_sha256: null,
        payload_byte_size: null,
        build_error_code: params.errorCode,
        build_error_message: params.errorMessage,
      })
      buildRows.set(row.id, row)
      return row
    })

    mockedMarkBuildInvalidated.mockImplementation(async (buildId, reason) => {
      const previous = buildRows.get(buildId) ?? mockBuildRow({ id: buildId })
      const row = mockBuildRow({
        ...previous,
        build_status: 'invalidated',
        invalidated_reason: reason,
        invalidated_at: '2026-01-01T00:02:00.000Z',
      })
      buildRows.set(row.id, row)
      return row
    })

    mockedGetReadyBuild.mockResolvedValue(null)
  })

  it('builds a version into an inline encrypted ready payload', async () => {
    mockedGetVersionById.mockResolvedValue(mockVersionRow())

    const result = await buildVersion('version-uuid-1')

    expect(result.success).toBe(true)
    expect(mockedCreateBuild).toHaveBeenCalledTimes(1)
    expect(mockedMarkBuildReady).toHaveBeenCalledTimes(1)

    const createParams = mockedCreateBuild.mock.calls[0][0]
    expect(createParams.sourceSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(createParams.payloadFormatVersion).toBe(PAYLOAD_FORMAT_VERSION)
    expect(createParams.payloadContentType).toBe(PAYLOAD_CONTENT_TYPE)
    expect(createParams).not.toHaveProperty('content')

    const readyParams = mockedMarkBuildReady.mock.calls[0][1]
    expect(readyParams.payloadCiphertext).not.toContain('print("hello")')
    expect(readyParams.payloadSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(readyParams.payloadByteSize).toBeGreaterThan(0)

    if (result.success) {
      expect(result.build.build_status).toBe('ready')
      expect(result.build.payload_storage_kind).toBe('inline_encrypted')
      expect(result.build.payload_ciphertext).toBe(readyParams.payloadCiphertext)
    }
  })

  it('records a failed build without storing source content', async () => {
    mockedGetVersionById.mockResolvedValue(mockVersionRow({ content: '   \r\n   ' }))

    const result = await buildVersion('version-uuid-1')

    expect(result.success).toBe(false)
    expect(mockedCreateBuild).toHaveBeenCalledTimes(1)
    expect(mockedMarkBuildReady).not.toHaveBeenCalled()
    expect(mockedMarkBuildFailed).toHaveBeenCalledWith('build-uuid-1', {
      errorCode: 'empty_source',
      errorMessage: 'Source content is empty after normalization',
    })

    if (!result.success) {
      expect(result.status).toBe(422)
      expect(result.build?.payload_ciphertext).toBeNull()
      expect(result.build?.build_error_message).not.toContain('\r\n')
    }
  })

  it('rebuilds a version and invalidates the previous ready build after success', async () => {
    const previousReadyBuild = mockBuildRow({
      id: 'previous-build',
      build_status: 'ready',
      payload_ciphertext: 'old-payload',
      payload_sha256: 'a'.repeat(64),
      built_at: '2026-01-01T00:00:00.000Z',
    })
    buildRows.set(previousReadyBuild.id, previousReadyBuild)
    mockedGetReadyBuild.mockResolvedValue(previousReadyBuild)
    mockedGetVersionById.mockResolvedValue(mockVersionRow())

    const result = await rebuildVersion('version-uuid-1')

    expect(result.success).toBe(true)
    expect(mockedGetReadyBuild).toHaveBeenCalledWith('version-uuid-1', {
      buildVersion: DELIVERY_BUILD_VERSION,
      payloadFormatVersion: PAYLOAD_FORMAT_VERSION,
    })
    expect(mockedMarkBuildInvalidated).toHaveBeenCalledWith('previous-build', 'superseded_by_rebuild')
  })

  it('changes source and payload hashes when source content changes', async () => {
    mockedGetVersionById
      .mockResolvedValueOnce(mockVersionRow({ id: 'version-uuid-1', content: 'print("one")' }))
      .mockResolvedValueOnce(mockVersionRow({ id: 'version-uuid-2', content: 'print("two")' }))

    const first = await buildVersion('version-uuid-1')
    const second = await buildVersion('version-uuid-2')

    expect(first.success).toBe(true)
    expect(second.success).toBe(true)

    const firstCreate = mockedCreateBuild.mock.calls[0][0]
    const secondCreate = mockedCreateBuild.mock.calls[1][0]
    const firstReady = mockedMarkBuildReady.mock.calls[0][1]
    const secondReady = mockedMarkBuildReady.mock.calls[1][1]

    expect(firstCreate.sourceSha256).not.toBe(secondCreate.sourceSha256)
    expect(firstReady.payloadSha256).not.toBe(secondReady.payloadSha256)
  })

  it('invalidates a build with a sanitized reason', async () => {
    const result = await invalidateBuild('build-uuid-1', 'manual leak! reason')

    expect(result.success).toBe(true)
    expect(mockedMarkBuildInvalidated).toHaveBeenCalledWith('build-uuid-1', 'manual_leak__reason')
    if (result.success) {
      expect(result.build.build_status).toBe('invalidated')
    }
  })
})
