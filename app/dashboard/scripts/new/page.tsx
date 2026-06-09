'use client'

import { useActionState, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Clipboard, UploadCloud } from 'lucide-react'
import { createScriptAction } from '@/app/actions/scripts'
import { cn } from '@/app/lib/utils'
import { FileUploadZone } from '@/app/dashboard/components/FileUploadZone'
import { Tooltip } from '@/app/dashboard/components/Tooltip'
import type { SourceFileMetadata } from '@/app/dashboard/lib/source-file'

type SourceMode = 'upload' | 'paste'

export default function NewScriptPage() {
  const [state, formAction, isPending] = useActionState(createScriptAction, { success: false })
  const [sourceMode, setSourceMode] = useState<SourceMode>('upload')
  const [content, setContent] = useState('')
  const [uploadedFile, setUploadedFile] = useState<SourceFileMetadata | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    setClientError(null)

    if (sourceMode === 'upload' && !uploadedFile) {
      event.preventDefault()
      setClientError('Upload a .lua or .txt file')
      return
    }

    if (!content.trim()) {
      event.preventDefault()
      setClientError('Content is required')
    }
  }

  const displayError = clientError || (!state?.success ? state?.message : null)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Tooltip text="Back to Scripts">
          <Link
            href="/dashboard/scripts"
            className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
            aria-label="Back to scripts"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
        </Tooltip>
        <div>
          <h1 className="text-2xl font-bold text-white">New Script</h1>
          <p className="mt-1 text-sm text-zinc-400">Create a new script</p>
        </div>
      </div>

      <form action={formAction} onSubmit={handleSubmit} className="space-y-6">
        {displayError && (
          <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
            {displayError}
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-zinc-300">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={100}
            className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
            placeholder="My Script"
          />
        </div>

        <div>
          <label htmlFor="slug" className="block text-sm font-medium text-zinc-300">
            Slug
          </label>
          <p className="mt-1 text-xs text-zinc-500">
            Lowercase letters, numbers, and hyphens. 3-64 characters.
          </p>
          <div className="mt-2 flex gap-2 rounded-lg border border-amber-900/50 bg-amber-950/10 px-3 py-2 text-xs text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            <p>
              Choose carefully. This slug becomes the loader URL and changing it later would break existing users.
            </p>
          </div>
          <input
            id="slug"
            name="slug"
            type="text"
            required
            maxLength={64}
            pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
            className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
            placeholder="my-script"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-zinc-300">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
            placeholder="Optional description"
          />
        </div>

        <input type="hidden" name="content" value={content} />
        <input type="hidden" name="source_filename" value={uploadedFile?.name ?? ''} />

        <div className="space-y-3">
          <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-1">
            <button
              type="button"
              onClick={() => setSourceMode('upload')}
              className={cn(
                'inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition',
                sourceMode === 'upload'
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
              Upload File
            </button>
            <button
              type="button"
              onClick={() => setSourceMode('paste')}
              className={cn(
                'inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition',
                sourceMode === 'paste'
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <Clipboard className="h-4 w-4" aria-hidden="true" />
              Paste Source
            </button>
          </div>

          {sourceMode === 'upload' ? (
            <FileUploadZone
              onFileReady={({ content: fileContent, metadata }) => {
                setContent(fileContent)
                setUploadedFile(metadata)
                setClientError(null)
              }}
              onFileRejected={() => {
                setContent('')
                setUploadedFile(null)
              }}
            />
          ) : (
            <div>
              <label htmlFor="source-content" className="block text-sm font-medium text-zinc-300">
                Content
              </label>
              <p className="mt-1 text-xs text-zinc-500">Script body. Max 1 MB.</p>
              <textarea
                id="source-content"
                rows={8}
                value={content}
                onChange={(event) => {
                  setContent(event.target.value)
                  setUploadedFile(null)
                }}
                className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 font-mono text-sm text-white placeholder:text-zinc-500 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                placeholder="print('hello')"
              />
            </div>
          )}
        </div>

        <div>
          <label htmlFor="visibility" className="block text-sm font-medium text-zinc-300">
            Visibility
          </label>
          <select
            id="visibility"
            name="visibility"
            defaultValue="private"
            className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
          >
            <option value="private">Private</option>
            <option value="unlisted">Unlisted</option>
            <option value="public">Public</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Creating...' : 'Create Script'}
          </button>
          <Link
            href="/dashboard/scripts"
            className="rounded-lg border border-zinc-800 px-4 py-2.5 text-sm text-zinc-400 transition hover:bg-zinc-800"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
