'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn } from '@/app/lib/utils'
import { Activity, BarChart3, Trash2, Edit, Hammer, History, Webhook } from 'lucide-react'
import { deleteScriptAction } from '@/app/actions/scripts'
import { getVisibilityBadge } from '@/app/dashboard/lib/visibility'
import { formatDate } from '@/app/dashboard/lib/format-date'
import { useState } from 'react'
import { BuildStatusBadge } from '@/app/dashboard/components/BuildStatusBadge'
import { CopyLoaderButton } from '@/app/dashboard/components/CopyLoaderButton'
import { DeleteDialog } from '@/app/dashboard/components/DeleteDialog'
import { Tooltip } from '@/app/dashboard/components/Tooltip'
import type { DashboardScriptListItem } from '@/app/dashboard/lib/script-list-item'

export function ScriptCard({
  script,
  onDelete,
}: {
  script: DashboardScriptListItem
  onDelete: (slug: string) => void
}) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const vis = getVisibilityBadge(script.visibility)
  const VisIcon = vis.icon

  async function handleDelete(slug: string) {
    const result = await deleteScriptAction(script.slug)
    if (result.success) {
      toast.success('Script deleted')
      onDelete(slug)
    } else {
      toast.error(result.message ?? 'Failed to delete script')
    }
    setDeleteOpen(false)
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition hover:border-zinc-700">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-white">
            {script.name}
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500">/{script.slug}</p>
          {script.description && (
            <p className="mt-2 line-clamp-2 text-xs text-zinc-400">
              {script.description}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
            vis.className
          )}
        >
          <VisIcon className="h-3 w-3" aria-hidden="true" />
          {vis.label}
        </span>

        <div className="flex items-center gap-1">
          <Tooltip text="Edit">
            <button
              type="button"
              onClick={() => router.push(`/dashboard/scripts/${script.slug}/edit`)}
              className="rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
              aria-label={`Edit ${script.name}`}
            >
              <Edit className="h-4 w-4" aria-hidden="true" />
            </button>
          </Tooltip>
          <CopyLoaderButton slug={script.slug} scriptName={script.name} variant="icon" />
          <Tooltip text="Build History">
            <Link
              href={`/dashboard/scripts/${script.slug}/builds`}
              className="rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
              aria-label={`View builds for ${script.name}`}
            >
              <Hammer className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Tooltip>
          <Tooltip text="Versions">
            <Link
              href={`/dashboard/versions/${script.slug}`}
              className="rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
              aria-label={`View versions for ${script.name}`}
            >
              <History className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Tooltip>
          <Tooltip text="Analytics">
            <Link
              href="/dashboard/analytics"
              className="rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
              aria-label={`View analytics for ${script.name}`}
            >
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Tooltip>
          <Tooltip text="Events">
            <Link
              href={`/dashboard/scripts/${script.slug}/events`}
              className="rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
              aria-label={`View events for ${script.name}`}
            >
              <Activity className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Tooltip>
          <Tooltip text="Webhooks">
            <Link
              href={`/dashboard/scripts/${script.slug}/webhooks`}
              className="rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
              aria-label={`Webhook settings for ${script.name}`}
            >
              <Webhook className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Tooltip>
          <Tooltip text="Delete">
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="rounded-md p-1.5 text-zinc-500 transition hover:bg-red-900/30 hover:text-red-400 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
              aria-label={`Delete ${script.name}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-zinc-600">Version</p>
          <p className="mt-1 font-mono text-zinc-400">
            {script.currentVersion ? `v${script.currentVersion.version}` : '—'}
          </p>
        </div>
        <div>
          <p className="text-zinc-600">Build</p>
          <div className="mt-1">
            <BuildStatusBadge status={script.buildInfo?.status ?? 'not_built'} />
          </div>
        </div>
        <div>
          <p className="text-zinc-600">Executions</p>
          <p className="mt-1 font-mono text-zinc-400">
            {Number(script.execute_count ?? 0).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-zinc-600">Last Executed</p>
          <p className="mt-1 text-zinc-400">
            {script.last_executed_at ? formatDate(script.last_executed_at) : 'Never'}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-600">
        {script.updated_at !== script.created_at && (
          <span>Updated {formatDate(script.updated_at)}</span>
        )}
        {script.buildInfo?.lastBuildAt && (
          <span>Built {formatDate(script.buildInfo.lastBuildAt)}</span>
        )}
      </div>
      {deleteOpen && (
        <DeleteDialog
          scriptName={script.name}
          scriptSlug={script.slug}
          onConfirm={handleDelete}
          onCancel={() => setDeleteOpen(false)}
        />
      )}
    </div>
  )
}
