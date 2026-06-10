import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScriptRow } from '@/app/lib/repositories/script-repository'
import type { EventTypeCount, ScriptQueueSnapshot } from '@/app/lib/repositories/event-repository'
import type { WebhookConfigRow } from '@/app/lib/repositories/webhook-config-repository'

// ---------------------------------------------------------------------------
// Mock: ownership
// ---------------------------------------------------------------------------

vi.mock('@/app/lib/auth/ownership', () => ({
  getOwnedScript: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Mock: event repository
// ---------------------------------------------------------------------------

vi.mock('@/app/lib/repositories/event-repository', () => ({
  getEventTypeCountsByScriptId: vi.fn(),
  getLastDeliveryTimestamp: vi.fn(),
  countEventsByScriptId: vi.fn(),
  getScriptQueueSnapshot: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Mock: webhook config repository
// ---------------------------------------------------------------------------

vi.mock('@/app/lib/repositories/webhook-config-repository', () => ({
  getWebhookConfigByScriptId: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Mock: supabaseAdmin (for countSecurityMetric)
// ---------------------------------------------------------------------------

let securityCallCount = 0
const securityCounts = [3, 1, 5] // invalid_signature, replay_attempt, rate_limited

vi.mock('@/app/lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: () => {
            securityCallCount++
            return { count: securityCounts[securityCallCount - 1] ?? 0, error: null }
          },
        }),
      }),
    }),
  },
}))

// ---------------------------------------------------------------------------
// Imports after hoisted mocks
// ---------------------------------------------------------------------------

import { getOwnedScript } from '@/app/lib/auth/ownership'
import {
  getEventTypeCountsByScriptId,
  getLastDeliveryTimestamp,
  countEventsByScriptId,
  getScriptQueueSnapshot,
} from '@/app/lib/repositories/event-repository'
import { getWebhookConfigByScriptId } from '@/app/lib/repositories/webhook-config-repository'
import { getEventAnalytics } from '@/app/lib/services/event-analytics-service'

const mockedGetOwnedScript = vi.mocked(getOwnedScript)
const mockedGetEventTypeCounts = vi.mocked(getEventTypeCountsByScriptId)
const mockedGetLastDeliveryTimestamp = vi.mocked(getLastDeliveryTimestamp)
const mockedCountEventsByScriptId = vi.mocked(countEventsByScriptId)
const mockedGetScriptQueueSnapshot = vi.mocked(getScriptQueueSnapshot)
const mockedGetWebhookConfig = vi.mocked(getWebhookConfigByScriptId)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OWNER_ID = 'owner-001'
const SCRIPT_SLUG = 'my-script'
const SCRIPT_ID = 'script-001'

function ownedScript(): ScriptRow {
  return {
    id: SCRIPT_ID,
    slug: SCRIPT_SLUG,
    name: 'My Script',
    description: null,
    visibility: 'private',
    creator_id: OWNER_ID,
    current_version_id: null,
    created_at: '2026-06-09T12:00:00.000Z',
    updated_at: '2026-06-09T12:00:00.000Z',
  }
}

function emptySnapshot(): ScriptQueueSnapshot {
  return { pendingCount: 0, deadLetterCount: 0, oldestPendingAgeSeconds: null }
}

function webhookConfigRow(
  overrides: Partial<WebhookConfigRow> = {},
): WebhookConfigRow {
  return {
    id: 'cfg-001',
    script_id: SCRIPT_ID,
    creator_id: OWNER_ID,
    provider: 'discord',
    config: { webhook_url: 'https://discord.com/api/webhooks/123/token' },
    enabled: true,
    created_at: '2026-06-09T00:00:00.000Z',
    updated_at: '2026-06-09T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  securityCallCount = 0
  mockedGetOwnedScript.mockResolvedValue(ownedScript())
  mockedGetEventTypeCounts.mockResolvedValue([])
  mockedGetLastDeliveryTimestamp.mockResolvedValue(null)
  mockedCountEventsByScriptId.mockResolvedValue(0)
  mockedGetScriptQueueSnapshot.mockResolvedValue(emptySnapshot())
  mockedGetWebhookConfig.mockResolvedValue(null)
})

// ---------------------------------------------------------------------------
// Ownership
// ---------------------------------------------------------------------------

describe('ownership', () => {
  it('returns 404 when script is not owned', async () => {
    mockedGetOwnedScript.mockResolvedValue(null)
    const result = await getEventAnalytics('unknown-slug', OWNER_ID)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(404)
      expect(result.message).toBe('Script not found')
    }
  })

  it('resolves script by slug and userId', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    const result = await getEventAnalytics(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    expect(mockedGetOwnedScript).toHaveBeenCalledWith(SCRIPT_SLUG, OWNER_ID)
  })

  it('does not leak script existence for wrong owner', async () => {
    mockedGetOwnedScript.mockResolvedValue(null)
    const result = await getEventAnalytics(SCRIPT_SLUG, 'other-owner')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// Analytics aggregation
// ---------------------------------------------------------------------------

describe('analytics aggregation', () => {
  it('returns zeroed analytics when no events exist', async () => {
    const result = await getEventAnalytics(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      const a = result.analytics
      expect(a.totalEvents).toBe(0)
      expect(a.deliveredEvents).toBe(0)
      expect(a.pendingEvents).toBe(0)
      expect(a.deadLetterEvents).toBe(0)
      expect(a.successRatePercent).toBe(0)
      expect(a.trends24h.total).toBe(0)
      expect(a.trends7d.total).toBe(0)
      expect(a.trends30d.total).toBe(0)
    }
  })

  it('computes overview counts correctly', async () => {
    mockedCountEventsByScriptId
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(80)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(10)
    const result = await getEventAnalytics(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.analytics.totalEvents).toBe(100)
      expect(result.analytics.deliveredEvents).toBe(80)
      expect(result.analytics.pendingEvents).toBe(10)
      expect(result.analytics.deadLetterEvents).toBe(10)
      expect(result.analytics.successRatePercent).toBe(80)
    }
  })

  it('computes success rate as 0 when total is 0', async () => {
    mockedCountEventsByScriptId.mockResolvedValue(0)
    const result = await getEventAnalytics(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) expect(result.analytics.successRatePercent).toBe(0)
  })

  it('computes success rate with one decimal precision', async () => {
    mockedCountEventsByScriptId
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0)
    const result = await getEventAnalytics(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) expect(result.analytics.successRatePercent).toBe(33.3)
  })

  it('groups trends by event type and delivery status', async () => {
    const recentCounts: EventTypeCount[] = [
      { event_type: 'execute', delivery_status: 'delivered', count: 1 },
    ]
    mockedGetEventTypeCounts
      .mockResolvedValueOnce(recentCounts)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    const result = await getEventAnalytics(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.analytics.trends24h.byType['execute']).toEqual({ delivered: 1, pending: 0, deadLetter: 0 })
      expect(result.analytics.trends24h.total).toBe(1)
      expect(result.analytics.trends7d.total).toBe(0)
      expect(result.analytics.trends30d.total).toBe(0)
    }
  })

  it('calls getEventTypeCountsByScriptId 3 times with correct since dates', async () => {
    await getEventAnalytics(SCRIPT_SLUG, OWNER_ID)
    expect(mockedGetEventTypeCounts).toHaveBeenCalledTimes(3)
    expect(mockedGetEventTypeCounts).toHaveBeenNthCalledWith(1, SCRIPT_ID, expect.any(Date))
    expect(mockedGetEventTypeCounts).toHaveBeenNthCalledWith(2, SCRIPT_ID, expect.any(Date))
    expect(mockedGetEventTypeCounts).toHaveBeenNthCalledWith(3, SCRIPT_ID, expect.any(Date))
  })
})

// ---------------------------------------------------------------------------
// Provider health
// ---------------------------------------------------------------------------

describe('provider health', () => {
  it('returns null when no webhook config exists', async () => {
    const result = await getEventAnalytics(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) expect(result.analytics.providerHealth).toBeNull()
  })

  it('returns provider health when webhook config is enabled', async () => {
    mockedGetWebhookConfig.mockResolvedValue(webhookConfigRow({ enabled: true }))
    mockedCountEventsByScriptId
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(80)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(10)
    const result = await getEventAnalytics(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      const h = result.analytics.providerHealth
      expect(h).not.toBeNull()
      if (h) {
        expect(h.provider).toBe('discord')
        expect(h.enabled).toBe(true)
        expect(h.totalDeliveries).toBe(80)
        expect(h.totalFailures).toBe(10)
        expect(h.failureRatePercent).toBe(11.1)
      }
    }
  })

  it('returns provider health when disabled', async () => {
    mockedGetWebhookConfig.mockResolvedValue(webhookConfigRow({ enabled: false }))
    const result = await getEventAnalytics(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) expect(result.analytics.providerHealth?.enabled).toBe(false)
  })

  it('includes last delivery timestamp', async () => {
    mockedGetWebhookConfig.mockResolvedValue(webhookConfigRow())
    mockedGetLastDeliveryTimestamp.mockResolvedValue('2026-06-09T10:00:00.000Z')
    const result = await getEventAnalytics(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.analytics.providerHealth?.lastDeliveryAt).toBe('2026-06-09T10:00:00.000Z')
    }
  })
})

// ---------------------------------------------------------------------------
// Queue health
// ---------------------------------------------------------------------------

describe('queue health', () => {
  it('returns per-script queue snapshot', async () => {
    const snapshot: ScriptQueueSnapshot = { pendingCount: 5, deadLetterCount: 2, oldestPendingAgeSeconds: 3600 }
    mockedGetScriptQueueSnapshot.mockResolvedValue(snapshot)
    const result = await getEventAnalytics(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) expect(result.analytics.queueHealth).toEqual(snapshot)
    expect(mockedGetScriptQueueSnapshot).toHaveBeenCalledWith(SCRIPT_ID)
  })

  it('handles empty queue', async () => {
    mockedGetScriptQueueSnapshot.mockResolvedValue(emptySnapshot())
    const result = await getEventAnalytics(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.analytics.queueHealth.pendingCount).toBe(0)
      expect(result.analytics.queueHealth.deadLetterCount).toBe(0)
      expect(result.analytics.queueHealth.oldestPendingAgeSeconds).toBeNull()
    }
  })
})

// ---------------------------------------------------------------------------
// Security metrics
// ---------------------------------------------------------------------------

describe('security metrics', () => {
  it('returns security counter values from verification_logs', async () => {
    const result = await getEventAnalytics(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      const m = result.analytics.securityMetrics
      expect(m.invalidSignatures).toBe(3)
      expect(m.replayAttempts).toBe(1)
      expect(m.rateLimitHits).toBe(5)
    }
  })

  it('queries verification_logs 3 times', async () => {
    await getEventAnalytics(SCRIPT_SLUG, OWNER_ID)
    expect(securityCallCount).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// DTO safety
// ---------------------------------------------------------------------------

describe('DTO safety', () => {
  it('never includes session_id', async () => {
    const result = await getEventAnalytics(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      const json = JSON.stringify(result.analytics)
      expect(json).not.toContain('session_id')
      expect(json).not.toContain('sessionId')
    }
  })

  it('never includes nonce', async () => {
    const result = await getEventAnalytics(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(JSON.stringify(result.analytics)).not.toContain('nonce')
    }
  })

  it('never includes event_secret', async () => {
    const result = await getEventAnalytics(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      const json = JSON.stringify(result.analytics)
      expect(json).not.toContain('event_secret')
      expect(json).not.toContain('eventSecret')
    }
  })

  it('never includes webhook_url', async () => {
    mockedGetWebhookConfig.mockResolvedValue(webhookConfigRow())
    const result = await getEventAnalytics(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      const json = JSON.stringify(result.analytics)
      expect(json).not.toContain('webhook_url')
      expect(json).not.toContain('webhookUrl')
    }
  })

  it('never includes creator_id', async () => {
    const result = await getEventAnalytics(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      const json = JSON.stringify(result.analytics)
      expect(json).not.toContain('creator_id')
      expect(json).not.toContain('creatorId')
    }
  })
})

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe('empty state', () => {
  it('returns success with all zeroes when no events exist', async () => {
    const result = await getEventAnalytics(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      const a = result.analytics
      expect(a.totalEvents).toBe(0)
      expect(a.trends24h.total).toBe(0)
      expect(a.trends7d.total).toBe(0)
      expect(a.trends30d.total).toBe(0)
      expect(a.providerHealth).toBeNull()
      expect(a.queueHealth.pendingCount).toBe(0)
    }
  })

  it('handles empty trends gracefully', async () => {
    mockedGetEventTypeCounts
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    const result = await getEventAnalytics(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(Object.keys(result.analytics.trends24h.byType)).toHaveLength(0)
      expect(Object.keys(result.analytics.trends7d.byType)).toHaveLength(0)
      expect(Object.keys(result.analytics.trends30d.byType)).toHaveLength(0)
    }
  })
})

// ---------------------------------------------------------------------------
// Trend calculations
// ---------------------------------------------------------------------------

describe('trend calculations', () => {
  it('separates 24h, 7d, and 30d windows correctly', async () => {
    const counts24h: EventTypeCount[] = [
      { event_type: 'execute', delivery_status: 'delivered', count: 1 },
    ]
    const counts7d: EventTypeCount[] = [
      { event_type: 'execute', delivery_status: 'delivered', count: 5 },
      { event_type: 'error', delivery_status: 'dead_letter', count: 2 },
    ]
    const counts30d: EventTypeCount[] = [
      { event_type: 'execute', delivery_status: 'delivered', count: 20 },
      { event_type: 'purchase', delivery_status: 'delivered', count: 10 },
    ]
    mockedGetEventTypeCounts
      .mockResolvedValueOnce(counts24h)
      .mockResolvedValueOnce(counts7d)
      .mockResolvedValueOnce(counts30d)
    const result = await getEventAnalytics(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.analytics.trends24h.window).toBe('24h')
      expect(result.analytics.trends24h.total).toBe(1)
      expect(result.analytics.trends7d.window).toBe('7d')
      expect(result.analytics.trends7d.total).toBe(7)
      expect(result.analytics.trends7d.byType['error']).toEqual({ delivered: 0, pending: 0, deadLetter: 2 })
      expect(result.analytics.trends30d.window).toBe('30d')
      expect(result.analytics.trends30d.total).toBe(30)
    }
  })

  it('accumulates counts for same event type across statuses', async () => {
    const counts: EventTypeCount[] = [
      { event_type: 'execute', delivery_status: 'delivered', count: 3 },
      { event_type: 'execute', delivery_status: 'pending', count: 2 },
      { event_type: 'execute', delivery_status: 'dead_letter', count: 1 },
    ]
    mockedGetEventTypeCounts
      .mockResolvedValueOnce(counts)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    const result = await getEventAnalytics(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      const entry = result.analytics.trends24h.byType['execute']
      expect(entry).toEqual({ delivered: 3, pending: 2, deadLetter: 1 })
      expect(result.analytics.trends24h.total).toBe(6)
    }
  })
})
