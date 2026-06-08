import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScriptRow } from '@/app/lib/repositories/script-repository'
import type { DeliveryBuildRow } from '@/app/lib/repositories/delivery-build-repository'
import type { DeliverySessionRow } from '@/app/lib/repositories/delivery-session-repository'

vi.mock('@/app/lib/services/delivery-build-service', () => ({
  DELIVERY_BUILD_VERSION: 'delivery-build-v1',
  PAYLOAD_FORMAT_VERSION: 'inline-json-v1',
}))

vi.mock('@/app/lib/repositories/script-repository', () => ({
  findScriptBySlug: vi.fn(),
}))

vi.mock('@/app/lib/repositories/delivery-build-repository', () => ({
  getReadyBuild: vi.fn(),
  getBuildById: vi.fn(),
}))

vi.mock('@/app/lib/repositories/delivery-session-repository', () => ({
  createSession: vi.fn(),
  getSessionByTokenHash: vi.fn(),
  consumeSession: vi.fn(),
}))

import {
  consumeDeliverySession,
  createDeliverySession,
  hashDeliverySessionToken,
  validateDeliverySession,
} from '@/app/lib/services/delivery-session-service'
import { findScriptBySlug } from '@/app/lib/repositories/script-repository'
import { getBuildById, getReadyBuild } from '@/app/lib/repositories/delivery-build-repository'
import {
  consumeSession,
  createSession,
  getSessionByTokenHash,
} from '@/app/lib/repositories/delivery-session-repository'

const mockedFindScriptBySlug = vi.mocked(findScriptBySlug)
const mockedGetReadyBuild = vi.mocked(getReadyBuild)
const mockedGetBuildById = vi.mocked(getBuildById)
const mockedCreateSession = vi.mocked(createSession)
const mockedGetSessionByTokenHash = vi.mocked(getSessionByTokenHash)
const mockedConsumeSession = vi.mocked(consumeSession)

function futureIso(seconds: number = 60): string {
  return new Date(Date.now() + seconds * 1000).toISOString()
}

function pastIso(seconds: number = 60): string {
  return new Date(Date.now() - seconds * 1000).toISOString()
}

function mockScriptRow(overrides: Partial<ScriptRow> = {}): ScriptRow {
  return {
    id: 'script-uuid-1',
    slug: 'my-script',
    name: 'My Script',
    description: '',
    visibility: 'public',
    creator_id: 'owner-uuid-1',
    current_version_id: 'version-uuid-1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
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

function mockSessionRow(overrides: Partial<DeliverySessionRow> = {}): DeliverySessionRow {
  return {
    id: 'session-uuid-1',
    script_id: 'script-uuid-1',
    build_id: 'build-uuid-1',
    session_token_hash: hashDeliverySessionToken('test-session-token-that-is-long-enough'),
    expires_at: futureIso(),
    consumed_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('Phase 5C delivery session service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('creates a short-lived session and stores only a token hash', async () => {
    mockedFindScriptBySlug.mockResolvedValue(mockScriptRow())
    mockedGetReadyBuild.mockResolvedValue(mockBuildRow())
    mockedCreateSession.mockImplementation(async (params) => mockSessionRow({
      script_id: params.scriptId,
      build_id: params.buildId,
      session_token_hash: params.tokenHash,
      expires_at: params.expiresAt,
    }))

    const result = await createDeliverySession('my-script')

    expect(result.success).toBe(true)
    expect(mockedCreateSession).toHaveBeenCalledTimes(1)

    const createParams = mockedCreateSession.mock.calls[0][0]
    expect(createParams.tokenHash).toMatch(/^[a-f0-9]{64}$/)
    if (result.success) {
      expect(createParams.tokenHash).not.toBe(result.session_token)
      expect(result.expires_in).toBe(60)
      expect(result.session.session_token_hash).toBe(createParams.tokenHash)
    }
  })

  it('rejects session creation when the current ready build is missing', async () => {
    mockedFindScriptBySlug.mockResolvedValue(mockScriptRow())
    mockedGetReadyBuild.mockResolvedValue(null)

    const result = await createDeliverySession('my-script')

    expect(result.success).toBe(false)
    expect(mockedCreateSession).not.toHaveBeenCalled()
    if (!result.success) {
      expect(result.status).toBe(404)
      expect(result.message).toBe('Delivery unavailable')
    }
  })

  it('rejects expired tokens uniformly', async () => {
    mockedGetSessionByTokenHash.mockResolvedValue(mockSessionRow({ expires_at: pastIso() }))

    const result = await validateDeliverySession('test-session-token-that-is-long-enough')

    expect(result.success).toBe(false)
    expect(mockedGetBuildById).not.toHaveBeenCalled()
    if (!result.success) {
      expect(result.status).toBe(403)
      expect(result.message).toBe('Invalid delivery session')
    }
  })

  it('rejects reused tokens uniformly', async () => {
    mockedGetSessionByTokenHash.mockResolvedValue(mockSessionRow({ consumed_at: '2026-01-01T00:01:00.000Z' }))

    const result = await validateDeliverySession('test-session-token-that-is-long-enough')

    expect(result.success).toBe(false)
    expect(mockedGetBuildById).not.toHaveBeenCalled()
    if (!result.success) {
      expect(result.message).toBe('Invalid delivery session')
    }
  })

  it('rejects sessions when the build no longer exists', async () => {
    mockedGetSessionByTokenHash.mockResolvedValue(mockSessionRow())
    mockedGetBuildById.mockResolvedValue(null)

    const result = await validateDeliverySession('test-session-token-that-is-long-enough')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.message).toBe('Invalid delivery session')
    }
  })

  it('retrieves payload and consumes the session once', async () => {
    const session = mockSessionRow()
    const consumed = mockSessionRow({ consumed_at: '2026-01-01T00:01:00.000Z' })
    mockedGetSessionByTokenHash.mockResolvedValue(session)
    mockedGetBuildById.mockResolvedValue(mockBuildRow())
    mockedConsumeSession.mockResolvedValue(consumed)

    const result = await consumeDeliverySession('test-session-token-that-is-long-enough')

    expect(result.success).toBe(true)
    expect(mockedConsumeSession).toHaveBeenCalledWith(session.id)
    if (result.success) {
      expect(result.payload).toBe('encrypted-payload')
      expect(result.payload_format_version).toBe('inline-json-v1')
      expect(result.build_version).toBe('delivery-build-v1')
      expect(result.session.consumed_at).toBe(consumed.consumed_at)
    }
  })

  it('rejects a second consume attempt when repository consume fails', async () => {
    mockedGetSessionByTokenHash.mockResolvedValue(mockSessionRow())
    mockedGetBuildById.mockResolvedValue(mockBuildRow())
    mockedConsumeSession.mockResolvedValue(null)

    const result = await consumeDeliverySession('test-session-token-that-is-long-enough')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(403)
      expect(result.message).toBe('Invalid delivery session')
    }
  })

  it('hashes tokens deterministically without returning the raw token', () => {
    const token = 'test-session-token-that-is-long-enough'
    const first = hashDeliverySessionToken(token)
    const second = hashDeliverySessionToken(token)

    expect(first).toBe(second)
    expect(first).toMatch(/^[a-f0-9]{64}$/)
    expect(first).not.toBe(token)
  })
})
