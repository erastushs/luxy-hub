import type { DeliverySessionRuntimeConfig, DeliverySessionRuntimeMode } from './types'

const DELIVERY_SESSION_RUNTIME_MODES: readonly DeliverySessionRuntimeMode[] = [
  'postgres',
  'shadow',
  'valkey_canary',
  'valkey',
]

export function parseDeliverySessionRuntimeConfig(
  env: Record<string, string | undefined> = process.env
): DeliverySessionRuntimeConfig {
  const requestedMode = env.DELIVERY_SESSION_MODE?.trim() || null
  const canaryPercentage = parseCanaryPercentage(env.DELIVERY_SESSION_CANARY_PERCENT)

  if (!requestedMode) {
    return { requestedMode: null, mode: 'postgres', invalidMode: null, canaryPercentage }
  }

  const normalizedMode = requestedMode.toLowerCase()

  if (DELIVERY_SESSION_RUNTIME_MODES.includes(normalizedMode as DeliverySessionRuntimeMode)) {
    return {
      requestedMode,
      mode: normalizedMode as DeliverySessionRuntimeMode,
      invalidMode: null,
      canaryPercentage,
    }
  }

  return { requestedMode, mode: 'postgres', invalidMode: requestedMode, canaryPercentage }
}

function parseCanaryPercentage(rawValue: string | undefined): number {
  if (!rawValue?.trim()) {
    return 0
  }

  const parsed = Number(rawValue)

  if (!Number.isFinite(parsed)) {
    return 0
  }

  return Math.min(100, Math.max(0, Math.floor(parsed)))
}
