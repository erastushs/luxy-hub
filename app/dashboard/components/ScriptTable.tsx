'use client'

import { cn } from '@/app/lib/utils'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { getVisibilityBadge } from '@/app/dashboard/lib/visibility'
import { formatDate } from '@/app/dashboard/lib/format-date'

type Script = {
  id: string
  slug: string
  name: string
  description: string | null
  visibility: string
  created_at: string
  updated_at: string
}

type ScriptTableProps = {
  scripts: Script[]
  onDeleteClick: (slug: string) => void
}

export function ScriptTable({ scripts, onDeleteClick }: ScriptTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/50">
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Visibility
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider sm:table-cell">
              Updated
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {scripts.map((script) => {
            const vis = getVisibilityBadge(script.visibility)
            const VisIcon = vis.icon

            return (
              <tr key={script.id} className="transition hover:bg-zinc-900/30">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/scripts/${script.slug}/edit`}
                    className="font-medium text-white hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 rounded"
                  >
                    {script.name}
                  </Link>
                  <p className="text-xs text-zinc-500">/{script.slug}</p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                      vis.className
                    )}
                  >
                    <VisIcon className="h-3 w-3" aria-hidden="true" />
                    {vis.label}
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-xs text-zinc-500 sm:table-cell">
                  {formatDate(script.updated_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onDeleteClick(script.slug)}
                    className="rounded-md p-1.5 text-zinc-500 transition hover:bg-red-900/30 hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                    aria-label={`Delete ${script.name}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
