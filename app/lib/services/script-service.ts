import {
  findScriptBySlug,
  listScripts,
  createScript as createScriptRepo,
  updateScript as updateScriptRepo,
  deleteScript as deleteScriptRepo,
  createVersion,
  getLatestVersion,
  getScriptStats,
  recordDownload,
  hashIdentifier,
  ScriptConflictError,
  type ScriptRow,
  type ScriptStats,
  type ListScriptsResult,
} from '@/app/lib/repositories/script-repository'
import { isValidSlug, isValidScriptName, isValidVisibility, isValidScriptContent, type Visibility } from '@/app/lib/validators'

export type { ScriptRow, ScriptStats, ListScriptsResult, Visibility }

export type ScriptResult =
  | { success: true; script: ScriptRow }
  | { success: false; message: string; status: number }

export type ScriptListResult =
  | { success: true; scripts: ScriptRow[]; total: number }
  | { success: false; message: string; status: number }

export type RawContentResult =
  | { success: true; content: string }
  | { success: false; message: string; status: number }

export type StatsResult =
  | { success: true; stats: ScriptStats }
  | { success: false; message: string; status: number }

export type DeleteResult =
  | { success: true; message: string }
  | { success: false; message: string; status: number }

function parseVersion(version: string): { major: number; minor: number; patch: number } {
  const parts = version.split('.')
  return {
    major: parseInt(parts[0] ?? '1', 10),
    minor: parseInt(parts[1] ?? '0', 10),
    patch: parseInt(parts[2] ?? '0', 10),
  }
}

function nextVersion(current: string): string {
  const v = parseVersion(current)
  return `${v.major}.${v.minor}.${v.patch + 1}`
}

export async function createScript(params: {
  slug: unknown
  name: unknown
  description?: unknown
  visibility?: unknown
  content: unknown
  creator_id?: string
}): Promise<ScriptResult> {
  if (!isValidSlug(params.slug)) {
    return { success: false, message: 'Slug must be 3-64 lowercase alphanumeric characters (hyphens allowed between segments)', status: 400 }
  }

  if (!isValidScriptName(params.name)) {
    return { success: false, message: 'Name is required and must be 1-100 characters', status: 400 }
  }

  if (!isValidScriptContent(params.content)) {
    return { success: false, message: 'Content is required and must not exceed 62 KB', status: 400 }
  }

  const visibility = params.visibility !== undefined ? params.visibility : 'private'
  if (!isValidVisibility(visibility)) {
    return { success: false, message: 'Invalid visibility. Must be public, private, or unlisted', status: 400 }
  }

  if (params.description !== undefined && typeof params.description !== 'string') {
    return { success: false, message: 'Description must be a string', status: 400 }
  }

  try {
    const script = await createScriptRepo({
      slug: params.slug,
      name: params.name.trim(),
      description: typeof params.description === 'string' ? params.description : undefined,
      visibility,
      creator_id: params.creator_id,
    })

    const version = await createVersion({
      script_id: script.id,
      version: '1.0.0',
      content: params.content,
    })

    const updated = await updateScriptRepo(params.slug, { current_version_id: version.id })
    if (!updated) {
      return { success: false, message: 'Failed to link version to script', status: 500 }
    }

    return { success: true, script: updated }
  } catch (error) {
    if (error instanceof ScriptConflictError) {
      return { success: false, message: error.message, status: 409 }
    }
    return { success: false, message: 'Failed to create script', status: 500 }
  }
}

export async function getScript(slug: unknown): Promise<ScriptResult> {
  if (!isValidSlug(slug)) {
    return { success: false, message: 'Invalid slug format', status: 400 }
  }

  try {
    const script = await findScriptBySlug(slug)
    if (!script) {
      return { success: false, message: 'Script not found', status: 404 }
    }
    return { success: true, script }
  } catch {
    return { success: false, message: 'Failed to fetch script', status: 500 }
  }
}

export async function listPublicScripts(limit?: unknown, offset?: unknown): Promise<ScriptListResult> {
  const parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : (typeof limit === 'number' ? limit : 20)
  const parsedOffset = typeof offset === 'string' ? parseInt(offset, 10) : (typeof offset === 'number' ? offset : 0)

  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    return { success: false, message: 'Limit must be a number between 1 and 100', status: 400 }
  }

  if (isNaN(parsedOffset) || parsedOffset < 0) {
    return { success: false, message: 'Offset must be a non-negative number', status: 400 }
  }

  try {
    const result = await listScripts('public', parsedLimit, parsedOffset)
    return { success: true, scripts: result.scripts, total: result.total }
  } catch {
    return { success: false, message: 'Failed to list scripts', status: 500 }
  }
}

export async function updateScript(
  slug: unknown,
  params: {
    name?: unknown
    description?: unknown
    visibility?: unknown
    content?: unknown
  }
): Promise<ScriptResult> {
  if (!isValidSlug(slug)) {
    return { success: false, message: 'Invalid slug format', status: 400 }
  }

  if (params.name !== undefined && !isValidScriptName(params.name)) {
    return { success: false, message: 'Name must be 1-100 characters', status: 400 }
  }

  if (params.description !== undefined && typeof params.description !== 'string') {
    return { success: false, message: 'Description must be a string', status: 400 }
  }

  if (params.visibility !== undefined && !isValidVisibility(params.visibility)) {
    return { success: false, message: 'Invalid visibility. Must be public, private, or unlisted', status: 400 }
  }

  if (params.content !== undefined && !isValidScriptContent(params.content)) {
    return { success: false, message: 'Content must not exceed 62 KB', status: 400 }
  }

  try {
    const existing = await findScriptBySlug(slug)
    if (!existing) {
      return { success: false, message: 'Script not found', status: 404 }
    }

    const updateFields: { name?: string; description?: string; visibility?: Visibility } = {}
    if (params.name !== undefined) updateFields.name = (params.name as string).trim()
    if (params.description !== undefined) updateFields.description = params.description as string
    if (params.visibility !== undefined) updateFields.visibility = params.visibility as Visibility

    let currentVersionId = existing.current_version_id

    if (params.content !== undefined && params.content !== '') {
      const latestVersion = await getLatestVersion(existing.id)
      const newVersionNumber = latestVersion ? nextVersion(latestVersion.version) : '1.0.1'

      const version = await createVersion({
        script_id: existing.id,
        version: newVersionNumber,
        content: params.content,
      })

      currentVersionId = version.id
    }

    const updated = await updateScriptRepo(slug, {
      ...updateFields,
      current_version_id: currentVersionId ?? undefined,
    })

    if (!updated) {
      return { success: false, message: 'Failed to update script', status: 500 }
    }

    return { success: true, script: updated }
  } catch (error) {
    if (error instanceof ScriptConflictError) {
      return { success: false, message: error.message, status: 409 }
    }
    return { success: false, message: 'Failed to update script', status: 500 }
  }
}

export async function deleteScript(slug: unknown): Promise<DeleteResult> {
  if (!isValidSlug(slug)) {
    return { success: false, message: 'Invalid slug format', status: 400 }
  }

  try {
    const existing = await findScriptBySlug(slug)
    if (!existing) {
      return { success: false, message: 'Script not found', status: 404 }
    }

    const deleted = await deleteScriptRepo(slug)
    if (!deleted) {
      return { success: false, message: 'Failed to delete script', status: 500 }
    }

    return { success: true, message: 'Script deleted' }
  } catch {
    return { success: false, message: 'Failed to delete script', status: 500 }
  }
}

export async function changeVisibility(
  slug: unknown,
  visibility: unknown
): Promise<ScriptResult> {
  if (!isValidSlug(slug)) {
    return { success: false, message: 'Invalid slug format', status: 400 }
  }

  if (!isValidVisibility(visibility)) {
    return { success: false, message: 'Invalid visibility. Must be public, private, or unlisted', status: 400 }
  }

  try {
    const existing = await findScriptBySlug(slug)
    if (!existing) {
      return { success: false, message: 'Script not found', status: 404 }
    }

    const updated = await updateScriptRepo(slug, { visibility })
    if (!updated) {
      return { success: false, message: 'Failed to update visibility', status: 500 }
    }

    return { success: true, script: updated }
  } catch {
    return { success: false, message: 'Failed to update visibility', status: 500 }
  }
}

export async function getRawContent(
  slug: unknown,
  isAuthenticated: boolean = false
): Promise<RawContentResult> {
  if (!isValidSlug(slug)) {
    return { success: false, message: 'Invalid slug format', status: 400 }
  }

  try {
    const script = await findScriptBySlug(slug)
    if (!script) {
      return { success: false, message: 'Script not found', status: 404 }
    }

    if (script.visibility === 'private' && !isAuthenticated) {
      return { success: false, message: 'This script is private', status: 403 }
    }

    if (!script.current_version_id) {
      return { success: false, message: 'Script has no published version', status: 404 }
    }

    const version = await getLatestVersion(script.id)
    if (!version) {
      return { success: false, message: 'Script content not found', status: 404 }
    }

    trackDownloadAsync(script.id, version.id, '')

    return { success: true, content: version.content }
  } catch {
    return { success: false, message: 'Failed to fetch script content', status: 500 }
  }
}

export async function getStats(slug: unknown): Promise<StatsResult> {
  if (!isValidSlug(slug)) {
    return { success: false, message: 'Invalid slug format', status: 400 }
  }

  try {
    const stats = await getScriptStats(slug)
    if (!stats) {
      return { success: false, message: 'Script not found', status: 404 }
    }

    return { success: true, stats }
  } catch {
    return { success: false, message: 'Failed to fetch stats', status: 500 }
  }
}

export async function trackDownload(
  scriptId: string,
  versionId: string | null,
  ip: string,
  userAgent?: string | null
): Promise<void> {
  try {
    const ip_hash = await hashIdentifier(ip)
    const ua_hash = userAgent ? await hashIdentifier(userAgent) : null

    await recordDownload({
      script_id: scriptId,
      version_id: versionId,
      ip_hash,
      user_agent_hash: ua_hash,
    })
  } catch {
    // Analytics failures must never propagate
  }
}

function trackDownloadAsync(scriptId: string, versionId: string, ip: string): void {
  trackDownload(scriptId, versionId, ip).then(
    () => {},
    () => {}
  )
}
