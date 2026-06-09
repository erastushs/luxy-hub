import type { EventLogRow, EventDeliveryStatus } from '@/app/lib/repositories/event-repository'
import {
  getPendingEvents,
  updateEventDeliveryStatus,
} from '@/app/lib/repositories/event-repository'
import { getEnabledWebhookConfigByScriptId } from '@/app/lib/repositories/webhook-config-repository'

export type DeliveryProvider = {
  deliver(event: EventLogRow, webhookUrl: string): Promise<DeliveryResult>
}

export type DeliveryResult = {
  success: boolean
  retryable: boolean
  messageId?: string
  error?: string
}

export type QueueBatchResult = {
  processed: number
  delivered: number
  failed: number
  deadLettered: number
  skipped: number
}

// ---------------------------------------------------------------------------
// Backoff
// ---------------------------------------------------------------------------

const BACKOFF_SCHEDULE_MS: readonly number[] = [10_000, 30_000, 90_000, 270_000, 810_000]

const MAX_RETRIES = 5
const BATCH_SIZE = 50

export function computeBackoffMs(retryCount: number): number {
  if (retryCount < 1) return 0
  const index = Math.min(retryCount - 1, BACKOFF_SCHEDULE_MS.length - 1)
  return BACKOFF_SCHEDULE_MS[index]
}

export function isRetryDue(event: Pick<EventLogRow, 'retry_count' | 'last_retry_at' | 'received_at'>): boolean {
  if (event.retry_count === 0) return true
  const backoffMs = computeBackoffMs(event.retry_count)
  const lastAttempt = event.last_retry_at ?? event.received_at
  const elapsed = Date.now() - new Date(lastAttempt).getTime()
  return elapsed >= backoffMs
}

// ---------------------------------------------------------------------------
// Delivery attempt
// ---------------------------------------------------------------------------

async function attemptDelivery(
  event: EventLogRow,
  provider: DeliveryProvider,
  webhookUrl: string,
): Promise<{ status: EventDeliveryStatus; errorMessage?: string }> {
  let result: DeliveryResult
  try {
    result = await provider.deliver(event, webhookUrl)
  } catch (err) {
    result = {
      success: false,
      retryable: true,
      error: err instanceof Error ? err.message : 'Delivery error',
    }
  }

  if (result.success) {
    return { status: 'delivered' }
  }

  if (result.retryable) {
    return { status: 'pending', errorMessage: result.error }
  }

  return { status: 'dead_letter', errorMessage: result.error }
}

// ---------------------------------------------------------------------------
// Queue processing
// ---------------------------------------------------------------------------

export async function processEventQueue(
  provider: DeliveryProvider,
  batchSize: number = BATCH_SIZE,
): Promise<QueueBatchResult> {
  const events = await getPendingEvents(batchSize)

  const stats: QueueBatchResult = {
    processed: events.length,
    delivered: 0,
    failed: 0,
    deadLettered: 0,
    skipped: 0,
  }

  for (const event of events) {
    if (!isRetryDue(event)) {
      stats.skipped++
      continue
    }

    const config = await getEnabledWebhookConfigByScriptId(event.script_id)

    if (!config) {
      await updateEventDeliveryStatus({
        eventId: event.id,
        deliveryStatus: 'delivered',
      })
      stats.delivered++
      continue
    }

    const webhookUrl = config.config?.webhook_url
    if (!webhookUrl || typeof webhookUrl !== 'string') {
      await updateEventDeliveryStatus({
        eventId: event.id,
        deliveryStatus: 'delivered',
      })
      stats.delivered++
      continue
    }

    const { status, errorMessage } = await attemptDelivery(event, provider, webhookUrl)

    if (status === 'delivered') {
      await updateEventDeliveryStatus({
        eventId: event.id,
        deliveryStatus: 'delivered',
      })
      stats.delivered++
      continue
    }

    const nextRetryCount = event.retry_count + 1

    if (status === 'dead_letter') {
      await updateEventDeliveryStatus({
        eventId: event.id,
        deliveryStatus: 'dead_letter',
        retryCount: nextRetryCount,
        errorMessage,
      })
      stats.deadLettered++
      continue
    }

    // status === 'pending' — retryable failure
    if (nextRetryCount >= MAX_RETRIES) {
      await updateEventDeliveryStatus({
        eventId: event.id,
        deliveryStatus: 'dead_letter',
        retryCount: nextRetryCount,
        errorMessage: errorMessage ?? 'Max retries exhausted',
      })
      stats.deadLettered++
      continue
    }

    await updateEventDeliveryStatus({
      eventId: event.id,
      deliveryStatus: 'pending',
      retryCount: nextRetryCount,
      errorMessage,
    })
    stats.failed++
  }

  return stats
}

// ---------------------------------------------------------------------------
// Dead-letter management
// ---------------------------------------------------------------------------

export async function replayDeadLetterEvent(eventId: string): Promise<EventLogRow | null> {
  return updateEventDeliveryStatus({
    eventId,
    deliveryStatus: 'pending',
    retryCount: 0,
    errorMessage: null,
    lastRetryAt: null,
    deliveredAt: null,
  })
}
