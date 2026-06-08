import {
  listLatestBuildSummariesByVersionIds,
  type DeliveryBuildStatus,
} from '@/app/lib/repositories/delivery-build-repository'
import type { ScriptRow } from '@/app/lib/repositories/script-repository'

export type DashboardBuildInfo = {
  buildId: string
  scriptId: string
  versionId: string
  status: DeliveryBuildStatus
  buildVersion: string
  payloadFormatVersion: string
  invalidatedReason: string | null
  errorCode: string | null
  errorMessage: string | null
  lastBuildAt: string | null
  invalidatedAt: string | null
  createdAt: string
  updatedAt: string
}

export async function getDashboardBuildInfoForScripts(
  ownerId: string,
  scripts: ScriptRow[]
): Promise<Record<string, DashboardBuildInfo>> {
  const ownedCurrentVersionIds = scripts
    .filter((script) => script.creator_id === ownerId && script.current_version_id)
    .map((script) => script.current_version_id as string)

  const builds = await listLatestBuildSummariesByVersionIds(ownedCurrentVersionIds)
  const allowedVersionIds = new Set(ownedCurrentVersionIds)
  const result: Record<string, DashboardBuildInfo> = {}

  for (const build of builds) {
    if (!allowedVersionIds.has(build.version_id)) continue

    result[build.version_id] = {
      buildId: build.id,
      scriptId: build.script_id,
      versionId: build.version_id,
      status: build.build_status,
      buildVersion: build.build_version,
      payloadFormatVersion: build.payload_format_version,
      invalidatedReason: build.invalidated_reason,
      errorCode: build.build_error_code,
      errorMessage: build.build_error_message,
      lastBuildAt: build.built_at ?? build.updated_at,
      invalidatedAt: build.invalidated_at,
      createdAt: build.created_at,
      updatedAt: build.updated_at,
    }
  }

  return result
}
