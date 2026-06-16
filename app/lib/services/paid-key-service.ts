import { createKeyWithExpiration } from '@/app/lib/services/key-service'

export type PaidKeyDuration = 'weekly' | 'monthly' | 'custom'

export type PaidKeyIssuanceInput =
  | { duration: 'weekly' }
  | { duration: 'monthly' }
  | { duration: 'custom'; expiresAt: string }

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
  const expiresAt = resolveExpiration(input)
  const key = await createKeyWithExpiration(expiresAt)

  return {
    key,
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
