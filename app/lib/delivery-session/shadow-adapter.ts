import type { DeliverySessionAdapter, DeliverySessionData } from './types'
import { executeDeliverySessionShadow } from './shadow'
import { getDeliverySessionMetricsService } from './metrics-service'

export class ShadowDeliverySessionAdapter implements DeliverySessionAdapter {
  constructor(
    private readonly authoritative: DeliverySessionAdapter,
    private readonly shadow: DeliverySessionAdapter
  ) {}

  async createSession(params: {
    scriptId: string
    buildId: string
    tokenHash: string
    expiresAt: string
    eventSecret?: string | null
  }): Promise<DeliverySessionData> {
    const execution = await executeDeliverySessionShadow({
      context: {
        operation: 'create',
        authoritativeBackend: 'postgres',
        shadowBackend: 'valkey',
      },
      authoritative: () => this.authoritative.createSession(params),
      shadow: () => this.shadow.createSession(params),
    })

    const metrics = getDeliverySessionMetricsService()
    metrics.incrementCreated()
    metrics.recordLatency('postgres', execution.comparison.authoritativeLatencyMs)
    metrics.recordLatency('valkey', execution.comparison.shadowLatencyMs)

    if (!execution.result) {
      throw new Error('Failed to create delivery session')
    }

    return execution.result
  }

  async getSessionByTokenHash(tokenHash: string): Promise<DeliverySessionData | null> {
    const execution = await executeDeliverySessionShadow({
      context: {
        operation: 'get',
        authoritativeBackend: 'postgres',
        shadowBackend: 'valkey',
      },
      authoritative: () => this.authoritative.getSessionByTokenHash(tokenHash),
      shadow: () => this.shadow.getSessionByTokenHash(tokenHash),
    })

    const metrics = getDeliverySessionMetricsService()
    metrics.recordLatency('postgres', execution.comparison.authoritativeLatencyMs)
    metrics.recordLatency('valkey', execution.comparison.shadowLatencyMs)

    if (execution.comparison.authoritativeError) {
      metrics.incrementBackendFailure()
    }

    return execution.result
  }

  async consumeSession(sessionId: string): Promise<DeliverySessionData | null> {
    const execution = await executeDeliverySessionShadow({
      context: {
        operation: 'consume',
        authoritativeBackend: 'postgres',
        shadowBackend: 'valkey',
      },
      authoritative: () => this.authoritative.consumeSession(sessionId),
      shadow: () => this.shadow.consumeSession(sessionId),
    })

    const metrics = getDeliverySessionMetricsService()
    if (execution.result) {
      metrics.incrementConsumed()
    }
    metrics.recordLatency('postgres', execution.comparison.authoritativeLatencyMs)
    metrics.recordLatency('valkey', execution.comparison.shadowLatencyMs)

    if (execution.comparison.authoritativeError) {
      metrics.incrementBackendFailure()
    }

    return execution.result
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.authoritative.deleteSession(sessionId)
  }
}
