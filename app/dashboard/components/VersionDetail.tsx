'use client'

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

type VersionRow = {
  id: string
  script_id: string
  version: string
  content: string
  changelog: string | null
  created_at: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type VersionDetailProps = {
  version: VersionRow
  scriptSlug: string
}

export function VersionDetail({ version, scriptSlug }: VersionDetailProps) {
  const router = useRouter()

  return (
    <div className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <button
        onClick={() => router.push(`/dashboard/versions/${scriptSlug}`)}
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to versions
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Version {version.version}
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Created {formatDate(version.created_at)}
          </p>
        </div>
        <span className="rounded-md bg-red-600/10 px-2.5 py-1 text-xs font-medium text-red-400">
          /{scriptSlug}
        </span>
      </div>

      {version.changelog && (
        <div>
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Changelog
          </h3>
          <p className="mt-2 text-sm text-zinc-300">{version.changelog}</p>
        </div>
      )}

      <div>
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          Content
        </h3>
        <pre className="mt-2 max-h-96 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-300 font-mono">
          {version.content}
        </pre>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
