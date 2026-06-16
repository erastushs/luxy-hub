export type ProviderKey = string

export type ProviderVerificationResult = {
  success: boolean
  message: string
  validToken: boolean
  tokenInfo?: unknown
}

export type ProviderVerifyInput = {
  token: string
  clientIP: string
}

export type KeyProvider = {
  key: ProviderKey
  verifyToken(input: ProviderVerifyInput): Promise<ProviderVerificationResult>
}
