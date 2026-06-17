export type ProviderKey = string

export type ProviderErrorCode =
  | 'invalid_token'
  | 'token_used'
  | 'provider_unavailable'
  | 'rate_limited'
  | 'internal_error'

export type ProviderMetadata = {
  key: ProviderKey
  displayName: string
  description: string
  enabled: boolean
  order: number
  ctaLabel: string
  estimatedTimeLabel: string
}

export type ProviderVerificationResult = {
  success: boolean
  message: string
  validToken: boolean
  errorCode?: ProviderErrorCode
  tokenInfo?: unknown
}

export type ProviderVerifyInput = {
  token: string
  clientIP: string
}

export type KeyProvider = {
  key: ProviderKey
  metadata: ProviderMetadata
  verifyToken(input: ProviderVerifyInput): Promise<ProviderVerificationResult>
}
