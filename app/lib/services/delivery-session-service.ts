import { createHash, randomBytes } from 'node:crypto'
import { getReadyBuild, getBuildById, type DeliveryBuildRow } from '@/app/lib/repositories/delivery-build-repository'
import {
  consumeSession,
  createSession,
  getSessionByTokenHash,
  type DeliverySessionRow,
} from '@/app/lib/repositories/delivery-session-repository'
import { findScriptForDeliveryBySlug, type ScriptRow } from '@/app/lib/repositories/script-repository'
import { isValidSlug } from '@/app/lib/validators'
import { DELIVERY_BUILD_VERSION, PAYLOAD_FORMAT_VERSION } from '@/app/lib/services/delivery-build-service'
import {
  createRuntimePayloadFromBuild,
  type RuntimePayloadResponse,
} from '@/app/lib/delivery/runtime-payload'
import { recordExecution } from '@/app/lib/repositories/script-execution-repository'
import { authorizeDeliveryAccess } from '@/app/lib/services/delivery-authorization-service'

export const DELIVERY_SESSION_TTL_SECONDS = 60
const UNAVAILABLE_MESSAGE = 'Delivery unavailable'
const INVALID_SESSION_MESSAGE = 'Invalid delivery session'

export type CreateDeliverySessionResult =
  | { success: true; session_token: string; event_secret: string; expires_in: number; session: DeliverySessionRow }
  | { success: false; message: string; status: number }

export type ValidateDeliverySessionResult =
  | { success: true; session: DeliverySessionRow; build: DeliveryBuildRow }
  | { success: false; message: string; status: number }

export type ConsumeDeliverySessionResult =
  | {
      success: true
      runtime_payload: string
      build_version: string
      version_id: string
      runtime_format_version: RuntimePayloadResponse['runtime_format_version']
      event_secret: string
      session: DeliverySessionRow
      build: DeliveryBuildRow
    }
  | { success: false; message: string; status: number }

function createRawSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

function createEventSecret(): string {
  return randomBytes(32).toString('base64url')
}

export function hashDeliverySessionToken(sessionToken: string): string {
  return createHash('sha256').update(sessionToken).digest('hex')
}

function invalidSession(): ValidateDeliverySessionResult {
  return { success: false, message: INVALID_SESSION_MESSAGE, status: 403 }
}

function isScriptDeliverable(script: ScriptRow): boolean {
  return script.visibility === 'public' || script.visibility === 'unlisted'
}

function isSha256Hex(value: string | null): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
}

function isReadyBuildDeliverable(build: DeliveryBuildRow): boolean {
  return build.build_status === 'ready'
    && build.payload_storage_kind === 'inline_encrypted'
    && typeof build.payload_ciphertext === 'string'
    && build.payload_ciphertext.length > 0
    && isSha256Hex(build.source_sha256)
    && isSha256Hex(build.payload_sha256)
}

export async function createDeliverySession(slug: unknown): Promise<CreateDeliverySessionResult> {
  if (!isValidSlug(slug)) {
    return { success: false, message: UNAVAILABLE_MESSAGE, status: 404 }
  }

  try {
    const script = await findScriptForDeliveryBySlug(slug)
    if (!script || !script.current_version_id || !isScriptDeliverable(script)) {
      return { success: false, message: UNAVAILABLE_MESSAGE, status: 404 }
    }

    const authorization = authorizeDeliveryAccess({ script })
    if (!authorization.success) {
      return authorization
    }

    const build = await getReadyBuild(script.current_version_id, {
      buildVersion: DELIVERY_BUILD_VERSION,
      payloadFormatVersion: PAYLOAD_FORMAT_VERSION,
    })

    if (!build || !isReadyBuildDeliverable(build)) {
      return { success: false, message: UNAVAILABLE_MESSAGE, status: 404 }
    }

    const sessionToken = createRawSessionToken()
    const eventSecret = createEventSecret()
    const session = await createSession({
      scriptId: script.id,
      buildId: build.id,
      tokenHash: hashDeliverySessionToken(sessionToken),
      expiresAt: new Date(Date.now() + DELIVERY_SESSION_TTL_SECONDS * 1000).toISOString(),
      eventSecret,
    })
    await recordExecution({ scriptId: script.id, sessionId: session.id })

    return {
      success: true,
      session_token: sessionToken,
      event_secret: eventSecret,
      expires_in: DELIVERY_SESSION_TTL_SECONDS,
      session,
    }
  } catch {
    return { success: false, message: UNAVAILABLE_MESSAGE, status: 404 }
  }
}

export async function validateDeliverySession(sessionToken: unknown): Promise<ValidateDeliverySessionResult> {
  if (typeof sessionToken !== 'string' || sessionToken.length < 32 || sessionToken.length > 256) {
    return invalidSession()
  }

  try {
    const tokenHash = hashDeliverySessionToken(sessionToken)
    const session = await getSessionByTokenHash(tokenHash)
    if (!session || session.consumed_at || new Date(session.expires_at).getTime() <= Date.now()) {
      return invalidSession()
    }

    const build = await getBuildById(session.build_id)
    if (!build || build.script_id !== session.script_id || !isReadyBuildDeliverable(build)) {
      return invalidSession()
    }

    return { success: true, session, build }
  } catch {
    return invalidSession()
  }
}

export async function consumeDeliverySession(sessionToken: unknown): Promise<ConsumeDeliverySessionResult> {
  const validation = await validateDeliverySession(sessionToken)
  if (!validation.success) {
    return validation
  }

  const consumedSession = await consumeSession(validation.session.id)
  if (!consumedSession) {
    return { success: false, message: INVALID_SESSION_MESSAGE, status: 403 }
  }

  let runtimePayload: RuntimePayloadResponse
  try {
    runtimePayload = createRuntimePayloadFromBuild(validation.build)
  } catch {
    return { success: false, message: INVALID_SESSION_MESSAGE, status: 403 }
  }

  if (!consumedSession.event_secret) {
    return { success: false, message: INVALID_SESSION_MESSAGE, status: 403 }
  }

  return {
    success: true,
    ...runtimePayload,
    event_secret: consumedSession.event_secret,
    session: consumedSession,
    build: validation.build,
  }
}
