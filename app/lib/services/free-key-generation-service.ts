import { checkRateLimit } from '@/app/lib/rate-limiter'
import { logEvent } from '@/app/lib/logger'
import { createKey } from '@/app/lib/services/key-service'
import { verifyWorkinkToken } from '@/app/lib/services/workink-service'
import { isValidToken } from '@/app/lib/validators'
import { freeKeyConfig } from '@/app/config/free-keys'

export type FreeKeyGenerationSource = 'generate-key API' | 'verify-workink API' | 'verify-token page'

export type FreeKeyGenerationResult =
  | { success: true; key: string; expires_at: string; tokenInfo?: unknown }
  | { success: false; message: string; status: number; retryAfter?: number }

export async function generateVerifiedFreeKey(
  token: unknown,
  clientIP: string,
  source: FreeKeyGenerationSource
): Promise<FreeKeyGenerationResult> {
  const rateLimit = await checkRateLimit(clientIP, 'GENERATE')

  if (!rateLimit.allowed) {
    await logEvent({
      event: 'RATE_LIMITED',
      ip: clientIP,
      message: `${source} free-key generation rate limit exceeded`,
    })

    return {
      success: false,
      message: source === 'generate-key API'
        ? 'Too many keys generated. Try again tomorrow.'
        : 'Too many requests. Please try again later.',
      status: 429,
      retryAfter: rateLimit.retryAfter,
    }
  }

  if (!isValidToken(token)) {
    await logEvent({
      event: 'VERIFY_WORKINK_FAILED',
      ip: clientIP,
      message: `${source} missing or invalid Work.ink token`,
    })

    return {
      success: false,
      message: source === 'generate-key API' ? 'Work.ink verification token required' : 'Token required',
      status: 400,
    }
  }

  const workinkResult = await verifyWorkinkToken(token, clientIP)

  if (!workinkResult.success) {
    await logEvent({
      event: workinkResult.message === 'Token already used' ? 'TOKEN_ALREADY_USED' : 'VERIFY_WORKINK_FAILED',
      ip: clientIP,
      token,
      message: `${source} Work.ink verification rejected: ${workinkResult.message}`,
    })

    return {
      success: false,
      message: workinkResult.message,
      status: getWorkinkFailureStatus(workinkResult.message),
    }
  }

  const key = await createKey()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + freeKeyConfig.expiresInDays)

  await logEvent({
    event: 'KEY_GENERATED',
    ip: clientIP,
    key,
    message: `Key generated via ${source} (format: ${freeKeyConfig.formats.current})`,
  })

  return {
    success: true,
    key,
    expires_at: expiresAt.toISOString(),
    tokenInfo: workinkResult.tokenInfo,
  }
}

function getWorkinkFailureStatus(message: string): number {
  const statusMap: Record<string, number> = {
    'Token required': 400,
    'Too many requests': 429,
    'Invalid token': 403,
    'Token already used': 403,
    'Internal server error': 500,
  }

  return statusMap[message] ?? 500
}
