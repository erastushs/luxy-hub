'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { VersionList } from '@/app/dashboard/components/VersionList'
import { Pagination } from '@/app/dashboard/components/Pagination'
import type { VersionSummaryRow, ScriptRow } from '@/app/lib/services/script-service'
import type { DashboardBuildListItem } from '@/app/lib/services/build-operations-service'

type VersionsHistoryClientProps = {
  slug: string
  versions: VersionSummaryRow[]
  total: number
  page: number
  totalPages: number
  scripts: ScriptRow[]
  buildsByVersionId: Record<string, DashboardBuildListItem>
}

export default function VersionsHistoryClient({
  slug,
  versions,
  total,
  page,
  totalPages,
  scripts,
  buildsByVersionId,
}: VersionsHistoryClientProps) {
  const router = useRouter()

  const currentScript = scripts.find((s) => s.slug === slug)

  function goToPage(p: number) {
    const sp = new URLSearchParams()
    sp.set('page', String(p))
    router.push(`/dashboard/versions/${slug}?${sp.toString()}`)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/versions"
          className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          aria-label="Back to script list"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Version History</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {currentScript ? currentScript.name : `/${slug}`}
            <span className="ml-2 text-xs text-zinc-600">
              {total} version{total !== 1 ? 's' : ''}
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <VersionList
            versions={versions}
            buildsByVersionId={buildsByVersionId}
            onSelect={(v) => router.push(`/dashboard/versions/${slug}/${v.id}`)}
          />

          {totalPages > 1 && (
            <div className="mt-6">
              <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Your Scripts
          </h3>
          {scripts.length === 0 ? (
            <p className="text-xs text-zinc-600">No scripts found.</p>
          ) : (
            <div className="space-y-1">
              {scripts.map((script) => (
                <Link
                  key={script.id}
                  href={`/dashboard/versions/${script.slug}`}
                  className={`block rounded-lg px-3 py-2 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 ${
                    script.slug === slug
                      ? 'bg-red-600/10 text-red-400'
                      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                  }`}
                >
                  {script.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
