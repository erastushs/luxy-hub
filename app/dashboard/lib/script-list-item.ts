import type { DashboardBuildInfo } from '@/app/lib/services/dashboard-build-service'
import type { ScriptRow, VersionSummaryRow } from '@/app/lib/services/script-service'

export type DashboardScriptListItem = ScriptRow & {
  currentVersion: VersionSummaryRow | null
  buildInfo: DashboardBuildInfo | null
}
