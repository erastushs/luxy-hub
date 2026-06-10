import { supabaseAdmin } from '@/app/lib/supabase'

export type SecurityMetric =
  | 'event.invalid_signature'
  | 'event.replay_attempt'
  | 'event.rate_limited'
  | 'event.auth_failure'

export type WebhookMetric =
  | 'webhook.delivery_success'
  | 'webhook.delivery_failure'
  | 'webhook.provider_failure'

export type QueueSnapshot = {
  pendingCount: number
  deadLetterCount: number
  oldestPendingAgeSeconds: number | null
}

function recordCounter(event: string, message?: string): void {
  supabaseAdmin
    .from('verification_logs')
    .insert({
      event,
      message: message ?? null,
      created_at: new Date().toISOString(),
    })
    .then(undefined, () => undefined)
}

export function recordSecurityCounter(metric: SecurityMetric, message?: string): void {
  recordCounter(metric, message)
}

export function recordWebhookCounter(metric: WebhookMetric, message?: string): void {
  recordCounter(metric, message)
}

export async function getQueueSnapshot(): Promise<QueueSnapshot> {
  const [{ count: pendingCount }, { count: deadLetterCount }, { data: oldestPending }] = await Promise.all([
    supabaseAdmin
      .from('event_logs')
      .select('id', { count: 'exact', head: true })
      .eq('delivery_status', 'pending'),
    supabaseAdmin
      .from('event_logs')
      .select('id', { count: 'exact', head: true })
      .eq('delivery_status', 'dead_letter'),
    supabaseAdmin
      .from('event_logs')
      .select('received_at')
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
