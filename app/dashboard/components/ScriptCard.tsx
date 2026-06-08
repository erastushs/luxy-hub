'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/app/lib/utils'
import { Trash2, Edit, Eye, EyeOff, Globe, type LucideIcon } from 'lucide-react'
import { deleteScriptAction } from '@/app/actions/scripts'
import { useState } from 'react'

type Script = {
  id: string
  slug: string
  name: string
  description: string | null
  visibility: string
  created_at: string
  updated_at: string
}

const visibilityConfig: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  public: { label: 'Public', icon: Globe, className: 'text-emerald-400 bg-emerald-400/10' },
  private: { label: 'Private', icon: EyeOff, className: 'text-zinc-400 bg-zinc-400/10' },
  unlisted: { label: 'Unlisted', icon: Eye, className: 'text-amber-400 bg-amber-400/10' },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function ScriptCard({
  script,
  onDelete,
}: {
  script: Script
  onDelete: (slug: string) => void
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const vis = visibilityConfig[script.visibility] ?? visibilityConfig.private
  const VisIcon = vis.icon

  async function handleDelete() {
    setDeleting(true)
    const result = await deleteScriptAction(script.slug)
    if (result.success) {
      toast.success('Script deleted')
      onDelete(script.slug)
    } else {
      toast.error(result.message ?? 'Failed to delete script')
    }
    setDeleting(false)
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
          <VisIcon className="h-3 w-3" />
          {vis.label}
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => router.push(`/dashboard/scripts/${script.slug}/edit`)}
            className="rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
            title="Edit"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-md p-1.5 text-zinc-500 transition hover:bg-red-900/30 hover:text-red-400 disabled:opacity-50"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-zinc-600">
        <span>Created {formatDate(script.created_at)}</span>
        {script.updated_at !== script.created_at && (
          <span>Updated {formatDate(script.updated_at)}</span>
        )}
      </div>
    </div>
  )
}
