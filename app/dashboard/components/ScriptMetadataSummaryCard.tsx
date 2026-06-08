import { BuildStatusBadge } from '@/app/dashboard/components/BuildStatusBadge'
import { CopyButton } from '@/app/dashboard/components/CopyButton'
import { getLoaderUrl } from '@/app/dashboard/lib/loader-snippet'
import type { DashboardBuildInfo } from '@/app/lib/services/dashboard-build-service'
import type { VersionSummaryRow } from '@/app/lib/services/script-service'

type ScriptMetadataSummaryCardProps = {
  slug: string
  currentVersion: VersionSummaryRow | null
  buildInfo: DashboardBuildInfo | null
}

export function ScriptMetadataSummaryCard({
  slug,
  currentVersion,
  buildInfo,
}: ScriptMetadataSummaryCardProps) {
  const loaderUrl = getLoaderUrl(slug)

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <h2 className="text-sm font-semibold text-white">Script Summary</h2>
      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <dt className="text-xs uppercase tracking-wider text-zinc-500">Current Slug</dt>
          <dd className="mt-2 font-mono text-sm text-zinc-300">/{slug}</dd>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <dt className="text-xs uppercase tracking-wider text-zinc-500">Current Version</dt>
          <dd className="mt-2 font-mono text-sm text-zinc-300">
            {currentVersion ? `v${currentVersion.version}` : '—'}
          </dd>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <dt className="text-xs uppercase tracking-wider text-zinc-500">Build Status</dt>
          <dd className="mt-2">
            <BuildStatusBadge status={buildInfo?.status ?? 'not_built'} />
          </dd>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-xs uppercase tracking-wider text-zinc-500">Loader URL</dt>
            <CopyButton value={loaderUrl} label="URL" compact />
          </div>
          <dd className="mt-2 truncate font-mono text-xs text-zinc-300">
            {loaderUrl}
          </dd>
        </div>
      </dl>
    </section>
  )
}
