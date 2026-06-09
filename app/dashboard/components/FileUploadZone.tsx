'use client'
import { useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import { readSourceFile, formatFileSize, MAX_SOURCE_FILE_BYTES, type SourceFileMetadata } from '@/app/dashboard/lib/source-file'
import { FileMetadataCard } from '@/app/dashboard/components/FileMetadataCard'

type FileUploadZoneProps = {
  onFileReady: (file: { content: string; metadata: SourceFileMetadata }) => void
  onFileRejected?: () => void
  fallbackName?: string | null
}

export function FileUploadZone({ onFileReady, onFileRejected, fallbackName }: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<SourceFileMetadata | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return

    setError(null)
    const result = await readSourceFile(file)

    if (!result.success) {
      setSelectedFile(null)
      setError(result.message)
      onFileRejected?.()
      return
    }

    setSelectedFile(result.metadata)
    onFileReady({ content: result.content, metadata: result.metadata })
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          void handleFile(event.dataTransfer.files[0])
        }}
        className={cn(
          'flex min-h-36 w-full flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600',
          isDragging
            ? 'border-red-600 bg-red-600/10'
            : 'border-zinc-700 bg-zinc-900/40 hover:border-zinc-600 hover:bg-zinc-900/70'
        )}
      >
        <UploadCloud className="h-7 w-7 text-zinc-400" aria-hidden="true" />
        <span className="mt-3 text-sm font-medium text-white">Upload Lua or text source</span>
        <span className="mt-1 text-xs text-zinc-500">Drop a .lua or .txt file here. Max {formatFileSize(MAX_SOURCE_FILE_BYTES)}.</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".lua,.txt,text/plain"
        className="sr-only"
        onChange={(event) => {
          void handleFile(event.target.files?.[0])
          event.currentTarget.value = ''
        }}
      />

      <FileMetadataCard
        file={selectedFile}
        fallbackName={selectedFile ? null : fallbackName}
        status={error ? 'error' : selectedFile || fallbackName ? 'ready' : 'idle'}
        error={error}
      />
    </div>
  )
}
