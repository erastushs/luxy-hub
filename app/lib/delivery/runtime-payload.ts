import { createHash } from 'node:crypto'
import type { DeliveryBuildRow } from '@/app/lib/repositories/delivery-build-repository'
import {
  decryptPayload,
  decompressPayload,
  validatePayload,
} from '@/app/lib/delivery/payload-consumer'

export const RUNTIME_FORMAT_VERSION = 'runtime-v1'

export type RuntimePayloadResponse = {
  runtime_payload: string
  build_version: string
  version_id: string
  runtime_format_version: typeof RUNTIME_FORMAT_VERSION
}

export class RuntimePayloadError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'RuntimePayloadError'
  }
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function createRuntimePayloadFromBuild(build: DeliveryBuildRow): RuntimePayloadResponse {
  if (!build.payload_ciphertext || !build.payload_sha256) {
    throw new RuntimePayloadError('missing_encrypted_payload', 'Encrypted delivery payload is missing')
  }

  if (sha256Hex(build.payload_ciphertext) !== build.payload_sha256) {
    throw new RuntimePayloadError('payload_integrity_failed', 'Encrypted delivery payload hash mismatch')
  }

  const encryptedPayload = validatePayload(build.payload_ciphertext)
  const compressedPayload = decryptPayload({
    payload: encryptedPayload,
    versionId: build.version_id,
    sourceSha256: build.source_sha256,
  })
  const runtimePayload = decompressPayload(compressedPayload)

  return {
    runtime_payload: runtimePayload,
    build_version: build.build_version,
    version_id: build.version_id,
    runtime_format_version: RUNTIME_FORMAT_VERSION,
  }
}
