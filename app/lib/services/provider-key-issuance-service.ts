import { createKey } from '@/app/lib/services/key-service'
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

  const key = await createKey()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 1)

  return {
    success: true,
    key,
    expires_at: expiresAt.toISOString(),
    verification,
  }
}
