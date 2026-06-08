import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { listCreatorScripts, type ScriptRow } from '@/app/lib/services/script-service'
import Link from 'next/link'
import { History, ArrowRight, Globe, EyeOff, Eye } from 'lucide-react'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const visibilityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  public: Globe,
  private: EyeOff,
  unlisted: Eye,
}

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
        <p className="mt-1 text-sm text-zinc-400">View version history for your scripts</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {scripts.length === 0 && !error ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/50 mx-auto">
            <History className="h-6 w-6 text-zinc-500" />
          </div>
          <h3 className="mt-4 text-sm font-medium text-zinc-300">No scripts yet</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Create a script first to view its version history.
          </p>
          <Link
            href="/dashboard/scripts/new"
            className="mt-6 inline-flex rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            Create Script
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {scripts.map((script) => {
            const VisIcon = visibilityIcons[script.visibility] ?? EyeOff

            return (
              <Link
                key={script.id}
                href={`/dashboard/versions/${script.slug}`}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition hover:border-zinc-700"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-white">
                    {script.name}
                  </h3>
                  <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                    <span>/{script.slug}</span>
                    <span className="inline-flex items-center gap-1">
                      <VisIcon className="h-3 w-3" />
                      {script.visibility}
                    </span>
                    <span>Updated {formatDate(script.updated_at)}</span>
                  </div>
                </div>
                <ArrowRight className="ml-3 h-4 w-4 flex-shrink-0 text-zinc-600" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
