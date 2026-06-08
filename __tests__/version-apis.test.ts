import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listVersions, getVersionDetail } from '@/app/lib/services/script-service'
import type { VersionRow } from '@/app/lib/repositories/script-repository'

vi.mock('@/app/lib/services/audit-service', () => ({
  logAuditEvent: vi.fn(),
}))

vi.mock('@/app/lib/services/build-automation-service', () => ({
  runAutoBuildForVersion: vi.fn(),
}))

vi.mock('@/app/lib/repositories/script-repository', () => {
  const mockVersionRow = (overrides: Partial<VersionRow> = {}): VersionRow => ({
    id: 'version-uuid-1',
    script_id: 'script-uuid-1',
    version: '1.0.0',
    content: 'print("hello")',
    changelog: 'Initial release',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  })

  return {
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
    listVersionsForScript: vi.fn(),
    listVersionSummariesByIds: vi.fn(),
    getVersionById: vi.fn(),
    getCreatorAnalyticsOverview: vi.fn(),
    getScriptAnalyticsForOwner: vi.fn(),
    getDownloadTrendsForOwner: vi.fn(),
    getScriptDownloadTrendsForOwner: vi.fn(),
    ScriptConflictError: class extends Error {
      constructor(slug: string) {
        super(`A script with slug "${slug}" already exists`)
        this.name = 'ScriptConflictError'
      }
    },
    mockVersionRow,
  }
})

vi.mock('@/app/lib/auth/ownership', () => {
  const original = vi.importActual('@/app/lib/auth/ownership')
  return original
})

import { findScriptBySlugForOwner, listVersionsForScript, getVersionById } from '@/app/lib/repositories/script-repository'

const mockedFindScriptBySlugForOwner = findScriptBySlugForOwner as ReturnType<typeof vi.fn>
const mockedListVersionsForScript = listVersionsForScript as ReturnType<typeof vi.fn>
const mockedGetVersionById = getVersionById as ReturnType<typeof vi.fn>

const OWNER_A = '00000000-0000-0000-0000-00000000000a'

function mockVersionRow(overrides: Partial<VersionRow> = {}): VersionRow {
  return {
    id: 'version-uuid-1',
    script_id: 'script-uuid-1',
    version: '1.0.0',
    content: 'print("hello")',
    changelog: 'Initial release',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function mockScriptRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'script-uuid-1',
    slug: 'my-script',
    name: 'My Script',
    description: 'A test script',
    visibility: 'public',
    creator_id: OWNER_A,
    current_version_id: 'version-uuid-1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('Phase 3C.3 Version History APIs', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('listVersions', () => {
    it('returns paginated versions for owned script', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue(mockScriptRow())
      mockedListVersionsForScript.mockResolvedValue({
        versions: [mockVersionRow(), mockVersionRow({ id: 'v2', version: '1.0.1' })],
        total: 2,
      })

      const result = await listVersions(OWNER_A, 'my-script', 10, 0)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.versions).toHaveLength(2)
        expect(result.total).toBe(2)
        expect(result.versions[0].version).toBe('1.0.0')
        expect(result.versions[0].changelog).toBe('Initial release')
      }
    })

    it('returns 404 for foreign script versions', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue(null)

      const result = await listVersions(OWNER_A, 'foreign-script')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(404)
        expect(result.message).toBe('Script not found')
      }
    })

    it('respects pagination limit', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue(mockScriptRow())
      mockedListVersionsForScript.mockResolvedValue({
        versions: [mockVersionRow()],
        total: 15,
      })

      const result = await listVersions(OWNER_A, 'my-script', 5, 0)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.versions).toHaveLength(1)
        expect(result.total).toBe(15)
      }
      expect(mockedListVersionsForScript).toHaveBeenCalledWith('script-uuid-1', 5, 0)
    })

    it('respects pagination offset', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue(mockScriptRow())
      mockedListVersionsForScript.mockResolvedValue({
        versions: [mockVersionRow({ id: 'v10', version: '1.5.0' })],
        total: 20,
      })

      const result = await listVersions(OWNER_A, 'my-script', 10, 10)
      expect(result.success).toBe(true)
      expect(mockedListVersionsForScript).toHaveBeenCalledWith('script-uuid-1', 10, 10)
    })

    it('rejects invalid slug', async () => {
      const result = await listVersions(OWNER_A, '!!bad!!')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(400)
      }
    })

    it('rejects invalid limit', async () => {
      const result = await listVersions(OWNER_A, 'my-script', 200)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(400)
      }
    })
  })

  describe('getVersionDetail', () => {
    it('returns version detail for owned script', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue(mockScriptRow())
      mockedGetVersionById.mockResolvedValue(mockVersionRow())

      const result = await getVersionDetail(OWNER_A, 'my-script', 'version-uuid-1')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.version.version).toBe('1.0.0')
        expect(result.version.content).toBe('print("hello")')
        expect(result.version.changelog).toBe('Initial release')
      }
    })

    it('returns 404 for foreign script version', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue(null)

      const result = await getVersionDetail(OWNER_A, 'foreign-script', 'version-uuid-1')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(404)
      }
    })

    it('returns 404 when version belongs to different script', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue(mockScriptRow())
      mockedGetVersionById.mockResolvedValue(mockVersionRow({ id: 'v-other', script_id: 'different-script-id' }))

      const result = await getVersionDetail(OWNER_A, 'my-script', 'v-other')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(404)
        expect(result.message).toBe('Version not found')
      }
    })

    it('returns 404 for non-existent version', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue(mockScriptRow())
      mockedGetVersionById.mockResolvedValue(null)

      const result = await getVersionDetail(OWNER_A, 'my-script', 'nonexistent')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(404)
      }
    })

    it('rejects empty version ID', async () => {
      const result = await getVersionDetail(OWNER_A, 'my-script', '')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(400)
      }
    })
  })

  describe('cross-account version isolation', () => {
    it('Creator A cannot list Creator B versions', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue(null)

      const result = await listVersions(OWNER_A, 'creator-b-script')
      expect(result.success).toBe(false)
      expect(result.status).toBe(404)
    })

    it('Creator A cannot get Creator B version detail', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue(null)

      const result = await getVersionDetail(OWNER_A, 'creator-b-script', 'version-uuid-1')
      expect(result.success).toBe(false)
      expect(result.status).toBe(404)
    })

    it('version hidden when script ownership fails', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue(null)

      const result = await getVersionDetail(OWNER_A, 'unknown-script', 'any-version')
      expect(result.success).toBe(false)
      expect(result.status).toBe(404)
    })
  })

  describe('version content security', () => {
    it('version detail includes content only for owner', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue(mockScriptRow())
      mockedGetVersionById.mockResolvedValue(mockVersionRow({ content: 'secure payload' }))

      const result = await getVersionDetail(OWNER_A, 'my-script', 'version-uuid-1')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.version.content).toBe('secure payload')
      }
    })

    it('version listing includes changelog but not content', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue(mockScriptRow())
      const versions = [
        mockVersionRow({ content: 'v1 content', changelog: 'First' }),
        mockVersionRow({ id: 'v2', version: '1.0.1', content: 'v2 content', changelog: 'Second' }),
      ]
      mockedListVersionsForScript.mockResolvedValue({ versions, total: 2 })

      const result = await listVersions(OWNER_A, 'my-script')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.versions[0]).toHaveProperty('changelog')
        expect(result.versions[0]).toHaveProperty('content')
        expect(result.versions[0].changelog).toBe('First')
      }
    })
  })
})
