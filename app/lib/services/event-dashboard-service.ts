import { getOwnedScript } from '@/app/lib/auth/ownership'
import {
  getEventsByScriptId,
  countEventsByScriptId,
  getEventLog,
  type EventLogRow,
  type EventType,
  type EventDeliveryStatus,
} from '@/app/lib/repositories/event-repository'
import { getWebhookConfigByScriptId } from '@/app/lib/repositories/webhook-config-repository'
import { replayDeadLetterEvent } from '@/app/lib/services/event-queue-service'

// ---------------------------------------------------------------------------
// Safe Event DTO — never leaks cryptographic material or session IDs
// ---------------------------------------------------------------------------

export type EventDashboardDTO = {
  id: string
  scriptId: string
  eventType: string
  payload: Record<string, unknown> | null
  deliveryStatus: string
  retryCount: number
  provider: string | null
  timestamp: string
  receivedAt: string
  lastRetryAt: string | null
  deliveredAt: string | null
  errorMessage: string | null
  createdAt: string
}

function toSafeEventDTO(
  row: EventLogRow,
  provider: string | null,
  includePayload: boolean,
): EventDashboardDTO {
  return {
    id: row.id,
    scriptId: row.script_id,
    eventType: row.event_type,
    payload: includePayload ? row.payload : null,
    deliveryStatus: row.delivery_status,
    retryCount: row.retry_count,
    provider,
    timestamp: row.timestamp,
    receivedAt: row.received_at,
    lastRetryAt: row.last_retry_at,
    deliveredAt: row.delivered_at,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  }
}

// ---------------------------------------------------------------------------
// Service result types
// ---------------------------------------------------------------------------

export type EventListResult<T = EventDashboardDTO[]> =
  | { success: true; events: T; total: number; page: number; pageSize: number }
  | { success: false; message: string; status: number }

export type EventDetailResult =
  | { success: true; event: EventDashboardDTO }
  | { success: false; message: string; status: number }

export type ReplayResult =
  | { success: true; message: string; replayed: number; remaining?: number }
  | { success: false; message: string; status: number }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveOwnedScript(slug: string, userId: string): Promise<{ id: string } | null> {
  const script = await getOwnedScript(slug, userId)
  if (!script) return null
  return { id: script.id }
}

async function getProviderForScript(scriptId: string): Promise<string | null> {
  try {
    const config = await getWebhookConfigByScriptId(scriptId)
    return config?.provider ?? null
  } catch {
    return null
  }
}

const DEFAULT_PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// Event history (paginated, filterable, ownership-enforced via slug)
// ---------------------------------------------------------------------------

export async function getEventHistory(
  slug: string,
  userId: string,
  options?: {
    eventType?: EventType
    deliveryStatus?: EventDeliveryStatus
    page?: number
    pageSize?: number
  },
): Promise<EventListResult> {
  const script = await resolveOwnedScript(slug, userId)
  if (!script) {
    return { success: false, message: 'Script not found', status: 404 }
  }

  const page = Math.max(1, options?.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, options?.pageSize ?? DEFAULT_PAGE_SIZE))
  const offset = (page - 1) * pageSize

  const provider = await getProviderForScript(script.id)

  const [events, total] = await Promise.all([
    getEventsByScriptId(script.id, {
      eventType: options?.eventType,
      deliveryStatus: options?.deliveryStatus,
      limit: pageSize,
      offset,
    }),
    countEventsByScriptId(script.id, {
      eventType: options?.eventType,
      deliveryStatus: options?.deliveryStatus,
    }),
  ])

  const dtos = events.map((row) => toSafeEventDTO(row, provider, false))

  return {
    success: true,
    events: dtos,
    total,
    page,
    pageSize,
  }
}

// ---------------------------------------------------------------------------
// Event detail (single event, ownership-enforced via slug)
// ---------------------------------------------------------------------------

export async function getEventDetail(
  slug: string,
  userId: string,
  eventId: string,
): Promise<EventDetailResult> {
  const script = await resolveOwnedScript(slug, userId)
  if (!script) {
    return { success: false, message: 'Script not found', status: 404 }
  }

  const event = await getEventLog(eventId)
  if (!event) {
    return { success: false, message: 'Event not found', status: 404 }
  }

  // Ownership: event must belong to the owned script
  if (event.script_id !== script.id) {
    return { success: false, message: 'Event not found', status: 404 }
  }

  const provider = await getProviderForScript(script.id)

  return {
    success: true,
    event: toSafeEventDTO(event, provider, true),
  }
}

// ---------------------------------------------------------------------------
// Dead-letter listing (paginated, ownership-enforced via slug)
// ---------------------------------------------------------------------------

export async function getDeadLetters(
  slug: string,
  userId: string,
  options?: {
    page?: number
    pageSize?: number
  },
): Promise<EventListResult> {
  const script = await resolveOwnedScript(slug, userId)
  if (!script) {
    return { success: false, message: 'Script not found', status: 404 }
  }

  const page = Math.max(1, options?.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, options?.pageSize ?? DEFAULT_PAGE_SIZE))
  const offset = (page - 1) * pageSize

  const provider = await getProviderForScript(script.id)

  const [events, total] = await Promise.all([
    getEventsByScriptId(script.id, {
      deliveryStatus: 'dead_letter',
      limit: pageSize,
      offset,
    }),
    countEventsByScriptId(script.id, {
      deliveryStatus: 'dead_letter',
    }),
  ])

  const dtos = events.map((row) => toSafeEventDTO(row, provider, false))

  return {
    success: true,
    events: dtos,
    total,
    page,
    pageSize,
  }
}

// ---------------------------------------------------------------------------
// Replay single dead-letter event (ownership-enforced via slug)
// ---------------------------------------------------------------------------

export async function replayEvent(
  slug: string,
  userId: string,
  eventId: string,
): Promise<ReplayResult> {
  const script = await resolveOwnedScript(slug, userId)
  if (!script) {
    return { success: false, message: 'Script not found', status: 404 }
  }

  const event = await getEventLog(eventId)
  if (!event) {
    return { success: false, message: 'Event not found', status: 404 }
  }

  if (event.script_id !== script.id) {
    return { success: false, message: 'Event not found', status: 404 }
  }

  if (event.delivery_status !== 'dead_letter') {
    return { success: false, message: 'Only dead-letter events can be replayed', status: 400 }
  }

  const replayed = await replayDeadLetterEvent(eventId)
  if (!replayed) {
    return { success: false, message: 'Failed to replay event', status: 500 }
  }

  return { success: true, message: 'Event queued for redelivery', replayed: 1 }
}


/** Maximum number of dead-letter events replayed in a single bulk operation. */
const BULK_REPLAY_CAP = 100

// ---------------------------------------------------------------------------
// Replay all dead-letter events for a script (ownership-enforced via slug)
// ---------------------------------------------------------------------------

export async function replayAllDeadLetters(
  slug: string,
  userId: string,
): Promise<ReplayResult> {
  const script = await resolveOwnedScript(slug, userId)
  if (!script) {
    return { success: false, message: 'Script not found', status: 404 }
  }

  const deadLetters = await getEventsByScriptId(script.id, {
    deliveryStatus: 'dead_letter',
  })

  if (deadLetters.length === 0) {
    return { success: false, message: 'No dead-letter events to replay', status: 400 }
  }

  const toReplay = deadLetters.slice(0, BULK_REPLAY_CAP)
  const remaining = deadLetters.length - toReplay.length

  let replayed = 0
  for (const event of toReplay) {
    const result = await replayDeadLetterEvent(event.id)
    if (result) replayed++
  }

  const message = remaining > 0
    ? `${replayed} replayed, ${remaining} remaining`
    : `${replayed} of ${deadLetters.length} dead-letter events replayed`

  return {
    success: true,
    message,
    replayed,
    ...(remaining > 0 ? { remaining } : {}),
  }
}

