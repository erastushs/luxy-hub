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

import { buildVersion, normalizeSource } from '@/app/lib/services/delivery-build-service'
import { getVersionById } from '@/app/lib/repositories/script-repository'
import {
  createBuild,
  markBuildReady,
} from '@/app/lib/repositories/delivery-build-repository'
import {
  decryptPayload,
  decompressPayload,
  PayloadConsumerError,
  validatePayload,
} from '@/app/lib/delivery/payload-consumer'

const mockedGetVersionById = vi.mocked(getVersionById)
const mockedCreateBuild = vi.mocked(createBuild)
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
    build_status: 'building',
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

describe('Phase 5D delivery payload consumer', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.DELIVERY_PAYLOAD_SECRET = TEST_SECRET
    process.env.DELIVERY_PAYLOAD_KEY_ID = 'test-key'
  })

  it('decrypts and decompresses Phase 5B output back to normalized source', async () => {
    const source = 'print("hello")\r\n'
    const build = await buildPayloadFromSource(source)

    const envelope = validatePayload(build.payload_ciphertext ?? '')
    const compressedPayload = decryptPayload({
      payload: envelope,
      versionId: build.version_id,
      sourceSha256: build.source_sha256,
      secret: TEST_SECRET,
    })
    const recoveredSource = decompressPayload(compressedPayload)

    expect(recoveredSource).toBe(normalizeSource(source))
  })

  it('consumes payload returned by the delivery API response shape', async () => {
    const source = 'local value = 42\nprint(value)'
    const build = await buildPayloadFromSource(source)
    const deliveryApiResponse = {
      payload: build.payload_ciphertext ?? '',
      payload_format_version: build.payload_format_version,
      build_version: build.build_version,
    }

    expect(deliveryApiResponse.payload_format_version).toBe('inline-json-v1')
    expect(deliveryApiResponse.build_version).toBe('delivery-build-v1')

    const recoveredSource = decompressPayload(decryptPayload({
      payload: deliveryApiResponse.payload,
      versionId: build.version_id,
      sourceSha256: build.source_sha256,
      secret: TEST_SECRET,
    }))

    expect(recoveredSource).toBe(normalizeSource(source))
  })

  it('rejects invalid payload JSON', () => {
    expect(() => validatePayload('not-json')).toThrow(PayloadConsumerError)
  })

  it('rejects invalid payload format versions', () => {
    const payload = JSON.stringify({
      v: 'future-format-v9',
      alg: 'aes-256-gcm:v1',
      kid: 'test-key',
      compression: 'gzip',
      iv: 'AAAAAAAAAAAAAAAA',
      tag: 'AAAAAAAAAAAAAAAAAAAAAA==',
      data: 'AAAA',
    })

    expect(() => validatePayload(payload)).toThrow(PayloadConsumerError)
  })

  it('rejects decryption with invalid payload context', async () => {
    const build = await buildPayloadFromSource('print("context")')

    expect(() => decryptPayload({
      payload: build.payload_ciphertext ?? '',
      versionId: build.version_id,
      sourceSha256: 'f'.repeat(64),
      secret: TEST_SECRET,
    })).toThrow(PayloadConsumerError)
  })
})
