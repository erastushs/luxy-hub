import { createCipheriv, createHash, randomBytes } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { getVersionById } from '@/app/lib/repositories/script-repository'
import {
  createBuild,
  getReadyBuild,
  markBuildBuilding,
  markBuildFailed,
  markBuildInvalidated,
  markBuildReady,
  type DeliveryBuildRow,
} from '@/app/lib/repositories/delivery-build-repository'

export const DELIVERY_BUILD_VERSION = 'delivery-build-v1'
export const PAYLOAD_FORMAT_VERSION = 'inline-json-v1'
export const PAYLOAD_CONTENT_TYPE = 'application/vnd.luxyhub.delivery-payload.v1+json'
export const ENCRYPTION_SCHEME = 'aes-256-gcm:v1'

export type BuildVersionResult =
  | { success: true; build: DeliveryBuildRow }
  | { success: false; message: string; status: number; build?: DeliveryBuildRow }

export type InvalidateBuildResult =
  | { success: true; build: DeliveryBuildRow }
  | { success: false; message: string; status: number }

class BuildInputError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 422
  ) {
    super(message)
    this.name = 'BuildInputError'
  }
}

function getPayloadSecret(): string {
  const secret = process.env.DELIVERY_PAYLOAD_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (secret) return secret

  if (process.env.NODE_ENV === 'production') {
    throw new BuildInputError('missing_payload_secret', 'Payload encryption secret is not configured', 500)
  }

  return 'dev-delivery-payload-secret'
}

function getEncryptionKeyId(): string {
  return process.env.DELIVERY_PAYLOAD_KEY_ID || 'default'
}

function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

export function normalizeSource(content: string): string {
  return content
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trimEnd()
}

function compressSource(normalizedSource: string): Buffer {
  return gzipSync(Buffer.from(normalizedSource, 'utf8'), { level: 9 })
}

function encryptCompressedPayload(params: {
  compressedPayload: Buffer
  versionId: string
  sourceSha256: string
}): string {
  const key = createHash('sha256').update(getPayloadSecret()).digest()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const aad = Buffer.from(`${PAYLOAD_FORMAT_VERSION}:${params.versionId}:${params.sourceSha256}`, 'utf8')

  cipher.setAAD(aad)
  const ciphertext = Buffer.concat([
    cipher.update(params.compressedPayload),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return JSON.stringify({
    v: PAYLOAD_FORMAT_VERSION,
    alg: ENCRYPTION_SCHEME,
    kid: getEncryptionKeyId(),
    compression: 'gzip',
    iv: iv.toString('base64'),
    tag: authTag.toString('base64'),
    data: ciphertext.toString('base64'),
  })
}

function sanitizeBuildError(error: unknown): {
  code: string
  message: string
  status: number
} {
  if (error instanceof BuildInputError) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
    }
  }

  return {
    code: 'build_failed',
    message: 'Delivery build failed',
    status: 500,
  }
}

function sanitizeInvalidationReason(reason: string): string {
  const normalized = reason.trim().replace(/[^a-zA-Z0-9_.:-]/g, '_')
  return normalized.slice(0, 120) || 'manual'
}

export async function buildVersion(versionId: string): Promise<BuildVersionResult> {
  if (!versionId || typeof versionId !== 'string') {
    return { success: false, message: 'Version ID is required', status: 400 }
  }

  const version = await getVersionById(versionId)
  if (!version) {
    return { success: false, message: 'Version not found', status: 404 }
  }

  const normalizedSource = normalizeSource(version.content)
  const sourceSha256 = sha256Hex(normalizedSource)
  let build: DeliveryBuildRow | null = null

  try {
    build = await createBuild({
      scriptId: version.script_id,
      versionId: version.id,
      sourceSha256,
      buildVersion: DELIVERY_BUILD_VERSION,
      payloadFormatVersion: PAYLOAD_FORMAT_VERSION,
      encryptionScheme: ENCRYPTION_SCHEME,
      encryptionKeyId: getEncryptionKeyId(),
      payloadContentType: PAYLOAD_CONTENT_TYPE,
      metadata: {
        normalized_byte_size: Buffer.byteLength(normalizedSource, 'utf8'),
      },
    })
    build = await markBuildBuilding(build.id)

    if (normalizedSource.trim().length === 0) {
      throw new BuildInputError('empty_source', 'Source content is empty after normalization')
    }

    const compressedPayload = compressSource(normalizedSource)
    const payloadCiphertext = encryptCompressedPayload({
      compressedPayload,
      versionId: version.id,
      sourceSha256,
    })
    const payloadSha256 = sha256Hex(payloadCiphertext)
    const readyBuild = await markBuildReady(build.id, {
      payloadCiphertext,
      payloadSha256,
      payloadByteSize: Buffer.byteLength(payloadCiphertext, 'utf8'),
    })

    return { success: true, build: readyBuild }
  } catch (error) {
    const sanitized = sanitizeBuildError(error)

    if (build) {
      try {
        const failedBuild = await markBuildFailed(build.id, {
          errorCode: sanitized.code,
          errorMessage: sanitized.message,
        })

        return {
          success: false,
          message: sanitized.message,
          status: sanitized.status,
          build: failedBuild,
        }
      } catch {
        return {
          success: false,
          message: 'Delivery build failed and failure state could not be recorded',
          status: 500,
        }
      }
    }

    return {
      success: false,
      message: sanitized.message,
      status: sanitized.status,
    }
  }
}

export async function rebuildVersion(versionId: string): Promise<BuildVersionResult> {
  const previousReadyBuild = await getReadyBuild(versionId, {
    buildVersion: DELIVERY_BUILD_VERSION,
    payloadFormatVersion: PAYLOAD_FORMAT_VERSION,
  })

  const result = await buildVersion(versionId)
  if (!result.success) {
    return result
  }

  if (previousReadyBuild && previousReadyBuild.id !== result.build.id) {
    const invalidated = await markBuildInvalidated(previousReadyBuild.id, 'superseded_by_rebuild')
    if (!invalidated) {
      return {
        success: false,
        message: 'Delivery build succeeded but previous build invalidation failed',
        status: 500,
        build: result.build,
      }
    }
  }

  return result
}

export async function invalidateBuild(
  buildId: string,
  reason: string = 'manual'
): Promise<InvalidateBuildResult> {
  if (!buildId || typeof buildId !== 'string') {
    return { success: false, message: 'Build ID is required', status: 400 }
  }

  const build = await markBuildInvalidated(buildId, sanitizeInvalidationReason(reason))
  if (!build) {
    return { success: false, message: 'Build not found', status: 404 }
  }

  return { success: true, build }
}
