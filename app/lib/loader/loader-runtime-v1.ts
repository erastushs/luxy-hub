import {
  LOADER_RUNTIME_FORMAT_VERSION,
  LOADER_SUPPORTED_BUILD_VERSION,
} from '@/app/lib/loader/loader-constants'

export { LOADER_RUNTIME_VERSION } from '@/app/lib/loader/loader-constants'

export type RuntimePayloadEnvelope = {
  runtime_payload: string
  build_version: typeof LOADER_SUPPORTED_BUILD_VERSION
  version_id: string
  runtime_format_version: typeof LOADER_RUNTIME_FORMAT_VERSION
}

export type ConsumeRuntimePayloadParams = {
  response: unknown
  execute?: (source: string) => void | Promise<void>
}

export type ConsumeRuntimePayloadResult = {
  source: string
  versionId: string
  runtimeFormatVersion: typeof LOADER_RUNTIME_FORMAT_VERSION
}

export class LoaderRuntimeError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'LoaderRuntimeError'
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function assertString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new LoaderRuntimeError('invalid_delivery_response', `${field} is invalid`)
  }

  return value
}

export function validateRuntimePayloadEnvelope(value: unknown): RuntimePayloadEnvelope {
  if (!isObject(value)) {
    throw new LoaderRuntimeError('invalid_delivery_response', 'Delivery response is invalid')
  }

  const runtimePayload = assertString(value.runtime_payload, 'runtime_payload')
  const buildVersion = assertString(value.build_version, 'build_version')
  const versionId = assertString(value.version_id, 'version_id')
  const runtimeFormatVersion = assertString(value.runtime_format_version, 'runtime_format_version')

  if (buildVersion !== LOADER_SUPPORTED_BUILD_VERSION) {
    throw new LoaderRuntimeError('unsupported_build_version', 'Build version is not supported')
  }

  if (runtimeFormatVersion !== LOADER_RUNTIME_FORMAT_VERSION) {
    throw new LoaderRuntimeError('unsupported_runtime_format', 'Runtime format version is not supported')
  }

  return {
    runtime_payload: runtimePayload,
    build_version: buildVersion,
    version_id: versionId,
    runtime_format_version: runtimeFormatVersion,
  }
}

export async function consumeRuntimePayloadV1(
  params: ConsumeRuntimePayloadParams
): Promise<ConsumeRuntimePayloadResult> {
  const delivery = validateRuntimePayloadEnvelope(params.response)
  if (params.execute) {
    await params.execute(delivery.runtime_payload)
  }

  return {
    source: delivery.runtime_payload,
    versionId: delivery.version_id,
    runtimeFormatVersion: delivery.runtime_format_version,
  }
}
