import type { EventLogRow, EventDeliveryStatus } from '@/app/lib/repositories/event-repository'
import {
  getPendingEvents,
  claimEventForProcessing,
  updateEventDeliveryStatus,
} from '@/app/lib/repositories/event-repository'
import { getEnabledWebhookConfigByScriptId } from '@/app/lib/repositories/webhook-config-repository'
import { recordWebhookCounter } from '@/app/lib/services/event-monitoring-service'

export type DeliveryProvider = {
  deliver(event: EventLogRow, webhookUrl: string): Promise<DeliveryResult>
}

export type ProviderResolver = (provider: string) => DeliveryProvider | null

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

const BACKOFF_SCHEDULE_MS: readonly number[] = [
  10_000,   // attempt 1: 10s
  30_000,   // attempt 2: 30s
  90_000,   // attempt 3: 90s
  270_000,  // attempt 4: 270s
  810_000,  // attempt 5: 810s
]

const MAX_RETRIES = 5
const BATCH_SIZE = 50

// ---------------------------------------------------------------------------
// Backoff
// ---------------------------------------------------------------------------

export function computeBackoffMs(retryCount: number): number {
  if (retryCount <= 0) return 0
  const idx = Math.min(retryCount - 1, BACKOFF_SCHEDULE_MS.length - 1)
  return BACKOFF_SCHEDULE_MS[idx]
}

export function isRetryDue(event: Pick<EventLogRow, 'retry_count' | 'last_retry_at' | 'received_at'>): boolean {
  if (event.retry_count === 0) return true // never attempted
  const backoffMs = computeBackoffMs(event.retry_count)
  const lastAttempt = event.last_retry_at
    ? new Date(event.last_retry_at).getTime()
    : new Date(event.received_at).getTime()
  return Date.now() - lastAttempt >= backoffMs
}

// ---------------------------------------------------------------------------
// Delivery attempt
// ---------------------------------------------------------------------------

async function attemptDelivery(
  event: EventLogRow,
  provider: DeliveryProvider,
  webhookUrl: string,
): Promise<{ status: EventDeliveryStatus; errorMessage?: string }> {
  try {
    const result = await provider.deliver(event, webhookUrl)

    if (result.success) {
      return { status: 'delivered' }
    }

    if (result.retryable && event.retry_count + 1 < MAX_RETRIES) {
      return { status: 'pending', errorMessage: result.error }
    }

    return { status: 'dead_letter', errorMessage: result.error }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown delivery error'
    if (event.retry_count + 1 < MAX_RETRIES) {
      return { status: 'pending', errorMessage: message }
    }
    return { status: 'dead_letter', errorMessage: message }
  }
}

// ---------------------------------------------------------------------------
// Queue processing
// ---------------------------------------------------------------------------
async function processClaimedEvent(
  event: EventLogRow,
  resolveProvider: ProviderResolver,
  stats: QueueBatchResult,
): Promise<void> {
  // Respect backoff schedule
  if (!isRetryDue(event)) {
    await updateEventDeliveryStatus({
      eventId: event.id,
      deliveryStatus: 'pending',
      retryCount: event.retry_count,
      lastRetryAt: event.last_retry_at,
      deliveredAt: event.delivered_at,
      errorMessage: event.error_message,
    })
    stats.skipped++
    return
  }

  // Look up webhook config for this script
  let config = null as { webhookUrl: string | null; provider: string } | null
  try {
    const row = await getEnabledWebhookConfigByScriptId(event.script_id)
    if (row) {
      config = {
        webhookUrl: (row.config as Record<string, unknown>)?.webhook_url as string | undefined ?? null,
        provider: row.provider,
      }
    }
  } catch {
    // Config lookup failed — treat as no config
  }

  if (!config || !config.webhookUrl) {
    // No enabled webhook configured — mark as delivered (no-op)
    await updateEventDeliveryStatus({
      eventId: event.id,
      deliveryStatus: 'delivered',
      deliveredAt: new Date().toISOString(),
      lastRetryAt: new Date().toISOString(),
    })
    stats.delivered++
    stats.processed++
    return
  }

  const provider = resolveProvider(config.provider)
  if (!provider) {
    // Unknown provider type → permanent failure, dead-letter
    await updateEventDeliveryStatus({
      eventId: event.id,
      deliveryStatus: 'dead_letter',
      retryCount: event.retry_count + 1,
      lastRetryAt: new Date().toISOString(),
      errorMessage: `Unknown provider: ${config.provider}`,
    })
    stats.deadLettered++
    stats.processed++
    return
  }

  const result = await attemptDelivery(event, provider, config.webhookUrl)

  stats.processed++

  if (result.status === 'delivered') {
    await updateEventDeliveryStatus({
      eventId: event.id,
      deliveryStatus: 'delivered',
      deliveredAt: new Date().toISOString(),
      retryCount: event.retry_count + 1,
      lastRetryAt: new Date().toISOString(),
      errorMessage: null,
    })
    stats.delivered++
    recordWebhookCounter('webhook.delivery_success', `event:${event.id}`)
  } else if (result.status === 'pending') {
    await updateEventDeliveryStatus({
      eventId: event.id,
      deliveryStatus: 'pending',
      retryCount: event.retry_count + 1,
      lastRetryAt: new Date().toISOString(),
      errorMessage: result.errorMessage ?? null,
    })
    stats.failed++
    recordWebhookCounter('webhook.delivery_failure', `event:${event.id}`)
  } else {
    await updateEventDeliveryStatus({
      eventId: event.id,
      deliveryStatus: 'dead_letter',
      retryCount: event.retry_count + 1,
      lastRetryAt: new Date().toISOString(),
      errorMessage: result.errorMessage ?? null,
    })
    stats.deadLettered++
    recordWebhookCounter('webhook.provider_failure', `event:${event.id}`)
  }
}

export async function processSingleEvent(
  eventId: string,
  resolveProvider: ProviderResolver,
): Promise<QueueBatchResult> {
  const stats: QueueBatchResult = {
    processed: 0,
    delivered: 0,
    failed: 0,
    deadLettered: 0,
    skipped: 0,
  }

  const event = await claimEventForProcessing(eventId)
  if (!event) {
    stats.skipped++
    return stats
  }

  await processClaimedEvent(event, resolveProvider, stats)
  return stats
}

export async function processEventQueue(
  resolveProvider: ProviderResolver,
  batchSize: number = BATCH_SIZE,
): Promise<QueueBatchResult> {
  const events = await getPendingEvents(batchSize)

  const stats: QueueBatchResult = {
    processed: 0,
    delivered: 0,
    failed: 0,
    deadLettered: 0,
    skipped: 0,
  }

  for (const candidate of events) {
    const event = await claimEventForProcessing(candidate.id)
    if (!event) {
      stats.skipped++
      continue
    }

    await processClaimedEvent(event, resolveProvider, stats)
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
    lastRetryAt: null,
    deliveredAt: null,
    errorMessage: null,
  })
}
