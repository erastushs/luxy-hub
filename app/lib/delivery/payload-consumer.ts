import { createDecipheriv, createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'

export const SUPPORTED_PAYLOAD_FORMAT_VERSION = 'inline-json-v1'
export const SUPPORTED_ENCRYPTION_SCHEME = 'aes-256-gcm:v1'
export const SUPPORTED_COMPRESSION = 'gzip'

export type InlineJsonV1Payload = {
  v: typeof SUPPORTED_PAYLOAD_FORMAT_VERSION
  alg: typeof SUPPORTED_ENCRYPTION_SCHEME
  kid: string
  compression: typeof SUPPORTED_COMPRESSION
  iv: string
  tag: string
  data: string
}

export type DecryptPayloadParams = {
  payload: string | InlineJsonV1Payload
  versionId: string
  sourceSha256: string
  secret?: string
}

export class PayloadConsumerError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'PayloadConsumerError'
  }
}

function getPayloadSecret(explicitSecret?: string): string {
  const secret = explicitSecret
    || process.env.DELIVERY_PAYLOAD_SECRET
    || process.env.CRON_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (secret) return secret

  if (process.env.NODE_ENV === 'production') {
    throw new PayloadConsumerError('missing_payload_secret', 'Payload decryption secret is not configured')
  }

  return 'dev-delivery-payload-secret'
}

function assertStringField(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new PayloadConsumerError('invalid_payload', `Payload field "${field}" is invalid`)
  }

  return value
}

function decodeBase64(value: string, field: string): Buffer {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new PayloadConsumerError('invalid_payload', `Payload field "${field}" is not valid base64`)
  }

  const decoded = Buffer.from(value, 'base64')
  if (decoded.length === 0) {
    throw new PayloadConsumerError('invalid_payload', `Payload field "${field}" is empty`)
  }

  return decoded
}

export function validatePayload(payload: string): InlineJsonV1Payload {
  let parsed: unknown

  try {
    parsed = JSON.parse(payload)
  } catch {
    throw new PayloadConsumerError('invalid_payload', 'Payload is not valid JSON')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new PayloadConsumerError('invalid_payload', 'Payload envelope is invalid')
  }

  const envelope = parsed as Record<string, unknown>
  const version = assertStringField(envelope.v, 'v')
  const algorithm = assertStringField(envelope.alg, 'alg')
  const compression = assertStringField(envelope.compression, 'compression')
  const kid = assertStringField(envelope.kid, 'kid')
  const iv = assertStringField(envelope.iv, 'iv')
  const tag = assertStringField(envelope.tag, 'tag')
  const data = assertStringField(envelope.data, 'data')

  if (version !== SUPPORTED_PAYLOAD_FORMAT_VERSION) {
    throw new PayloadConsumerError('unsupported_payload_format', 'Payload format version is not supported')
  }

  if (algorithm !== SUPPORTED_ENCRYPTION_SCHEME) {
    throw new PayloadConsumerError('unsupported_encryption_scheme', 'Payload encryption scheme is not supported')
  }

  if (compression !== SUPPORTED_COMPRESSION) {
    throw new PayloadConsumerError('unsupported_compression', 'Payload compression is not supported')
  }

  if (decodeBase64(iv, 'iv').length !== 12) {
    throw new PayloadConsumerError('invalid_payload', 'Payload IV length is invalid')
  }

  if (decodeBase64(tag, 'tag').length !== 16) {
    throw new PayloadConsumerError('invalid_payload', 'Payload auth tag length is invalid')
  }

  decodeBase64(data, 'data')

  return {
    v: version,
    alg: algorithm,
    kid,
    compression,
    iv,
    tag,
    data,
  }
}

export function decryptPayload(params: DecryptPayloadParams): Buffer {
  const envelope = typeof params.payload === 'string'
    ? validatePayload(params.payload)
    : params.payload

  if (!/^[a-f0-9]{64}$/.test(params.sourceSha256)) {
    throw new PayloadConsumerError('invalid_payload_context', 'Source SHA-256 is invalid')
  }

  if (!params.versionId || typeof params.versionId !== 'string') {
    throw new PayloadConsumerError('invalid_payload_context', 'Version ID is required')
  }

  try {
    const key = createHash('sha256').update(getPayloadSecret(params.secret)).digest()
    const iv = decodeBase64(envelope.iv, 'iv')
    const tag = decodeBase64(envelope.tag, 'tag')
    const data = decodeBase64(envelope.data, 'data')
    const aad = Buffer.from(`${envelope.v}:${params.versionId}:${params.sourceSha256}`, 'utf8')
    const decipher = createDecipheriv('aes-256-gcm', key, iv)

    decipher.setAAD(aad)
    decipher.setAuthTag(tag)

    return Buffer.concat([
      decipher.update(data),
      decipher.final(),
    ])
  } catch (error) {
    if (error instanceof PayloadConsumerError) throw error
    throw new PayloadConsumerError('decrypt_failed', 'Payload decryption failed')
  }
}

export function decompressPayload(payload: Buffer | Uint8Array): string {
  try {
    return gunzipSync(payload).toString('utf8')
  } catch {
    throw new PayloadConsumerError('decompress_failed', 'Payload decompression failed')
  }
}
