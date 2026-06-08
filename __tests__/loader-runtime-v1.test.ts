import { describe, expect, it, vi } from 'vitest'
import {
  consumeRuntimePayloadV1,
  LoaderRuntimeError,
  validateRuntimePayloadEnvelope,
} from '@/app/lib/loader/loader-runtime-v1'

function runtimeResponse(overrides: Record<string, unknown> = {}) {
  return {
    runtime_payload: 'print("LUXY TEST")',
    build_version: 'delivery-build-v1',
    version_id: 'version-uuid-1',
    runtime_format_version: 'runtime-v1',
    ...overrides,
  }
}

describe('Phase 6D loader runtime v1', () => {
  it('validates and executes a runtime payload response', async () => {
    const execute = vi.fn()

    const result = await consumeRuntimePayloadV1({
      response: runtimeResponse(),
      execute,
    })

    expect(result.source).toBe('print("LUXY TEST")')
    expect(result.versionId).toBe('version-uuid-1')
    expect(result.runtimeFormatVersion).toBe('runtime-v1')
    expect(execute).toHaveBeenCalledWith('print("LUXY TEST")')
  })

  it('rejects missing runtime payloads', () => {
    expect(() => validateRuntimePayloadEnvelope(runtimeResponse({ runtime_payload: '' })))
      .toThrow(LoaderRuntimeError)
  })

  it('rejects unsupported build versions', () => {
    expect(() => validateRuntimePayloadEnvelope(runtimeResponse({
      build_version: 'delivery-build-v9',
    }))).toThrow(LoaderRuntimeError)
  })

  it('rejects unsupported runtime format versions', () => {
    expect(() => validateRuntimePayloadEnvelope(runtimeResponse({
      runtime_format_version: 'runtime-v9',
    }))).toThrow(LoaderRuntimeError)
  })
})
