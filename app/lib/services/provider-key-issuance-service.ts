import { DEFAULT_KEY_DURATION_MS, createKeyRecord } from '@/app/lib/services/key-service'
import { getProvider } from '@/app/lib/providers/registry'
import type { ProviderKey, ProviderVerificationResult } from '@/app/lib/providers/types'

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
  const provider = getProvider(providerKey)
  const verification = await provider.verifyToken({ token, clientIP })

  if (!verification.success) {
    return { success: false, message: verification.message, verification }
  }

  const key = await createKeyRecord(new Date(Date.now() + DEFAULT_KEY_DURATION_MS))

  return {
    success: true,
    key: key.key,
    expires_at: key.expires_at,
    verification,
  }
}
