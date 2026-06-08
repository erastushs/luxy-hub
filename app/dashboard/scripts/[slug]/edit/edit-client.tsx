'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Hammer } from 'lucide-react'
import { updateScriptAction } from '@/app/actions/scripts'
import { FileUploadZone } from '@/app/dashboard/components/FileUploadZone'
import { BuildInfoPanel } from '@/app/dashboard/components/BuildInfoPanel'
import { CopyLoaderButton } from '@/app/dashboard/components/CopyLoaderButton'
import { LoaderSnippetCard } from '@/app/dashboard/components/LoaderSnippetCard'
import { RebuildButton } from '@/app/dashboard/components/RebuildButton'
import { ScriptMetadataSummaryCard } from '@/app/dashboard/components/ScriptMetadataSummaryCard'
import { Tooltip } from '@/app/dashboard/components/Tooltip'
import type { DashboardBuildInfo } from '@/app/lib/services/dashboard-build-service'
import type { ScriptRow, VersionSummaryRow } from '@/app/lib/services/script-service'
import type { SourceFileMetadata } from '@/app/dashboard/lib/source-file'

export default function EditScriptClient({
  script,
  currentVersion,
  buildInfo,
  lastUploadedFilename,
}: {
  script: ScriptRow
  currentVersion: VersionSummaryRow | null
  buildInfo: DashboardBuildInfo | null
  lastUploadedFilename: string | null
}) {
  const updateWithSlug = updateScriptAction.bind(null, script.slug)
  const [state, formAction, isPending] = useActionState(updateWithSlug, { success: false })
  const [replacementContent, setReplacementContent] = useState('')
  const [replacementFile, setReplacementFile] = useState<SourceFileMetadata | null>(null)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
            <h1 className="text-2xl font-bold text-white">Edit Script</h1>
            <p className="mt-1 text-sm text-zinc-400">
              /{script.slug}
              {currentVersion && (
                <span className="ml-2 text-xs text-zinc-600">v{currentVersion.version}</span>
              )}
            </p>
          </div>
        </div>
        <CopyLoaderButton slug={script.slug} scriptName={script.name} />
      </div>

      <ScriptMetadataSummaryCard
        slug={script.slug}
        currentVersion={currentVersion}
        buildInfo={buildInfo}
      />

      <LoaderSnippetCard slug={script.slug} />

      <div className="rounded-lg border border-amber-900/50 bg-amber-950/10 p-4">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-amber-300">Slug Safety</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Loader URLs are tied to the script slug. Slugs are fixed after creation in the current dashboard, so existing loader users keep the same URL.
            </p>
          </div>
        </div>
      </div>

      <form action={formAction} className="space-y-6">
        <div>
          <input type="hidden" name="content" value={replacementContent} />
          <input type="hidden" name="source_filename" value={replacementFile?.name ?? ''} />
        </div>

        {state?.message && !state.success && (
          <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
            {state.message}
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
            defaultValue={script.name}
            maxLength={100}
            className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
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
            defaultValue={script.description ?? ''}
            className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
            placeholder="Optional description"
          />
        </div>

        <div>
          <label htmlFor="visibility" className="block text-sm font-medium text-zinc-300">
            Visibility
          </label>
          <select
            id="visibility"
            name="visibility"
            defaultValue={script.visibility}
            className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
          >
            <option value="private">Private</option>
            <option value="unlisted">Unlisted</option>
            <option value="public">Public</option>
          </select>
        </div>

        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-medium text-zinc-300">Replace Lua File</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Current content remains unchanged unless a replacement file is selected.
            </p>
          </div>
          <FileUploadZone
            fallbackName={replacementFile ? null : lastUploadedFilename}
            onFileReady={({ content, metadata }) => {
              setReplacementContent(content)
              setReplacementFile(metadata)
            }}
            onFileRejected={() => {
              setReplacementContent('')
              setReplacementFile(null)
            }}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Saving...' : 'Save Changes'}
          </button>
          <Link
            href="/dashboard/scripts"
            className="rounded-lg border border-zinc-800 px-4 py-2.5 text-sm text-zinc-400 transition hover:bg-zinc-800"
          >
            Cancel
          </Link>
        </div>
      </form>

      <div className="space-y-3">
        <BuildInfoPanel build={buildInfo} />
        <div className="flex flex-wrap items-center gap-3">
          <RebuildButton slug={script.slug} />
          <Link
            href={`/dashboard/scripts/${script.slug}/builds`}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800"
          >
            <Hammer className="h-4 w-4" aria-hidden="true" />
            Build History
          </Link>
        </div>
      </div>
    </div>
  )
}
