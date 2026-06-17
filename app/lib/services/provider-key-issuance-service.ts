import { DEFAULT_KEY_DURATION_MS, createKeyRecord } from '@/app/lib/services/key-service'
import { resolveEnabledProvider } from '@/app/lib/providers/registry'
import type { ProviderErrorCode, ProviderKey, ProviderVerificationResult } from '@/app/lib/providers/types'

export type ProviderKeyIssuanceResult =
  | {
      success: true
      key: string
      expires_at: string
      verification: ProviderVerificationResult
    }
  | {
      success: false
      message: string
      errorCode: ProviderErrorCode
      verification: ProviderVerificationResult
    }

export async function issueProviderKey({
  providerKey,
  token,
  clientIP,
}: {
  providerKey: ProviderKey
  token: string
  clientIP: string
}): Promise<ProviderKeyIssuanceResult> {
  const provider = resolveEnabledProvider(providerKey)

  if (!provider) {
    const errorCode: ProviderErrorCode = 'provider_unavailable'
    const verification: ProviderVerificationResult = {
      success: false,
      message: 'Provider unavailable',
      validToken: false,
      errorCode,
    }

    return {
      success: false,
      message: verification.message,
      errorCode,
      verification,
    }
  }

  const verification = await provider.verifyToken({ token, clientIP })

  if (!verification.success) {
    return {
      success: false,
      message: verification.message,
      errorCode: normalizeProviderError(verification),
      verification,
    }
  }

  const key = await createKeyRecord({
    expiresAt: new Date(Date.now() + DEFAULT_KEY_DURATION_MS),
    keyCategory: 'free',
    keyType: 'free',
  })

  return {
    success: true,
    key: key.key,
    expires_at: key.expires_at,
    verification,
  }
}

function normalizeProviderError(verification: ProviderVerificationResult): ProviderErrorCode {
  if (verification.errorCode) return verification.errorCode

  const messageMap: Record<string, ProviderErrorCode> = {
    'Token required': 'invalid_token',
    'Invalid token': 'invalid_token',
    'Token already used': 'token_used',
    'Too many requests': 'rate_limited',
    'Internal server error': 'internal_error',
  }

  return messageMap[verification.message] ?? 'internal_error'
}
