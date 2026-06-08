import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VersionRow } from '@/app/lib/repositories/script-repository'
import type { DeliveryBuildRow } from '@/app/lib/repositories/delivery-build-repository'

vi.mock('@/app/lib/repositories/script-repository', () => ({
  getVersionById: vi.fn(),
}))

vi.mock('@/app/lib/repositories/delivery-build-repository', () => ({
  createBuild: vi.fn(),
  getReadyBuild: vi.fn(),
  markBuildBuilding: vi.fn(),
  markBuildReady: vi.fn(),
  markBuildFailed: vi.fn(),
  markBuildInvalidated: vi.fn(),
}))

import { buildVersion, normalizeSource } from '@/app/lib/services/delivery-build-service'
import { getVersionById } from '@/app/lib/repositories/script-repository'
import {
  createBuild,
  markBuildBuilding,
  markBuildReady,
} from '@/app/lib/repositories/delivery-build-repository'
import {
  buildPayloadAad,
  consumeDeliveryPayloadV1,
  LoaderRuntimeError,
  validatePayloadIntegrity,
} from '@/app/lib/loader/loader-runtime-v1'

const mockedGetVersionById = vi.mocked(getVersionById)
const mockedCreateBuild = vi.mocked(createBuild)
const mockedMarkBuildBuilding = vi.mocked(markBuildBuilding)
const mockedMarkBuildReady = vi.mocked(markBuildReady)

const TEST_SECRET = 'test-delivery-secret'

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
    build_status: 'pending',
    payload_storage_kind: 'inline_encrypted',
    payload_ciphertext: null,
    payload_content_type: 'application/vnd.luxyhub.delivery-payload.v1+json',
    payload_byte_size: null,
    source_sha256: '0'.repeat(64),
    payload_sha256: null,
    build_version: 'delivery-build-v1',
    payload_format_version: 'inline-json-v1',
    encryption_scheme: 'aes-256-gcm:v1',
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

async function buildPayloadFromSource(source: string): Promise<DeliveryBuildRow> {
  const version = mockVersionRow({ content: source })
  const buildRows = new Map<string, DeliveryBuildRow>()

  mockedGetVersionById.mockResolvedValue(version)
  mockedCreateBuild.mockImplementation(async (params) => {
    const row = mockBuildRow({
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
  mockedMarkBuildBuilding.mockImplementation(async (buildId) => {
    const previous = buildRows.get(buildId) ?? mockBuildRow({ id: buildId })
    const row = mockBuildRow({
      ...previous,
      build_status: 'building',
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

  const result = await buildVersion(version.id)
  if (!result.success) {
    throw new Error(result.message)
  }

  return result.build
}

function deliveryResponseFromBuild(build: DeliveryBuildRow) {
  return {
    payload: build.payload_ciphertext ?? '',
    context: {
      build_id: build.id,
      version_id: build.version_id,
      source_sha256: build.source_sha256,
      payload_sha256: build.payload_sha256 ?? '',
    },
    payload_format_version: build.payload_format_version,
    build_version: build.build_version,
  }
}

describe('Phase 6D loader runtime v1', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.DELIVERY_PAYLOAD_SECRET = TEST_SECRET
    process.env.DELIVERY_PAYLOAD_KEY_ID = 'test-key'
  })

  it('standardizes AAD as payload format, version id, and source hash', () => {
    const aad = buildPayloadAad({
      payloadFormatVersion: 'inline-json-v1',
      versionId: 'version-uuid-1',
      sourceSha256: 'a'.repeat(64),
    })

    expect(aad).toBe(`inline-json-v1:version-uuid-1:${'a'.repeat(64)}`)
  })

  it('validates, decrypts, decompresses, and executes a delivery response', async () => {
    const source = 'local value = 42\r\nprint(value)'
    const build = await buildPayloadFromSource(source)
    const execute = vi.fn()

    const result = await consumeDeliveryPayloadV1({
      response: deliveryResponseFromBuild(build),
      secret: TEST_SECRET,
      execute,
    })

    expect(result.source).toBe(normalizeSource(source))
    expect(result.aad).toBe(`${build.payload_format_version}:${build.version_id}:${build.source_sha256}`)
    expect(execute).toHaveBeenCalledWith(normalizeSource(source))
  })

  it('rejects payload integrity mismatches before decrypting', async () => {
    const build = await buildPayloadFromSource('print("integrity")')
    const response = deliveryResponseFromBuild(build)
    response.context.payload_sha256 = 'f'.repeat(64)

    await expect(consumeDeliveryPayloadV1({
      response,
      secret: TEST_SECRET,
    })).rejects.toThrow(LoaderRuntimeError)
  })

  it('rejects unsupported build versions', async () => {
    const build = await buildPayloadFromSource('print("version")')
    const response = {
      ...deliveryResponseFromBuild(build),
      build_version: 'delivery-build-v9',
    }

    await expect(consumeDeliveryPayloadV1({
      response,
      secret: TEST_SECRET,
    })).rejects.toThrow(LoaderRuntimeError)
  })

  it('exposes direct payload hash validation for runtime adapters', async () => {
    const build = await buildPayloadFromSource('print("hash")')
    const response = deliveryResponseFromBuild(build)

    expect(() => validatePayloadIntegrity(response.payload, response.context)).not.toThrow()
    expect(() => validatePayloadIntegrity(`${response.payload}tampered`, response.context)).toThrow(LoaderRuntimeError)
  })
})
