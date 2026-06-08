import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { listBuildHistory } from '@/app/lib/services/build-operations-service'
import { BuildHistoryTable } from '@/app/dashboard/components/BuildHistoryTable'
import { RebuildButton } from '@/app/dashboard/components/RebuildButton'

function pageHref(slug: string, page: number): string {
  return `/dashboard/scripts/${slug}/builds?page=${page}`
}

export default async function ScriptBuildsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { slug } = await params
  const sp = await searchParams
  const requestedPage = typeof sp.page === 'string' ? parseInt(sp.page, 10) : 1
  const page = Math.max(1, isNaN(requestedPage) ? 1 : requestedPage)
  const limit = 10
  const offset = (page - 1) * limit

  const result = await listBuildHistory(user.id, slug, { limit, offset })
  if (!result.success) {
    notFound()
  }

  const totalPages = Math.max(1, Math.ceil(result.total / limit))

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/scripts"
            className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
            aria-label="Back to scripts"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Build History</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {result.script.name}
              <span className="ml-2 text-xs text-zinc-600">/{result.script.slug}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <RebuildButton slug={result.script.slug} />
          <Link
            href={`/dashboard/scripts/${result.script.slug}/edit`}
            className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800"
          >
            Edit Script
          </Link>
        </div>
      </div>

      <BuildHistoryTable slug={result.script.slug} builds={result.builds} />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <Link
            href={pageHref(result.script.slug, Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            className={`inline-flex items-center gap-1 rounded-lg border border-zinc-800 px-3 py-2 text-sm transition ${
              page <= 1
                ? 'pointer-events-none text-zinc-700'
                : 'text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Previous
          </Link>
          <span className="text-sm text-zinc-500">
            Page {page} of {totalPages}
          </span>
          <Link
            href={pageHref(result.script.slug, Math.min(totalPages, page + 1))}
            aria-disabled={page >= totalPages}
            className={`inline-flex items-center gap-1 rounded-lg border border-zinc-800 px-3 py-2 text-sm transition ${
              page >= totalPages
                ? 'pointer-events-none text-zinc-700'
                : 'text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  )
}
