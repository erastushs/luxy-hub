import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getOverview, getScriptStats, getDownloadTrends } from '@/app/lib/services/analytics-service'

const OWNER_A = '00000000-0000-0000-0000-00000000000a'
const OWNER_B = '00000000-0000-0000-0000-00000000000b'

const mockOverview = {
  total_scripts: 5,
  published_scripts: 3,
  private_scripts: 2,
  total_downloads: 1000,
  downloads_today: 50,
  downloads_7d: 300,
  downloads_30d: 800,
}

const mockScriptAnalytics = {
  slug: 'my-script',
  total_downloads: 200,
  downloads_today: 10,
  downloads_7d: 60,
  downloads_30d: 150,
  last_downloaded_at: '2026-01-01T00:00:00.000Z',
}

const mockTrends = {
  points: [
    { day: '2026-06-01', downloads: 10 },
    { day: '2026-06-02', downloads: 15 },
    { day: '2026-06-03', downloads: 0 },
  ],
}

vi.mock('@/app/lib/repositories/script-repository', () => ({
  getCreatorAnalyticsOverview: vi.fn(),
  getScriptAnalyticsForOwner: vi.fn(),
  getDownloadTrendsForOwner: vi.fn(),
  getScriptDownloadTrendsForOwner: vi.fn(),
  findScriptBySlug: vi.fn(),
  findScriptBySlugForOwner: vi.fn(),
  listScripts: vi.fn(),
  listScriptsForOwner: vi.fn(),
  createScript: vi.fn(),
  updateScript: vi.fn(),
  deleteScript: vi.fn(),
  createVersion: vi.fn(),
  getLatestVersion: vi.fn(),
  getScriptStats: vi.fn(),
  getScriptStatsForOwner: vi.fn(),
  recordDownload: vi.fn(),
  hashIdentifier: vi.fn(),
  ScriptConflictError: class extends Error {
    constructor(slug: string) {
      super(`A script with slug "${slug}" already exists`)
      this.name = 'ScriptConflictError'
    }
  },
}))

import {
  getCreatorAnalyticsOverview,
  getScriptAnalyticsForOwner,
  getDownloadTrendsForOwner,
  getScriptDownloadTrendsForOwner,
} from '@/app/lib/repositories/script-repository'

const mockedGetCreatorAnalyticsOverview = getCreatorAnalyticsOverview as ReturnType<typeof vi.fn>
const mockedGetScriptAnalyticsForOwner = getScriptAnalyticsForOwner as ReturnType<typeof vi.fn>
const mockedGetDownloadTrendsForOwner = getDownloadTrendsForOwner as ReturnType<typeof vi.fn>
const mockedGetScriptDownloadTrendsForOwner = getScriptDownloadTrendsForOwner as ReturnType<typeof vi.fn>

describe('Phase 3C.2 Analytics Aggregation APIs', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('getOverview', () => {
    it('returns analytics overview for creator', async () => {
      mockedGetCreatorAnalyticsOverview.mockResolvedValue(mockOverview)

      const result = await getOverview(OWNER_A)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.overview.total_scripts).toBe(5)
        expect(result.overview.total_downloads).toBe(1000)
        expect(result.overview.downloads_today).toBe(50)
        expect(result.overview.downloads_7d).toBe(300)
        expect(result.overview.downloads_30d).toBe(800)
        expect(result.overview.published_scripts).toBe(3)
        expect(result.overview.private_scripts).toBe(2)
      }
    })

    it('passes correct ownerId to repository', async () => {
      mockedGetCreatorAnalyticsOverview.mockResolvedValue(mockOverview)

      await getOverview(OWNER_A)
      expect(mockedGetCreatorAnalyticsOverview).toHaveBeenCalledWith(OWNER_A)
    })

    it('returns overview scoped to creator only', async () => {
      const creatorAOverview = { ...mockOverview, total_scripts: 3 }
      const creatorBOverview = { ...mockOverview, total_scripts: 7 }
      mockedGetCreatorAnalyticsOverview.mockResolvedValueOnce(creatorAOverview)
      mockedGetCreatorAnalyticsOverview.mockResolvedValueOnce(creatorBOverview)

      const resultA = await getOverview(OWNER_A)
      const resultB = await getOverview(OWNER_B)

      if (resultA.success) expect(resultA.overview.total_scripts).toBe(3)
      if (resultB.success) expect(resultB.overview.total_scripts).toBe(7)
    })
  })

  describe('getScriptStats', () => {
    it('returns analytics for owned script', async () => {
      mockedGetScriptAnalyticsForOwner.mockResolvedValue(mockScriptAnalytics)

      const result = await getScriptStats(OWNER_A, 'my-script')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.analytics.slug).toBe('my-script')
        expect(result.analytics.total_downloads).toBe(200)
        expect(result.analytics.downloads_7d).toBe(60)
        expect(result.analytics.downloads_30d).toBe(150)
      }
    })

    it('returns 404 for foreign script analytics', async () => {
      mockedGetScriptAnalyticsForOwner.mockResolvedValue(null)

      const result = await getScriptStats(OWNER_A, 'creator-b-script')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(404)
        expect(result.message).toBe('Script not found')
      }
    })

    it('passes correct ownerId and slug to repository', async () => {
      mockedGetScriptAnalyticsForOwner.mockResolvedValue(mockScriptAnalytics)

      await getScriptStats(OWNER_A, 'test-script')
      expect(mockedGetScriptAnalyticsForOwner).toHaveBeenCalledWith('test-script', OWNER_A)
    })
  })

  describe('getDownloadTrends', () => {
    it('returns portfolio-level trends for last_7_days', async () => {
      mockedGetDownloadTrendsForOwner.mockResolvedValue(mockTrends)

      const result = await getDownloadTrends(OWNER_A, 'last_7_days')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.trends.points).toHaveLength(3)
        expect(result.trends.points[0].downloads).toBe(10)
      }
      expect(mockedGetDownloadTrendsForOwner).toHaveBeenCalledWith(OWNER_A, 7)
    })

    it('returns portfolio-level trends for last_30_days', async () => {
      mockedGetDownloadTrendsForOwner.mockResolvedValue(mockTrends)

      const result = await getDownloadTrends(OWNER_A, 'last_30_days')
      expect(result.success).toBe(true)
      expect(mockedGetDownloadTrendsForOwner).toHaveBeenCalledWith(OWNER_A, 30)
    })

    it('returns script-level trends when slug provided', async () => {
      mockedGetScriptDownloadTrendsForOwner.mockResolvedValue(mockTrends)

      const result = await getDownloadTrends(OWNER_A, 'last_7_days', 'my-script')
      expect(result.success).toBe(true)
      expect(mockedGetScriptDownloadTrendsForOwner).toHaveBeenCalledWith('my-script', OWNER_A, 7)
    })

    it('returns 404 for foreign script trends', async () => {
      mockedGetScriptDownloadTrendsForOwner.mockResolvedValue(null)

      const result = await getDownloadTrends(OWNER_A, 'last_7_days', 'foreign-script')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(404)
      }
    })

    it('rejects invalid range parameter', async () => {
      const result = await getDownloadTrends(OWNER_A, 'invalid_range')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(400)
        expect(result.message).toContain('last_7_days or last_30_days')
      }
    })

    it('accepts shorthand range formats', async () => {
      mockedGetDownloadTrendsForOwner.mockResolvedValue(mockTrends)

      const result7 = await getDownloadTrends(OWNER_A, '7d')
      expect(result7.success).toBe(true)
      expect(mockedGetDownloadTrendsForOwner).toHaveBeenCalledWith(OWNER_A, 7)

      const result30 = await getDownloadTrends(OWNER_A, '30')
      expect(result30.success).toBe(true)
      expect(mockedGetDownloadTrendsForOwner).toHaveBeenCalledWith(OWNER_A, 30)
    })
  })

  describe('cross-account analytics isolation', () => {
    it('Creator A cannot access Creator B analytics overview', async () => {
      mockedGetCreatorAnalyticsOverview.mockResolvedValue({ ...mockOverview, total_scripts: 3 })

      const result = await getOverview(OWNER_A)
      expect(mockedGetCreatorAnalyticsOverview).toHaveBeenCalledWith(OWNER_A)
      expect(mockedGetCreatorAnalyticsOverview).not.toHaveBeenCalledWith(OWNER_B)
    })

    it('Creator A cannot access Creator B script analytics', async () => {
      mockedGetScriptAnalyticsForOwner.mockResolvedValue(null)

      const result = await getScriptStats(OWNER_A, 'creator-b-script')
      expect(result.success).toBe(false)
      expect(result.status).toBe(404)
    })

    it('Creator A cannot access Creator B download trends', async () => {
      mockedGetScriptDownloadTrendsForOwner.mockResolvedValue(null)

      const result = await getDownloadTrends(OWNER_A, 'last_7_days', 'creator-b-script')
      expect(result.success).toBe(false)
      expect(result.status).toBe(404)
    })
  })

  describe('aggregation guarantees', () => {
    it('never returns raw download events', async () => {
      mockedGetCreatorAnalyticsOverview.mockResolvedValue(mockOverview)

      const result = await getOverview(OWNER_A)
      if (result.success) {
        const overview = result.overview as Record<string, unknown>
        expect(overview).not.toHaveProperty('ip_hash')
        expect(overview).not.toHaveProperty('user_agent_hash')
        expect(overview).not.toHaveProperty('script_id')
        expect(overview).not.toHaveProperty('downloads')
        expect(overview).toHaveProperty('total_downloads')
      }
    })

    it('trends only expose day-level aggregation', async () => {
      mockedGetDownloadTrendsForOwner.mockResolvedValue(mockTrends)

      const result = await getDownloadTrends(OWNER_A, 'last_7_days')
      if (result.success) {
        const firstPoint = result.trends.points[0] as Record<string, unknown>
        expect(firstPoint).toHaveProperty('day')
        expect(firstPoint).toHaveProperty('downloads')
        expect(firstPoint).not.toHaveProperty('created_at')
        expect(firstPoint).not.toHaveProperty('ip_hash')
      }
    })
  })
})
