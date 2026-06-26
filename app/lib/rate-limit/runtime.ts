import { PostgresRateLimitAdapter } from './postgres-adapter'
import { ShadowRateLimitAdapter } from './shadow-adapter'
import { ValkeyRateLimitAdapter } from './valkey-adapter'
import { CanaryRateLimitAdapter } from './canary-adapter'
import { parseRateLimitRuntimeConfig } from './config'
import type { RateLimitAdapter } from './types'

const postgresRateLimitAdapter = new PostgresRateLimitAdapter()
const valkeyRateLimitAdapter = new ValkeyRateLimitAdapter(undefined, {
  logFailures: false,
  throwOnFailure: true,
})
const shadowRateLimitAdapter = new ShadowRateLimitAdapter(
  postgresRateLimitAdapter,
  valkeyRateLimitAdapter
)

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

  if (config.mode === 'shadow') {
    return shadowRateLimitAdapter
  }

  if (config.mode === 'valkey_canary') {
    return new CanaryRateLimitAdapter(
      postgresRateLimitAdapter,
      valkeyRateLimitAdapter,
      config.canaryPercentage
    )
  }

  if (config.mode === 'valkey') {
    return valkeyRateLimitAdapter
  }

  return postgresRateLimitAdapter
}

export function getPostgresRateLimitAdapter(): RateLimitAdapter {
  return postgresRateLimitAdapter
}
