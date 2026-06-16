import { findKey, insertKey, deactivateExpiredKeys } from '@/app/lib/repositories/key-repository'
import { generateKey } from '@/app/lib/key-generator'
import { isValidKeyFormat } from '@/app/lib/validators'

export type KeyStatus =
  | { valid: true }
  | { valid: false; message: string; status: number }

export const DEFAULT_KEY_DURATION_MS = 24 * 60 * 60 * 1000

export async function validateKey(key: unknown): Promise<KeyStatus> {
  if (!key) {
    return { valid: false, message: 'Key is required', status: 400 }
  }

  if (!isValidKeyFormat(key)) {
    return { valid: false, message: 'Invalid key', status: 403 }
  }

  const record = await findKey(key)

  if (!record) {
    return { valid: false, message: 'Invalid key', status: 403 }
  }

  if (!record.is_active) {
    return { valid: false, message: 'Invalid key', status: 403 }
  }

  if (new Date(record.expires_at) < new Date()) {
    return { valid: false, message: 'Invalid key', status: 403 }
  }

  return { valid: true }
}

export async function createKeyWithExpiration(expiresAt: Date): Promise<string> {
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    throw new Error('Key expiration must be in the future')
  }

  let attempts = 0
  while (attempts < 5) {
    const key = generateKey()
    const inserted = await insertKey(key, expiresAt.toISOString())
    if (inserted) return key
    attempts++
  }

  throw new Error('Failed to generate unique key after 5 attempts')
}

export async function createKeyRecord(expiresAt: Date): Promise<{ key: string; expires_at: string }> {
  const key = await createKeyWithExpiration(expiresAt)

  return {
    key,
    expires_at: expiresAt.toISOString(),
  }
}

export async function createKey(): Promise<string> {
  const record = await createKeyRecord(new Date(Date.now() + DEFAULT_KEY_DURATION_MS))

  return record.key
}

export async function runKeyCleanup() {
  const { error } = await deactivateExpiredKeys()
  if (error) throw error
}
