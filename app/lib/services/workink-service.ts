import { workinkProvider } from '@/app/lib/providers/workink-provider'
import type { ProviderVerificationResult } from '@/app/lib/providers/types'

export type WorkinkResult = ProviderVerificationResult

export async function verifyWorkinkToken(token: string, clientIP: string): Promise<WorkinkResult> {
  return workinkProvider.verifyToken({ token, clientIP })
}
