import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { formatDateTime } from '@/app/dashboard/lib/format-date'
import { BuildStatusBadge } from '@/app/dashboard/components/BuildStatusBadge'
import type { DashboardBuildListItem } from '@/app/lib/services/build-operations-service'

type VersionRow = {
  id: string
  script_id: string
  version: string
  content: string
  changelog: string | null
  created_at: string
}

type VersionDetailProps = {
  version: VersionRow
  scriptSlug: string
  build?: DashboardBuildListItem | null
}

export function VersionDetail({ version, scriptSlug, build = null }: VersionDetailProps) {
  return (
    <div className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <Link
        href={`/dashboard/versions/${scriptSlug}`}
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 rounded"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to versions
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">
            Version {version.version}
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Created {formatDateTime(version.created_at)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-md bg-red-600/10 px-2.5 py-1 text-xs font-medium text-red-400">
            /{scriptSlug}
          </span>
          <BuildStatusBadge status={build?.status ?? 'not_built'} />
        </div>
      </div>

      {version.changelog && (
        <div>
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Changelog
          </h2>
          <p className="mt-2 text-sm text-zinc-300">{version.changelog}</p>
        </div>
      )}

      <div>
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          Content
        </h2>
        <pre className="mt-2 max-h-96 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-300 font-mono">
          {version.content}
        </pre>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <span className="text-xs text-zinc-500">Version</span>
          <p className="font-mono text-sm text-white">{version.version}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <span className="text-xs text-zinc-500">Version ID</span>
          <p className="truncate font-mono text-xs text-zinc-400">{version.id}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <span className="text-xs text-zinc-500">Created</span>
          <p className="text-sm text-white">
            {new Date(version.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  )
}
