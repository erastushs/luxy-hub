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

import { createRuntimePayloadFromBuild, RuntimePayloadError } from '@/app/lib/delivery/runtime-payload'
import { buildVersion, normalizeSource } from '@/app/lib/services/delivery-build-service'
import { getVersionById } from '@/app/lib/repositories/script-repository'
import {
  createBuild,
  markBuildBuilding,
  markBuildReady,
} from '@/app/lib/repositories/delivery-build-repository'

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
    content: 'print("LUXY TEST")',
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

describe('Phase 6H runtime payload delivery', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.DELIVERY_PAYLOAD_SECRET = TEST_SECRET
    process.env.DELIVERY_PAYLOAD_KEY_ID = 'test-key'
  })

  it('decrypts an encrypted build server-side and returns runtime-v1 payload', async () => {
    const source = 'print("LUXY TEST")\r\n'
    const build = await buildPayloadFromSource(source)

    expect(build.payload_storage_kind).toBe('inline_encrypted')
    expect(build.payload_ciphertext).toBeTruthy()
    expect(build.payload_ciphertext).not.toContain('LUXY TEST')

    const runtime = createRuntimePayloadFromBuild(build)

    expect(runtime).toEqual({
      runtime_payload: normalizeSource(source),
      build_version: 'delivery-build-v1',
      version_id: 'version-uuid-1',
      runtime_format_version: 'runtime-v1',
    })
    expect(runtime).not.toHaveProperty('payload')
    expect(runtime).not.toHaveProperty('payload_ciphertext')
    expect(runtime).not.toHaveProperty('source_sha256')
    expect(runtime).not.toHaveProperty('payload_sha256')
  })

  it('rejects corrupted encrypted build payloads before runtime delivery', async () => {
    const build = await buildPayloadFromSource('print("hash")')

    expect(() => createRuntimePayloadFromBuild({
      ...build,
      payload_ciphertext: `${build.payload_ciphertext}tampered`,
    })).toThrow(RuntimePayloadError)
  })
})
