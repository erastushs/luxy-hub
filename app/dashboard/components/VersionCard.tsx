import { cn } from '@/app/lib/utils'
import { formatDateTime } from '@/app/dashboard/lib/format-date'

type VersionRow = {
  id: string
  script_id: string
  version: string
  changelog: string | null
  created_at: string
}

type VersionCardProps = {
  version: VersionRow
  active?: boolean
  onClick?: () => void
}

export function VersionCard({ version, active = false, onClick }: VersionCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full rounded-xl border p-5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600',
        active
          ? 'border-red-600/30 bg-red-600/5'
          : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
      )}
      aria-pressed={active}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white">v{version.version}</span>
        <span className="font-mono text-xs text-zinc-500">
          {formatDateTime(version.created_at)}
        </span>
      </div>
      {version.changelog && (
        <p className="mt-2 line-clamp-2 text-xs text-zinc-400">
          {version.changelog}
        </p>
      )}
    </button>
  )
}
