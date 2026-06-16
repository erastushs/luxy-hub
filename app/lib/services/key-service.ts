import { findKey, insertKey, deactivateExpiredKeys, upgradeKeyHash } from '@/app/lib/repositories/key-repository'
import { generateKey } from '@/app/lib/key-generator'
import { isValidKeyFormat } from '@/app/lib/validators'
import { freeKeyConfig } from '@/app/config/free-keys'
import { hashFreeKeyLookup, hashLegacyFreeKeyLookup } from '@/app/lib/security/secret-hashing'

export type KeyStatus =
  | { valid: true }
  | { valid: false; message: string; status: number }

export async function validateKey(key: unknown): Promise<KeyStatus> {
  if (!key) {
    return { valid: false, message: 'Key is required', status: 400 }
  }

  if (!isValidKeyFormat(key)) {
    return { valid: false, message: 'Invalid key', status: 403 }
  }

  const rawKey = key.trim()
  const currentHash = hashFreeKeyLookup(rawKey)
  const legacyHash = hashLegacyFreeKeyLookup(rawKey)
  const record = await findKey(currentHash)
    ?? await findKey(legacyHash)
    ?? await findKey(rawKey)

  if (!record) {
    return { valid: false, message: 'Invalid key', status: 403 }
  }

  if (!record.is_active) {
    return { valid: false, message: 'Invalid key', status: 403 }
  }

  if (new Date(record.expires_at) < new Date()) {
    return { valid: false, message: 'Invalid key', status: 403 }
  }

  if (record.key_hash !== currentHash || record.key !== null) {
    await upgradeKeyHash(record.id, currentHash)
  }

  return { valid: true }
}

export async function createKey(): Promise<string> {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + freeKeyConfig.expiresInDays)

  let attempts = 0
  while (attempts < freeKeyConfig.maxGenerationAttempts) {
    const key = generateKey()
    const inserted = await insertKey(hashFreeKeyLookup(key), expiresAt.toISOString())
    if (inserted) return key
    attempts++
  }

  throw new Error(`Failed to generate unique key after ${freeKeyConfig.maxGenerationAttempts} attempts`)
}

export async function runKeyCleanup() {
  const { error } = await deactivateExpiredKeys()
  if (error) throw error
}
