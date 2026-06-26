import { PostgresDeliverySessionAdapter } from './postgres-adapter'
import { ValkeyDeliverySessionAdapter } from './valkey-adapter'
import { ShadowDeliverySessionAdapter } from './shadow-adapter'
import { CanaryDeliverySessionAdapter } from './canary-adapter'
import { parseDeliverySessionRuntimeConfig } from './config'
import type { DeliverySessionAdapter } from './types'

const postgresDeliverySessionAdapter = new PostgresDeliverySessionAdapter()
const valkeyDeliverySessionAdapter = new ValkeyDeliverySessionAdapter(undefined, {
  logFailures: false,
})

function logInvalidRuntimeMode(invalidMode: string): void {
  console.warn(JSON.stringify({
    timestamp: new Date().toISOString(),
    component: 'delivery-session',
    event: 'invalid_runtime_mode',
    fallbackMode: 'postgres',
    requestedMode: invalidMode,
  }))
}

export function resolveDeliverySessionAdapter(
  env: Record<string, string | undefined> = process.env
): DeliverySessionAdapter {
  const config = parseDeliverySessionRuntimeConfig(env)

  if (config.invalidMode) {
    logInvalidRuntimeMode(config.invalidMode)
  }

  if (config.mode === 'shadow') {
    return new ShadowDeliverySessionAdapter(
      postgresDeliverySessionAdapter,
      valkeyDeliverySessionAdapter
    )
  }

  if (config.mode === 'valkey_canary') {
    return new CanaryDeliverySessionAdapter(
      postgresDeliverySessionAdapter,
      valkeyDeliverySessionAdapter,
      config.canaryPercentage
    )
  }

  if (config.mode === 'valkey') {
    return valkeyDeliverySessionAdapter
  }

  return postgresDeliverySessionAdapter
}

export function getPostgresDeliverySessionAdapter(): DeliverySessionAdapter {
  return postgresDeliverySessionAdapter
}
