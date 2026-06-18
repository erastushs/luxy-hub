import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { listCreatorScripts, type ScriptRow } from '@/app/lib/services/script-service'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { EmptyState } from '@/app/dashboard/components/EmptyState'
import { ErrorBanner } from '@/app/dashboard/components/ErrorBanner'
import { getVisibilityBadge } from '@/app/dashboard/lib/visibility'
import { formatDate } from '@/app/dashboard/lib/format-date'

export default async function VersionsPage() {
  const user = await getCurrentUser()

  let scripts: ScriptRow[] = []
  let error: string | null = null

  if (user) {
    const result = await listCreatorScripts(user.id, {
      limit: 50,
      offset: 0,
    })

    if (result.success) {
      scripts = result.scripts
    } else {
      error = result.message ?? 'Failed to load scripts'
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Versions</h1>
        <p className="mt-1 text-sm text-zinc-400">View script version history.</p>
      </div>

      {error && <ErrorBanner message={error} />}

      {scripts.length === 0 && !error ? (
        <EmptyState
          title="No scripts yet"
          description="Create a script first to view its version history."
          action={
            <Link
              href="/dashboard/scripts/new"
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Create Script
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {scripts.map((script) => {
            const vis = getVisibilityBadge(script.visibility)
            const VisIcon = vis.icon

            return (
              <Link
                key={script.id}
                href={`/dashboard/versions/${script.slug}`}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition hover:border-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-white">
                    {script.name}
                  </h3>
                  <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                    <span>/{script.slug}</span>
                    <span className="inline-flex items-center gap-1">
                      <VisIcon className="h-3 w-3" aria-hidden="true" />
                      {vis.label}
                    </span>
                    <span>Updated {formatDate(script.updated_at)}</span>
                  </div>
                </div>
                <ArrowRight className="ml-3 h-4 w-4 flex-shrink-0 text-zinc-600" aria-hidden="true" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
