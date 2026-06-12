import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAnalyticsV2Overview, getOverview, getScriptStats, getTopScripts } from '@/app/lib/services/analytics-service'

const OWNER_A = '00000000-0000-0000-0000-00000000000a'
const OWNER_B = '00000000-0000-0000-0000-00000000000b'

const scriptRows = [
  { visibility: 'public', execute_count: 10 },
  { visibility: 'private', execute_count: 5 },
  { visibility: 'unlisted', execute_count: 2 },
]

vi.mock('@/app/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

vi.mock('@/app/lib/repositories/script-repository', () => ({
  findScriptBySlugForOwner: vi.fn(),
}))

vi.mock('@/app/lib/repositories/script-execution-repository', () => ({
  getTopScripts: vi.fn(),
}))

vi.mock('@/app/lib/auth/session-auth', () => ({
  AuthError: class AuthError extends Error {
    status: number

    constructor(message: string, status: number = 401) {
      super(message)
      this.name = 'AuthError'
      this.status = status
    }
  },
  requireAuth: vi.fn(),
}))

vi.mock('@/app/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
  getClientIP: vi.fn(() => '127.0.0.1'),
}))

import { supabaseAdmin } from '@/app/lib/supabase'
import { AuthError, requireAuth } from '@/app/lib/auth/session-auth'
import { checkRateLimit } from '@/app/lib/rate-limiter'
import { findScriptBySlugForOwner } from '@/app/lib/repositories/script-repository'
import { getTopScripts as getTopScriptsRepo } from '@/app/lib/repositories/script-execution-repository'
import { GET as overviewRoute } from '@/app/api/dashboard/analytics/overview/route'

const mockedFrom = vi.mocked(supabaseAdmin.from)
const mockedRequireAuth = vi.mocked(requireAuth)
const mockedCheckRateLimit = vi.mocked(checkRateLimit)
const mockedFindScriptBySlugForOwner = vi.mocked(findScriptBySlugForOwner)
const mockedGetTopScriptsRepo = vi.mocked(getTopScriptsRepo)

function mockScriptsSelect(data: Array<{ visibility: string; execute_count: number }> | null, error: unknown = null) {
  const eq = vi.fn().mockResolvedValue({ data, error })
  const select = vi.fn().mockReturnValue({ eq })
  mockedFrom.mockReturnValue({ select } as never)
  return { select, eq }
}

describe('Analytics V1 service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedRequireAuth.mockResolvedValue({ id: OWNER_A, email: 'creator@example.test' })
    mockedCheckRateLimit.mockResolvedValue({ allowed: true })
  })

  describe('getOverview', () => {
    it('returns execution overview for a creator', async () => {
      mockScriptsSelect(scriptRows)

      const result = await getOverview(OWNER_A)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.overview).toEqual({
          total_scripts: 3,
          published_scripts: 1,
          private_scripts: 1,
          unlisted_scripts: 1,
          total_executions: 17,
        })
      }
    })

    it('scopes overview by owner id', async () => {
      const { eq } = mockScriptsSelect(scriptRows)

      await getOverview(OWNER_A)

      expect(mockedFrom).toHaveBeenCalledWith('scripts')
      expect(eq).toHaveBeenCalledWith('creator_id', OWNER_A)
      expect(eq).not.toHaveBeenCalledWith('creator_id', OWNER_B)
    })

    it('does not expose raw execution rows or legacy download fields', async () => {
      mockScriptsSelect(scriptRows)

      const result = await getOverview(OWNER_A)

      expect(result.success).toBe(true)
      if (result.success) {
        const overview = result.overview as Record<string, unknown>
        expect(overview).toHaveProperty('total_executions')
        expect(overview).not.toHaveProperty('script_id')
        expect(overview).not.toHaveProperty('session_id')
        expect(overview).not.toHaveProperty('total_downloads')
        expect(overview).not.toHaveProperty('downloads_7d')
      }
    })
  })

  describe('getAnalyticsV2Overview', () => {
    it('returns authorization, license, delivery, and runtime metrics', async () => {
      mockedFrom.mockImplementation((table: string) => {
        if (table === 'scripts') {
          const select = vi.fn((columns: string) => ({
            eq: vi.fn().mockResolvedValue({
              data: columns === 'id'
                ? [{ id: 'script-uuid-1' }, { id: 'script-uuid-2' }]
                : scriptRows,
              error: null,
            }),
          }))
          return { select } as never
        }

        if (table === 'licenses') {
          const select = vi.fn((columns: string) => {
            if (columns.includes('license_assignments')) {
              return { eq: vi.fn().mockResolvedValue({
                data: [
                  { id: 'license-1', license_assignments: [{ status: 'active' }] },
                  { id: 'license-2', license_assignments: [{ status: 'revoked' }] },
                ],
                error: null,
              }) }
            }

            return { eq: vi.fn().mockResolvedValue({
            data: [
              { status: 'active', max_assignments: 2 },
              { status: 'revoked', max_assignments: 1 },
            ],
            error: null,
            }) }
          })
          return { select } as never
        }

        if (table === 'audit_logs') {
          const inGte = vi.fn().mockResolvedValue({
            data: [
              { action: 'license.authorization_allowed', metadata: { reason: 'assignment_reused' } },
              { action: 'license.authorization_denied', metadata: { reason: 'capacity_exhausted' } },
            ],
            error: null,
          })
          const actionGte = vi.fn().mockResolvedValue({
            data: [{ action: 'delivery.session_created' }],
            error: null,
          })
          const actionEq = vi.fn(() => ({ gte: actionGte }))
          const inFilter = vi.fn(() => ({ gte: inGte }))
          const eqActor = vi.fn(() => ({ in: inFilter, eq: actionEq }))
          return { select: vi.fn(() => ({ eq: eqActor })) } as never
        }

        if (table === 'event_logs') {
          const gte = vi.fn().mockResolvedValue({
            data: [
              { event_type: 'execute', delivery_status: 'delivered' },
              { event_type: 'error', delivery_status: 'dead_letter' },
            ],
            error: null,
          })
          const secondIn = vi.fn(() => ({ gte }))
          const firstIn = vi.fn(() => ({ in: secondIn }))
          return { select: vi.fn(() => ({ in: firstIn })) } as never
        }

        return { select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })) } as never
      })

      const result = await getAnalyticsV2Overview(OWNER_A)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.overview.total_executions).toBe(17)
        expect(result.overview.authorization).toEqual({
          success: 1,
          failure: 1,
          denial_reasons: { capacity_exhausted: 1 },
        })
        expect(result.overview.licenses).toEqual({
          active: 1,
          revoked: 1,
          disabled: 0,
          assignment_utilization: 1 / 3,
        })
        expect(result.overview.delivery).toEqual({
          session_creation: 1,
          payload_fetch: null,
          fetch_failures: null,
        })
        expect(result.overview.runtime).toEqual({
          starts: 1,
          failures: 1,
          execution_volume: 17,
        })
      }
    })

    it('applies the requested time window to audit and runtime event queries', async () => {
      const gteCalls: Array<[string, string]> = []

      mockedFrom.mockImplementation((table: string) => {
        if (table === 'scripts') {
          const select = vi.fn((columns: string) => ({
            eq: vi.fn().mockResolvedValue({
              data: columns === 'id' ? [{ id: 'script-uuid-1' }] : scriptRows,
              error: null,
            }),
          }))
          return { select } as never
        }

        if (table === 'licenses') {
          return { select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })) } as never
        }

        if (table === 'audit_logs') {
          const gte = vi.fn((column: string, value: string) => {
            gteCalls.push([column, value])
            return Promise.resolve({ data: [], error: null })
          })
          const eqAction = vi.fn(() => ({ gte }))
          const inAction = vi.fn(() => ({ gte }))
          const eqActor = vi.fn(() => ({ in: inAction, eq: eqAction }))
          return { select: vi.fn(() => ({ eq: eqActor })) } as never
        }

        if (table === 'event_logs') {
          const gte = vi.fn((column: string, value: string) => {
            gteCalls.push([column, value])
            return Promise.resolve({ data: [], error: null })
          })
          const secondIn = vi.fn(() => ({ gte }))
          const firstIn = vi.fn(() => ({ in: secondIn }))
          return { select: vi.fn(() => ({ in: firstIn })) } as never
        }

        return { select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })) } as never
      })

      const result = await getAnalyticsV2Overview(OWNER_A, { windowDays: 7 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.overview.window_days).toBe(7)
      }
      expect(gteCalls.map(([column]) => column)).toEqual(expect.arrayContaining([
        'created_at',
        'received_at',
      ]))
    })

    it.each([
      [7, 7],
      [30, 30],
      [90, 90],
      [45, 90],
    ])('normalizes Analytics V2 window_days=%s to %s', async (requested, expected) => {
      mockedFrom.mockImplementation((table: string) => {
        if (table === 'scripts') {
          const select = vi.fn((columns: string) => ({
            eq: vi.fn().mockResolvedValue({
              data: columns === 'id' ? [{ id: 'script-uuid-1' }] : scriptRows,
              error: null,
            }),
          }))
          return { select } as never
        }

        if (table === 'licenses') {
          return { select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })) } as never
        }

        if (table === 'audit_logs') {
          const gte = vi.fn().mockResolvedValue({ data: [], error: null })
          const eqAction = vi.fn(() => ({ gte }))
          const inAction = vi.fn(() => ({ gte }))
          const eqActor = vi.fn(() => ({ in: inAction, eq: eqAction }))
          return { select: vi.fn(() => ({ eq: eqActor })) } as never
        }

        if (table === 'event_logs') {
          const gte = vi.fn().mockResolvedValue({ data: [], error: null })
          const secondIn = vi.fn(() => ({ gte }))
          const firstIn = vi.fn(() => ({ in: secondIn }))
          return { select: vi.fn(() => ({ in: firstIn })) } as never
        }

        return { select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })) } as never
      })

      const result = await getAnalyticsV2Overview(OWNER_A, { windowDays: requested })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.overview.window_days).toBe(expected)
      }
    })

    it('derives V2 metrics from real audit, license, and runtime event rows', async () => {
      mockedFrom.mockImplementation((table: string) => {
        if (table === 'scripts') {
          const select = vi.fn((columns: string) => ({
            eq: vi.fn().mockResolvedValue({
              data: columns === 'id'
                ? [{ id: 'script-uuid-1' }, { id: 'script-uuid-2' }]
                : scriptRows,
              error: null,
            }),
          }))
          return { select } as never
        }

        if (table === 'licenses') {
          const select = vi.fn((columns: string) => {
            if (columns.includes('license_assignments')) {
              return { eq: vi.fn().mockResolvedValue({
                data: [
                  { id: 'license-1', license_assignments: [{ status: 'active' }, { status: 'disabled' }] },
                  { id: 'license-2', license_assignments: [{ status: 'active' }] },
                ],
                error: null,
              }) }
            }

            return { eq: vi.fn().mockResolvedValue({
              data: [
                { status: 'active', max_assignments: 2 },
                { status: 'disabled', max_assignments: 2 },
                { status: 'revoked', max_assignments: 1 },
              ],
              error: null,
            }) }
          })
          return { select } as never
        }

        if (table === 'audit_logs') {
          const authRows = [
            { action: 'license.authorization_allowed', metadata: { reason: 'assignment_reused' } },
            { action: 'license.authorization_allowed', metadata: { reason: 'assignment_created' } },
            { action: 'license.authorization_denied', metadata: { reason: 'capacity_exhausted' } },
            { action: 'license.authorization_denied', metadata: null },
          ]
          const deliveryRows = [
            { action: 'delivery.session_created' },
            { action: 'delivery.session_created' },
            { action: 'delivery.session_created' },
          ]
          const inGte = vi.fn().mockResolvedValue({ data: authRows, error: null })
          const actionGte = vi.fn().mockResolvedValue({ data: deliveryRows, error: null })
          const actionEq = vi.fn(() => ({ gte: actionGte }))
          const inFilter = vi.fn(() => ({ gte: inGte }))
          const eqActor = vi.fn(() => ({ in: inFilter, eq: actionEq }))
          return { select: vi.fn(() => ({ eq: eqActor })) } as never
        }

        if (table === 'event_logs') {
          const gte = vi.fn().mockResolvedValue({
            data: [
              { event_type: 'execute', delivery_status: 'delivered' },
              { event_type: 'heartbeat', delivery_status: 'pending' },
              { event_type: 'error', delivery_status: 'pending' },
              { event_type: 'execute', delivery_status: 'dead_letter' },
            ],
            error: null,
          })
          const secondIn = vi.fn(() => ({ gte }))
          const firstIn = vi.fn(() => ({ in: secondIn }))
          return { select: vi.fn(() => ({ in: firstIn })) } as never
        }

        return { select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })) } as never
      })

      const result = await getAnalyticsV2Overview(OWNER_A, { windowDays: 30 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.overview.authorization).toEqual({
          success: 2,
          failure: 2,
          denial_reasons: { capacity_exhausted: 1, unknown: 1 },
        })
        expect(result.overview.licenses).toEqual({
          active: 1,
          revoked: 1,
          disabled: 1,
          assignment_utilization: 2 / 5,
        })
        expect(result.overview.delivery.session_creation).toBe(3)
        expect(result.overview.runtime).toEqual({
          starts: 3,
          failures: 2,
          execution_volume: 17,
        })
      }
    })

    it('falls back to zeroed derived metrics when event or audit queries fail', async () => {
      mockedFrom.mockImplementation((table: string) => {
        if (table === 'scripts') {
          const select = vi.fn((columns: string) => ({
            eq: vi.fn().mockResolvedValue({
              data: columns === 'id' ? [{ id: 'script-uuid-1' }] : scriptRows,
              error: null,
            }),
          }))
          return { select } as never
        }

        if (table === 'licenses') {
          return { select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'license query failed' } }) })) } as never
        }

        if (table === 'audit_logs') {
          const gte = vi.fn().mockResolvedValue({ data: null, error: { message: 'audit query failed' } })
          const eqAction = vi.fn(() => ({ gte }))
          const inAction = vi.fn(() => ({ gte }))
          const eqActor = vi.fn(() => ({ in: inAction, eq: eqAction }))
          return { select: vi.fn(() => ({ eq: eqActor })) } as never
        }

        if (table === 'event_logs') {
          const gte = vi.fn().mockResolvedValue({ data: null, error: { message: 'event query failed' } })
          const secondIn = vi.fn(() => ({ gte }))
          const firstIn = vi.fn(() => ({ in: secondIn }))
          return { select: vi.fn(() => ({ in: firstIn })) } as never
        }

        return { select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })) } as never
      })

      const result = await getAnalyticsV2Overview(OWNER_A, { windowDays: 30 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.overview.authorization).toEqual({ success: 0, failure: 0, denial_reasons: {} })
        expect(result.overview.licenses).toEqual({ active: 0, revoked: 0, disabled: 0, assignment_utilization: 0 })
        expect(result.overview.delivery).toEqual({ session_creation: 0, payload_fetch: null, fetch_failures: null })
        expect(result.overview.runtime).toEqual({ starts: 0, failures: 0, execution_volume: 17 })
      }
    })
  })

  describe('analytics overview route versioning', () => {
    it('defaults to the V1 overview shape', async () => {
      mockScriptsSelect(scriptRows)

      const response = await overviewRoute(new Request('https://example.test/api/dashboard/analytics/overview') as never)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.overview).toHaveProperty('total_executions', 17)
      expect(body.overview).not.toHaveProperty('authorization')
    })

    it('returns V2 analytics when version=2 and passes window_days', async () => {
      mockedFrom.mockImplementation((table: string) => {
        if (table === 'scripts') {
          const select = vi.fn((columns: string) => ({
            eq: vi.fn().mockResolvedValue({
              data: columns === 'id' ? [{ id: 'script-uuid-1' }] : scriptRows,
              error: null,
            }),
          }))
          return { select } as never
        }

        if (table === 'licenses') {
          return { select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })) } as never
        }

        if (table === 'audit_logs') {
          const gte = vi.fn().mockResolvedValue({ data: [], error: null })
          const eqAction = vi.fn(() => ({ gte }))
          const inAction = vi.fn(() => ({ gte }))
          const eqActor = vi.fn(() => ({ in: inAction, eq: eqAction }))
          return { select: vi.fn(() => ({ eq: eqActor })) } as never
        }

        if (table === 'event_logs') {
          const gte = vi.fn().mockResolvedValue({ data: [], error: null })
          const secondIn = vi.fn(() => ({ gte }))
          const firstIn = vi.fn(() => ({ in: secondIn }))
          return { select: vi.fn(() => ({ in: firstIn })) } as never
        }

        return { select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })) } as never
      })

      const response = await overviewRoute(new Request('https://example.test/api/dashboard/analytics/overview?version=2&window_days=7') as never)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.overview).toHaveProperty('authorization')
      expect(body.overview).toHaveProperty('window_days', 7)
    })

    it('rejects unauthenticated analytics overview access', async () => {
      mockedRequireAuth.mockRejectedValue(new AuthError('Authentication required', 401))

      const response = await overviewRoute(new Request('https://example.test/api/dashboard/analytics/overview?version=2') as never)
      const body = await response.json()

      expect(response.status).toBe(401)
      expect(body).toEqual({ success: false, message: 'Authentication required' })
      expect(mockedFrom).not.toHaveBeenCalled()
    })

    it('rate limits authenticated analytics overview access before querying data', async () => {
      mockedCheckRateLimit.mockResolvedValue({ allowed: false, retryAfter: 60 })

      const response = await overviewRoute(new Request('https://example.test/api/dashboard/analytics/overview?version=2') as never)
      const body = await response.json()

      expect(response.status).toBe(429)
      expect(response.headers.get('Retry-After')).toBe('60')
      expect(body).toEqual({ success: false, message: 'Too many requests. Please try again later.' })
      expect(mockedFrom).not.toHaveBeenCalled()
    })
  })

  describe('getScriptStats', () => {
    it('returns execution analytics for an owned script', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue({
        id: 'script-uuid-1',
        slug: 'my-script',
        name: 'My Script',
        description: '',
        visibility: 'public',
        creator_id: OWNER_A,
        current_version_id: 'version-uuid-1',
        execute_count: 42,
        last_executed_at: '2026-01-01T00:00:00.000Z',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      })

      const result = await getScriptStats(OWNER_A, 'my-script')

      expect(result.success).toBe(true)
      expect(mockedFindScriptBySlugForOwner).toHaveBeenCalledWith('my-script', OWNER_A)
      if (result.success) {
        expect(result.analytics).toEqual({
          slug: 'my-script',
          total_executions: 42,
          last_executed_at: '2026-01-01T00:00:00.000Z',
        })
      }
    })

    it('returns 404 for foreign script analytics', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue(null)

      const result = await getScriptStats(OWNER_A, 'creator-b-script')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(404)
        expect(result.message).toBe('Script not found')
      }
    })
  })

  describe('getTopScripts', () => {
    it('returns top scripts from the execution repository', async () => {
      mockedGetTopScriptsRepo.mockResolvedValue([
        {
          name: 'My Script',
          slug: 'my-script',
          visibility: 'public',
          executions: 42,
          last_executed_at: '2026-01-01T00:00:00.000Z',
        },
      ])

      const result = await getTopScripts(OWNER_A, 5)

      expect(mockedGetTopScriptsRepo).toHaveBeenCalledWith(OWNER_A, 5)
      expect(result[0].executions).toBe(42)
      expect(result[0].last_executed_at).toBe('2026-01-01T00:00:00.000Z')
    })
  })
})
