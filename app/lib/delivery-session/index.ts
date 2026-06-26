import type { DeliverySessionAdapter, DeliverySessionData } from './types'
import { PostgresDeliverySessionAdapter } from './postgres-adapter'
import { resolveDeliverySessionAdapter } from './runtime'

let activeDeliverySessionAdapter: DeliverySessionAdapter | null = null

export function getDeliverySessionAdapter(): DeliverySessionAdapter {
  if (!activeDeliverySessionAdapter) {
    activeDeliverySessionAdapter = resolveDeliverySessionAdapter()
  }
  return activeDeliverySessionAdapter
}

export function setDeliverySessionAdapterForTests(adapter: DeliverySessionAdapter): void {
  activeDeliverySessionAdapter = adapter
}

export function resetDeliverySessionAdapterForTests(): void {
  activeDeliverySessionAdapter = new PostgresDeliverySessionAdapter()
}

export async function createSession(params: {
  scriptId: string
  buildId: string
  tokenHash: string
  expiresAt: string
  eventSecret?: string | null
}): Promise<DeliverySessionData> {
  return getDeliverySessionAdapter().createSession(params)
}

export async function getSessionByTokenHash(tokenHash: string): Promise<DeliverySessionData | null> {
  return getDeliverySessionAdapter().getSessionByTokenHash(tokenHash)
}

export async function consumeSession(sessionId: string): Promise<DeliverySessionData | null> {
  return getDeliverySessionAdapter().consumeSession(sessionId)
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  return getDeliverySessionAdapter().deleteSession(sessionId)
}

export type { DeliverySessionAdapter, DeliverySessionData } from './types'
export { parseDeliverySessionRuntimeConfig } from './config'
export { resolveDeliverySessionAdapter } from './runtime'
export { getDeliverySessionRolloutMetrics } from './metrics-service'
