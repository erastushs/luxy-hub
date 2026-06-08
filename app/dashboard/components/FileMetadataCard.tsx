import { FileCode2 } from 'lucide-react'
import { formatFileSize, type SourceFileMetadata } from '@/app/dashboard/lib/source-file'

type FileMetadataCardProps = {
  file: SourceFileMetadata | null
  fallbackName?: string | null
  status?: 'idle' | 'ready' | 'error'
  error?: string | null
}

export function FileMetadataCard({
  file,
  fallbackName,
  status = 'idle',
  error = null,
}: FileMetadataCardProps) {
  const label = file?.name ?? fallbackName ?? 'No file selected'
  const detail = file ? formatFileSize(file.size) : fallbackName ? 'Stored on current version' : 'Awaiting upload'
  const statusLabel = status === 'ready' ? 'Ready' : status === 'error' ? 'Rejected' : 'Idle'

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-zinc-800 p-2 text-zinc-400">
          <FileCode2 className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-white">{label}</p>
            <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">{detail}</p>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  )
}
