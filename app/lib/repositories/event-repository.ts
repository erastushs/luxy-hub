import { supabaseAdmin } from '@/app/lib/supabase'

export type EventType =
  | 'execute'
  | 'purchase'
  | 'error'
  | 'ban'
  | 'key_redeem'
  | 'heartbeat'
  | 'license_activate'
  | 'license_revoke'

export type EventDeliveryStatus = 'pending' | 'delivered' | 'dead_letter'

export type EventLogRow = {
  id: string
  script_id: string
  session_id: string | null
  event_type: EventType
  payload: Record<string, unknown>
  delivery_status: EventDeliveryStatus
  retry_count: number
  timestamp: string
  received_at: string
  nonce: string
  last_retry_at: string | null
  delivered_at: string | null
  error_message: string | null
  claimed_at: string | null
  created_at: string
}

export const ALLOWED_EVENT_TYPES: readonly EventType[] = [
  'execute',
  'purchase',
  'error',
  'ban',
  'key_redeem',
  'heartbeat',
  'license_activate',
  'license_revoke',
] as const

export function isValidEventType(value: string): value is EventType {
  return (ALLOWED_EVENT_TYPES as readonly string[]).includes(value)
}

const EVENT_LOG_SELECT = [
  'id',
  'script_id',
  'session_id',
  'event_type',
  'payload',
  'delivery_status',
  'retry_count',
  'timestamp',
  'received_at',
  'nonce',
  'last_retry_at',
  'delivered_at',
  'error_message',
  'claimed_at',
  'created_at',
].join(', ')

export async function createEventLog(params: {
  scriptId: string
  sessionId: string
  eventType: EventType
  payload: Record<string, unknown>
  timestamp: string
  nonce: string
}): Promise<EventLogRow> {
  const { data, error } = await supabaseAdmin
    .from('event_logs')
    .insert({
      script_id: params.scriptId,
      session_id: params.sessionId,
      event_type: params.eventType,
      payload: params.payload,
      timestamp: params.timestamp,
      nonce: params.nonce,
    })
    .select(EVENT_LOG_SELECT)
    .single()

  if (error) throw error
  return data as unknown as EventLogRow
}

export async function getEventLog(id: string): Promise<EventLogRow | null> {
  const { data, error } = await supabaseAdmin
    .from('event_logs')
    .select(EVENT_LOG_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data as unknown as EventLogRow | null
}

export async function findEventByNonce(sessionId: string, nonce: string): Promise<EventLogRow | null> {
  const { data, error } = await supabaseAdmin
    .from('event_logs')
    .select(EVENT_LOG_SELECT)
    .eq('session_id', sessionId)
    .eq('nonce', nonce)
    .maybeSingle()

  if (error) throw error
  return data as unknown as EventLogRow | null
}

export async function getPendingEvents(limit: number = 50, leaseExpiredBefore: Date = new Date(Date.now() - 15 * 60 * 1000)): Promise<EventLogRow[]> {
  const { data, error } = await supabaseAdmin
    .from('event_logs')
    .select(EVENT_LOG_SELECT)
    .eq('delivery_status', 'pending')
    .or(`claimed_at.is.null,claimed_at.lt.${leaseExpiredBefore.toISOString()}`)
    .order('received_at', { ascending: true })
    .limit(limit)

  if (error) throw error
  return (data as unknown as EventLogRow[]) ?? []
}

export async function claimEventForProcessing(eventId: string, leaseExpiredBefore: Date = new Date(Date.now() - 15 * 60 * 1000)): Promise<EventLogRow | null> {
  const { data, error } = await supabaseAdmin
    .from('event_logs')
    .update({ claimed_at: new Date().toISOString() })
    .eq('id', eventId)
    .eq('delivery_status', 'pending')
    .or(`claimed_at.is.null,claimed_at.lt.${leaseExpiredBefore.toISOString()}`)
    .select(EVENT_LOG_SELECT)
    .single()

  if (error) return null
  return data as unknown as EventLogRow
}

export async function getEventsByScriptId(
  scriptId: string,
  options?: {
    eventType?: EventType
    deliveryStatus?: EventDeliveryStatus
    limit?: number
    offset?: number
  }
): Promise<EventLogRow[]> {
  let query = supabaseAdmin
    .from('event_logs')
    .select(EVENT_LOG_SELECT)
    .eq('script_id', scriptId)

  if (options?.eventType !== undefined) {
    query = query.eq('event_type', options.eventType)
  }
  if (options?.deliveryStatus !== undefined) {
    query = query.eq('delivery_status', options.deliveryStatus)
  }

  query = query.order('received_at', { ascending: false })

  if (options?.limit !== undefined) {
    query = query.limit(options.limit)
  }
  if (options?.offset !== undefined) {
    query = query.range(options.offset, options.offset + (options.limit ?? 20) - 1)
  }

  const { data, error } = await query

  if (error) throw error
  return (data as unknown as EventLogRow[]) ?? []
}

export async function countEventsByScriptId(
  scriptId: string,
  options?: {
    eventType?: EventType
    deliveryStatus?: EventDeliveryStatus
  }
): Promise<number> {
  let query = supabaseAdmin
    .from('event_logs')
    .select('*', { count: 'exact', head: true })
    .eq('script_id', scriptId)

  if (options?.eventType !== undefined) {
    query = query.eq('event_type', options.eventType)
  }
  if (options?.deliveryStatus !== undefined) {
    query = query.eq('delivery_status', options.deliveryStatus)
  }

  const { count, error } = await query

  if (error) throw error
  return count ?? 0
}

export async function updateEventDeliveryStatus(params: {
  eventId: string
  deliveryStatus: EventDeliveryStatus
  retryCount?: number
  lastRetryAt?: string | null
  deliveredAt?: string | null
  errorMessage?: string | null
}): Promise<EventLogRow | null> {
  const updates: Record<string, unknown> = {
    delivery_status: params.deliveryStatus,
    claimed_at: null,
  }

  if (params.retryCount !== undefined) updates.retry_count = params.retryCount
  if (params.lastRetryAt !== undefined) updates.last_retry_at = params.lastRetryAt
  if (params.deliveredAt !== undefined) updates.delivered_at = params.deliveredAt
  if (params.errorMessage !== undefined) updates.error_message = params.errorMessage

  const { data, error } = await supabaseAdmin
    .from('event_logs')
    .update(updates)
    .eq('id', params.eventId)
    .select(EVENT_LOG_SELECT)
    .single()

  if (error) return null
  return data as unknown as EventLogRow
}

export async function deleteDeliveredEventsBefore(before: Date): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('event_logs')
    .delete({ count: 'exact' })
    .eq('delivery_status', 'delivered')
    .lt('created_at', before.toISOString())

  if (error) throw error
  return count ?? 0
}

export async function deleteDeadLetterEventsBefore(before: Date): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('event_logs')
    .delete({ count: 'exact' })
    .eq('delivery_status', 'dead_letter')
    .lt('created_at', before.toISOString())

  if (error) throw error
  return count ?? 0
}

export async function deletePendingEventsBefore(before: Date): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('event_logs')
    .delete({ count: 'exact' })
    .eq('delivery_status', 'pending')
    .lt('created_at', before.toISOString())

  if (error) throw error
  return count ?? 0
}

// ---------------------------------------------------------------------------
// Analytics: event type counts within a time range
// ---------------------------------------------------------------------------

export type EventTypeCount = {
  event_type: EventType
  delivery_status: EventDeliveryStatus
  count: number
}

export async function getEventTypeCountsByScriptId(
  scriptId: string,
  since?: Date,
): Promise<EventTypeCount[]> {
  let query = supabaseAdmin
    .from('event_logs')
    .select('event_type, delivery_status')
    .eq('script_id', scriptId)

  if (since !== undefined) {
    query = query.gte('received_at', since.toISOString())
  }

  const { data, error } = await query

  if (error) throw error
  if (!data) return []

  const counts = new Map<string, number>()
  for (const row of data as { event_type: string; delivery_status: string }[]) {
    const key = `${row.event_type}:${row.delivery_status}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const result: EventTypeCount[] = []
  for (const [key, count] of counts) {
    const [event_type, delivery_status] = key.split(':') as [EventType, EventDeliveryStatus]
    result.push({ event_type, delivery_status, count })
  }

  return result
}

// ---------------------------------------------------------------------------
// Analytics: last delivery timestamp for a script
// ---------------------------------------------------------------------------

export async function getLastDeliveryTimestamp(scriptId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('event_logs')
    .select('delivered_at')
    .eq('script_id', scriptId)
    .eq('delivery_status', 'delivered')
    .order('delivered_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as { delivered_at: string | null } | null)?.delivered_at ?? null
}

// ---------------------------------------------------------------------------
// Analytics: per-script queue health snapshot
// ---------------------------------------------------------------------------

export type ScriptQueueSnapshot = {
  pendingCount: number
  deadLetterCount: number
  oldestPendingAgeSeconds: number | null
}

export async function getScriptQueueSnapshot(scriptId: string): Promise<ScriptQueueSnapshot> {
  const [{ count: pendingCount }, { count: deadLetterCount }, { data: oldestPending }] = await Promise.all([
    supabaseAdmin
      .from('event_logs')
      .select('id', { count: 'exact', head: true })
      .eq('script_id', scriptId)
      .eq('delivery_status', 'pending'),
    supabaseAdmin
      .from('event_logs')
      .select('id', { count: 'exact', head: true })
      .eq('script_id', scriptId)
      .eq('delivery_status', 'dead_letter'),
    supabaseAdmin
      .from('event_logs')
      .select('received_at')
      .eq('script_id', scriptId)
      .eq('delivery_status', 'pending')
      .order('received_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const receivedAt = (oldestPending as { received_at?: string } | null)?.received_at
  const oldestPendingAgeSeconds = receivedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(receivedAt).getTime()) / 1000))
    : null

  return {
    pendingCount: pendingCount ?? 0,
    deadLetterCount: deadLetterCount ?? 0,
    oldestPendingAgeSeconds,
  }
}
