const KEY_REGEX = /^LUXY-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/
const MAX_TOKEN_LENGTH = 256
const MAX_BODY_SIZE = 64 * 1024

export function isValidKeyFormat(key: unknown): key is string {
  return typeof key === 'string' && KEY_REGEX.test(key)
}

export function isValidToken(token: unknown): token is string {
  return typeof token === 'string' && token.trim().length > 0 && token.length <= MAX_TOKEN_LENGTH
}

export function validateRequestSize(contentLength: string | null): boolean {
  if (!contentLength) return true
  const size = parseInt(contentLength, 10)
  return !isNaN(size) && size <= MAX_BODY_SIZE
}
