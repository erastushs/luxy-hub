import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/lib/auth/ownership', () => ({
  getOwnedScript: vi.fn(),
}))

// 20 count values: 4 metrics × (24h,7d,30d,48h) + 4 event30d = 20
let countValues: number[] = Array(20).fill(0)
let countIdx = 0

vi.mock('@/app/lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: () => {
            const val = countValues[countIdx] ?? 0
            countIdx++
            return { count: val, error: null }
          },
        }),
      }),
    }),
  },
}))

import { getOwnedScript } from '@/app/lib/auth/ownership'
import { getSecurityDashboard } from '@/app/lib/services/security-monitoring-service'

const mockedGetOwnedScript = vi.mocked(getOwnedScript)

const OWNER_ID = 'owner-001'
const SCRIPT_SLUG = 'my-script'
const SCRIPT_ID = 'script-001'

function ownedScript() {
  return {
    id: SCRIPT_ID, slug: SCRIPT_SLUG, name: 'My Script', description: null,
    visibility: 'private' as const, creator_id: OWNER_ID, current_version_id: null,
    created_at: '2026-06-09T12:00:00.000Z', updated_at: '2026-06-09T12:00:00.000Z',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  countValues = Array(20).fill(0)
  countIdx = 0
  mockedGetOwnedScript.mockResolvedValue(ownedScript())
})

// ---------------------------------------------------------------------------
// Ownership
// ---------------------------------------------------------------------------

describe('ownership', () => {
  it('returns 404 when script is not owned', async () => {
    mockedGetOwnedScript.mockResolvedValue(null)
    const result = await getSecurityDashboard('unknown', OWNER_ID)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(404)
      expect(result.message).toBe('Script not found')
    }
  })

  it('does not leak script existence', async () => {
    mockedGetOwnedScript.mockResolvedValue(null)
    const result = await getSecurityDashboard(SCRIPT_SLUG, 'other')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.status).toBe(404)
  })

  it('resolves script by slug and userId', async () => {
    const result = await getSecurityDashboard(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    expect(mockedGetOwnedScript).toHaveBeenCalledWith(SCRIPT_SLUG, OWNER_ID)
  })
})

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

describe('aggregation accuracy', () => {
  it('returns zeroed dashboard when no events exist', async () => {
    const result = await getSecurityDashboard(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      const d = result.dashboard
      expect(d.overview.invalidSignatures).toBe(0)
      expect(d.overview.replayAttempts).toBe(0)
      expect(d.overview.rateLimitHits).toBe(0)
      expect(d.overview.authFailures).toBe(0)
      expect(d.overview.securityScore).toBe(100)
      expect(d.trends24h.total).toBe(0)
      expect(d.trends7d.total).toBe(0)
      expect(d.trends30d.total).toBe(0)
      expect(d.anomalies).toHaveLength(0)
      expect(d.events).toHaveLength(0)
    }
  })

  it('correctly aggregates metrics', async () => {
    // invalid: 10/30/50/15, replay: 2/5/8/2, rate: 5/12/20/5, auth: 20/50/100/25
    // event30d: 50/8/20/100
    countValues = [
      10, 30, 50, 15,
      2, 5, 8, 2,
      5, 12, 20, 5,
      20, 50, 100, 25,
      50, 8, 20, 100,
    ]
    const result = await getSecurityDashboard(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      const d = result.dashboard
      expect(d.overview.invalidSignatures).toBe(10)
      expect(d.overview.replayAttempts).toBe(2)
      expect(d.overview.rateLimitHits).toBe(5)
      expect(d.overview.authFailures).toBe(20)
      expect(d.trends24h.total).toBe(37)
      expect(d.trends7d.total).toBe(97)
      expect(d.trends30d.total).toBe(178)
    }
  })
})

// ---------------------------------------------------------------------------
// Risk classification
// ---------------------------------------------------------------------------

describe('risk classification', () => {
  it('LOW when score >= 80', async () => {
    // 24h: 2 inv, 0 rep, 1 rate, 3 auth → 100-(10+0+3+6)=81
    countValues = [2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0]
    const result = await getSecurityDashboard(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.dashboard.risk.level).toBe('LOW')
      expect(result.dashboard.risk.score).toBe(81)
    }
  })

  it('MEDIUM when score 50-79', async () => {
    // 24h: 6 inv, 0 rep, 3 rate, 5 auth → 100-(30+0+9+10)=51
    countValues = [6, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0]
    const result = await getSecurityDashboard(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.dashboard.risk.level).toBe('MEDIUM')
      expect(result.dashboard.risk.score).toBe(51)
    }
  })

  it('HIGH when score < 50', async () => {
    // 24h: 15 inv, 1 rep, 10 rate, 10 auth → 100-(75+10+30+20)=0
    countValues = [15, 0, 0, 0, 1, 0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 0, 0, 0, 0]
    const result = await getSecurityDashboard(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.dashboard.risk.level).toBe('HIGH')
      expect(result.dashboard.risk.score).toBe(0)
    }
  })

  it('includes replay trigger', async () => {
    countValues = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    const result = await getSecurityDashboard(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.dashboard.risk.triggers).toContain('1 replay attempt(s) detected')
    }
  })
})

// ---------------------------------------------------------------------------
// Anomaly detection
// ---------------------------------------------------------------------------

describe('anomaly detection', () => {
  it('detects 3× spike', async () => {
    // 24h=15, 48h=20 → baseline=5, ratio=3.0 ≥ 3 → HIGH
    countValues = [15, 0, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    const result = await getSecurityDashboard(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.dashboard.anomalies).toHaveLength(1)
      expect(result.dashboard.anomalies[0].metric).toBe('event.invalid_signature')
      expect(result.dashboard.anomalies[0].severity).toBe('HIGH')
    }
  })

  it('detects zero-baseline spike', async () => {
    // 24h=8, 48h=8 → baseline=0
    countValues = [0, 0, 0, 0, 8, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    const result = await getSecurityDashboard(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.dashboard.anomalies).toHaveLength(1)
      expect(result.dashboard.anomalies[0].severity).toBe('MEDIUM')
    }
  })

  it('no anomaly below threshold', async () => {
    countValues = [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    const result = await getSecurityDashboard(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.dashboard.anomalies).toHaveLength(0)
    }
  })
})

// ---------------------------------------------------------------------------
// Security score
// ---------------------------------------------------------------------------

describe('security score', () => {
  it('100 when no events', async () => {
    const result = await getSecurityDashboard(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) expect(result.dashboard.overview.securityScore).toBe(100)
  })

  it('decreases with replay', async () => {
    countValues = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    const result = await getSecurityDashboard(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) expect(result.dashboard.overview.securityScore).toBe(90)
  })

  it('caps at 0', async () => {
    countValues = [50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    const result = await getSecurityDashboard(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) expect(result.dashboard.overview.securityScore).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// DTO safety
// ---------------------------------------------------------------------------

describe('DTO safety', () => {
  it('never includes event_secret', async () => {
    const result = await getSecurityDashboard(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(JSON.stringify(result.dashboard)).not.toContain('event_secret')
    }
  })

  it('never includes webhook_url', async () => {
    const result = await getSecurityDashboard(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(JSON.stringify(result.dashboard)).not.toContain('webhook_url')
    }
  })

  it('never includes session_id', async () => {
    const result = await getSecurityDashboard(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(JSON.stringify(result.dashboard)).not.toContain('session_id')
    }
  })

  it('never includes nonce', async () => {
    const result = await getSecurityDashboard(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(JSON.stringify(result.dashboard)).not.toContain('nonce')
    }
  })

  it('never includes creator_id', async () => {
    const result = await getSecurityDashboard(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(JSON.stringify(result.dashboard)).not.toContain('creator_id')
    }
  })
})

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

describe('pagination', () => {
  it('returns page 1 metadata', async () => {
    const result = await getSecurityDashboard(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.dashboard.page).toBe(1)
      expect(result.dashboard.pageSize).toBe(10)
    }
  })

  it('returns correct total pages', async () => {
    countValues = Array(20).fill(0)
    countValues[16] = 1; countValues[17] = 2; countValues[18] = 3; countValues[19] = 4
    const result = await getSecurityDashboard(SCRIPT_SLUG, OWNER_ID, 1, 2)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.dashboard.totalEvents).toBe(4)
      expect(result.dashboard.totalPages).toBe(2)
      expect(result.dashboard.events).toHaveLength(2)
    }
  })
})

// ---------------------------------------------------------------------------
// Event severity
// ---------------------------------------------------------------------------

describe('event severity', () => {
  it('HIGH for replay_attempt', async () => {
    countValues = Array(20).fill(0)
    countValues[17] = 5
    const result = await getSecurityDashboard(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      const ev = result.dashboard.events.find(e => e.eventType === 'event.replay_attempt')
      expect(ev?.severity).toBe('HIGH')
    }
  })

  it('MEDIUM for invalid_signature and rate_limited', async () => {
    countValues = Array(20).fill(0)
    countValues[16] = 5; countValues[18] = 3
    const result = await getSecurityDashboard(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.dashboard.events.find(e => e.eventType === 'event.invalid_signature')?.severity).toBe('MEDIUM')
      expect(result.dashboard.events.find(e => e.eventType === 'event.rate_limited')?.severity).toBe('MEDIUM')
    }
  })

  it('LOW for auth_failure', async () => {
    countValues = Array(20).fill(0)
    countValues[19] = 10
    const result = await getSecurityDashboard(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.dashboard.events.find(e => e.eventType === 'event.auth_failure')?.severity).toBe('LOW')
    }
  })
})

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe('empty state', () => {
  it('empty anomalies', async () => {
    const result = await getSecurityDashboard(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.dashboard.anomalies).toHaveLength(0)
    }
  })

  it('empty events', async () => {
    const result = await getSecurityDashboard(SCRIPT_SLUG, OWNER_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.dashboard.events).toHaveLength(0)
      expect(result.dashboard.totalEvents).toBe(0)
    }
  })
})
