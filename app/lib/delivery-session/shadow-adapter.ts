import type { DeliverySessionAdapter, DeliverySessionData, CreateDeliverySessionParams } from './types'
import { executeDeliverySessionShadow } from './shadow'
import { getDeliverySessionMetricsService } from './metrics-service'
import { getCurrentTracer } from './trace'

export class ShadowDeliverySessionAdapter implements DeliverySessionAdapter {
  constructor(
    private readonly authoritative: DeliverySessionAdapter,
    private readonly shadow: DeliverySessionAdapter
  ) {}

  async createSession(params: CreateDeliverySessionParams): Promise<DeliverySessionData> {
    const tracer = getCurrentTracer()
    tracer.adapter('shadow')

    const authStart = Date.now()
    const authoritativeData = await this.authoritative.createSession(params)
    const authLatencyMs = Date.now() - authStart

    const execution = await executeDeliverySessionShadow({
      context: {
        operation: 'create',
        authoritativeBackend: 'postgres',
        shadowBackend: 'valkey',
      },
      authoritative: () => Promise.resolve(authoritativeData),
      shadow: () => this.shadow.createSession({ ...params, id: authoritativeData.id }),
      preResolvedAuthoritative: {
        backend: 'postgres',
        data: authoritativeData,
        latencyMs: authLatencyMs,
        error: null,
      },
    })

    const metrics = getDeliverySessionMetricsService()
    metrics.incrementCreated()
    metrics.recordLatency('postgres', execution.comparison.authoritativeLatencyMs)
    metrics.recordLatency('valkey', execution.comparison.shadowLatencyMs)
    metrics.recordComparison({
      operation: 'create',
      identical: execution.comparison.parity,
    })

    const comparisonLabel = execution.comparison.parity ? 'identical' : execution.comparison.mismatchReason ?? 'unknown'
    tracer.shadow('postgres', 'valkey', comparisonLabel, 'create', execution.comparison.mismatchFields)

    if (!execution.result) {
      throw new Error('Failed to create delivery session')
    }

    return execution.result
  }

  async getSessionByTokenHash(tokenHash: string): Promise<DeliverySessionData | null> {
    const tracer = getCurrentTracer()
    tracer.adapter('shadow')

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
    metrics.recordComparison({
      operation: 'lookup',
      identical: execution.comparison.parity,
    })

    const comparisonLabel = execution.comparison.parity ? 'identical' : execution.comparison.mismatchReason ?? 'unknown'
    tracer.shadow('postgres', 'valkey', comparisonLabel, 'lookup', execution.comparison.mismatchFields)

    if (execution.comparison.authoritativeError) {
      metrics.incrementBackendFailure()
    }

    return execution.result
  }

  async consumeSession(sessionId: string): Promise<DeliverySessionData | null> {
    const tracer = getCurrentTracer()
    tracer.adapter('shadow')

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
    metrics.recordComparison({
      operation: 'consume',
      identical: execution.comparison.parity,
    })

    const comparisonLabel = execution.comparison.parity ? 'identical' : execution.comparison.mismatchReason ?? 'unknown'
    tracer.shadow('postgres', 'valkey', comparisonLabel, 'consume', execution.comparison.mismatchFields)

    if (execution.comparison.authoritativeError) {
      metrics.incrementBackendFailure()
    }

    return execution.result
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.authoritative.deleteSession(sessionId)
  }
}
