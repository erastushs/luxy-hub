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

export async function getPendingEvents(limit: number = 50): Promise<EventLogRow[]> {
  const { data, error } = await supabaseAdmin
    .from('event_logs')
    .select(EVENT_LOG_SELECT)
    .eq('delivery_status', 'pending')
    .order('received_at', { ascending: true })
    .limit(limit)

  if (error) throw error
  return (data as unknown as EventLogRow[]) ?? []
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
