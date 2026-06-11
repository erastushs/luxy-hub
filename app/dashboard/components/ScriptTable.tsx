'use client'

import { cn } from '@/app/lib/utils'
import Link from 'next/link'
import { Activity, BarChart3, Edit, Hammer, History, Trash2, Webhook } from 'lucide-react'
import { getVisibilityBadge } from '@/app/dashboard/lib/visibility'
import { formatDate } from '@/app/dashboard/lib/format-date'
import { BuildStatusBadge } from '@/app/dashboard/components/BuildStatusBadge'
import { CopyLoaderButton } from '@/app/dashboard/components/CopyLoaderButton'
import { Tooltip } from '@/app/dashboard/components/Tooltip'
import type { DashboardScriptListItem } from '@/app/dashboard/lib/script-list-item'

type ScriptTableProps = {
  scripts: DashboardScriptListItem[]
  onDeleteClick: (slug: string) => void
}

export function ScriptTable({ scripts, onDeleteClick }: ScriptTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/50">
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Script Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Visibility
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider md:table-cell">
              Current Version
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider sm:table-cell">
              Build Status
            </th>
            <th className="hidden px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider lg:table-cell">
              Executions
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider xl:table-cell">
              Last Executed
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider xl:table-cell">
              Last Updated
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Actions
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
                <td className="hidden px-4 py-3 md:table-cell">
                  <span className="font-mono text-xs text-zinc-400">
                    {script.currentVersion ? `v${script.currentVersion.version}` : '—'}
                  </span>
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <BuildStatusBadge status={script.buildInfo?.status ?? 'not_built'} />
                  {script.buildInfo?.lastBuildAt && (
                    <p className="mt-1 text-xs text-zinc-600">
                      {formatDate(script.buildInfo.lastBuildAt)}
                    </p>
                  )}
                </td>
                <td className="hidden px-4 py-3 text-right font-mono text-sm text-white tabular-nums lg:table-cell">
                  {Number(script.execute_count ?? 0).toLocaleString()}
                </td>
                <td className="hidden px-4 py-3 text-xs text-zinc-500 xl:table-cell">
                  {script.last_executed_at ? formatDate(script.last_executed_at) : 'Never'}
                </td>
                <td className="hidden px-4 py-3 text-xs text-zinc-500 xl:table-cell">
                  {formatDate(script.updated_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Tooltip text="Edit">
                      <Link
                        href={`/dashboard/scripts/${script.slug}/edit`}
                        className="rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                        aria-label={`Edit ${script.name}`}
                      >
                        <Edit className="h-4 w-4" aria-hidden="true" />
                      </Link>
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
                        onClick={() => onDeleteClick(script.slug)}
                        className="rounded-md p-1.5 text-zinc-500 transition hover:bg-red-900/30 hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                        aria-label={`Delete ${script.name}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </Tooltip>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
