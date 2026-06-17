import { insertToken } from '@/app/lib/repositories/token-repository'
import { getProviderRuntimeConfig } from '@/app/lib/providers/config'
import type { KeyProvider, ProviderVerificationResult } from '@/app/lib/providers/types'

const MAX_TOKEN_LENGTH = 256

export const workinkProvider: KeyProvider = {
  key: 'workink',
  metadata: getProviderRuntimeConfig('workink')!,
  async verifyToken({ token, clientIP }): Promise<ProviderVerificationResult> {
    if (!token || token.trim().length === 0) {
      return { success: false, message: 'Token required', validToken: false, errorCode: 'invalid_token' }
    }

    if (token.length > MAX_TOKEN_LENGTH) {
      return { success: false, message: 'Invalid token', validToken: false, errorCode: 'invalid_token' }
    }

    const sanitized = token.trim()

    try {
      const response = await fetch(
        `https://work.ink/_api/v2/token/isValid/${encodeURIComponent(sanitized)}`
      )

      const data = await response.json()

      if (!data.valid) {
        return { success: false, message: 'Invalid token', validToken: false, errorCode: 'invalid_token' }
      }

      if (data.info?.byIp) {
        const workinkIP = data.info.byIp.trim()

        if (workinkIP !== clientIP && clientIP !== '127.0.0.1') {
          console.warn(
            `IP mismatch: Work.ink=${workinkIP} client=${clientIP} — allowing (soft check)`
          )
        }
      }

      const consumed = await insertToken(sanitized)

      if (!consumed) {
        return { success: false, message: 'Token already used', validToken: false, errorCode: 'token_used' }
      }

      return {
        success: true,
        message: 'Token verified',
        validToken: true,
        tokenInfo: data.info,
      }
    } catch {
      console.error('Work.ink verification error')
      return { success: false, message: 'Internal server error', validToken: false, errorCode: 'provider_unavailable' }
    }
  },
}
