import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { getAnalyticsPepper, getKeyHashSecret, getLicenseHashSecret } from '@/app/config/env'

const SCRYPT_PARAMS = { n: 16_384, r: 8, p: 1, keyLength: 32 } as const

export function hmacSha256(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex')
}

export function legacySha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function hashFreeKeyLookup(value: string): string {
  return `hmac-sha256:v1:${hmacSha256(value, getKeyHashSecret())}`
}

export function hashLegacyFreeKeyLookup(value: string): string {
  return `legacy-sha256:${legacySha256(value)}`
}

export function hashLicenseLookup(value: string): string {
  return hmacSha256(value, getLicenseHashSecret())
}

export function hashCustomerIdentifier(value: string): string {
  return hmacSha256(value, getAnalyticsPepper())
}

export function hashLicenseVerifier(value: string): string {
  const salt = randomBytes(16).toString('base64url')
  const hash = scryptSync(value, salt, SCRYPT_PARAMS.keyLength, {
    N: SCRYPT_PARAMS.n,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
  }).toString('base64url')
  return `scrypt:v1:${SCRYPT_PARAMS.n}:${SCRYPT_PARAMS.r}:${SCRYPT_PARAMS.p}:${salt}:${hash}`
}

export function legacyLicenseVerifier(value: string): string {
  return legacySha256(value)
}

export function verifyLicenseVerifier(value: string, stored: string): boolean {
  if (stored.startsWith('scrypt:v1:')) {
    const [, , n, r, p, salt, expected] = stored.split(':')
    if (!n || !r || !p || !salt || !expected) return false

    const actual = scryptSync(value, salt, Buffer.from(expected, 'base64url').length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    })
    return safeEqual(actual, Buffer.from(expected, 'base64url'))
  }

  return safeEqual(Buffer.from(legacyLicenseVerifier(value), 'hex'), Buffer.from(stored, 'hex'))
}

export function isLegacyLicenseVerifier(stored: string): boolean {
  return /^[a-f0-9]{64}$/.test(stored)
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b)
}
