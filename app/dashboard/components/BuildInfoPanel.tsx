import { BuildStatusBadge } from '@/app/dashboard/components/BuildStatusBadge'
import { formatDateTime } from '@/app/dashboard/lib/format-date'
import type { DashboardBuildInfo } from '@/app/lib/services/dashboard-build-service'

type BuildInfoPanelProps = {
  build: DashboardBuildInfo | null
}

function valueOrDash(value: string | null | undefined): string {
  return value && value.length > 0 ? value : '—'
}

export function BuildInfoPanel({ build }: BuildInfoPanelProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-white">Delivery Build</h2>
        <BuildStatusBadge status={build?.status ?? 'not_built'} />
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-zinc-500">Last Build</dt>
          <dd className="mt-1 text-sm text-zinc-300">
            {build?.lastBuildAt ? formatDateTime(build.lastBuildAt) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Build Version</dt>
          <dd className="mt-1 truncate font-mono text-xs text-zinc-300">
            {valueOrDash(build?.buildVersion)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Payload Format</dt>
          <dd className="mt-1 truncate font-mono text-xs text-zinc-300">
            {valueOrDash(build?.payloadFormatVersion)}
          </dd>
        </div>
      </dl>

      {build?.status === 'failed' && (build.errorCode || build.errorMessage) && (
        <div className="mt-4 rounded-lg border border-red-900/50 bg-red-950/20 p-3">
          <p className="text-xs font-medium text-red-400">Build Failure</p>
          {build.errorCode && (
            <p className="mt-2 font-mono text-xs text-red-300">{build.errorCode}</p>
          )}
          {build.errorMessage && (
            <p className="mt-1 text-sm text-zinc-300">{build.errorMessage}</p>
          )}
        </div>
      )}
    </div>
  )
}
