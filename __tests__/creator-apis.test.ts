import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listCreatorScripts, createScript, updateScript, deleteScript, getVisibleScript, getStats, changeVisibility } from '@/app/lib/services/script-service'
import type { ScriptRow, ScriptStats } from '@/app/lib/repositories/script-repository'

const mockScriptRow = (overrides: Partial<ScriptRow> = {}): ScriptRow => ({
  id: '00000000-0000-0000-0000-000000000001',
  slug: 'my-script',
  name: 'My Script',
  description: 'A test script',
  visibility: 'public',
  creator_id: '00000000-0000-0000-0000-00000000000a',
  current_version_id: '00000000-0000-0000-0000-000000000002',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const mockStats: ScriptStats = {
  slug: 'my-script',
  total_downloads: 100,
  unique_ips: 50,
  downloads_today: 10,
  downloads_this_week: 30,
  last_downloaded_at: '2026-01-01T00:00:00.000Z',
}

const OWNER_A = '00000000-0000-0000-0000-00000000000a'
const OWNER_B = '00000000-0000-0000-0000-00000000000b'

vi.mock('@/app/lib/services/audit-service', () => ({
  logAuditEvent: vi.fn(),
}))

vi.mock('@/app/lib/services/build-automation-service', () => ({
  runAutoBuildForVersion: vi.fn(),
}))

vi.mock('@/app/lib/repositories/script-repository', () => ({
  listScriptsForOwner: vi.fn(),
  findScriptBySlug: vi.fn(),
  findScriptBySlugForOwner: vi.fn(),
  createScript: vi.fn(),
  updateScript: vi.fn(),
  deleteScript: vi.fn(),
  createVersion: vi.fn(),
  getLatestVersion: vi.fn(),
  getScriptStatsForOwner: vi.fn(),
  recordDownload: vi.fn(),
  hashIdentifier: vi.fn(),
  listVersionSummariesByIds: vi.fn(),
  ScriptConflictError: class extends Error {
    constructor(slug: string) {
      super(`A script with slug "${slug}" already exists`)
      this.name = 'ScriptConflictError'
    }
  },
}))

vi.mock('@/app/lib/auth/ownership', () => {
  const actual = vi.importActual('@/app/lib/auth/ownership')
  return actual
})

import {
  listScriptsForOwner,
  findScriptBySlug,
  findScriptBySlugForOwner,
  createScript as createScriptRepo,
  updateScript as updateScriptRepo,
  deleteScript as deleteScriptRepo,
  createVersion,
  getLatestVersion,
  getScriptStatsForOwner,
} from '@/app/lib/repositories/script-repository'
import { runAutoBuildForVersion } from '@/app/lib/services/build-automation-service'

const mockedListScriptsForOwner = listScriptsForOwner as ReturnType<typeof vi.fn>
const mockedFindScriptBySlug = findScriptBySlug as ReturnType<typeof vi.fn>
const mockedFindScriptBySlugForOwner = findScriptBySlugForOwner as ReturnType<typeof vi.fn>
const mockedCreateScriptRepo = createScriptRepo as ReturnType<typeof vi.fn>
const mockedUpdateScriptRepo = updateScriptRepo as ReturnType<typeof vi.fn>
const mockedDeleteScriptRepo = deleteScriptRepo as ReturnType<typeof vi.fn>
const mockedCreateVersion = createVersion as ReturnType<typeof vi.fn>
const mockedGetLatestVersion = getLatestVersion as ReturnType<typeof vi.fn>
const mockedGetScriptStatsForOwner = getScriptStatsForOwner as ReturnType<typeof vi.fn>
const mockedRunAutoBuildForVersion = runAutoBuildForVersion as ReturnType<typeof vi.fn>

describe('Phase 3C Creator API Layer', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('listCreatorScripts', () => {
    it('returns paginated scripts for owner', async () => {
      mockedListScriptsForOwner.mockResolvedValue({
        scripts: [mockScriptRow(), mockScriptRow({ slug: 'script-2', name: 'Script 2' })],
        total: 2,
      })

      const result = await listCreatorScripts(OWNER_A, { limit: 10 })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.scripts).toHaveLength(2)
        expect(result.total).toBe(2)
      }
      expect(mockedListScriptsForOwner).toHaveBeenCalledWith({
        ownerId: OWNER_A,
        visibility: null,
        search: null,
        limit: 10,
        offset: 0,
      })
    })

    it('rejects invalid limit', async () => {
      const result = await listCreatorScripts(OWNER_A, { limit: 200 })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(400)
        expect(result.message).toContain('Limit')
      }
    })

    it('rejects negative offset', async () => {
      const result = await listCreatorScripts(OWNER_A, { offset: -5 })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(400)
      }
    })

    it('filters by visibility', async () => {
      mockedListScriptsForOwner.mockResolvedValue({
        scripts: [mockScriptRow({ visibility: 'public' })],
        total: 1,
      })

      const result = await listCreatorScripts(OWNER_A, { visibility: 'public' })
      expect(result.success).toBe(true)
      expect(mockedListScriptsForOwner).toHaveBeenCalledWith({
        ownerId: OWNER_A,
        visibility: 'public',
        search: null,
        limit: 20,
        offset: 0,
      })
    })

    it('rejects invalid visibility filter', async () => {
      const result = await listCreatorScripts(OWNER_A, { visibility: 'invalid' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(400)
      }
    })

    it('accepts "all" visibility', async () => {
      mockedListScriptsForOwner.mockResolvedValue({
        scripts: [mockScriptRow()],
        total: 1,
      })

      const result = await listCreatorScripts(OWNER_A, { visibility: 'all' })
      expect(result.success).toBe(true)
    })
  })

  describe('getVisibleScript — ownership enforcement', () => {
    it('returns script when owner accesses own script', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue(mockScriptRow({ creator_id: OWNER_A }))

      const result = await getVisibleScript('my-script', OWNER_A)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.script.creator_id).toBe(OWNER_A)
      }
    })

    it('returns 404 when non-owner accesses foreign script', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue(null)

      const result = await getVisibleScript('foreign-script', OWNER_A)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(404)
        expect(result.message).toBe('Script not found')
      }
    })

    it('returns 404 when owner accesses non-existent script', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue(null)

      const result = await getVisibleScript('nonexistent', OWNER_A)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(404)
      }
    })

    it('shows private script to owner', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue(mockScriptRow({ visibility: 'private', creator_id: OWNER_A }))

      const result = await getVisibleScript('private-script', OWNER_A)
      expect(result.success).toBe(true)
    })

    it('hides private script from anonymous users', async () => {
      mockedFindScriptBySlug.mockResolvedValue(mockScriptRow({ visibility: 'private', creator_id: OWNER_A }))

      const result = await getVisibleScript('private-script')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(404)
      }
    })

    it('shows public script to anonymous users', async () => {
      mockedFindScriptBySlug.mockResolvedValue(mockScriptRow({ visibility: 'public', creator_id: OWNER_A }))

      const result = await getVisibleScript('public-script')
      expect(result.success).toBe(true)
    })
  })

  describe('updateScript — ownership enforcement', () => {
    it('updates own script', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue(mockScriptRow({ creator_id: OWNER_A }))
      mockedUpdateScriptRepo.mockResolvedValue(mockScriptRow({ name: 'Updated Name', creator_id: OWNER_A }))

      const result = await updateScript('my-script', OWNER_A, { name: 'Updated Name' })
      expect(result.success).toBe(true)
      expect(mockedCreateVersion).not.toHaveBeenCalled()
      if (result.success) {
        expect(result.script.name).toBe('Updated Name')
      }
    })

    it('replaces source content from an uploaded Lua file', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue(mockScriptRow({ creator_id: OWNER_A }))
      mockedGetLatestVersion.mockResolvedValue({
        id: 'version-uuid-1',
        script_id: '00000000-0000-0000-0000-000000000001',
        version: '1.0.0',
        content: 'print("old")',
        changelog: null,
        created_at: '2026-01-01T00:00:00.000Z',
      })
      mockedCreateVersion.mockResolvedValue({
        id: 'version-uuid-2',
        script_id: '00000000-0000-0000-0000-000000000001',
        version: '1.0.1',
        content: 'print("new")',
        changelog: 'Uploaded file: main.lua',
        created_at: '2026-01-02T00:00:00.000Z',
      })
      mockedUpdateScriptRepo.mockResolvedValue(mockScriptRow({
        creator_id: OWNER_A,
        current_version_id: 'version-uuid-2',
      }))

      const result = await updateScript('my-script', OWNER_A, {
        content: 'print("new")',
        sourceFilename: 'main.lua',
      })

      expect(result.success).toBe(true)
      expect(mockedCreateVersion).toHaveBeenCalledWith({
        script_id: '00000000-0000-0000-0000-000000000001',
        version: '1.0.1',
        content: 'print("new")',
        changelog: 'Uploaded file: main.lua',
      })
      expect(mockedUpdateScriptRepo).toHaveBeenCalledWith(
        'my-script',
        { current_version_id: 'version-uuid-2' },
        OWNER_A
      )
      expect(mockedRunAutoBuildForVersion).toHaveBeenCalledWith('version-uuid-2', 'version_created')
    })

    it('returns 404 for foreign script update', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue(null)

      const result = await updateScript('foreign-script', OWNER_A, { name: 'Hacked' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(404)
      }
    })
  })

  describe('createScript — build automation', () => {
    it('auto-builds the initial script version after creation', async () => {
      mockedCreateScriptRepo.mockResolvedValue(mockScriptRow({ slug: 'new-script', id: 'script-uuid-1' }))
      mockedCreateVersion.mockResolvedValue({
        id: 'version-uuid-1',
        script_id: 'script-uuid-1',
        version: '1.0.0',
        content: 'print("hello")',
        changelog: null,
        created_at: '2026-01-01T00:00:00.000Z',
      })
      mockedUpdateScriptRepo.mockResolvedValue(mockScriptRow({
        slug: 'new-script',
        id: 'script-uuid-1',
        current_version_id: 'version-uuid-1',
      }))

      const result = await createScript({
        slug: 'new-script',
        name: 'New Script',
        visibility: 'private',
        content: 'print("hello")',
        creatorId: OWNER_A,
        creatorRole: 'creator',
      })

      expect(result.success).toBe(true)
      expect(mockedRunAutoBuildForVersion).toHaveBeenCalledWith('version-uuid-1', 'script_created')
    })
  })

  describe('changeVisibility — build automation', () => {
    it('auto-builds the current version when publishing visibility changes', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue(mockScriptRow({
        creator_id: OWNER_A,
        visibility: 'private',
        current_version_id: 'version-uuid-1',
      }))
      mockedUpdateScriptRepo.mockResolvedValue(mockScriptRow({
        creator_id: OWNER_A,
        visibility: 'public',
        current_version_id: 'version-uuid-1',
      }))

      const result = await changeVisibility('my-script', OWNER_A, 'public')

      expect(result.success).toBe(true)
      expect(mockedRunAutoBuildForVersion).toHaveBeenCalledWith('version-uuid-1', 'script_published')
    })
  })

  describe('deleteScript — ownership enforcement', () => {
    it('deletes own script', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue(mockScriptRow({ creator_id: OWNER_A }))
      mockedDeleteScriptRepo.mockResolvedValue(true)

      const result = await deleteScript('my-script', OWNER_A)
      expect(result.success).toBe(true)
    })

    it('returns 404 for foreign script delete', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue(null)

      const result = await deleteScript('foreign-script', OWNER_A)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(404)
      }
    })
  })

  describe('getStats — ownership enforcement', () => {
    it('returns stats for own script', async () => {
      mockedGetScriptStatsForOwner.mockResolvedValue(mockStats)

      const result = await getStats('my-script', OWNER_A)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.stats.total_downloads).toBe(100)
      }
    })

    it('returns 404 for foreign script stats', async () => {
      mockedGetScriptStatsForOwner.mockResolvedValue(null)

      const result = await getStats('foreign-script', OWNER_A)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(404)
      }
    })
  })

  describe('cross-account isolation', () => {
    it('Creator A cannot read Creator B scripts', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue(null)

      const result = await getVisibleScript('creator-b-script', OWNER_A)
      expect(result.success).toBe(false)
      expect(result.status).toBe(404)
    })

    it('Creator A cannot update Creator B scripts', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue(null)

      const result = await updateScript('creator-b-script', OWNER_A, { name: 'Hacked' })
      expect(result.success).toBe(false)
      expect(result.status).toBe(404)
    })

    it('Creator A cannot delete Creator B scripts', async () => {
      mockedFindScriptBySlugForOwner.mockResolvedValue(null)

      const result = await deleteScript('creator-b-script', OWNER_A)
      expect(result.success).toBe(false)
      expect(result.status).toBe(404)
    })

    it('Creator A cannot access Creator B stats', async () => {
      mockedGetScriptStatsForOwner.mockResolvedValue(null)

      const result = await getStats('creator-b-script', OWNER_A)
      expect(result.success).toBe(false)
      expect(result.status).toBe(404)
    })
  })

  describe('listCreatorScripts — pagination', () => {
    it('respects default pagination', async () => {
      mockedListScriptsForOwner.mockResolvedValue({
        scripts: Array.from({ length: 20 }, (_, i) => mockScriptRow({ slug: `script-${i}` })),
        total: 50,
      })

      const result = await listCreatorScripts(OWNER_A, {})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.scripts).toHaveLength(20)
        expect(result.total).toBe(50)
      }
    })

    it('respects custom limit and offset', async () => {
      mockedListScriptsForOwner.mockResolvedValue({
        scripts: [mockScriptRow({ slug: 'page-2-script' })],
        total: 15,
      })

      const result = await listCreatorScripts(OWNER_A, { limit: 5, offset: 5 })
      expect(result.success).toBe(true)
      expect(mockedListScriptsForOwner).toHaveBeenCalledWith({
        ownerId: OWNER_A,
        visibility: null,
        search: null,
        limit: 5,
        offset: 5,
      })
    })
  })

  describe('listCreatorScripts — search', () => {
    it('passes search parameter to repository', async () => {
      mockedListScriptsForOwner.mockResolvedValue({
        scripts: [mockScriptRow({ name: 'BloxAtlas' })],
        total: 1,
      })

      const result = await listCreatorScripts(OWNER_A, { search: 'blox' })
      expect(result.success).toBe(true)
      expect(mockedListScriptsForOwner).toHaveBeenCalledWith({
        ownerId: OWNER_A,
        visibility: null,
        search: 'blox',
        limit: 20,
        offset: 0,
      })
    })
  })
})
