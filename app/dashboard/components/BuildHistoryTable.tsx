import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { BuildStatusBadge } from '@/app/dashboard/components/BuildStatusBadge'
import { formatDateTime } from '@/app/dashboard/lib/format-date'
import type { DashboardBuildListItem } from '@/app/lib/services/build-operations-service'

type BuildHistoryTableProps = {
  slug: string
  builds: DashboardBuildListItem[]
}

function dateOrDash(value: string | null): string {
  return value ? formatDateTime(value) : '—'
}

export function BuildHistoryTable({ slug, builds }: BuildHistoryTableProps) {
  if (builds.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
        <p className="text-sm text-zinc-500">No delivery builds found for this script.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/50">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
              Status
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 md:table-cell">
              Build Version
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 lg:table-cell">
              Payload Format
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
              Built At
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 xl:table-cell">
              Invalidated At
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 sm:table-cell">
              Failure
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
              Details
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {builds.map((build) => (
            <tr key={build.buildId} className="transition hover:bg-zinc-900/30">
              <td className="px-4 py-3">
                <BuildStatusBadge status={build.status} />
                <p className="mt-1 font-mono text-xs text-zinc-600">
                  {build.buildId.slice(0, 8)}
                </p>
              </td>
              <td className="hidden px-4 py-3 font-mono text-xs text-zinc-400 md:table-cell">
                {build.buildVersion}
              </td>
              <td className="hidden px-4 py-3 font-mono text-xs text-zinc-400 lg:table-cell">
                {build.payloadFormatVersion}
              </td>
              <td className="px-4 py-3 text-xs text-zinc-500">
                {dateOrDash(build.builtAt)}
              </td>
              <td className="hidden px-4 py-3 text-xs text-zinc-500 xl:table-cell">
                {dateOrDash(build.invalidatedAt)}
              </td>
              <td className="hidden px-4 py-3 sm:table-cell">
                {build.status === 'failed' ? (
                  <div className="max-w-56">
                    <p className="font-mono text-xs text-red-400">
                      {build.errorCode ?? 'build_failed'}
                    </p>
                    {build.errorMessage && (
                      <p className="mt-1 truncate text-xs text-zinc-500">
                        {build.errorMessage}
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-zinc-600">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/dashboard/scripts/${slug}/builds/${build.buildId}`}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                >
                  Open
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
