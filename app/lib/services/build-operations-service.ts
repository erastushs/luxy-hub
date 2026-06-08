import {
  getBuildDashboardById,
  getLatestBuild,
  listBuildsForScript,
  listLatestBuildSummariesByVersionIds,
  type DeliveryBuildDashboardRow,
  type DeliveryBuildStatus,
  type DeliveryBuildSummaryRow,
} from '@/app/lib/repositories/delivery-build-repository'
import type { ScriptRow, VersionSummaryRow } from '@/app/lib/repositories/script-repository'
import { assertScriptOwner, OwnershipError } from '@/app/lib/auth/ownership'
import { isValidSlug } from '@/app/lib/validators'
import { rebuildVersion } from '@/app/lib/services/delivery-build-service'

export type DashboardBuildListItem = {
  buildId: string
  scriptId: string
  versionId: string
  status: DeliveryBuildStatus
  buildVersion: string
  payloadFormatVersion: string
  builtAt: string | null
  invalidatedAt: string | null
  createdAt: string
  updatedAt: string
  invalidatedReason: string | null
  errorCode: string | null
  errorMessage: string | null
}

export type DashboardBuildDetails = DashboardBuildListItem & {
  payloadStorageKind: 'inline_encrypted'
  payloadContentType: string
  payloadByteSize: number | null
  encryptionScheme: string
  metadata: Record<string, unknown>
}

export type BuildHistoryResult =
  | { success: true; script: ScriptRow; builds: DashboardBuildListItem[]; total: number }
  | { success: false; message: string; status: number }

export type BuildDetailsResult =
  | { success: true; script: ScriptRow; build: DashboardBuildDetails }
  | { success: false; message: string; status: number }

export type LatestBuildStatusResult =
  | { success: true; script: ScriptRow; build: DashboardBuildDetails | null }
  | { success: false; message: string; status: number }

export type BuildStatusMapResult =
  | { success: true; buildsByVersionId: Record<string, DashboardBuildListItem> }
  | { success: false; message: string; status: number }

export type RebuildLatestVersionResult =
  | { success: true; script: ScriptRow; build: DashboardBuildDetails }
  | { success: false; message: string; status: number; build?: DashboardBuildDetails }

function parsePagination(limit?: unknown, offset?: unknown): { limit: number; offset: number } | null {
  const parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : (typeof limit === 'number' ? limit : 10)
  const parsedOffset = typeof offset === 'string' ? parseInt(offset, 10) : (typeof offset === 'number' ? offset : 0)

  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) return null
  if (isNaN(parsedOffset) || parsedOffset < 0) return null

  return { limit: parsedLimit, offset: parsedOffset }
}

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'string') {
      safe[key] = value.slice(0, 256)
    } else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      safe[key] = value
    }
  }

  return safe
}

function mapSummary(row: DeliveryBuildSummaryRow): DashboardBuildListItem {
  return {
    buildId: row.id,
    scriptId: row.script_id,
    versionId: row.version_id,
    status: row.build_status,
    buildVersion: row.build_version,
    payloadFormatVersion: row.payload_format_version,
    builtAt: row.built_at,
    invalidatedAt: row.invalidated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    invalidatedReason: row.invalidated_reason,
    errorCode: row.build_error_code,
    errorMessage: row.build_error_message,
  }
}

function mapDashboardRow(row: DeliveryBuildDashboardRow): DashboardBuildDetails {
  return {
    ...mapSummary(row),
    payloadStorageKind: row.payload_storage_kind,
    payloadContentType: row.payload_content_type,
    payloadByteSize: row.payload_byte_size,
    encryptionScheme: row.encryption_scheme,
    metadata: sanitizeMetadata(row.metadata ?? {}),
  }
}

function mapBuildResultRow(row: DeliveryBuildDashboardRow | DeliveryBuildSummaryRow): DashboardBuildListItem {
  return mapSummary(row)
}

function mapFullBuildRow(row: {
  id: string
  script_id: string
  version_id: string
  build_status: DeliveryBuildStatus
  payload_storage_kind: 'inline_encrypted'
  payload_content_type: string
  payload_byte_size: number | null
  build_version: string
  payload_format_version: string
  encryption_scheme: string
  invalidated_reason: string | null
  build_error_code: string | null
  build_error_message: string | null
  metadata: Record<string, unknown>
  built_at: string | null
  invalidated_at: string | null
  created_at: string
  updated_at: string
}): DashboardBuildDetails {
  return mapDashboardRow({
    id: row.id,
    script_id: row.script_id,
    version_id: row.version_id,
    build_status: row.build_status,
    payload_storage_kind: row.payload_storage_kind,
    payload_content_type: row.payload_content_type,
    payload_byte_size: row.payload_byte_size,
    build_version: row.build_version,
    payload_format_version: row.payload_format_version,
    encryption_scheme: row.encryption_scheme,
    invalidated_reason: row.invalidated_reason,
    build_error_code: row.build_error_code,
    build_error_message: row.build_error_message,
    metadata: row.metadata,
    built_at: row.built_at,
    invalidated_at: row.invalidated_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  })
}

async function getOwnedScriptForBuilds(ownerId: string, slug: unknown): Promise<ScriptRow> {
  if (!isValidSlug(slug)) {
    throw new OwnershipError('Invalid slug format', 400)
  }

  return assertScriptOwner(slug, ownerId)
}

export async function listBuildHistory(
  ownerId: string,
  slug: unknown,
  params: { limit?: unknown; offset?: unknown } = {}
): Promise<BuildHistoryResult> {
  const pagination = parsePagination(params.limit, params.offset)
  if (!pagination) {
    return { success: false, message: 'Invalid pagination', status: 400 }
  }

  try {
    const script = await getOwnedScriptForBuilds(ownerId, slug)
    const result = await listBuildsForScript(script.id, pagination.limit, pagination.offset)

    return {
      success: true,
      script,
      builds: result.builds.map(mapDashboardRow),
      total: result.total,
    }
  } catch (error) {
    if (error instanceof OwnershipError) {
      return { success: false, message: error.message, status: error.status }
    }

    return { success: false, message: 'Failed to list build history', status: 500 }
  }
}

export async function getBuildDetails(
  ownerId: string,
  slug: unknown,
  buildId: unknown
): Promise<BuildDetailsResult> {
  if (!buildId || typeof buildId !== 'string') {
    return { success: false, message: 'Build ID is required', status: 400 }
  }

  try {
    const script = await getOwnedScriptForBuilds(ownerId, slug)
    const build = await getBuildDashboardById(buildId)

    if (!build || build.script_id !== script.id) {
      return { success: false, message: 'Build not found', status: 404 }
    }

    return { success: true, script, build: mapDashboardRow(build) }
  } catch (error) {
    if (error instanceof OwnershipError) {
      return { success: false, message: error.message, status: error.status }
    }

    return { success: false, message: 'Failed to fetch build details', status: 500 }
  }
}

export async function getLatestBuildStatus(
  ownerId: string,
  slug: unknown
): Promise<LatestBuildStatusResult> {
  try {
    const script = await getOwnedScriptForBuilds(ownerId, slug)
    if (!script.current_version_id) {
      return { success: true, script, build: null }
    }

    const build = await getLatestBuild(script.current_version_id)
    return { success: true, script, build: build ? mapDashboardRow(build) : null }
  } catch (error) {
    if (error instanceof OwnershipError) {
      return { success: false, message: error.message, status: error.status }
    }

    return { success: false, message: 'Failed to fetch latest build status', status: 500 }
  }
}

export async function getBuildStatusesForVersions(
  ownerId: string,
  slug: unknown,
  versions: VersionSummaryRow[]
): Promise<BuildStatusMapResult> {
  try {
    const script = await getOwnedScriptForBuilds(ownerId, slug)
    const versionIds = versions
      .filter((version) => version.script_id === script.id)
      .map((version) => version.id)

    const builds = await listLatestBuildSummariesByVersionIds(versionIds)
    const allowedVersionIds = new Set(versionIds)
    const buildsByVersionId: Record<string, DashboardBuildListItem> = {}

    for (const build of builds) {
      if (!allowedVersionIds.has(build.version_id)) continue
      buildsByVersionId[build.version_id] = mapBuildResultRow(build)
    }

    return { success: true, buildsByVersionId }
  } catch (error) {
    if (error instanceof OwnershipError) {
      return { success: false, message: error.message, status: error.status }
    }

    return { success: false, message: 'Failed to fetch build statuses', status: 500 }
  }
}

export async function rebuildLatestVersion(
  ownerId: string,
  slug: unknown
): Promise<RebuildLatestVersionResult> {
  try {
    const script = await getOwnedScriptForBuilds(ownerId, slug)
    if (!script.current_version_id) {
      return { success: false, message: 'Script has no current version to rebuild', status: 400 }
    }

    const result = await rebuildVersion(script.current_version_id)
    if (!result.success) {
      return {
        success: false,
        message: result.message,
        status: result.status,
        build: result.build ? mapFullBuildRow(result.build) : undefined,
      }
    }

    return { success: true, script, build: mapFullBuildRow(result.build) }
  } catch (error) {
    if (error instanceof OwnershipError) {
      return { success: false, message: error.message, status: error.status }
    }

    return { success: false, message: 'Failed to rebuild script', status: 500 }
  }
}
