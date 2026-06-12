import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DeliveryScriptRow } from '@/app/lib/repositories/script-repository'
import type { DeliveryBuildRow } from '@/app/lib/repositories/delivery-build-repository'
import type { DeliverySessionRow } from '@/app/lib/repositories/delivery-session-repository'

vi.mock('@/app/lib/services/delivery-build-service', () => ({
  DELIVERY_BUILD_VERSION: 'delivery-build-v1',
  PAYLOAD_FORMAT_VERSION: 'inline-json-v1',
}))

vi.mock('@/app/lib/repositories/script-repository', () => ({
  findScriptForDeliveryBySlug: vi.fn(),
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

vi.mock('@/app/lib/repositories/script-execution-repository', () => ({
  recordExecution: vi.fn(),
}))

vi.mock('@/app/lib/delivery/runtime-payload', () => ({
  RUNTIME_FORMAT_VERSION: 'runtime-v1',
  createRuntimePayloadFromBuild: vi.fn(),
}))

vi.mock('@/app/lib/services/key-service', () => ({
  validateKey: vi.fn(),
}))

vi.mock('@/app/lib/services/license-service', () => ({
  recordLicenseDelivery: vi.fn(),
  validateLicense: vi.fn(),
}))

vi.mock('@/app/lib/services/audit-service', () => ({
  logAuditEvent: vi.fn(),
}))

import {
  consumeDeliverySession,
  createDeliverySession,
  hashDeliverySessionToken,
  validateDeliverySession,
} from '@/app/lib/services/delivery-session-service'
import { findScriptForDeliveryBySlug } from '@/app/lib/repositories/script-repository'
import { getBuildById, getReadyBuild } from '@/app/lib/repositories/delivery-build-repository'
import {
  consumeSession,
  createSession,
  getSessionByTokenHash,
} from '@/app/lib/repositories/delivery-session-repository'
import { recordExecution } from '@/app/lib/repositories/script-execution-repository'
import { createRuntimePayloadFromBuild } from '@/app/lib/delivery/runtime-payload'
import { validateKey } from '@/app/lib/services/key-service'
import { recordLicenseDelivery, validateLicense } from '@/app/lib/services/license-service'
import { logAuditEvent } from '@/app/lib/services/audit-service'

const mockedFindScriptForDeliveryBySlug = vi.mocked(findScriptForDeliveryBySlug)
const mockedGetReadyBuild = vi.mocked(getReadyBuild)
const mockedGetBuildById = vi.mocked(getBuildById)
const mockedCreateSession = vi.mocked(createSession)
const mockedGetSessionByTokenHash = vi.mocked(getSessionByTokenHash)
const mockedConsumeSession = vi.mocked(consumeSession)
const mockedRecordExecution = vi.mocked(recordExecution)
const mockedCreateRuntimePayloadFromBuild = vi.mocked(createRuntimePayloadFromBuild)
const mockedValidateKey = vi.mocked(validateKey)
const mockedRecordLicenseDelivery = vi.mocked(recordLicenseDelivery)
const mockedValidateLicense = vi.mocked(validateLicense)
const mockedLogAuditEvent = vi.mocked(logAuditEvent)

function futureIso(seconds: number = 60): string {
  return new Date(Date.now() + seconds * 1000).toISOString()
}

function pastIso(seconds: number = 60): string {
  return new Date(Date.now() - seconds * 1000).toISOString()
}

function mockScriptRow(overrides: Partial<DeliveryScriptRow> = {}): DeliveryScriptRow {
  return {
    id: 'script-uuid-1',
    slug: 'my-script',
    name: 'My Script',
    description: '',
    visibility: 'public',
    creator_id: 'owner-uuid-1',
    current_version_id: 'version-uuid-1',
    access_mode: 'public',
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
    event_secret: 'event-secret',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('Phase 5C delivery session service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedCreateRuntimePayloadFromBuild.mockReturnValue({
      runtime_payload: 'print("LUXY TEST")',
      build_version: 'delivery-build-v1',
      version_id: 'version-uuid-1',
      runtime_format_version: 'runtime-v1',
    })
    mockedRecordExecution.mockResolvedValue({
      id: 'execution-uuid-1',
      script_id: 'script-uuid-1',
      session_id: 'session-uuid-1',
      created_at: '2026-01-01T00:00:00.000Z',
    })
    mockedRecordLicenseDelivery.mockResolvedValue(undefined)
  })

  it('creates a short-lived session and stores only a token hash', async () => {
    mockedFindScriptForDeliveryBySlug.mockResolvedValue(mockScriptRow())
    mockedGetReadyBuild.mockResolvedValue(mockBuildRow())
    mockedCreateSession.mockImplementation(async (params) => mockSessionRow({
      script_id: params.scriptId,
      build_id: params.buildId,
      session_token_hash: params.tokenHash,
      expires_at: params.expiresAt,
      event_secret: params.eventSecret ?? null,
    }))

    const result = await createDeliverySession('my-script')

    expect(result.success).toBe(true)
    expect(mockedCreateSession).toHaveBeenCalledTimes(1)
    expect(mockedRecordExecution).toHaveBeenCalledWith({
      scriptId: 'script-uuid-1',
      sessionId: 'session-uuid-1',
    })

    const createParams = mockedCreateSession.mock.calls[0][0]
    expect(createParams.tokenHash).toMatch(/^[a-f0-9]{64}$/)
    if (result.success) {
      expect(createParams.tokenHash).not.toBe(result.session_token)
      expect(result.expires_in).toBe(60)
      expect(result.session.session_token_hash).toBe(createParams.tokenHash)
      expect(createParams.eventSecret).toMatch(/^[A-Za-z0-9_-]{43}$/)
      expect(result.event_secret).toBe(createParams.eventSecret)
      expect(result.session.event_secret).toBe(createParams.eventSecret)
    }
  })

  it('persists and returns an event secret for runtime signing', async () => {
    mockedFindScriptForDeliveryBySlug.mockResolvedValue(mockScriptRow())
    mockedGetReadyBuild.mockResolvedValue(mockBuildRow())
    mockedCreateSession.mockImplementation(async (params) => mockSessionRow({
      script_id: params.scriptId,
      build_id: params.buildId,
      session_token_hash: params.tokenHash,
      expires_at: params.expiresAt,
      event_secret: params.eventSecret ?? null,
    }))

    const result = await createDeliverySession('my-script')

    expect(result.success).toBe(true)
    expect(mockedCreateSession).toHaveBeenCalledWith(expect.objectContaining({
      scriptId: 'script-uuid-1',
      buildId: 'build-uuid-1',
      tokenHash: expect.any(String),
      expiresAt: expect.any(String),
      eventSecret: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    }))
    expect(mockedRecordExecution).toHaveBeenCalledWith({
      scriptId: 'script-uuid-1',
      sessionId: 'session-uuid-1',
    })
    if (result.success) {
      expect(result.event_secret).toBe(result.session.event_secret)
      expect(result).not.toHaveProperty('session_token_hash')
    }
  })

  it('rejects session creation when the current ready build is missing', async () => {
    mockedFindScriptForDeliveryBySlug.mockResolvedValue(mockScriptRow({ access_mode: 'license_required' }))
    mockedGetReadyBuild.mockResolvedValue(null)

    const result = await createDeliverySession(
      'my-script',
      undefined,
      'LUXY-PREM-XXXX-XXXX-XXXX',
      'customer-1'
    )

    expect(result.success).toBe(false)
    expect(mockedValidateLicense).not.toHaveBeenCalled()
    expect(mockedCreateSession).not.toHaveBeenCalled()
    if (!result.success) {
      expect(result.status).toBe(404)
      expect(result.message).toBe('Delivery unavailable')
    }
  })

  it('keeps public session creation flow unchanged before recording analytics', async () => {
    mockedFindScriptForDeliveryBySlug.mockResolvedValue(mockScriptRow({ access_mode: 'public' }))
    mockedGetReadyBuild.mockResolvedValue(mockBuildRow())
    mockedCreateSession.mockImplementation(async (params) => mockSessionRow({
      script_id: params.scriptId,
      build_id: params.buildId,
      session_token_hash: params.tokenHash,
      expires_at: params.expiresAt,
      event_secret: params.eventSecret ?? null,
    }))

    const result = await createDeliverySession('my-script')

    expect(result.success).toBe(true)
    expect(mockedFindScriptForDeliveryBySlug).toHaveBeenCalledWith('my-script')
    expect(mockedGetReadyBuild).toHaveBeenCalledWith('version-uuid-1', {
      buildVersion: 'delivery-build-v1',
      payloadFormatVersion: 'inline-json-v1',
    })
    expect(mockedCreateSession).toHaveBeenCalledTimes(1)
    expect(mockedRecordExecution).toHaveBeenCalledWith({
      scriptId: 'script-uuid-1',
      sessionId: 'session-uuid-1',
    })
  })

  it('creates sessions for key-required scripts when a valid key is provided', async () => {
    mockedFindScriptForDeliveryBySlug.mockResolvedValue(mockScriptRow({ access_mode: 'key_required' }))
    mockedValidateKey.mockResolvedValue({ valid: true })
    mockedGetReadyBuild.mockResolvedValue(mockBuildRow())
    mockedCreateSession.mockImplementation(async (params) => mockSessionRow({
      script_id: params.scriptId,
      build_id: params.buildId,
      session_token_hash: params.tokenHash,
      expires_at: params.expiresAt,
      event_secret: params.eventSecret ?? null,
    }))

    const result = await createDeliverySession('my-script', 'LUXY-ABCD-1234-EFGH')

    expect(result.success).toBe(true)
    expect(mockedValidateKey).toHaveBeenCalledWith('LUXY-ABCD-1234-EFGH')
    expect(mockedGetReadyBuild).toHaveBeenCalled()
    expect(mockedCreateSession).toHaveBeenCalledTimes(1)
    expect(mockedRecordExecution).toHaveBeenCalledWith({
      scriptId: 'script-uuid-1',
      sessionId: 'session-uuid-1',
    })
  })

  it('rejects key-required sessions when no key is provided', async () => {
    mockedFindScriptForDeliveryBySlug.mockResolvedValue(mockScriptRow({ access_mode: 'key_required' }))
    mockedGetReadyBuild.mockResolvedValue(mockBuildRow())

    const result = await createDeliverySession('my-script')

    expect(result).toEqual({
      success: false,
      status: 403,
      message: 'Key is required',
    })
    expect(mockedValidateKey).not.toHaveBeenCalled()
    expect(mockedGetReadyBuild).toHaveBeenCalled()
    expect(mockedCreateSession).not.toHaveBeenCalled()
    expect(mockedRecordExecution).not.toHaveBeenCalled()
  })

  it('rejects key-required sessions with an invalid key', async () => {
    mockedFindScriptForDeliveryBySlug.mockResolvedValue(mockScriptRow({ access_mode: 'key_required' }))
    mockedGetReadyBuild.mockResolvedValue(mockBuildRow())
    mockedValidateKey.mockResolvedValue({ valid: false, message: 'Invalid key', status: 403 })

    const result = await createDeliverySession('my-script', 'BAD-KEY-XXXX-YYYY')

    expect(result).toEqual({
      success: false,
      status: 403,
      message: 'Invalid key',
    })
    expect(mockedValidateKey).toHaveBeenCalledWith('BAD-KEY-XXXX-YYYY')
    expect(mockedGetReadyBuild).toHaveBeenCalled()
    expect(mockedCreateSession).not.toHaveBeenCalled()
    expect(mockedRecordExecution).not.toHaveBeenCalled()
  })

  it('rejects license-required sessions when no license is provided', async () => {
    mockedFindScriptForDeliveryBySlug.mockResolvedValue(mockScriptRow({ access_mode: 'license_required' }))
    mockedGetReadyBuild.mockResolvedValue(mockBuildRow())
    mockedValidateLicense.mockResolvedValue({ success: false, status: 403, message: 'License is required', reason: 'license_required' })

    const result = await createDeliverySession('my-script')

    expect(result).toEqual({
      success: false,
      status: 403,
      message: 'License is required',
    })
    expect(mockedValidateLicense).toHaveBeenCalledWith({
      scriptId: 'script-uuid-1',
      license: undefined,
      customerIdentifier: undefined,
    })
    expect(mockedGetReadyBuild).toHaveBeenCalled()
    expect(mockedCreateSession).not.toHaveBeenCalled()
    expect(mockedRecordExecution).not.toHaveBeenCalled()
  })

  it('creates sessions for license-required scripts with a valid license', async () => {
    mockedFindScriptForDeliveryBySlug.mockResolvedValue(mockScriptRow({ access_mode: 'license_required' }))
    mockedValidateLicense.mockResolvedValue({
      success: true,
      license: {
        id: 'license-uuid-1',
        script_id: 'script-uuid-1',
        creator_id: 'owner-uuid-1',
        key_hash: 'a'.repeat(64),
        max_assignments: 1,
        status: 'active',
        activation_count: 0,
        delivery_count: 0,
        last_activation_at: null,
        last_delivery_at: null,
        expires_at: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      assignment: {
        id: 'assignment-uuid-1',
        license_id: 'license-uuid-1',
        customer_identifier_hash: 'b'.repeat(64),
        display_name: null,
        status: 'active',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      assignmentCreated: false,
    })
    mockedGetReadyBuild.mockResolvedValue(mockBuildRow())
    mockedCreateSession.mockImplementation(async (params) => mockSessionRow({
      script_id: params.scriptId,
      build_id: params.buildId,
      session_token_hash: params.tokenHash,
      expires_at: params.expiresAt,
      event_secret: params.eventSecret ?? null,
    }))

    const result = await createDeliverySession(
      'my-script',
      undefined,
      'LUXY-PREM-XXXX-XXXX-XXXX',
      'customer-1'
    )

    expect(result.success).toBe(true)
    expect(mockedValidateLicense).toHaveBeenCalledWith({
      scriptId: 'script-uuid-1',
      license: 'LUXY-PREM-XXXX-XXXX-XXXX',
      customerIdentifier: 'customer-1',
    })
    expect(mockedGetReadyBuild).toHaveBeenCalled()
    expect(mockedCreateSession).toHaveBeenCalledTimes(1)
    expect(mockedRecordExecution).toHaveBeenCalledWith({
      scriptId: 'script-uuid-1',
      sessionId: 'session-uuid-1',
    })
    expect(mockedRecordLicenseDelivery).toHaveBeenCalledWith('license-uuid-1')
    expect(mockedLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'delivery.session_created',
      resource_type: 'delivery_session',
      resource_id: 'session-uuid-1',
    }))
  })

  it('continues premium delivery when license delivery counter telemetry fails', async () => {
    mockedFindScriptForDeliveryBySlug.mockResolvedValue(mockScriptRow({ access_mode: 'license_required' }))
    mockedValidateLicense.mockResolvedValue({
      success: true,
      license: {
        id: 'license-uuid-1',
        script_id: 'script-uuid-1',
        creator_id: 'owner-uuid-1',
        key_hash: 'a'.repeat(64),
        max_assignments: 1,
        status: 'active',
        activation_count: 0,
        delivery_count: 0,
        last_activation_at: null,
        last_delivery_at: null,
        expires_at: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      assignment: {
        id: 'assignment-uuid-1',
        license_id: 'license-uuid-1',
        customer_identifier_hash: 'b'.repeat(64),
        display_name: null,
        status: 'active',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      assignmentCreated: false,
    })
    mockedGetReadyBuild.mockResolvedValue(mockBuildRow())
    mockedCreateSession.mockImplementation(async (params) => mockSessionRow({
      script_id: params.scriptId,
      build_id: params.buildId,
      session_token_hash: params.tokenHash,
      expires_at: params.expiresAt,
      event_secret: params.eventSecret ?? null,
    }))
    mockedRecordLicenseDelivery.mockRejectedValue(new Error('counter down'))

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await createDeliverySession(
      'my-script',
      undefined,
      'LUXY-PREM-XXXX-XXXX-XXXX',
      'customer-1'
    )
    await Promise.resolve()

    expect(result.success).toBe(true)
    expect(mockedRecordLicenseDelivery).toHaveBeenCalledWith('license-uuid-1')
    expect(consoleError).toHaveBeenCalledWith(
      '[delivery] Failed to record license delivery counter:',
      expect.any(Error)
    )

    consoleError.mockRestore()
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

  it('retrieves runtime payload and consumes the session once', async () => {
    const session = mockSessionRow()
    const consumed = mockSessionRow({ consumed_at: '2026-01-01T00:01:00.000Z' })
    mockedGetSessionByTokenHash.mockResolvedValue(session)
    mockedGetBuildById.mockResolvedValue(mockBuildRow())
    mockedConsumeSession.mockResolvedValue(consumed)

    const result = await consumeDeliverySession('test-session-token-that-is-long-enough')

    expect(result.success).toBe(true)
    expect(mockedConsumeSession).toHaveBeenCalledWith(session.id)
    expect(mockedCreateRuntimePayloadFromBuild).toHaveBeenCalledWith(expect.objectContaining({
      id: 'build-uuid-1',
      payload_ciphertext: 'encrypted-payload',
    }))
    if (result.success) {
      expect(result.runtime_payload).toBe('print("LUXY TEST")')
      expect(result.build_version).toBe('delivery-build-v1')
      expect(result.version_id).toBe('version-uuid-1')
      expect(result.runtime_format_version).toBe('runtime-v1')
      expect(result).not.toHaveProperty('payload')
      expect(result).not.toHaveProperty('context')
      expect(result.session.consumed_at).toBe(consumed.consumed_at)
      expect(result.event_secret).toBe(consumed.event_secret)
    }
  })

  it('rejects sessions when the ready build is missing safe context hashes', async () => {
    mockedGetSessionByTokenHash.mockResolvedValue(mockSessionRow())
    mockedGetBuildById.mockResolvedValue(mockBuildRow({ payload_sha256: null }))

    const result = await validateDeliverySession('test-session-token-that-is-long-enough')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.message).toBe('Invalid delivery session')
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

  it('rejects consumed sessions missing an event secret', async () => {
    mockedGetSessionByTokenHash.mockResolvedValue(mockSessionRow())
    mockedGetBuildById.mockResolvedValue(mockBuildRow())
    mockedConsumeSession.mockResolvedValue(mockSessionRow({
      consumed_at: '2026-01-01T00:01:00.000Z',
      event_secret: null,
    }))

    const result = await consumeDeliverySession('test-session-token-that-is-long-enough')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(403)
      expect(result.message).toBe('Invalid delivery session')
    }
  })

  it('returns a uniform error when runtime payload generation fails', async () => {
    mockedGetSessionByTokenHash.mockResolvedValue(mockSessionRow())
    mockedGetBuildById.mockResolvedValue(mockBuildRow())
    mockedConsumeSession.mockResolvedValue(mockSessionRow({ consumed_at: '2026-01-01T00:01:00.000Z' }))
    mockedCreateRuntimePayloadFromBuild.mockImplementation(() => {
      throw new Error('decrypt failed')
    })

    const result = await consumeDeliverySession('test-session-token-that-is-long-enough')

    expect(result.success).toBe(false)
    expect(mockedConsumeSession).toHaveBeenCalledWith('session-uuid-1')
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
