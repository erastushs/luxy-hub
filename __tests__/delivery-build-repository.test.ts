import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { DeliveryBuildRow } from '@/app/lib/repositories/delivery-build-repository'

vi.mock('@/app/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

import { supabaseAdmin } from '@/app/lib/supabase'
import { createBuild, getReadyBuild, markBuildBuilding } from '@/app/lib/repositories/delivery-build-repository'

type QueryChain = {
  insert: Mock
  update: Mock
  select: Mock
  eq: Mock
  order: Mock
  limit: Mock
  single: Mock
}

function mockBuildRow(overrides: Partial<DeliveryBuildRow> = {}): DeliveryBuildRow {
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

function createQueryChain(data: DeliveryBuildRow | null, error: unknown = null): QueryChain {
  const chain = {} as QueryChain
  chain.insert = vi.fn(() => chain)
  chain.update = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.limit = vi.fn(() => chain)
  chain.single = vi.fn(async () => ({ data, error }))
  return chain
}

describe('delivery build repository', () => {
  const mockedFrom = supabaseAdmin.from as unknown as Mock

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('creates inline encrypted build rows without source metadata', async () => {
    const row = mockBuildRow({ build_status: 'pending', payload_ciphertext: null })
    const chain = createQueryChain(row)
    mockedFrom.mockReturnValue(chain)

    const result = await createBuild({
      scriptId: 'script-uuid-1',
      versionId: 'version-uuid-1',
      sourceSha256: '0'.repeat(64),
      buildVersion: 'delivery-build-v1',
      payloadFormatVersion: 'inline-json-v1',
      encryptionScheme: 'aes-256-gcm:v1',
      encryptionKeyId: 'test-key',
      payloadContentType: 'application/vnd.luxyhub.delivery-payload.v1+json',
      metadata: {
        normalized_byte_size: 14,
        content: 'print("secret")',
        source: 'print("secret")',
      },
    })

    expect(result).toEqual(row)
    const inserted = chain.insert.mock.calls[0][0]
    expect(inserted.build_status).toBe('pending')
    expect(inserted.payload_storage_kind).toBe('inline_encrypted')
    expect(inserted.payload_ciphertext).toBeNull()
    expect(inserted.metadata).toEqual({ normalized_byte_size: 14 })
  })

  it('retrieves the latest ready inline build for a version', async () => {
    const row = mockBuildRow()
    const chain = createQueryChain(row)
    mockedFrom.mockReturnValue(chain)

    const result = await getReadyBuild('version-uuid-1', {
      buildVersion: 'delivery-build-v1',
      payloadFormatVersion: 'inline-json-v1',
    })

    expect(result).toEqual(row)
    expect(mockedFrom).toHaveBeenCalledWith('delivery_builds')
    expect(chain.eq).toHaveBeenCalledWith('version_id', 'version-uuid-1')
    expect(chain.eq).toHaveBeenCalledWith('build_status', 'ready')
    expect(chain.eq).toHaveBeenCalledWith('payload_storage_kind', 'inline_encrypted')
    expect(chain.eq).toHaveBeenCalledWith('build_version', 'delivery-build-v1')
    expect(chain.eq).toHaveBeenCalledWith('payload_format_version', 'inline-json-v1')
    expect(chain.order).toHaveBeenCalledWith('built_at', { ascending: false })
  })

  it('marks a pending build as building', async () => {
    const row = mockBuildRow({ build_status: 'building', payload_ciphertext: null })
    const chain = createQueryChain(row)
    mockedFrom.mockReturnValue(chain)

    const result = await markBuildBuilding('build-uuid-1')

    expect(result).toEqual(row)
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({
      build_status: 'building',
    }))
    expect(chain.eq).toHaveBeenCalledWith('id', 'build-uuid-1')
  })

  it('excludes invalidated builds by filtering only ready status', async () => {
    const chain = createQueryChain(null, { code: 'PGRST116' })
    mockedFrom.mockReturnValue(chain)

    const result = await getReadyBuild('version-uuid-1')

    expect(result).toBeNull()
    expect(chain.eq).toHaveBeenCalledWith('build_status', 'ready')
    expect(chain.eq).not.toHaveBeenCalledWith('build_status', 'invalidated')
  })
})
