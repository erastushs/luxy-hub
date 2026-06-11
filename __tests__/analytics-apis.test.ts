import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getOverview, getScriptStats, getTopScripts } from '@/app/lib/services/analytics-service'

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

import { supabaseAdmin } from '@/app/lib/supabase'
import { findScriptBySlugForOwner } from '@/app/lib/repositories/script-repository'
import { getTopScripts as getTopScriptsRepo } from '@/app/lib/repositories/script-execution-repository'

const mockedFrom = vi.mocked(supabaseAdmin.from)
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
