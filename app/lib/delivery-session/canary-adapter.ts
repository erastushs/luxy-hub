import { createHash } from 'node:crypto'
import type { DeliverySessionAdapter, DeliverySessionBackend, DeliverySessionData } from './types'
import { executeDeliverySessionShadow } from './shadow'
import { getDeliverySessionMetricsService } from './metrics-service'
import { getCurrentTracer } from './trace'

export class CanaryDeliverySessionAdapter implements DeliverySessionAdapter {
  constructor(
    private readonly postgres: DeliverySessionAdapter,
    private readonly valkey: DeliverySessionAdapter,
    private readonly canaryPercentage: number
  ) {}

  async createSession(params: {
    scriptId: string
    buildId: string
    tokenHash: string
    expiresAt: string
    eventSecret?: string | null
  }): Promise<DeliverySessionData> {
    const tracer = getCurrentTracer()
    const identifier = `delivery:create:${params.tokenHash}`
    const backend = selectCanaryBackend(identifier, this.canaryPercentage)
    tracer.adapter('valkey_canary', backend)

    if (backend === 'postgres') {
      return this.runWithShadow(identifier, 'postgres', 'valkey', {
        authoritative: () => this.postgres.createSession(params),
        shadow: () => this.valkey.createSession(params),
      }) as Promise<DeliverySessionData>
    }

    const metrics = getDeliverySessionMetricsService()
    metrics.recordRolloutRequest('valkey')

    try {
      const result = await this.valkey.createSession(params)
      metrics.incrementCreated()
      return result
    } catch (error) {
      tracer.fallback('valkey', 'postgres', error instanceof Error ? error.message : String(error))
      metrics.recordRolloutRequest('postgres', true)
      metrics.incrementBackendFailure()
      const result = await this.postgres.createSession(params)
      metrics.incrementCreated()
      return result
    }
  }

  async getSessionByTokenHash(tokenHash: string): Promise<DeliverySessionData | null> {
    const tracer = getCurrentTracer()
    const identifier = `delivery:get:${tokenHash}`
    const backend = selectCanaryBackend(identifier, this.canaryPercentage)
    tracer.adapter('valkey_canary', backend)

    if (backend === 'postgres') {
      return this.runWithShadow(identifier, 'postgres', 'valkey', {
        authoritative: () => this.postgres.getSessionByTokenHash(tokenHash),
        shadow: () => this.valkey.getSessionByTokenHash(tokenHash),
      })
    }

    const metrics = getDeliverySessionMetricsService()
    metrics.recordRolloutRequest('valkey')

    try {
      return await this.valkey.getSessionByTokenHash(tokenHash)
    } catch (error) {
      tracer.fallback('valkey', 'postgres', error instanceof Error ? error.message : String(error))
      metrics.recordRolloutRequest('postgres', true)
      metrics.incrementBackendFailure()
      return this.postgres.getSessionByTokenHash(tokenHash)
    }
  }

  async consumeSession(sessionId: string): Promise<DeliverySessionData | null> {
    const tracer = getCurrentTracer()
    const identifier = `delivery:consume:${sessionId}`
    const backend = selectCanaryBackend(identifier, this.canaryPercentage)
    tracer.adapter('valkey_canary', backend)

    if (backend === 'postgres') {
      return this.runWithShadow(identifier, 'postgres', 'valkey', {
        authoritative: () => this.postgres.consumeSession(sessionId),
        shadow: () => this.valkey.consumeSession(sessionId),
      })
    }

    const metrics = getDeliverySessionMetricsService()
    metrics.recordRolloutRequest('valkey')

    try {
      const result = await this.valkey.consumeSession(sessionId)
      if (result) {
        metrics.incrementConsumed()
      }
      return result
    } catch (error) {
      tracer.fallback('valkey', 'postgres', error instanceof Error ? error.message : String(error))
      metrics.recordRolloutRequest('postgres', true)
      metrics.incrementBackendFailure()
      const result = await this.postgres.consumeSession(sessionId)
      if (result) {
        metrics.incrementConsumed()
      }
      return result
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.postgres.deleteSession(sessionId)
  }

  private async runWithShadow(
    identifier: string,
    authoritativeBackend: DeliverySessionBackend,
    shadowBackend: DeliverySessionBackend,
    ops: {
      authoritative: () => Promise<DeliverySessionData | null>
      shadow: () => Promise<DeliverySessionData | null>
    }
  ): Promise<DeliverySessionData | null> {
    const metrics = getDeliverySessionMetricsService()
    metrics.recordRolloutRequest('postgres')

    const execution = await executeDeliverySessionShadow({
      context: {
        operation: 'get',
        authoritativeBackend,
        shadowBackend,
      },
      authoritative: ops.authoritative,
      shadow: ops.shadow,
    })

    metrics.recordLatency(shadowBackend, execution.comparison.shadowLatencyMs)

    if (execution.comparison.authoritativeError) {
      metrics.incrementBackendFailure()
    }

    if (execution.comparison.authoritativeData) {
      return execution.comparison.authoritativeData
    }

    throw new Error('Failed to execute delivery session operation')
  }
}

function selectCanaryBackend(identifier: string, canaryPercentage: number): DeliverySessionBackend {
  if (canaryPercentage <= 0) {
    return 'postgres'
  }
  if (canaryPercentage >= 100) {
    return 'valkey'
  }
  return stableCanaryBucket(identifier) < canaryPercentage ? 'valkey' : 'postgres'
}

function stableCanaryBucket(identifier: string): number {
  const hex = createHash('sha256').update(identifier).digest('hex').slice(0, 8)
  return Number.parseInt(hex, 16) % 100
}
