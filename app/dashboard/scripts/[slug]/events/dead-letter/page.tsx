import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { getDeadLetters } from '@/app/lib/services/event-dashboard-service'
import { DeadLetterTable } from '../events-client'

function pageHref(slug: string, page: number): string {
  return `/dashboard/scripts/${encodeURIComponent(slug)}/events/dead-letter${page > 1 ? '?page=' + page : ''}`
}

export default async function DeadLetterPage({
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
  const pageSize = 20

  const result = await getDeadLetters(slug, user.id, { page, pageSize })

  if (!result.success) {
    notFound()
  }

  const totalPages = Math.max(1, Math.ceil(result.total / pageSize))

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href={`/dashboard/scripts/${slug}/events`}
            className="mb-1 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
            Back to events
          </Link>
          <h1 className="text-xl font-semibold text-zinc-100">Dead Letter</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Events that exhausted all retry attempts or encountered permanent delivery failures.
          </p>
        </div>
      </div>

      <DeadLetterTable
        slug={slug}
        events={result.events}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        totalPages={totalPages}
        pageHref={(p) => pageHref(slug, p)}
      />
    </div>
  )
}
