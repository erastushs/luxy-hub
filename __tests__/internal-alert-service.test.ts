import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Pure function tests (no supabase needed)
// ---------------------------------------------------------------------------

import { evaluateThresholds } from '@/app/lib/services/internal-alert-service'
import type { AlertType } from '@/app/lib/services/internal-alert-service'

describe('evaluateThresholds (pure)', () => {
  it('returns empty when all values are 0', () => {
    const values: Record<AlertType, number> = {
      queue_backlog_spike: 0, dead_letter_spike: 0, invalid_signature_spike: 0,
      replay_attack_spike: 0, webhook_failure_burst: 0, auth_failure_spike: 0,
    }
    expect(evaluateThresholds(values)).toEqual([])
  })

  it('triggers queue_backlog_spike low at 100', () => {
    const evals = evaluateThresholds({
      queue_backlog_spike: 150, dead_letter_spike: 0, invalid_signature_spike: 0,
      replay_attack_spike: 0, webhook_failure_burst: 0, auth_failure_spike: 0,
    })
    expect(evals).toHaveLength(1)
    expect(evals[0].alertType).toBe('queue_backlog_spike')
    expect(evals[0].severity).toBe('low')
  })

  it('triggers critical at 5000', () => {
    expect(evaluateThresholds({
      queue_backlog_spike: 6000, dead_letter_spike: 0, invalid_signature_spike: 0,
      replay_attack_spike: 0, webhook_failure_burst: 0, auth_failure_spike: 0,
    })[0].severity).toBe('critical')
  })

  it('does not trigger at threshold-1', () => {
    expect(evaluateThresholds({
      queue_backlog_spike: 99, dead_letter_spike: 0, invalid_signature_spike: 0,
      replay_attack_spike: 0, webhook_failure_burst: 0, auth_failure_spike: 0,
    })).toEqual([])
  })

  it('triggers at exact boundary', () => {
    expect(evaluateThresholds({
      queue_backlog_spike: 100, dead_letter_spike: 0, invalid_signature_spike: 0,
      replay_attack_spike: 0, webhook_failure_burst: 0, auth_failure_spike: 0,
    })[0].severity).toBe('low')
  })

  it('invalid_signature_spike low at 20', () => {
    expect(evaluateThresholds({
      queue_backlog_spike: 0, dead_letter_spike: 0, invalid_signature_spike: 20,
      replay_attack_spike: 0, webhook_failure_burst: 0, auth_failure_spike: 0,
    })[0].severity).toBe('low')
  })

  it('replay_attack_spike critical at 100', () => {
    expect(evaluateThresholds({
      queue_backlog_spike: 0, dead_letter_spike: 0, invalid_signature_spike: 0,
      replay_attack_spike: 100, webhook_failure_burst: 0, auth_failure_spike: 0,
    })[0].severity).toBe('critical')
  })

  it('auth_failure_spike low at 30', () => {
    expect(evaluateThresholds({
      queue_backlog_spike: 0, dead_letter_spike: 0, invalid_signature_spike: 0,
      replay_attack_spike: 0, webhook_failure_burst: 0, auth_failure_spike: 30,
    })[0].severity).toBe('low')
  })

  it('webhook_failure_burst low at 10', () => {
    expect(evaluateThresholds({
      queue_backlog_spike: 0, dead_letter_spike: 0, invalid_signature_spike: 0,
      replay_attack_spike: 0, webhook_failure_burst: 10, auth_failure_spike: 0,
    })[0].severity).toBe('low')
  })

  it('dead_letter_spike medium at 50', () => {
    const evals = evaluateThresholds({
      queue_backlog_spike: 0, dead_letter_spike: 60, invalid_signature_spike: 0,
      replay_attack_spike: 0, webhook_failure_burst: 0, auth_failure_spike: 0,
    })
    expect(evals[0].severity).toBe('medium')
  })

  it('queue high at 1000', () => {
    expect(evaluateThresholds({
      queue_backlog_spike: 1500, dead_letter_spike: 0, invalid_signature_spike: 0,
      replay_attack_spike: 0, webhook_failure_burst: 0, auth_failure_spike: 0,
    })[0].severity).toBe('high')
  })

  it('returns multiple evaluations all critical', () => {
    const evals = evaluateThresholds({
      queue_backlog_spike: 6000, dead_letter_spike: 600,
      invalid_signature_spike: 600, replay_attack_spike: 200,
      webhook_failure_burst: 600, auth_failure_spike: 1200,
    })
    expect(evals).toHaveLength(6)
    for (const e of evals) expect(e.severity).toBe('critical')
  })
})

// ---------------------------------------------------------------------------
// Integration: checkAlerts (mocked supabase)
// ---------------------------------------------------------------------------

let countValues: { count: number }[] = []
let countIdx = 0
let activeAlertsStore: { alert_type: string; id: string; threshold_value: number }[] = []

// Build thenable chains using Proxy to avoid explicit Function types
function thenable<T>(obj: Record<string, unknown>, resolver: (resolve: (v: T) => void) => void): unknown {
  const proxy = new Proxy(obj, {
    get(target, prop) {
      if (prop === 'then') return (fn: (v: T) => void) => { resolver(fn) }
      return target[prop as string]
    },
  })
  return proxy
}

vi.mock('@/app/lib/services/event-monitoring-service', async () => {
  const actual = await vi.importActual('@/app/lib/services/event-monitoring-service')
  return { ...actual, getQueueSnapshot: vi.fn() }
})

vi.mock('@/app/lib/supabase', () => {
  type Row = { id: string; alert_type: string; severity: 'low'; status: 'active'; current_value: number; threshold_value: number; message: string; created_at: string; resolved_at: null }

  const makeRow = (a: { alert_type: string; id: string; threshold_value: number }): Row => ({
    id: a.id, alert_type: a.alert_type, severity: 'low', status: 'active',
    current_value: 0, threshold_value: a.threshold_value, message: '',
    created_at: new Date().toISOString(), resolved_at: null,
  })

  return {
    supabaseAdmin: {
      from: (table: string) => ({
        select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
          const isCount = !!(typeof opts === 'object' && opts !== null && (opts as Record<string, unknown>).count === 'exact' && (opts as Record<string, unknown>).head === true)

          if (table === 'verification_logs') {
            return {
              eq: () => ({
                gte: () => {
                  const v = countValues[countIdx] ?? { count: 0 }
                  countIdx++
                  return { count: v.count, error: null }
                },
              }),
            }
          }

          // alert_events — the root select returns a chain
          const root: Record<string, unknown> = {}

          // Default thenable for when .select() is awaited directly
          const defaultResolver = (resolve: (v: { data: Row[]; error: null } | { count: number; error: null }) => void) => {
            if (isCount) resolve({ count: activeAlertsStore.length, error: null })
            else resolve({ data: activeAlertsStore.map(makeRow), error: null })
          }

          Object.assign(root, {
            then: defaultResolver,

            eq: (field: string, value: unknown) => {
              if (field === 'alert_type') {
                return {
                  eq: () => ({
                    limit: () => ({
                      maybeSingle: async () => {
                        const found = activeAlertsStore.find(a => a.alert_type === value)
                        return { data: found ? makeRow(found) : null, error: null }
                      },
                    }),
                  }),
                }
              }

              // Status or severity eq
              const eqObj: Record<string, unknown> = {}

              eqObj.then = (resolve: (v: { data: Row[]; error: null } | { count: number; error: null }) => void) => {
                if (isCount) resolve({ count: value === 'active' ? activeAlertsStore.length : 0, error: null })
                else resolve({ data: activeAlertsStore.map(makeRow), error: null })
              }

              eqObj.eq = () => thenable({}, (resolve: (v: { count: number; error: null }) => void) => {
                resolve({ count: 0, error: null })
              })

              eqObj.order = () => ({
                range: () => Promise.resolve({ data: activeAlertsStore.map(makeRow), error: null }),
              })

              return eqObj
            },

            order: () => ({
              range: () => Promise.resolve({ data: activeAlertsStore.map(makeRow), error: null }),
            }),
          })

          return root
        },
        insert: () => ({
          select: () => ({
            single: async () => {
              return { data: { id: `alert-${activeAlertsStore.length + 1}` }, error: null }
            },
          }),
        }),
        update: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }),
    },
  }
})

import { getQueueSnapshot } from '@/app/lib/services/event-monitoring-service'
import { checkAlerts } from '@/app/lib/services/internal-alert-service'

const mockedGetQueueSnapshot = vi.mocked(getQueueSnapshot)

function resetMocks() {
  countIdx = 0
  countValues = Array(10).fill({ count: 0 })
  activeAlertsStore = []
  mockedGetQueueSnapshot.mockResolvedValue({ pendingCount: 0, deadLetterCount: 0, oldestPendingAgeSeconds: null })
}

function setSec(invalid: number, replay: number, auth: number, webhook: number) {
  countValues = [{ count: invalid }, { count: replay }, { count: auth }, { count: webhook }]
}

describe('checkAlerts integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
  })

  it('creates alert when queue backlog exceeds threshold', async () => {
    mockedGetQueueSnapshot.mockResolvedValue({ pendingCount: 600, deadLetterCount: 0, oldestPendingAgeSeconds: null })
    expect((await checkAlerts()).triggered).toBe(1)
  })

  it('does not create alert below threshold', async () => {
    mockedGetQueueSnapshot.mockResolvedValue({ pendingCount: 50, deadLetterCount: 0, oldestPendingAgeSeconds: null })
    expect((await checkAlerts()).triggered).toBe(0)
  })

  it('creates alert for invalid signature spike', async () => {
    setSec(25, 0, 0, 0)
    expect((await checkAlerts()).triggered).toBe(1)
  })

  it('creates alert for replay attack spike', async () => {
    setSec(0, 6, 0, 0)
    expect((await checkAlerts()).triggered).toBe(1)
  })

  it('creates alert for auth failure spike', async () => {
    setSec(0, 0, 35, 0)
    expect((await checkAlerts()).triggered).toBe(1)
  })

  it('creates alert for webhook failure burst', async () => {
    setSec(0, 0, 0, 15)
    expect((await checkAlerts()).triggered).toBe(1)
  })

  it('creates multiple alerts', async () => {
    mockedGetQueueSnapshot.mockResolvedValue({ pendingCount: 6000, deadLetterCount: 600, oldestPendingAgeSeconds: null })
    setSec(600, 200, 0, 0)
    expect((await checkAlerts()).triggered).toBeGreaterThanOrEqual(2)
  })
})

describe('duplicate suppression', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMocks() })

  it('does not create duplicate when active alert exists', async () => {
    activeAlertsStore.push({ alert_type: 'queue_backlog_spike', id: 'existing-1', threshold_value: 500 })
    mockedGetQueueSnapshot.mockResolvedValue({ pendingCount: 600, deadLetterCount: 0, oldestPendingAgeSeconds: null })
    expect((await checkAlerts()).triggered).toBe(0)
  })

  it('creates alert for other type', async () => {
    activeAlertsStore.push({ alert_type: 'queue_backlog_spike', id: 'existing-1', threshold_value: 500 })
    mockedGetQueueSnapshot.mockResolvedValue({ pendingCount: 600, deadLetterCount: 600, oldestPendingAgeSeconds: null })
    expect((await checkAlerts()).triggered).toBe(1)
  })
})

describe('alert resolution', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMocks() })

  it('resolves when metrics drop below threshold', async () => {
    activeAlertsStore.push({ alert_type: 'queue_backlog_spike', id: 'ex-1', threshold_value: 500 })
    mockedGetQueueSnapshot.mockResolvedValue({ pendingCount: 0, deadLetterCount: 0, oldestPendingAgeSeconds: null })
    expect((await checkAlerts()).resolved).toBe(1)
  })

  it('does not resolve when still above threshold', async () => {
    activeAlertsStore.push({ alert_type: 'queue_backlog_spike', id: 'ex-1', threshold_value: 500 })
    mockedGetQueueSnapshot.mockResolvedValue({ pendingCount: 600, deadLetterCount: 0, oldestPendingAgeSeconds: null })
    expect((await checkAlerts()).resolved).toBe(0)
  })
})

describe('discord notification gating', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMocks() })

  it('does not crash when env var absent', async () => {
    mockedGetQueueSnapshot.mockResolvedValue({ pendingCount: 6000, deadLetterCount: 0, oldestPendingAgeSeconds: null })
    expect((await checkAlerts()).triggered).toBe(1)
  })
})
