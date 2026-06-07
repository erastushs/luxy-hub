import { findKey, insertKey, deactivateExpiredKeys } from '@/app/lib/repositories/key-repository'
import { generateKey } from '@/app/lib/key-generator'
import { isValidKeyFormat } from '@/app/lib/validators'

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

export async function createKey(): Promise<string> {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 1)

  let attempts = 0
  while (attempts < 5) {
    const key = generateKey()
    const inserted = await insertKey(key, expiresAt.toISOString())
    if (inserted) return key
    attempts++
  }

  throw new Error('Failed to generate unique key after 5 attempts')
}

export async function runKeyCleanup() {
  const { error } = await deactivateExpiredKeys()
  if (error) throw error
}
