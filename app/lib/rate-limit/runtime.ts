import { PostgresRateLimitAdapter } from './postgres-adapter'
import { parseRateLimitRuntimeConfig } from './config'
import type { RateLimitAdapter } from './types'

const postgresRateLimitAdapter = new PostgresRateLimitAdapter()

function logInvalidRuntimeMode(invalidMode: string): void {
  console.warn(JSON.stringify({
    timestamp: new Date().toISOString(),
    component: 'rate-limit',
    event: 'invalid_runtime_mode',
    fallbackMode: 'postgres',
    requestedMode: invalidMode,
  }))
}

export function resolveRateLimitAdapter(
  env: Record<string, string | undefined> = process.env
): RateLimitAdapter {
  const config = parseRateLimitRuntimeConfig(env)

  if (config.invalidMode) {
    logInvalidRuntimeMode(config.invalidMode)
  }

  return postgresRateLimitAdapter
}

export function getPostgresRateLimitAdapter(): RateLimitAdapter {
  return postgresRateLimitAdapter
}
