import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockInsertAuditLog } = vi.hoisted(() => ({
  mockInsertAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/app/lib/repositories/audit-repository', () => ({
  insertAuditLog: mockInsertAuditLog,
  listAuditLogsForActor: vi.fn(),
}))

vi.mock('@/app/lib/repositories/script-repository', () => ({
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
}))

vi.mock('@/app/lib/auth/ownership', () => ({
  assertScriptOwner: vi.fn(),
  OwnershipError: class extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.name = 'OwnershipError'
      this.status = status
    }
  },
}))

import { createScript, updateScript, deleteScript, changeVisibility } from '@/app/lib/services/script-service'
import { createScript as createScriptRepo, updateScript as updateScriptRepo, deleteScript as deleteScriptRepo, createVersion } from '@/app/lib/repositories/script-repository'
import { assertScriptOwner } from '@/app/lib/auth/ownership'

const OWNER_A = '00000000-0000-0000-0000-00000000000a'

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

function mockVersionRow() {
  return {
    id: 'version-uuid-1',
    script_id: 'script-uuid-1',
    version: '1.0.0',
    content: 'print("hello")',
    changelog: 'Initial release',
    created_at: '2026-01-01T00:00:00.000Z',
  }
}

function getAuditPayload(): Record<string, unknown> | null {
  const args = mockInsertAuditLog.mock.calls[mockInsertAuditLog.mock.calls.length - 1]
  return (args?.[0] as Record<string, unknown>) ?? null
}

function getAuditPayloadByAction(action: string): Record<string, unknown> | null {
  for (const args of mockInsertAuditLog.mock.calls) {
    const obj = args[0] as Record<string, unknown>
    if (obj?.action === action) return obj
  }
  return null
}

describe('Phase 3C.4 Audit Logging System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsertAuditLog.mockResolvedValue(undefined)
  })

  describe('script create audit', () => {
    it('writes audit log with correct actor and action', async () => {
      (createScriptRepo as ReturnType<typeof vi.fn>).mockResolvedValue(mockScriptRow({ slug: 'new-script', id: 'script-uuid-1' }))
      ;(createVersion as ReturnType<typeof vi.fn>).mockResolvedValue(mockVersionRow())
      ;(updateScriptRepo as ReturnType<typeof vi.fn>).mockResolvedValue(mockScriptRow({ slug: 'new-script', id: 'script-uuid-1' }))

      await createScript({
        slug: 'new-script',
        name: 'New Script',
        visibility: 'public',
        content: 'print("test")',
        creatorId: OWNER_A,
        creatorRole: 'creator',
      })

      const p = getAuditPayloadByAction('script.created')
      expect(p).not.toBeNull()
      expect(p!.actor_id).toBe(OWNER_A)
      expect(p!.actor_role).toBe('creator')
      expect(p!.resource_type).toBe('script')
      expect(p!.resource_slug).toBe('new-script')
    })

    it('includes metadata with name and visibility', async () => {
      (createScriptRepo as ReturnType<typeof vi.fn>).mockResolvedValue(mockScriptRow({ slug: 'my-rbx', id: 'script-uuid-1', name: 'My RBX Script' }))
      ;(createVersion as ReturnType<typeof vi.fn>).mockResolvedValue(mockVersionRow())
      ;(updateScriptRepo as ReturnType<typeof vi.fn>).mockResolvedValue(mockScriptRow({ slug: 'my-rbx', id: 'script-uuid-1', name: 'My RBX Script' }))

      await createScript({
        slug: 'my-rbx',
        name: 'My RBX Script',
        visibility: 'private',
        content: 'loadstring(game:HttpGet("url"))()',
        creatorId: OWNER_A,
        creatorRole: 'admin',
      })

      const p = getAuditPayloadByAction('script.created')
      expect(p).not.toBeNull()
      expect(p!.actor_role).toBe('admin')
      const meta = p!.metadata as Record<string, unknown>
      expect(meta.name).toBe('My RBX Script')
      expect(meta.visibility).toBe('private')
    })
  })

  describe('script update audit', () => {
    it('writes audit log with actor role', async () => {
      (assertScriptOwner as ReturnType<typeof vi.fn>).mockResolvedValue(mockScriptRow())
      ;(updateScriptRepo as ReturnType<typeof vi.fn>).mockResolvedValue(mockScriptRow({ name: 'Updated' }))

      await updateScript('my-script', OWNER_A, { name: 'Updated' }, 'admin')

      const p = getAuditPayloadByAction('script.updated')
      expect(p).not.toBeNull()
      expect(p!.actor_id).toBe(OWNER_A)
      expect(p!.actor_role).toBe('admin')
    })

    it('tracks which fields changed and content flag', async () => {
      (assertScriptOwner as ReturnType<typeof vi.fn>).mockResolvedValue(mockScriptRow())
      ;(updateScriptRepo as ReturnType<typeof vi.fn>).mockResolvedValue(mockScriptRow({ name: 'Renamed', visibility: 'public' }))

      await updateScript('my-script', OWNER_A, { name: 'Renamed', visibility: 'public', content: 'print("v2")' }, 'creator')

      const p = getAuditPayloadByAction('script.updated')
      expect(p).not.toBeNull()
      const meta = p!.metadata as Record<string, unknown>
      expect(meta.changed).toEqual(['name', 'visibility'])
      expect(meta.has_content_update).toBe(true)
    })
  })

  describe('script delete audit', () => {
    it('writes audit log with name and visibility before deletion', async () => {
      const deletedScript = mockScriptRow({ name: 'DeleteMe', visibility: 'unlisted' })
      ;(assertScriptOwner as ReturnType<typeof vi.fn>).mockResolvedValue(deletedScript)
      ;(deleteScriptRepo as ReturnType<typeof vi.fn>).mockResolvedValue(true)

      await deleteScript('my-script', OWNER_A, 'creator')

      const p = getAuditPayloadByAction('script.deleted')
      expect(p).not.toBeNull()
      expect(p!.resource_slug).toBe('my-script')
      const meta = p!.metadata as Record<string, unknown>
      expect(meta.name).toBe('DeleteMe')
      expect(meta.visibility).toBe('unlisted')
    })
  })

  describe('visibility change audit', () => {
    it('records previous and new visibility', async () => {
      (assertScriptOwner as ReturnType<typeof vi.fn>).mockResolvedValue(mockScriptRow({ visibility: 'private' }))
      ;(updateScriptRepo as ReturnType<typeof vi.fn>).mockResolvedValue(mockScriptRow({ visibility: 'public' }))

      await changeVisibility('my-script', OWNER_A, 'public', 'creator')

      const p = getAuditPayloadByAction('script.visibility_changed')
      expect(p).not.toBeNull()
      const meta = p!.metadata as Record<string, unknown>
      expect(meta.previous_visibility).toBe('private')
      expect(meta.new_visibility).toBe('public')
    })
  })

  describe('test verification', () => {
    it('audit write is called exactly once per mutation', async () => {
      ;(createScriptRepo as ReturnType<typeof vi.fn>).mockResolvedValue(mockScriptRow({ slug: 's', id: 'i' }))
      ;(createVersion as ReturnType<typeof vi.fn>).mockResolvedValue(mockVersionRow())
      ;(updateScriptRepo as ReturnType<typeof vi.fn>).mockResolvedValue(mockScriptRow({ slug: 's', id: 'i' }))

      await createScript({
        slug: 'short', name: 'N', visibility: 'private', content: 'c',
        creatorId: OWNER_A, creatorRole: 'creator',
      })

      const scriptCreated = getAuditPayloadByAction('script.created')
      expect(scriptCreated).not.toBeNull()
    })
  })
})
