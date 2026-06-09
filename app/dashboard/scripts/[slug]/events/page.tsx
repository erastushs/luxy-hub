import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { getEventHistory } from '@/app/lib/services/event-dashboard-service'
import { EventsTable } from './events-client'
import type { EventType, EventDeliveryStatus } from '@/app/lib/repositories/event-repository'

function pageHref(slug: string, page: number, status?: string, type?: string): string {
  const params = new URLSearchParams()
  if (page > 1) params.set('page', String(page))
  if (status && status !== 'all') params.set('status', status)
  if (type && type !== 'all') params.set('type', type)
  const qs = params.toString()
  return `/dashboard/scripts/${encodeURIComponent(slug)}/events${qs ? '?' + qs : ''}`
}

export default async function ScriptEventsPage({
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

  const statusFilter = (typeof sp.status === 'string' ? sp.status : 'all') as 'all' | EventDeliveryStatus
  const typeFilter = (typeof sp.type === 'string' ? sp.type : 'all') as 'all' | EventType
  const requestedPage = typeof sp.page === 'string' ? parseInt(sp.page, 10) : 1
  const page = Math.max(1, isNaN(requestedPage) ? 1 : requestedPage)
  const pageSize = 20

  const result = await getEventHistory(slug, user.id, {
    deliveryStatus: statusFilter !== 'all' ? statusFilter : undefined,
    eventType: typeFilter !== 'all' ? typeFilter : undefined,
    page,
    pageSize,
  })

  if (!result.success) {
    notFound()
  }

  const totalPages = Math.max(1, Math.ceil(result.total / pageSize))

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href={`/dashboard/scripts/${slug}`}
            className="mb-1 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
            Back to script
          </Link>
          <h1 className="text-xl font-semibold text-zinc-100">Event History</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/scripts/${slug}/events/dead-letter`}
            className="inline-flex items-center gap-1 rounded-lg border border-red-800 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-950 transition-colors"
          >
            Dead Letter
          </Link>
        </div>
      </div>

      <EventsTable
        slug={slug}
        events={result.events}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        totalPages={totalPages}
        pageHref={(p) => pageHref(slug, p, statusFilter, typeFilter)}
        filterHref={(status, type) => pageHref(slug, 1, status, type)}
      />
    </div>
  )
}
