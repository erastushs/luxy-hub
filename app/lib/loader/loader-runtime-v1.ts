import { createHash } from 'node:crypto'
import {
  decryptPayload,
  decompressPayload,
  validatePayload,
} from '@/app/lib/delivery/payload-consumer'
import {
  DELIVERY_BUILD_VERSION,
  PAYLOAD_FORMAT_VERSION,
} from '@/app/lib/services/delivery-build-service'

export { LOADER_RUNTIME_VERSION } from '@/app/lib/loader/loader-constants'
export const AAD_SEPARATOR = ':'

export type DeliveryFetchContext = {
  build_id: string
  version_id: string
  source_sha256: string
  payload_sha256: string
}

export type DeliveryFetchEnvelope = {
  payload: string
  context: DeliveryFetchContext
  payload_format_version: typeof PAYLOAD_FORMAT_VERSION
  build_version: typeof DELIVERY_BUILD_VERSION
}

export type ConsumeDeliveryPayloadParams = {
  response: unknown
  secret?: string
  execute?: (source: string) => void | Promise<void>
}

export type ConsumeDeliveryPayloadResult = {
  source: string
  aad: string
  context: DeliveryFetchContext
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

function isSha256Hex(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value)
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function buildPayloadAad(params: {
  payloadFormatVersion: string
  versionId: string
  sourceSha256: string
}): string {
  if (!params.payloadFormatVersion || !params.versionId || !params.sourceSha256) {
    throw new LoaderRuntimeError('invalid_aad_context', 'AAD context is incomplete')
  }

  return [
    params.payloadFormatVersion,
    params.versionId,
    params.sourceSha256,
  ].join(AAD_SEPARATOR)
}

export function validateDeliveryContext(context: unknown): DeliveryFetchContext {
  if (!isObject(context)) {
    throw new LoaderRuntimeError('invalid_delivery_context', 'Delivery context is invalid')
  }

  const buildId = assertString(context.build_id, 'context.build_id')
  const versionId = assertString(context.version_id, 'context.version_id')
  const sourceSha256 = assertString(context.source_sha256, 'context.source_sha256')
  const payloadSha256 = assertString(context.payload_sha256, 'context.payload_sha256')

  if (!isSha256Hex(sourceSha256)) {
    throw new LoaderRuntimeError('invalid_delivery_context', 'Source SHA-256 is invalid')
  }

  if (!isSha256Hex(payloadSha256)) {
    throw new LoaderRuntimeError('invalid_delivery_context', 'Payload SHA-256 is invalid')
  }

  return {
    build_id: buildId,
    version_id: versionId,
    source_sha256: sourceSha256,
    payload_sha256: payloadSha256,
  }
}

export function validateDeliveryFetchEnvelope(value: unknown): DeliveryFetchEnvelope {
  if (!isObject(value)) {
    throw new LoaderRuntimeError('invalid_delivery_response', 'Delivery response is invalid')
  }

  const payload = assertString(value.payload, 'payload')
  const payloadFormatVersion = assertString(value.payload_format_version, 'payload_format_version')
  const buildVersion = assertString(value.build_version, 'build_version')
  const context = validateDeliveryContext(value.context)

  if (payloadFormatVersion !== PAYLOAD_FORMAT_VERSION) {
    throw new LoaderRuntimeError('unsupported_payload_format', 'Payload format version is not supported')
  }

  if (buildVersion !== DELIVERY_BUILD_VERSION) {
    throw new LoaderRuntimeError('unsupported_build_version', 'Build version is not supported')
  }

  return {
    payload,
    context,
    payload_format_version: payloadFormatVersion,
    build_version: buildVersion,
  }
}

export function validatePayloadIntegrity(payload: string, context: DeliveryFetchContext): void {
  const actualHash = sha256Hex(payload)
  if (actualHash !== context.payload_sha256) {
    throw new LoaderRuntimeError('payload_integrity_failed', 'Payload integrity check failed')
  }
}

export async function consumeDeliveryPayloadV1(
  params: ConsumeDeliveryPayloadParams
): Promise<ConsumeDeliveryPayloadResult> {
  const delivery = validateDeliveryFetchEnvelope(params.response)
  validatePayloadIntegrity(delivery.payload, delivery.context)

  const payload = validatePayload(delivery.payload)
  const aad = buildPayloadAad({
    payloadFormatVersion: delivery.payload_format_version,
    versionId: delivery.context.version_id,
    sourceSha256: delivery.context.source_sha256,
  })

  const compressedPayload = decryptPayload({
    payload,
    versionId: delivery.context.version_id,
    sourceSha256: delivery.context.source_sha256,
    secret: params.secret,
  })
  const source = decompressPayload(compressedPayload)

  if (params.execute) {
    await params.execute(source)
  }

  return {
    source,
    aad,
    context: delivery.context,
  }
}
