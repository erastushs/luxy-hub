import { supabaseAdmin } from '@/app/lib/supabase'
import { getQueueSnapshot } from '@/app/lib/services/event-monitoring-service'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const ALERT_TYPES = [
  'queue_backlog_spike',
  'dead_letter_spike',
  'invalid_signature_spike',
  'replay_attack_spike',
  'webhook_failure_burst',
  'auth_failure_spike',
] as const

export type AlertType = (typeof ALERT_TYPES)[number]

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'

export type AlertStatus = 'active' | 'resolved'

export type AlertThresholdConfig = {
  value: number
  severity: AlertSeverity
}

const ALERT_THRESHOLDS: Record<AlertType, AlertThresholdConfig[]> = {
  queue_backlog_spike: [
    { value: 5000, severity: 'critical' },
    { value: 1000, severity: 'high' },
    { value: 500, severity: 'medium' },
    { value: 100, severity: 'low' },
  ],
  dead_letter_spike: [
    { value: 500, severity: 'critical' },
    { value: 100, severity: 'high' },
    { value: 50, severity: 'medium' },
    { value: 10, severity: 'low' },
  ],
  invalid_signature_spike: [
    { value: 500, severity: 'critical' },
    { value: 100, severity: 'high' },
    { value: 50, severity: 'medium' },
    { value: 20, severity: 'low' },
  ],
  replay_attack_spike: [
    { value: 100, severity: 'critical' },
    { value: 50, severity: 'high' },
    { value: 10, severity: 'medium' },
    { value: 5, severity: 'low' },
  ],
  webhook_failure_burst: [
    { value: 500, severity: 'critical' },
    { value: 100, severity: 'high' },
    { value: 30, severity: 'medium' },
    { value: 10, severity: 'low' },
  ],
  auth_failure_spike: [
    { value: 1000, severity: 'critical' },
    { value: 500, severity: 'high' },
    { value: 100, severity: 'medium' },
    { value: 30, severity: 'low' },
  ],
}

// ---------------------------------------------------------------------------
// Safe DTOs — never expose secrets, webhooks, sessions
// ---------------------------------------------------------------------------

export type AlertEventDTO = {
  id: string
  alertType: AlertType
  severity: AlertSeverity
  status: AlertStatus
  currentValue: number
  thresholdValue: number
  message: string
  createdAt: string
  resolvedAt: string | null
}

export type AlertDashboardDTO = {
  activeAlerts: AlertEventDTO[]
  resolvedAlerts: AlertEventDTO[]
  totalActive: number
  totalResolved: number
  page: number
  pageSize: number
  totalPages: number
}

// ---------------------------------------------------------------------------
// Label & description helpers
// ---------------------------------------------------------------------------

const ALERT_LABELS: Record<AlertType, string> = {
  queue_backlog_spike: 'Queue Backlog Spike',
  dead_letter_spike: 'Dead Letter Spike',
  invalid_signature_spike: 'Invalid Signature Spike',
  replay_attack_spike: 'Replay Attack Spike',
  webhook_failure_burst: 'Webhook Failure Burst',
  auth_failure_spike: 'Auth Failure Spike',
}

// ---------------------------------------------------------------------------
// Threshold evaluation (pure function)
// ---------------------------------------------------------------------------

type ThresholdEvaluation = {
  alertType: AlertType
  currentValue: number
  thresholdValue: number
  severity: AlertSeverity
}

// Exported for testing
export function evaluateThresholds(
  currentValues: Record<AlertType, number>,
): ThresholdEvaluation[] {
  const evaluations: ThresholdEvaluation[] = []

  for (const alertType of ALERT_TYPES) {
    const value = currentValues[alertType]
    const config = ALERT_THRESHOLDS[alertType]

    const exceeded = config
      .filter(t => value >= t.value)
      .sort((a, b) => b.value - a.value)

    if (exceeded.length > 0) {
      evaluations.push({
        alertType,
        currentValue: value,
        thresholdValue: exceeded[0].value,
        severity: exceeded[0].severity,
      })
    }
  }

  return evaluations
}

// ---------------------------------------------------------------------------
// Count helper (reuses verification_logs pattern)
// ---------------------------------------------------------------------------

async function countMetric(event: string, since: Date): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('verification_logs')
    .select('id', { count: 'exact', head: true })
    .eq('event', event)
    .gte('created_at', since.toISOString())

  if (error) return 0
  return count ?? 0
}

// ---------------------------------------------------------------------------
// Get current monitoring values
// ---------------------------------------------------------------------------

async function getCurrentValues(): Promise<Record<AlertType, number>> {
  const now = new Date()
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const [
    invalidSignatureCount,
    replayAttemptCount,
    authFailureCount,
    webhookFailureCount,
    queueSnapshot,
  ] = await Promise.all([
    countMetric('event.invalid_signature', since24h),
    countMetric('event.replay_attempt', since24h),
    countMetric('event.auth_failure', since24h),
    countMetric('webhook.provider_failure', since24h),
    getQueueSnapshot(),
  ])

  return {
    queue_backlog_spike: queueSnapshot.pendingCount,
    dead_letter_spike: queueSnapshot.deadLetterCount,
    invalid_signature_spike: invalidSignatureCount,
    replay_attack_spike: replayAttemptCount,
    webhook_failure_burst: webhookFailureCount,
    auth_failure_spike: authFailureCount,
  }
}

// ---------------------------------------------------------------------------
// Active alert check (dedup)
// ---------------------------------------------------------------------------

async function getActiveAlertOfType(alertType: AlertType): Promise<{ id: string } | null> {
  const { data, error } = await supabaseAdmin
    .from('alert_events')
    .select('id')
    .eq('alert_type', alertType)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (error) return null
  return data as { id: string } | null
}

// ---------------------------------------------------------------------------
// Discord notification (internal only, no secrets exposed)
// ---------------------------------------------------------------------------

async function notifyDiscord(alert: ThresholdEvaluation, alertId: string): Promise<void> {
  const webhookUrl = process.env.INTERNAL_ALERT_DISCORD_WEBHOOK
  if (!webhookUrl) return

  const label = ALERT_LABELS[alert.alertType]
  const color = alert.severity === 'critical' ? 0xED4245 : 0xFEE75C // red or yellow

  const body = {
    embeds: [
      {
        title: `🔔 ${label}`,
        description: `A new ${alert.severity} alert has been triggered.`,
        color,
        fields: [
          { name: 'Severity', value: alert.severity.toUpperCase(), inline: true },
          { name: 'Current Value', value: String(alert.currentValue), inline: true },
          { name: 'Threshold', value: String(alert.thresholdValue), inline: true },
          { name: 'Alert ID', value: alertId, inline: false },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      console.error(`[alerts] Discord notification failed: HTTP ${res.status}`)
    }
  } catch (err) {
    console.error('[alerts] Discord notification error:', err)
  }
}

// ---------------------------------------------------------------------------
// Main alert check function
// ---------------------------------------------------------------------------

export type AlertCheckResult = {
  triggered: number
  resolved: number
}

export async function checkAlerts(): Promise<AlertCheckResult> {
  const currentValues = await getCurrentValues()
  const evaluations = evaluateThresholds(currentValues)

  let triggered = 0
  let resolved = 0

  // Create new alerts (skip if active alert of same type exists)
  for (const eval_ of evaluations) {
    const existing = await getActiveAlertOfType(eval_.alertType)
    if (existing) continue

    const label = ALERT_LABELS[eval_.alertType]
    const message = `${label} detected: current=${eval_.currentValue}, threshold=${eval_.thresholdValue}`

    const { data, error } = await supabaseAdmin
      .from('alert_events')
      .insert({
        alert_type: eval_.alertType,
        severity: eval_.severity,
        status: 'active',
        current_value: eval_.currentValue,
        threshold_value: eval_.thresholdValue,
        message,
        metadata: {},
      })
      .select('id')
      .single()

    if (error) {
      console.error('[alerts] Failed to create alert:', error)
      continue
    }

    triggered++

    // Notify Discord for high/critical
    if (eval_.severity === 'high' || eval_.severity === 'critical') {
      await notifyDiscord(eval_, (data as { id: string }).id)
    }
  }

  // Resolve alerts where current value is below threshold
  const { data: activeAlerts, error: fetchError } = await supabaseAdmin
    .from('alert_events')
    .select('id, alert_type, threshold_value')
    .eq('status', 'active')

  if (!fetchError && activeAlerts) {
    for (const alert of activeAlerts as { id: string; alert_type: AlertType; threshold_value: number }[]) {
      const currentValue = currentValues[alert.alert_type]
      if (currentValue < alert.threshold_value) {
        const { error: resolveError } = await supabaseAdmin
          .from('alert_events')
          .update({
            status: 'resolved',
            resolved_at: new Date().toISOString(),
          })
          .eq('id', alert.id)

        if (!resolveError) resolved++
      }
    }
  }

  return { triggered, resolved }
}

// ---------------------------------------------------------------------------
// Dashboard query (admin only — no ownership check)
// ---------------------------------------------------------------------------

export async function getAlertDashboard(
  statusFilter?: AlertStatus,
  severityFilter?: AlertSeverity,
  page: number = 1,
  pageSize: number = 10,
): Promise<AlertDashboardDTO> {
  let activeQuery = supabaseAdmin
    .from('alert_events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  let resolvedQuery = supabaseAdmin
    .from('alert_events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'resolved')

  if (severityFilter) {
    activeQuery = activeQuery.eq('severity', severityFilter)
    resolvedQuery = resolvedQuery.eq('severity', severityFilter)
  }

  const [{ count: totalActive }, { count: totalResolved }] = await Promise.all([
    activeQuery,
    resolvedQuery,
  ])

  // Fetch the requested status page
  const effectiveStatus = statusFilter ?? 'active'
  let query = supabaseAdmin
    .from('alert_events')
    .select('*')
    .eq('status', effectiveStatus)
    .order('created_at', { ascending: false })

  if (severityFilter) {
    query = query.eq('severity', severityFilter)
  }

  const totalForStatus = effectiveStatus === 'active'
    ? (totalActive ?? 0)
    : (totalResolved ?? 0)

  const totalPages = Math.max(1, Math.ceil(totalForStatus / pageSize))
  const start = (page - 1) * pageSize

  const { data, error } = await query.range(start, start + pageSize - 1)

  const alerts: AlertEventDTO[] = !error && data
    ? (data as AlertEventRow[]).map(toDTO)
    : []

  return {
    activeAlerts: effectiveStatus === 'active' ? alerts : [],
    resolvedAlerts: effectiveStatus === 'resolved' ? alerts : [],
    totalActive: totalActive ?? 0,
    totalResolved: totalResolved ?? 0,
    page,
    pageSize,
    totalPages,
  }
}

// ---------------------------------------------------------------------------
// Raw row type (internal)
// ---------------------------------------------------------------------------

type AlertEventRow = {
  id: string
  alert_type: string
  severity: AlertSeverity
  status: AlertStatus
  current_value: number
  threshold_value: number
  message: string
  created_at: string
  resolved_at: string | null
}

function toDTO(row: AlertEventRow): AlertEventDTO {
  return {
    id: row.id,
    alertType: row.alert_type as AlertType,
    severity: row.severity,
    status: row.status,
    currentValue: row.current_value,
    thresholdValue: row.threshold_value,
    message: row.message,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }
}
