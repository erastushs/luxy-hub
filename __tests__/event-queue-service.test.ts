import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventLogRow } from '@/app/lib/repositories/event-repository'
import type { WebhookConfigRow } from '@/app/lib/repositories/webhook-config-repository'
import type { DeliveryProvider, ProviderResolver } from '@/app/lib/services/event-queue-service'
import {
  computeBackoffMs,
  isRetryDue,
  processEventQueue,
  processSingleEvent,
  replayDeadLetterEvent,
} from '@/app/lib/services/event-queue-service'

vi.mock('@/app/lib/repositories/event-repository', () => ({
  getPendingEvents: vi.fn(),
  claimEventForProcessing: vi.fn(),
  updateEventDeliveryStatus: vi.fn(),
}))

vi.mock('@/app/lib/repositories/webhook-config-repository', () => ({
  getEnabledWebhookConfigByScriptId: vi.fn(),
}))

vi.mock('@/app/lib/services/event-monitoring-service', () => ({
  recordWebhookCounter: vi.fn(),
}))

import {
  getPendingEvents,
  claimEventForProcessing,
  updateEventDeliveryStatus,
} from '@/app/lib/repositories/event-repository'
import { getEnabledWebhookConfigByScriptId } from '@/app/lib/repositories/webhook-config-repository'

const mockedGetPendingEvents = vi.mocked(getPendingEvents)
const mockedClaimEvent = vi.mocked(claimEventForProcessing)
const mockedUpdateEventDeliveryStatus = vi.mocked(updateEventDeliveryStatus)
const mockedGetEnabledConfig = vi.mocked(getEnabledWebhookConfigByScriptId)

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

const FAKE_WEBHOOK_URL = 'https://discord.com/api/webhooks/1234567890/abc123'

function eventRow(overrides: Partial<EventLogRow> = {}): EventLogRow {
  return {
    id: 'event-001',
    script_id: 'script-001',
    session_id: 'session-001',
    event_type: 'execute',
    payload: { key: 'value' },
    delivery_status: 'pending',
    retry_count: 0,
    timestamp: '2026-06-09T12:00:00.000Z',
    received_at: '2026-06-09T12:00:01.000Z',
    nonce: 'a'.repeat(32),
    last_retry_at: null,
    delivered_at: null,
    error_message: null,
    claimed_at: null,
    created_at: '2026-06-09T12:00:01.000Z',
    ...overrides,
  }
}

function enabledConfig(overrides: Partial<{ provider: string }> = {}): WebhookConfigRow {
  return {
    id: 'cfg-001',
    script_id: 'script-001',
    creator_id: 'creator-001',
    provider: (overrides.provider ?? 'discord') as WebhookConfigRow['provider'],
    config: { webhook_url: FAKE_WEBHOOK_URL } as Record<string, unknown>,
    enabled: true,
    created_at: '2026-06-09T12:00:00.000Z',
    updated_at: '2026-06-09T12:00:00.000Z',
  } as WebhookConfigRow
}

function enabledConfigNoUrl(): WebhookConfigRow {
  const cfg = enabledConfig()
  cfg.config = {} as Record<string, unknown>
  return cfg
}

function succeedProvider(): DeliveryProvider {
  return { deliver: vi.fn().mockResolvedValue({ success: true, retryable: false }) }
}

function retryableProvider(error = 'provider-unreachable'): DeliveryProvider {
  return { deliver: vi.fn().mockResolvedValue({ success: false, retryable: true, error }) }
}

function fatalProvider(error = 'invalid-webhook'): DeliveryProvider {
  return { deliver: vi.fn().mockResolvedValue({ success: false, retryable: false, error }) }
}

function crashingProvider(error = 'network timeout'): DeliveryProvider {
  return { deliver: vi.fn().mockRejectedValue(new Error(error)) }
}

function resolveProvider(provider: DeliveryProvider): ProviderResolver {
  return (type: string) => {
    if (type === 'discord') return provider
    return null
  }
}

// ---------------------------------------------------------------------------
// Backoff unit tests
// ---------------------------------------------------------------------------

describe('computeBackoffMs', () => {
  it('returns 0 for retry count 0', () => {
    expect(computeBackoffMs(0)).toBe(0)
  })

  it.each([
    [1, 10_000], [2, 30_000], [3, 90_000], [4, 270_000],
    [5, 810_000], [6, 810_000], [99, 810_000],
  ])('retry count %i → %i ms', (retryCount, expected) => {
    expect(computeBackoffMs(retryCount)).toBe(expected)
  })
})

describe('isRetryDue', () => {
  it('returns true when retry_count is 0', () => {
    expect(isRetryDue(eventRow())).toBe(true)
  })

  it('returns true when backoff has elapsed', () => {
    const ev = eventRow({ retry_count: 1, last_retry_at: new Date(Date.now() - 15_000).toISOString() })
    expect(isRetryDue(ev)).toBe(true)
  })

  it('returns false when backoff has not elapsed', () => {
    const ev = eventRow({ retry_count: 1, last_retry_at: new Date(Date.now() - 3_000).toISOString() })
    expect(isRetryDue(ev)).toBe(false)
  })

  it('uses received_at when last_retry_at is null', () => {
    const ev = eventRow({ retry_count: 2, last_retry_at: null, received_at: new Date(Date.now() - 60_000).toISOString() })
    expect(isRetryDue(ev)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Queue processing tests
// ---------------------------------------------------------------------------

describe('processEventQueue', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedClaimEvent.mockImplementation(async (eventId) => eventRow({ id: eventId }))
    mockedGetPendingEvents.mockResolvedValue([])
    mockedUpdateEventDeliveryStatus.mockImplementation(async (p) => {
      return { ...eventRow(), id: p.eventId, delivery_status: p.deliveryStatus, retry_count: p.retryCount ?? 0 }
    })
  })

  it('delivers a pending event through the provider', async () => {
    const ev = eventRow()
    mockedClaimEvent.mockResolvedValue(ev)
    mockedGetPendingEvents.mockResolvedValue([ev])
    mockedGetEnabledConfig.mockResolvedValue(enabledConfig())

    const provider = succeedProvider()
    await processEventQueue(resolveProvider(provider))
    expect(provider.deliver).toHaveBeenCalledWith(ev, FAKE_WEBHOOK_URL)
    expect(mockedUpdateEventDeliveryStatus).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'event-001', deliveryStatus: 'delivered' })
    )
  })

  it('marks event as delivered when no webhook config exists', async () => {
    mockedGetPendingEvents.mockResolvedValue([eventRow()])
    mockedGetEnabledConfig.mockResolvedValue(null)

    const provider = succeedProvider()
    const result = await processEventQueue(resolveProvider(provider))

    expect(result.delivered).toBe(1)
    expect(provider.deliver).not.toHaveBeenCalled()
  })

  it('marks event as delivered when config has no webhook_url', async () => {
    mockedGetPendingEvents.mockResolvedValue([eventRow()])
    mockedGetEnabledConfig.mockResolvedValue(enabledConfigNoUrl())

    const provider = succeedProvider()
    const result = await processEventQueue(resolveProvider(provider))

    expect(result.delivered).toBe(1)
    expect(provider.deliver).not.toHaveBeenCalled()
  })

  it('dead-letters event when provider type is unknown', async () => {
    mockedGetPendingEvents.mockResolvedValue([eventRow()])
    mockedGetEnabledConfig.mockResolvedValue(enabledConfig({ provider: 'telegram' }))

    const result = await processEventQueue(resolveProvider(succeedProvider()))

    expect(result.deadLettered).toBe(1)
    expect(mockedUpdateEventDeliveryStatus).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryStatus: 'dead_letter', errorMessage: 'Unknown provider: telegram' })
    )
  })

  it('increments retry_count on retryable failure', async () => {
    mockedGetPendingEvents.mockResolvedValue([eventRow({ retry_count: 0 })])
    mockedGetEnabledConfig.mockResolvedValue(enabledConfig())

    const result = await processEventQueue(resolveProvider(retryableProvider()))

    expect(result.failed).toBe(1)
    expect(mockedUpdateEventDeliveryStatus).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryStatus: 'pending', retryCount: 1 })
    )
  })

  it('retryable crash also increments retry_count', async () => {
    mockedGetPendingEvents.mockResolvedValue([eventRow({ retry_count: 0 })])
    mockedGetEnabledConfig.mockResolvedValue(enabledConfig())

    const result = await processEventQueue(resolveProvider(crashingProvider()))

    expect(result.failed).toBe(1)
    expect(mockedUpdateEventDeliveryStatus).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryStatus: 'pending', retryCount: 1, errorMessage: 'network timeout' })
    )
  })

  it('moves to dead_letter on non-retryable failure', async () => {
    mockedGetPendingEvents.mockResolvedValue([eventRow()])
    mockedGetEnabledConfig.mockResolvedValue(enabledConfig())

    const result = await processEventQueue(resolveProvider(fatalProvider()))

    expect(result.deadLettered).toBe(1)
    expect(mockedUpdateEventDeliveryStatus).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryStatus: 'dead_letter', errorMessage: 'invalid-webhook' })
    )
  })

  it('moves to dead_letter after exhausting all retries', async () => {
    mockedGetPendingEvents.mockResolvedValue([eventRow({ retry_count: 4 })])
    mockedGetEnabledConfig.mockResolvedValue(enabledConfig())
    mockedClaimEvent.mockResolvedValue(eventRow({ retry_count: 4 }))

    const result = await processEventQueue(resolveProvider(retryableProvider()))

    expect(result.deadLettered).toBe(1)
    expect(mockedUpdateEventDeliveryStatus).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryStatus: 'dead_letter', retryCount: 5 })
    )
  })

  it('respects batch size', async () => {
    const events = Array.from({ length: 80 }, (_, i) =>
      eventRow({ id: `event-${i}`, script_id: `script-${i}` })
    )
    mockedGetPendingEvents.mockResolvedValue(events)
    mockedGetEnabledConfig.mockResolvedValue(null)

    const result = await processEventQueue(resolveProvider(succeedProvider()))

    expect(mockedGetPendingEvents).toHaveBeenCalledWith(50)
    expect(result.processed).toBe(80)
  })

  it('skips events not yet due for retry', async () => {
    const due = eventRow({ id: 'event-due', retry_count: 0 })
    const waiting = eventRow({ id: 'event-waiting', retry_count: 1, last_retry_at: new Date(Date.now() - 2_000).toISOString() })
    mockedGetPendingEvents.mockResolvedValue([due, waiting])
    mockedClaimEvent.mockImplementation(async (eventId) => {
      if (eventId === due.id) return due
      if (eventId === waiting.id) return waiting
      return null
    })

    const provider = succeedProvider()
    const result = await processEventQueue(resolveProvider(provider))

    expect(result.skipped).toBe(1)
    expect(result.delivered).toBe(1)
    expect(provider.deliver).not.toHaveBeenCalled()
  })

  it('returns zeros when queue is empty', async () => {
    const result = await processEventQueue(resolveProvider(succeedProvider()))
    expect(result).toEqual({ processed: 0, delivered: 0, failed: 0, deadLettered: 0, skipped: 0 })
  })
  it('skips a candidate already claimed by another worker', async () => {
    const ev = eventRow({ id: 'claimed-by-worker-a' })
    mockedGetPendingEvents.mockResolvedValue([ev])
    mockedClaimEvent.mockResolvedValue(null)

    const provider = succeedProvider()
    const result = await processEventQueue(resolveProvider(provider))

    expect(result.skipped).toBe(1)
    expect(result.processed).toBe(0)
    expect(provider.deliver).not.toHaveBeenCalled()
  })

  it('processes one explicitly claimed event without fetching the global queue', async () => {
    const ev = eventRow({ id: 'test-event' })
    mockedClaimEvent.mockResolvedValue(ev)
    mockedGetEnabledConfig.mockResolvedValue(enabledConfig())

    const provider = succeedProvider()
    const result = await processSingleEvent('test-event', resolveProvider(provider))

    expect(mockedGetPendingEvents).not.toHaveBeenCalled()
    expect(mockedClaimEvent).toHaveBeenCalledWith('test-event')
    expect(result.delivered).toBe(1)
    expect(provider.deliver).toHaveBeenCalledWith(ev, FAKE_WEBHOOK_URL)
  })

  it('handles a mixed batch correctly', async () => {
    const ev1 = eventRow({ id: 'e1', script_id: 's1' })
    const ev2 = eventRow({ id: 'e2', script_id: 's2' })
    const ev3 = eventRow({ id: 'e3', script_id: 's3' })
    mockedGetPendingEvents.mockResolvedValue([ev1, ev2, ev3])

    mockedClaimEvent.mockImplementation(async (eventId) => {
      if (eventId === ev1.id) return ev1
      if (eventId === ev2.id) return ev2
      if (eventId === ev3.id) return ev3
      return null
    })

    mockedGetEnabledConfig.mockImplementation(async (scriptId) => {
      if (scriptId === 's3') return null
      return enabledConfig()
    })

    let call = 0
    const provider: DeliveryProvider = {
      deliver: vi.fn().mockImplementation(async () => {
        call++
        if (call === 1) return { success: true, retryable: false }
        return { success: false, retryable: true, error: 'fail' }
      }),
    }

    const result = await processEventQueue(resolveProvider(provider))
    expect(result.delivered).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.deadLettered).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Dead-letter replay
// ---------------------------------------------------------------------------

describe('replayDeadLetterEvent', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedUpdateEventDeliveryStatus.mockImplementation(async (p) => {
      return { ...eventRow(), id: p.eventId, delivery_status: p.deliveryStatus, retry_count: p.retryCount ?? 0 }
    })
  })

  it('resets a dead-letter event back to pending', async () => {
    mockedUpdateEventDeliveryStatus.mockResolvedValue({ ...eventRow(), id: 'event-dl', delivery_status: 'pending', retry_count: 0 })
    const result = await replayDeadLetterEvent('event-dl')

    expect(result).not.toBeNull()
    expect(mockedUpdateEventDeliveryStatus).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'event-dl', deliveryStatus: 'pending', retryCount: 0, lastRetryAt: null, deliveredAt: null, errorMessage: null })
    )
  })
})
