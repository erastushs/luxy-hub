import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { EventLogRow } from '@/app/lib/repositories/event-repository'

vi.mock('@/app/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

import { supabaseAdmin } from '@/app/lib/supabase'
import {
  ALLOWED_EVENT_TYPES,
  createEventLog,
  findEventByNonce,
  getPendingEvents,
  getEventsByScriptId,
  updateEventDeliveryStatus,
  isValidEventType,
} from '@/app/lib/repositories/event-repository'

type QueryChain = {
  insert: Mock
  update: Mock
  select: Mock
  eq: Mock
  order: Mock
  limit: Mock
  range: Mock
  maybeSingle: Mock
  single: Mock
  then: (resolve: (value: { data?: unknown; error: unknown }) => void) => void
}

function mockEventRow(overrides: Partial<EventLogRow> = {}): EventLogRow {
  return {
    id: 'event-uuid-1',
    script_id: 'script-uuid-1',
    session_id: 'session-uuid-1',
    event_type: 'execute',
    payload: { player: 'Player1' },
    delivery_status: 'pending',
    retry_count: 0,
    timestamp: '2026-06-09T12:00:00.000Z',
    received_at: '2026-06-09T12:00:01.000Z',
    nonce: 'a'.repeat(32),
    last_retry_at: null,
    delivered_at: null,
    error_message: null,
    created_at: '2026-06-09T12:00:01.000Z',
    ...overrides,
  }
}

function createQueryChain(
  data: EventLogRow | EventLogRow[] | null,
  error: unknown = null
): QueryChain {
  const chain = {} as QueryChain
  chain.insert = vi.fn(() => chain)
  chain.update = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.limit = vi.fn(() => chain)
  chain.range = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(async () => ({
    data: Array.isArray(data) ? data[0] ?? null : data,
    error,
  }))
  chain.single = vi.fn(async () => ({
    data: Array.isArray(data) ? data[0] ?? null : data,
    error,
  }))
  chain.then = (resolve) => {
    resolve({ data: Array.isArray(data) ? data : data, error })
  }
  return chain
}

describe('event repository', () => {
  const mockedFrom = supabaseAdmin.from as unknown as Mock

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('creates an event log with required event platform fields', async () => {
    const row = mockEventRow()
    const chain = createQueryChain(row)
    mockedFrom.mockReturnValue(chain)

    const result = await createEventLog({
      scriptId: 'script-uuid-1',
      sessionId: 'session-uuid-1',
      eventType: 'execute',
      payload: { player: 'Player1' },
      timestamp: '2026-06-09T12:00:00.000Z',
      nonce: 'a'.repeat(32),
    })

    expect(result.id).toBe('event-uuid-1')
    expect(result.event_type).toBe('execute')
    expect(result.delivery_status).toBe('pending')
    expect(result.retry_count).toBe(0)
    expect(chain.insert).toHaveBeenCalledWith({
      script_id: 'script-uuid-1',
      session_id: 'session-uuid-1',
      event_type: 'execute',
      payload: { player: 'Player1' },
      timestamp: '2026-06-09T12:00:00.000Z',
      nonce: 'a'.repeat(32),
    })
  })

  it('propagates event insert errors from database constraints', async () => {
    const chain = createQueryChain(null, new Error('event_type check violation'))
    mockedFrom.mockReturnValue(chain)

    await expect(
      createEventLog({
        scriptId: 'script-uuid-1',
        sessionId: 'session-uuid-1',
        eventType: 'execute',
        payload: {},
        timestamp: '2026-06-09T12:00:00.000Z',
        nonce: 'a'.repeat(32),
      })
    ).rejects.toThrow('event_type check violation')
  })

  it('looks up nonce inside session scope', async () => {
    const chain = createQueryChain(mockEventRow({ nonce: 'b'.repeat(32) }))
    mockedFrom.mockReturnValue(chain)

    const result = await findEventByNonce('session-uuid-1', 'b'.repeat(32))

    expect(result!.nonce).toBe('b'.repeat(32))
    expect(chain.eq).toHaveBeenCalledWith('session_id', 'session-uuid-1')
    expect(chain.eq).toHaveBeenCalledWith('nonce', 'b'.repeat(32))
  })

  it('selects pending events in FIFO order', async () => {
    const chain = createQueryChain([
      mockEventRow({ id: 'evt-1', received_at: '2026-06-09T12:00:00.000Z' }),
      mockEventRow({ id: 'evt-2', received_at: '2026-06-09T12:00:01.000Z' }),
    ])
    mockedFrom.mockReturnValue(chain)

    const result = await getPendingEvents(25)

    expect(result).toHaveLength(2)
    expect(chain.eq).toHaveBeenCalledWith('delivery_status', 'pending')
    expect(chain.order).toHaveBeenCalledWith('received_at', { ascending: true })
    expect(chain.limit).toHaveBeenCalledWith(25)
  })

  it('selects events by script, event type, and delivery status', async () => {
    const chain = createQueryChain([mockEventRow({ event_type: 'error' })])
    mockedFrom.mockReturnValue(chain)

    await getEventsByScriptId('script-uuid-1', {
      eventType: 'error',
      deliveryStatus: 'dead_letter',
      limit: 10,
      offset: 20,
    })

    expect(chain.eq).toHaveBeenCalledWith('script_id', 'script-uuid-1')
    expect(chain.eq).toHaveBeenCalledWith('event_type', 'error')
    expect(chain.eq).toHaveBeenCalledWith('delivery_status', 'dead_letter')
    expect(chain.range).toHaveBeenCalledWith(20, 29)
  })

  it('updates delivery status without provider logic', async () => {
    const row = mockEventRow({
      delivery_status: 'delivered',
      delivered_at: '2026-06-09T12:00:02.000Z',
    })
    const chain = createQueryChain(row)
    mockedFrom.mockReturnValue(chain)

    const result = await updateEventDeliveryStatus({
      eventId: 'event-uuid-1',
      deliveryStatus: 'delivered',
      deliveredAt: '2026-06-09T12:00:02.000Z',
      errorMessage: null,
    })

    expect(result!.delivery_status).toBe('delivered')
    expect(chain.update).toHaveBeenCalledWith({
      delivery_status: 'delivered',
      delivered_at: '2026-06-09T12:00:02.000Z',
      error_message: null,
    })
  })

  describe('event allowlist enforcement', () => {
    it.each(ALLOWED_EVENT_TYPES)('accepts allowed event type: %s', (eventType) => {
      expect(isValidEventType(eventType)).toBe(true)
    })

    it.each([
      'unknown',
      'custom_event',
      'EXECUTE',
      '',
      ' ',
      'execute ',
      'network_call',
      'chat_message',
      'enter_world',
      'leave_world',
    ])('rejects disallowed event type: %s', (eventType) => {
      expect(isValidEventType(eventType)).toBe(false)
    })

    it('has exactly the Phase 8B.1 allowed event types', () => {
      expect(ALLOWED_EVENT_TYPES).toEqual([
        'execute',
        'purchase',
        'error',
        'ban',
        'key_redeem',
        'heartbeat',
        'license_activate',
        'license_revoke',
      ])
    })
  })
})
