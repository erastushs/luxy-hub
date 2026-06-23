import type { ValkeyConfig } from './types'

const DEFAULT_PORT = 6379
const DEFAULT_DATABASE = 0
const DEFAULT_CONNECT_TIMEOUT_MS = 1000
const DEFAULT_COMMAND_TIMEOUT_MS = 1000

type EnvSource = Record<string, string | undefined>

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean | null {
  if (value == null || value.trim() === '') {
    return defaultValue
  }

  const normalized = value.trim().toLowerCase()

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }

  return null
}

function parseInteger(
  value: string | undefined,
  defaultValue: number,
  name: string,
  errors: string[],
  options: { min: number; max: number }
): number {
  if (value == null || value.trim() === '') {
    return defaultValue
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < options.min || parsed > options.max) {
    errors.push(`${name} must be an integer between ${options.min} and ${options.max}`)
    return defaultValue
  }

  return parsed
}

export function getValkeyConfig(env: EnvSource = process.env): ValkeyConfig {
  const errors: string[] = []
  const requestedEnabled = parseBoolean(env.VALKEY_ENABLED, false)
  const tls = parseBoolean(env.VALKEY_TLS, false)

  if (requestedEnabled == null) {
    errors.push('VALKEY_ENABLED must be a boolean value')
  }

  if (tls == null) {
    errors.push('VALKEY_TLS must be a boolean value')
  }

  const host = env.VALKEY_HOST?.trim() || null
  const port = parseInteger(env.VALKEY_PORT, DEFAULT_PORT, 'VALKEY_PORT', errors, {
    min: 1,
    max: 65535,
  })
  const database = parseInteger(env.VALKEY_DB, DEFAULT_DATABASE, 'VALKEY_DB', errors, {
    min: 0,
    max: 15,
  })
  const connectTimeoutMs = parseInteger(
    env.VALKEY_CONNECT_TIMEOUT_MS,
    DEFAULT_CONNECT_TIMEOUT_MS,
    'VALKEY_CONNECT_TIMEOUT_MS',
    errors,
    { min: 1, max: 30000 }
  )
  const commandTimeoutMs = parseInteger(
    env.VALKEY_COMMAND_TIMEOUT_MS,
    DEFAULT_COMMAND_TIMEOUT_MS,
    'VALKEY_COMMAND_TIMEOUT_MS',
    errors,
    { min: 1, max: 30000 }
  )

  if (requestedEnabled === true && !host) {
    errors.push('VALKEY_HOST is required when VALKEY_ENABLED is true')
  }

  return {
    enabled: requestedEnabled === true && errors.length === 0,
    requestedEnabled: requestedEnabled === true,
    host,
    port,
    password: env.VALKEY_PASSWORD || null,
    database,
    tls: tls === true,
    connectTimeoutMs,
    commandTimeoutMs,
    errors,
  }
}

export function assertServerOnlyValkeyAccess(): void {
  if (typeof window !== 'undefined') {
    throw new Error('Valkey access is server-side only')
  }
}
