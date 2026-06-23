import { createHash } from 'crypto'

const DEFAULT_APP_NAMESPACE = 'luxyhub'

export function getValkeyEnvironment(env: Record<string, string | undefined> = process.env): string {
  const explicit = env.VALKEY_NAMESPACE_ENV?.trim().toLowerCase()

  if (explicit) {
    return sanitizeSegment(explicit)
  }

  if (env.NODE_ENV === 'production') {
    return 'prod'
  }

  if (env.NODE_ENV === 'test') {
    return 'test'
  }

  return 'local'
}

export function sanitizeSegment(segment: string): string {
  return segment
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown'
}

export function createValkeyKeyPrefix(workload: string, env: Record<string, string | undefined> = process.env): string {
  return `${DEFAULT_APP_NAMESPACE}:${getValkeyEnvironment(env)}:${sanitizeSegment(workload)}:`
}

export function createValkeyKey(
  workload: string,
  identifier: string,
  env: Record<string, string | undefined> = process.env
): string {
  return `${createValkeyKeyPrefix(workload, env)}${sanitizeSegment(identifier)}`
}

export function hashValkeyIdentifier(identifier: string, salt: string = ''): string {
  return createHash('sha256').update(salt).update(identifier).digest('hex')
}
