import { cn } from '@/app/lib/utils'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

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
        'w-full rounded-xl border p-5 text-left transition',
        active
          ? 'border-red-600/30 bg-red-600/5'
          : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white">v{version.version}</span>
        <span className="font-mono text-xs text-zinc-500">
          {formatDate(version.created_at)}
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
