import { findKey, insertKey, deactivateExpiredKeys, listKeys, setKeyActiveState, type KeyCategory, type KeyRow } from '@/app/lib/repositories/key-repository'
import { generateFreeKey, generateKey, generatePremiumKey } from '@/app/lib/key-generator'
import { isValidKeyFormat } from '@/app/lib/validators'

export type KeyStatus =
  | { valid: true }
  | { valid: false; message: string; status: number }

export type DashboardKeyStatus = 'active' | 'expired' | 'disabled'

export type DashboardKey = KeyRow & {
  status: DashboardKeyStatus
}

export type KeySummary = {
  total: number
  active: number
  expired: number
  disabled: number
}

export const DEFAULT_KEY_DURATION_MS = 24 * 60 * 60 * 1000
const KEY_GENERATION_ATTEMPTS = 20

export type CreateKeyRecordInput = {
  expiresAt: Date
  keyCategory?: KeyCategory
  name?: string | null
  description?: string | null
}

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
  const record = await createKeyRecord({ expiresAt })

  return record.key
}

export async function createKeyRecord(input: Date | CreateKeyRecordInput): Promise<{ key: string; expires_at: string }> {
  const params = input instanceof Date ? { expiresAt: input } : input
  const { expiresAt } = params

  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    throw new Error('Key expiration must be in the future')
  }

  let attempts = 0
  while (attempts < KEY_GENERATION_ATTEMPTS) {
    const key = generateKeyForCategory(params.keyCategory ?? 'legacy')
    const inserted = await insertKey({
      key,
      expiresAt: expiresAt.toISOString(),
      keyCategory: params.keyCategory ?? 'legacy',
      name: params.name ?? null,
      description: params.description ?? null,
    })
    if (inserted) {
      return {
        key,
        expires_at: expiresAt.toISOString(),
      }
    }
    attempts++
  }

  throw new Error(`Failed to generate unique key after ${KEY_GENERATION_ATTEMPTS} attempts`)
}

export async function createKey(): Promise<string> {
  const record = await createKeyRecord(new Date(Date.now() + DEFAULT_KEY_DURATION_MS))

  return record.key
}

export async function runKeyCleanup() {
  const { error } = await deactivateExpiredKeys()
  if (error) throw error
}

export async function listDashboardKeys(search?: unknown): Promise<{ keys: DashboardKey[]; summary: KeySummary }> {
  const normalizedSearch = typeof search === 'string' && search.trim().length > 0 ? search.trim() : null
  const keys = await listKeys({ search: normalizedSearch, limit: 200, category: 'premium' })
  const dashboardKeys = keys.map(serializeDashboardKey)

  return {
    keys: dashboardKeys,
    summary: summarizeKeys(dashboardKeys),
  }
}

export async function updateDashboardKeyState(keyId: unknown, isActive: unknown): Promise<DashboardKey | null> {
  if (typeof keyId !== 'string' || keyId.trim().length === 0 || typeof isActive !== 'boolean') {
    return null
  }

  const updated = await setKeyActiveState(keyId.trim(), isActive)
  return updated ? serializeDashboardKey(updated) : null
}

export function getDashboardKeyStatus(key: Pick<KeyRow, 'is_active' | 'expires_at'>): DashboardKeyStatus {
  if (!key.is_active) return 'disabled'
  if (new Date(key.expires_at).getTime() < Date.now()) return 'expired'
  return 'active'
}

function serializeDashboardKey(key: KeyRow): DashboardKey {
  return {
    ...key,
    status: getDashboardKeyStatus(key),
  }
}

function summarizeKeys(keys: DashboardKey[]): KeySummary {
  return keys.reduce<KeySummary>((summary, key) => {
    summary.total += 1
    summary[key.status] += 1
    return summary
  }, { total: 0, active: 0, expired: 0, disabled: 0 })
}

function generateKeyForCategory(category: KeyCategory): string {
  if (category === 'free') return generateFreeKey()
  if (category === 'premium') return generatePremiumKey()
  return generateKey()
}
