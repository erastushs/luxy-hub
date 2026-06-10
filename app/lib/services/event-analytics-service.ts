import { getOwnedScript } from '@/app/lib/auth/ownership'
import {
  getEventTypeCountsByScriptId,
  getLastDeliveryTimestamp,
  countEventsByScriptId,
  getScriptQueueSnapshot,
  type EventTypeCount,
  type ScriptQueueSnapshot,
} from '@/app/lib/repositories/event-repository'
import { supabaseAdmin } from '@/app/lib/supabase'
import { getWebhookConfigByScriptId } from '@/app/lib/repositories/webhook-config-repository'

// ---------------------------------------------------------------------------
// Safe DTOs — never expose secrets, webhook URLs, session IDs, nonces
// ---------------------------------------------------------------------------

export type EventAnalyticsDTO = {
  // Overview
  totalEvents: number
  deliveredEvents: number
  pendingEvents: number
  deadLetterEvents: number
  successRatePercent: number

  // Event trends (by type, per time window)
  trends24h: TrendBreakdown
  trends7d: TrendBreakdown
  trends30d: TrendBreakdown

  // Queue health (per-script)
  queueHealth: ScriptQueueSnapshot

  // Provider health
  providerHealth: ProviderHealthDTO | null

  // Security metrics (from verification_logs)
  securityMetrics: SecurityMetricsDTO
}

export type TrendBreakdown = {
  window: string // '24h' | '7d' | '30d'
  byType: Record<string, TrendBreakdownEntry>
  total: number
}

export type TrendBreakdownEntry = {
  delivered: number
  pending: number
  deadLetter: number
}

export type ProviderHealthDTO = {
  provider: string
  enabled: boolean
  totalDeliveries: number
  totalFailures: number
  failureRatePercent: number
  lastDeliveryAt: string | null
}

export type SecurityMetricsDTO = {
  invalidSignatures: number
  replayAttempts: number
  rateLimitHits: number
}

// ---------------------------------------------------------------------------
// Service result types
// ---------------------------------------------------------------------------

export type EventAnalyticsResult =
  | { success: true; analytics: EventAnalyticsDTO }
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

function computeTrendBreakdown(
  counts: EventTypeCount[],
): TrendBreakdown {
  const byType: Record<string, TrendBreakdownEntry> = {}
  let total = 0

  for (const c of counts) {
    if (!byType[c.event_type]) {
      byType[c.event_type] = { delivered: 0, pending: 0, deadLetter: 0 }
    }
    if (c.delivery_status === 'delivered') {
      byType[c.event_type].delivered += c.count
    } else if (c.delivery_status === 'pending') {
      byType[c.event_type].pending += c.count
    } else if (c.delivery_status === 'dead_letter') {
      byType[c.event_type].deadLetter += c.count
    }
    total += c.count
  }

  return { window: '', byType, total }
}

/**
 * Count verification_logs rows for a specific event within a time range.
 * Scope is global, since security counters are event API signals
 * that are not per-script.
 */
async function countSecurityMetric(
  event: string,
  since: Date,
): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('verification_logs')
    .select('id', { count: 'exact', head: true })
    .eq('event', event)
    .gte('created_at', since.toISOString())

  if (error) return 0
  return count ?? 0
}

// ---------------------------------------------------------------------------
// Main analytics function
// ---------------------------------------------------------------------------

export async function getEventAnalytics(
  slug: string,
  userId: string,
): Promise<EventAnalyticsResult> {
  const script = await resolveOwnedScript(slug, userId)
  if (!script) {
    return { success: false, message: 'Script not found', status: 404 }
  }

  const scriptId = script.id

  try {
    const now = new Date()

    // Time windows
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Parallel fetch: overview counts, event type counts per window,
    // provider config, last delivery time, per-script queue health, security metrics
    const [
      totalEventsResult,
      deliveredEventsResult,
      pendingEventsResult,
      deadLetterEventsResult,
      counts24h,
      counts7d,
      counts30d,
      providerConfig,
      lastDeliveryAt,
      queueHealth,
      invalidSignatures,
      replayAttempts,
      rateLimitHits,
    ] = await Promise.all([
      countEventsByScriptId(scriptId),
      countEventsByScriptId(scriptId, { deliveryStatus: 'delivered' }),
      countEventsByScriptId(scriptId, { deliveryStatus: 'pending' }),
      countEventsByScriptId(scriptId, { deliveryStatus: 'dead_letter' }),
      getEventTypeCountsByScriptId(scriptId, since24h),
      getEventTypeCountsByScriptId(scriptId, since7d),
      getEventTypeCountsByScriptId(scriptId, since30d),
      getWebhookConfigByScriptId(scriptId),
      getLastDeliveryTimestamp(scriptId),
      getScriptQueueSnapshot(scriptId),
      countSecurityMetric('event.invalid_signature', since30d),
      countSecurityMetric('event.replay_attempt', since30d),
      countSecurityMetric('event.rate_limited', since30d),
    ])

    // Overview
    const totalEvents = totalEventsResult
    const deliveredEvents = deliveredEventsResult
    const pendingEvents = pendingEventsResult
    const deadLetterEvents = deadLetterEventsResult
    const successRatePercent = totalEvents > 0
      ? Math.round((deliveredEvents / totalEvents) * 1000) / 10
      : 0

    // Trends
    const trends24hBreakdown = computeTrendBreakdown(counts24h)
    trends24hBreakdown.window = '24h'
    const trends7dBreakdown = computeTrendBreakdown(counts7d)
    trends7dBreakdown.window = '7d'
    const trends30dBreakdown = computeTrendBreakdown(counts30d)
    trends30dBreakdown.window = '30d'

    // Provider health
    let providerHealth: ProviderHealthDTO | null = null
    if (providerConfig) {
      const totalDeliveries = deliveredEvents
      const totalFailures = deadLetterEvents
      const totalOps = totalDeliveries + totalFailures
      const failureRatePercent = totalOps > 0
        ? Math.round((totalFailures / totalOps) * 1000) / 10
        : 0

      providerHealth = {
        provider: providerConfig.provider,
        enabled: providerConfig.enabled,
        totalDeliveries,
        totalFailures,
        failureRatePercent,
        lastDeliveryAt,
      }
    }

    // Security metrics
    const securityMetrics: SecurityMetricsDTO = {
      invalidSignatures,
      replayAttempts,
      rateLimitHits,
    }

    const analytics: EventAnalyticsDTO = {
      totalEvents,
      deliveredEvents,
      pendingEvents,
      deadLetterEvents,
      successRatePercent,
      trends24h: trends24hBreakdown,
      trends7d: trends7dBreakdown,
      trends30d: trends30dBreakdown,
      providerHealth,
      queueHealth,
      securityMetrics,
    }

    return { success: true, analytics }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load event analytics'
    return { success: false, message, status: 500 }
  }
}
