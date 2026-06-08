'use client'

import { cn } from '@/app/lib/utils'
import Link from 'next/link'
import { Eye, EyeOff, Globe, Trash2, type LucideIcon } from 'lucide-react'

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
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {scripts.map((script) => {
            const vis = visibilityConfig[script.visibility] ?? visibilityConfig.private
            const VisIcon = vis.icon

            return (
              <tr key={script.id} className="transition hover:bg-zinc-900/30">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/scripts/${script.slug}/edit`}
                    className="font-medium text-white hover:text-red-400"
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
                    <VisIcon className="h-3 w-3" />
                    {vis.label}
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-xs text-zinc-500 sm:table-cell">
                  {formatDate(script.updated_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onDeleteClick(script.slug)}
                    className="rounded-md p-1.5 text-zinc-500 transition hover:bg-red-900/30 hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
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
