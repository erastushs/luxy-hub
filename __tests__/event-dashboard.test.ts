import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScriptRow } from '@/app/lib/repositories/script-repository'
import type { EventLogRow } from '@/app/lib/repositories/event-repository'

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
  getEventsByScriptId: vi.fn(),
  countEventsByScriptId: vi.fn(),
  getEventLog: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Mock: webhook config repository
// ---------------------------------------------------------------------------

vi.mock('@/app/lib/repositories/webhook-config-repository', () => ({
  getWebhookConfigByScriptId: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Mock: queue service (replayDeadLetterEvent)
// ---------------------------------------------------------------------------

vi.mock('@/app/lib/services/event-queue-service', () => ({
  replayDeadLetterEvent: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Imports after hoisted mocks
// ---------------------------------------------------------------------------

import { getOwnedScript } from '@/app/lib/auth/ownership'
import {
  getEventsByScriptId,
  countEventsByScriptId,
  getEventLog,
} from '@/app/lib/repositories/event-repository'
import { getWebhookConfigByScriptId } from '@/app/lib/repositories/webhook-config-repository'
import type { WebhookConfigRow } from '@/app/lib/repositories/webhook-config-repository'
import { replayDeadLetterEvent } from '@/app/lib/services/event-queue-service'
import {
  getEventHistory,
  getEventDetail,
  getDeadLetters,
  replayEvent,
  replayAllDeadLetters,
} from '@/app/lib/services/event-dashboard-service'

const mockedGetOwnedScript = vi.mocked(getOwnedScript)
const mockedGetEventsByScriptId = vi.mocked(getEventsByScriptId)
const mockedCountEventsByScriptId = vi.mocked(countEventsByScriptId)
const mockedGetEventLog = vi.mocked(getEventLog)
const mockedGetWebhookConfig = vi.mocked(getWebhookConfigByScriptId)
const mockedReplayDeadLetterEvent = vi.mocked(replayDeadLetterEvent)
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

function eventRow(overrides: Partial<EventLogRow> = {}): EventLogRow {
  return {
    id: 'event-001',
    script_id: SCRIPT_ID,
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

function webhookConfigRow(provider: string = 'discord'): WebhookConfigRow {
  return {
    id: 'cfg-001',
    script_id: SCRIPT_ID,
    creator_id: OWNER_ID,
    provider: provider as WebhookConfigRow['provider'],
    config: {},
    enabled: true,
    created_at: '2026-06-09T12:00:00.000Z',
    updated_at: '2026-06-09T12:00:00.000Z',
  }
}

// ---------------------------------------------------------------------------
// getEventHistory
// ---------------------------------------------------------------------------

describe('getEventHistory', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('rejects non-owned script', async () => {
    mockedGetOwnedScript.mockResolvedValue(null)

    const result = await getEventHistory(SCRIPT_SLUG, OWNER_ID)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.status).toBe(404)
  })

  it('returns empty list for script with no events', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetEventsByScriptId.mockResolvedValue([])
    mockedCountEventsByScriptId.mockResolvedValue(0)
    mockedGetWebhookConfig.mockResolvedValue(null)

    const result = await getEventHistory(SCRIPT_SLUG, OWNER_ID)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.events).toEqual([])
      expect(result.total).toBe(0)
      expect(result.page).toBe(1)
    }
  })

  it('returns paginated events with provider', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetWebhookConfig.mockResolvedValue(webhookConfigRow('discord'))
    mockedGetEventsByScriptId.mockResolvedValue([eventRow(), eventRow({ id: 'e2' })])
    mockedCountEventsByScriptId.mockResolvedValue(2)

    const result = await getEventHistory(SCRIPT_SLUG, OWNER_ID, { page: 1, pageSize: 20 })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.events.length).toBe(2)
      expect(result.events[0].provider).toBe('discord')
      // Payload must NOT be included in list view
      expect(result.events[0].payload).toBeNull()
      // Secret fields must never leak
      expect(JSON.stringify(result.events)).not.toContain('session')
      expect(JSON.stringify(result.events)).not.toContain('nonce')
    }
  })

  it('filters by delivery status', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetWebhookConfig.mockResolvedValue(null)
    mockedGetEventsByScriptId.mockResolvedValue([eventRow({ delivery_status: 'dead_letter' })])
    mockedCountEventsByScriptId.mockResolvedValue(1)

    const result = await getEventHistory(SCRIPT_SLUG, OWNER_ID, { deliveryStatus: 'dead_letter' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.events[0].deliveryStatus).toBe('dead_letter')
    }
  })

  it('filters by event type', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetWebhookConfig.mockResolvedValue(null)
    mockedGetEventsByScriptId.mockResolvedValue([eventRow({ event_type: 'error', delivery_status: 'pending' })])
    mockedCountEventsByScriptId.mockResolvedValue(1)

    const result = await getEventHistory(SCRIPT_SLUG, OWNER_ID, { eventType: 'error' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.events[0].eventType).toBe('error')
    }
  })

  it('handles page and pageSize', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetWebhookConfig.mockResolvedValue(null)
    mockedGetEventsByScriptId.mockResolvedValue([eventRow()])
    mockedCountEventsByScriptId.mockResolvedValue(42)

    const result = await getEventHistory(SCRIPT_SLUG, OWNER_ID, { page: 3, pageSize: 10 })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.page).toBe(3)
      expect(result.pageSize).toBe(10)
    }
  })
})

// ---------------------------------------------------------------------------
// getEventDetail
// ---------------------------------------------------------------------------

describe('getEventDetail', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('rejects non-owned script', async () => {
    mockedGetOwnedScript.mockResolvedValue(null)

    const result = await getEventDetail(SCRIPT_SLUG, OWNER_ID, 'event-001')

    expect(result.success).toBe(false)
    if (!result.success) expect(result.status).toBe(404)
  })

  it('returns 404 for missing event', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetEventLog.mockResolvedValue(null)

    const result = await getEventDetail(SCRIPT_SLUG, OWNER_ID, 'event-001')

    expect(result.success).toBe(false)
    if (!result.success) expect(result.status).toBe(404)
  })

  it('rejects event from different script', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetEventLog.mockResolvedValue(eventRow({ script_id: 'different-script' }))

    const result = await getEventDetail(SCRIPT_SLUG, OWNER_ID, 'event-001')

    expect(result.success).toBe(false)
    if (!result.success) expect(result.status).toBe(404)
  })

  it('returns event with payload included', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetWebhookConfig.mockResolvedValue(webhookConfigRow('discord'))
    mockedGetEventLog.mockResolvedValue(eventRow())

    const result = await getEventDetail(SCRIPT_SLUG, OWNER_ID, 'event-001')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.event.payload).toEqual({ key: 'value' })
      expect(result.event.provider).toBe('discord')
      // Must never leak session/nonce
      expect(JSON.stringify(result.event)).not.toContain('session')
      expect(JSON.stringify(result.event)).not.toContain('nonce')
    }
  })

  it('returns event with error message for dead letter', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetWebhookConfig.mockResolvedValue(null)
    mockedGetEventLog.mockResolvedValue(
      eventRow({ delivery_status: 'dead_letter', error_message: 'Discord 404', retry_count: 5 }),
    )

    const result = await getEventDetail(SCRIPT_SLUG, OWNER_ID, 'event-001')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.event.deliveryStatus).toBe('dead_letter')
      expect(result.event.errorMessage).toBe('Discord 404')
      expect(result.event.retryCount).toBe(5)
    }
  })
})

// ---------------------------------------------------------------------------
// getDeadLetters
// ---------------------------------------------------------------------------

describe('getDeadLetters', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('rejects non-owned script', async () => {
    mockedGetOwnedScript.mockResolvedValue(null)

    const result = await getDeadLetters(SCRIPT_SLUG, OWNER_ID)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.status).toBe(404)
  })

  it('returns only dead-letter events', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetWebhookConfig.mockResolvedValue(null)
    mockedGetEventsByScriptId.mockResolvedValue([
      eventRow({ id: 'e1', delivery_status: 'dead_letter', error_message: 'x' }),
    ])
    mockedCountEventsByScriptId.mockResolvedValue(1)

    const result = await getDeadLetters(SCRIPT_SLUG, OWNER_ID)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.events.length).toBe(1)
      expect(result.events[0].deliveryStatus).toBe('dead_letter')
      // Payload must NOT be included in list view
      expect(result.events[0].payload).toBeNull()
    }
  })

  it('supports pagination', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetWebhookConfig.mockResolvedValue(null)
    mockedGetEventsByScriptId.mockResolvedValue([])
    mockedCountEventsByScriptId.mockResolvedValue(15)

    const result = await getDeadLetters(SCRIPT_SLUG, OWNER_ID, { page: 2, pageSize: 10 })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.page).toBe(2)
      expect(result.total).toBe(15)
    }
  })
})

// ---------------------------------------------------------------------------
// replayEvent
// ---------------------------------------------------------------------------

describe('replayEvent', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('rejects non-owned script', async () => {
    mockedGetOwnedScript.mockResolvedValue(null)

    const result = await replayEvent(SCRIPT_SLUG, OWNER_ID, 'event-001')

    expect(result.success).toBe(false)
    if (!result.success) expect(result.status).toBe(404)
  })

  it('rejects missing event', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetEventLog.mockResolvedValue(null)

    const result = await replayEvent(SCRIPT_SLUG, OWNER_ID, 'event-001')

    expect(result.success).toBe(false)
    if (!result.success) expect(result.status).toBe(404)
  })

  it('rejects event from different script', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetEventLog.mockResolvedValue(eventRow({ script_id: 'other' }))

    const result = await replayEvent(SCRIPT_SLUG, OWNER_ID, 'event-001')

    expect(result.success).toBe(false)
    if (!result.success) expect(result.status).toBe(404)
  })

  it('rejects non-dead-letter event', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetEventLog.mockResolvedValue(eventRow({ delivery_status: 'delivered' }))

    const result = await replayEvent(SCRIPT_SLUG, OWNER_ID, 'event-001')

    expect(result.success).toBe(false)
    if (!result.success) expect(result.message).toContain('dead-letter')
  })

  it('replays dead-letter event successfully', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetEventLog.mockResolvedValue(eventRow({ delivery_status: 'dead_letter', error_message: 'Discord 404' }))
    mockedReplayDeadLetterEvent.mockResolvedValue(eventRow({ delivery_status: 'pending', retry_count: 0 }))

    const result = await replayEvent(SCRIPT_SLUG, OWNER_ID, 'event-001')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.replayed).toBe(1)
      expect(result.message).toContain('queued')
    }
    expect(mockedReplayDeadLetterEvent).toHaveBeenCalledWith('event-001')
  })

  it('returns error when replay fails', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetEventLog.mockResolvedValue(eventRow({ delivery_status: 'dead_letter' }))
    mockedReplayDeadLetterEvent.mockResolvedValue(null)

    const result = await replayEvent(SCRIPT_SLUG, OWNER_ID, 'event-001')

    expect(result.success).toBe(false)
    if (!result.success) expect(result.message).toContain('Failed')
  })
})

// ---------------------------------------------------------------------------
// replayAllDeadLetters
// ---------------------------------------------------------------------------

describe('replayAllDeadLetters', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('rejects non-owned script', async () => {
    mockedGetOwnedScript.mockResolvedValue(null)

    const result = await replayAllDeadLetters(SCRIPT_SLUG, OWNER_ID)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.status).toBe(404)
  })

  it('rejects when no dead letters exist', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetEventsByScriptId.mockResolvedValue([])

    const result = await replayAllDeadLetters(SCRIPT_SLUG, OWNER_ID)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.message).toContain('No dead-letter')
  })

  it('replays all dead letters', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetEventsByScriptId.mockResolvedValue([
      eventRow({ id: 'e1', delivery_status: 'dead_letter' }),
      eventRow({ id: 'e2', delivery_status: 'dead_letter' }),
      eventRow({ id: 'e3', delivery_status: 'dead_letter' }),
    ])
    mockedReplayDeadLetterEvent
      .mockResolvedValueOnce(eventRow({ id: 'e1', delivery_status: 'pending' }))
      .mockResolvedValueOnce(eventRow({ id: 'e2', delivery_status: 'pending' }))
      .mockResolvedValueOnce(null) // e3 fails

    const result = await replayAllDeadLetters(SCRIPT_SLUG, OWNER_ID)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.replayed).toBe(2)
      expect(result.message).toContain('2 of 3')
    }
  })

  it('only fetches dead_letter status events', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetEventsByScriptId.mockResolvedValue([])

    await replayAllDeadLetters(SCRIPT_SLUG, OWNER_ID)

    expect(mockedGetEventsByScriptId).toHaveBeenCalledWith(SCRIPT_ID, {
      deliveryStatus: 'dead_letter',
    })
  })
})
