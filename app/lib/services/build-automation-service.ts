import {
  getLatestBuildRow,
  type DeliveryBuildRow,
  type DeliveryBuildStatus,
} from '@/app/lib/repositories/delivery-build-repository'
import {
  buildVersion,
  DELIVERY_BUILD_VERSION,
  PAYLOAD_FORMAT_VERSION,
  type BuildVersionResult,
} from '@/app/lib/services/delivery-build-service'

export type AutoBuildTrigger =
  | 'script_created'
  | 'version_created'
  | 'script_published'

type AutoBuildSkipReason = 'already_ready' | 'already_running' | 'failed_requires_manual_rebuild'

export type AutoBuildResult =
  | {
      success: true
      skipped: false
      trigger: AutoBuildTrigger
      build: DeliveryBuildRow
    }
  | {
      success: true
      skipped: true
      trigger: AutoBuildTrigger
      reason: AutoBuildSkipReason
      latestStatus: DeliveryBuildStatus
      build: DeliveryBuildRow
    }
  | {
      success: false
      skipped: false
      trigger: AutoBuildTrigger
      message: string
      status: number
      build?: DeliveryBuildRow
    }

function mapBuildResult(trigger: AutoBuildTrigger, result: BuildVersionResult): AutoBuildResult {
  if (result.success) {
    return {
      success: true,
      skipped: false,
      trigger,
      build: result.build,
    }
  }

  return {
    success: false,
    skipped: false,
    trigger,
    message: result.message,
    status: result.status,
    build: result.build,
  }
}

function skipReasonForStatus(status: DeliveryBuildStatus): AutoBuildSkipReason | null {
  if (status === 'ready') return 'already_ready'
  if (status === 'pending' || status === 'building') return 'already_running'
  if (status === 'failed') return 'failed_requires_manual_rebuild'
  return null
}

export async function ensureAutoBuildForVersion(
  versionId: string,
  trigger: AutoBuildTrigger
): Promise<AutoBuildResult> {
  const latestBuild = await getLatestBuildRow(versionId, {
    buildVersion: DELIVERY_BUILD_VERSION,
    payloadFormatVersion: PAYLOAD_FORMAT_VERSION,
  })

  if (latestBuild) {
    const reason = skipReasonForStatus(latestBuild.build_status)
    if (reason) {
      return {
        success: true,
        skipped: true,
        trigger,
        reason,
        latestStatus: latestBuild.build_status,
        build: latestBuild,
      }
    }
  }

  return mapBuildResult(trigger, await buildVersion(versionId))
}

export async function runAutoBuildForVersion(
  versionId: string,
  trigger: AutoBuildTrigger
): Promise<void> {
  try {
    await ensureAutoBuildForVersion(versionId, trigger)
  } catch {
    // Source mutations must remain durable even if build automation has an unexpected failure.
  }
}
