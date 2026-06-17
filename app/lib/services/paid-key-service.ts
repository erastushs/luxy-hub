import { createKeyRecord } from '@/app/lib/services/key-service'

export type PaidKeyDuration = 'weekly' | 'monthly' | 'custom'

export type PaidKeyIssuanceInput =
  | { duration: 'weekly'; name: string; description?: string | null }
  | { duration: 'monthly'; name: string; description?: string | null }
  | { duration: 'custom'; expiresAt: string; name: string; description?: string | null }

export type PaidKeyIssuance = {
  key: string
  expires_at: string
  duration: PaidKeyDuration
}

export class PaidKeyValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PaidKeyValidationError'
  }
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

const MONTH_MS = 30 * 24 * 60 * 60 * 1000

const MAX_CUSTOM_DURATION_MS = 366 * 24 * 60 * 60 * 1000

const MIN_CUSTOM_DURATION_MS = 60 * 1000

export async function issuePaidKey(input: PaidKeyIssuanceInput): Promise<PaidKeyIssuance> {
  const name = normalizePremiumKeyName(input.name)
  const expiresAt = resolveExpiration(input)
  const key = await createKeyRecord({
    expiresAt,
    keyCategory: 'premium',
    name,
    description: normalizeDescription(input.description),
  })

  return {
    key: key.key,
    expires_at: expiresAt.toISOString(),
    duration: input.duration,
  }
}

export function resolvePaidKeyExpiration(input: PaidKeyIssuanceInput): Date {
  return resolveExpiration(input)
}

function resolveExpiration(input: PaidKeyIssuanceInput): Date {
  const now = Date.now()

  if (input.duration === 'weekly') {
    return new Date(now + WEEK_MS)
  }

  if (input.duration === 'monthly') {
    return new Date(now + MONTH_MS)
  }

  const expiresAt = new Date(input.expiresAt)

  if (Number.isNaN(expiresAt.getTime())) {
    throw new PaidKeyValidationError('Custom expiration must be a valid date')
  }

  const customDurationMs = expiresAt.getTime() - now
  if (customDurationMs < MIN_CUSTOM_DURATION_MS) {
    throw new PaidKeyValidationError('Custom expiration must be in the future')
  }

  if (customDurationMs > MAX_CUSTOM_DURATION_MS) {
    throw new PaidKeyValidationError('Custom expiration cannot be more than 366 days out')
  }

  return expiresAt
}

function normalizePremiumKeyName(name: string): string {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new PaidKeyValidationError('Premium key name is required')
  }

  return name.trim()
}

function normalizeDescription(description: string | null | undefined): string | null {
  if (typeof description !== 'string') return null
  const trimmed = description.trim()

  return trimmed.length > 0 ? trimmed : null
}
