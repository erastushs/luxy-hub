import { getOwnedScript } from '@/app/lib/auth/ownership'
import { supabaseAdmin } from '@/app/lib/supabase'

// ---------------------------------------------------------------------------
// Safe DTOs — never expose event_secret, session IDs, nonces, webhook URLs
// ---------------------------------------------------------------------------

export type SecurityOverviewDTO = {
  invalidSignatures: number
  replayAttempts: number
  rateLimitHits: number
  authFailures: number
  securityScore: number
}

export type SecurityTrendBreakdown = {
  window: string
  invalidSignatures: number
  replayAttempts: number
  rateLimitHits: number
  authFailures: number
  total: number
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export type RiskAssessmentDTO = {
  level: RiskLevel
  score: number
  explanation: string
  triggers: string[]
}

export type SecurityAnomalyItemDTO = {
  metric: string
  severity: RiskLevel
  current24h: number
  baseline24h: number
  description: string
}

export type SecurityEventItemDTO = {
  eventType: string
  label: string
  count: number
  lastSeen: string | null
  severity: RiskLevel
}

export type SecurityDashboardDTO = {
  overview: SecurityOverviewDTO
  trends24h: SecurityTrendBreakdown
  trends7d: SecurityTrendBreakdown
  trends30d: SecurityTrendBreakdown
  risk: RiskAssessmentDTO
  anomalies: SecurityAnomalyItemDTO[]
  events: SecurityEventItemDTO[]
  totalEvents: number
  page: number
  pageSize: number
  totalPages: number
}

export type SecurityDashboardResult =
  | { success: true; dashboard: SecurityDashboardDTO }
  | { success: false; message: string; status: number }

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function resolveOwnedScript(
  slug: string,
  userId: string,
): Promise<{ id: string } | null> {
  const script = await getOwnedScript(slug, userId)
  if (!script) return null
  return { id: script.id }
}

async function countMetric(event: string, since: Date): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('verification_logs')
    .select('id', { count: 'exact', head: true })
    .eq('event', event)
    .gte('created_at', since.toISOString())

  if (error) return 0
  return count ?? 0
}

const SECURITY_METRICS = [
  'event.invalid_signature',
  'event.replay_attempt',
  'event.rate_limited',
  'event.auth_failure',
] as const

type SecurityMetricName = (typeof SECURITY_METRICS)[number]

const METRIC_LABELS: Record<SecurityMetricName, string> = {
  'event.invalid_signature': 'Invalid Signature',
  'event.replay_attempt': 'Replay Attempt',
  'event.rate_limited': 'Rate Limited',
  'event.auth_failure': 'Auth Failure',
}

// ---------------------------------------------------------------------------
// Scoring & classification (pure functions)
// ---------------------------------------------------------------------------

function computeSecurityScore(metrics: Record<SecurityMetricName, number>): number {
  let penalty = 0
  penalty += metrics['event.invalid_signature'] * 5
  penalty += metrics['event.replay_attempt'] * 10
  penalty += metrics['event.rate_limited'] * 3
  penalty += metrics['event.auth_failure'] * 2
  return Math.max(0, 100 - Math.round(penalty))
}

function classifyRisk(metrics: Record<SecurityMetricName, number>): RiskAssessmentDTO {
  const score = computeSecurityScore(metrics)
  const triggers: string[] = []

  if (metrics['event.replay_attempt'] > 0) {
    triggers.push(`${metrics['event.replay_attempt']} replay attempt(s) detected`)
  }
  if (metrics['event.invalid_signature'] >= 20) {
    triggers.push(`High invalid signature volume (${metrics['event.invalid_signature']})`)
  }
  if (metrics['event.rate_limited'] >= 10) {
    triggers.push(`Frequent rate limiting (${metrics['event.rate_limited']})`)
  }
  if (metrics['event.auth_failure'] >= 30) {
    triggers.push(`Elevated auth failures (${metrics['event.auth_failure']})`)
  }

  let level: RiskLevel
  let explanation: string

  if (score >= 80) {
    level = 'LOW'
    explanation = 'Security posture is healthy. No significant threats detected.'
  } else if (score >= 50) {
    level = 'MEDIUM'
    explanation = 'Some security signals require attention. Monitor trends closely.'
  } else {
    level = 'HIGH'
    explanation = 'Active security threats detected. Immediate investigation recommended.'
  }

  return { level, score, explanation, triggers }
}

function detectAnomalies(
  current: Record<SecurityMetricName, number>,
  baseline: Record<SecurityMetricName, number>,
): SecurityAnomalyItemDTO[] {
  const anomalies: SecurityAnomalyItemDTO[] = []

  for (const metric of SECURITY_METRICS) {
    const cur = current[metric]
    const base = baseline[metric]

    if (cur < 3) continue

    let isAnomaly = false
    let severity: RiskLevel = 'MEDIUM'

    if (base === 0 && cur >= 5) {
      isAnomaly = true
      severity = cur >= 15 ? 'HIGH' : 'MEDIUM'
    } else if (base > 0) {
      const ratio = cur / base
      if (ratio >= 3 && cur >= 10) {
        isAnomaly = true
        severity = 'HIGH'
      } else if (ratio >= 2 && cur >= 5) {
        isAnomaly = true
        severity = 'MEDIUM'
      }
    }

    if (isAnomaly) {
      const label = METRIC_LABELS[metric]
      anomalies.push({
        metric,
        severity,
        current24h: cur,
        baseline24h: base,
        description: base === 0
          ? `${label} spike: ${cur} in last 24h (previously 0)`
          : `${label} increased ${Math.round(cur / base)}×: ${cur} vs baseline ${base}`,
      })
    }
  }

  return anomalies
}

function eventSeverity(event: SecurityMetricName): RiskLevel {
  switch (event) {
    case 'event.replay_attempt': return 'HIGH'
    case 'event.invalid_signature': return 'MEDIUM'
    case 'event.rate_limited': return 'MEDIUM'
    case 'event.auth_failure': return 'LOW'
  }
}

// ---------------------------------------------------------------------------
// Main security dashboard function
// ---------------------------------------------------------------------------

export async function getSecurityDashboard(
  slug: string,
  userId: string,
  page: number = 1,
  pageSize: number = 10,
): Promise<SecurityDashboardResult> {
  const script = await resolveOwnedScript(slug, userId)
  if (!script) {
    return { success: false, message: 'Script not found', status: 404 }
  }

  try {
    const now = new Date()
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const since48h = new Date(now.getTime() - 48 * 60 * 60 * 1000)
    const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // 16 count queries + 4 event30d counts = 20 total
    const queries: Promise<number>[] = []
    const labels: { metric: SecurityMetricName; window: string }[] = []

    for (const metric of SECURITY_METRICS) {
      queries.push(countMetric(metric, since24h));  labels.push({ metric, window: '24h' })
      queries.push(countMetric(metric, since7d));   labels.push({ metric, window: '7d' })
      queries.push(countMetric(metric, since30d));  labels.push({ metric, window: '30d' })
      queries.push(countMetric(metric, since48h));  labels.push({ metric, window: '48h' })
    }

    for (const metric of SECURITY_METRICS) {
      queries.push(countMetric(metric, since30d))
      labels.push({ metric, window: 'event30d' })
    }

    const allCounts = await Promise.all(queries)

    // Parse
    let idx = 0
    const m24h = {} as Record<SecurityMetricName, number>
    const m7d = {} as Record<SecurityMetricName, number>
    const m30d = {} as Record<SecurityMetricName, number>
    const m48h = {} as Record<SecurityMetricName, number>

    for (let i = 0; i < SECURITY_METRICS.length * 4; i++) {
      const { metric, window } = labels[idx]
      if (window === '24h') m24h[metric] = allCounts[idx]
      else if (window === '7d') m7d[metric] = allCounts[idx]
      else if (window === '30d') m30d[metric] = allCounts[idx]
      else if (window === '48h') m48h[metric] = allCounts[idx]
      idx++
    }

    // Baseline (prior 24h) = 48h - 24h
    const baseline = {} as Record<SecurityMetricName, number>
    for (const metric of SECURITY_METRICS) {
      baseline[metric] = Math.max(0, m48h[metric] - m24h[metric])
    }

    // Overview
    const overview: SecurityOverviewDTO = {
      invalidSignatures: m24h['event.invalid_signature'],
      replayAttempts: m24h['event.replay_attempt'],
      rateLimitHits: m24h['event.rate_limited'],
      authFailures: m24h['event.auth_failure'],
      securityScore: computeSecurityScore(m24h),
    }

    // Risk
    const risk = classifyRisk(m24h)

    // Anomalies
    const anomalies = detectAnomalies(m24h, baseline)

    // Trend breakdowns
    function bd(metrics: Record<SecurityMetricName, number>, window: string): SecurityTrendBreakdown {
      return {
        window,
        invalidSignatures: metrics['event.invalid_signature'],
        replayAttempts: metrics['event.replay_attempt'],
        rateLimitHits: metrics['event.rate_limited'],
        authFailures: metrics['event.auth_failure'],
        total: Object.values(metrics).reduce((s, v) => s + v, 0),
      }
    }

    // Events table
    const securityEvents: SecurityEventItemDTO[] = []
    for (let i = 0; i < SECURITY_METRICS.length; i++) {
      const metric = SECURITY_METRICS[i]
      const count = allCounts[idx + i] ?? 0
      if (count > 0) {
        securityEvents.push({
          eventType: metric,
          label: METRIC_LABELS[metric],
          count,
          lastSeen: null, // Not queried separately
          severity: eventSeverity(metric),
        })
      }
    }

    securityEvents.sort((a, b) => b.count - a.count)

    // Pagination
    const total = securityEvents.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const start = (page - 1) * pageSize

    const dashboard: SecurityDashboardDTO = {
      overview,
      trends24h: bd(m24h, '24h'),
      trends7d: bd(m7d, '7d'),
      trends30d: bd(m30d, '30d'),
      risk,
      anomalies,
      events: securityEvents.slice(start, start + pageSize),
      totalEvents: total,
      page,
      pageSize,
      totalPages,
    }

    return { success: true, dashboard }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load security dashboard'
    return { success: false, message, status: 500 }
  }
}
