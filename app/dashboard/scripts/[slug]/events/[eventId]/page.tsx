import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { getEventDetail } from '@/app/lib/services/event-dashboard-service'
import { EventStatusBadge } from '../events-client'
import { ReplayButton } from './replay-button'

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  } catch {
    return '—'
  }
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string; eventId: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { slug, eventId } = await params

  const result = await getEventDetail(slug, user.id, eventId)

  if (!result.success) {
    notFound()
  }

  const event = result.event

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href={`/dashboard/scripts/${slug}/events`}
            className="mb-1 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
            Back to events
          </Link>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-3">
            Event Detail
            <span className="font-mono text-sm text-zinc-500">{event.id}</span>
          </h1>
        </div>
        {event.deliveryStatus === 'dead_letter' && (
          <ReplayButton slug={slug} eventId={event.id} />
        )}
      </div>

      {/* Metadata card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Metadata</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-zinc-500 mb-1">Event Type</dt>
            <dd className="font-mono text-sm text-zinc-200">{event.eventType}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 mb-1">Status</dt>
            <dd>
              <EventStatusBadge status={event.deliveryStatus} retryCount={event.retryCount} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 mb-1">Retry Count</dt>
            <dd className="text-sm text-zinc-200">{event.retryCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 mb-1">Provider</dt>
            <dd className="text-sm text-zinc-200">{event.provider ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 mb-1">Event Timestamp</dt>
            <dd className="text-sm text-zinc-200">{formatTimestamp(event.timestamp)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 mb-1">Received At</dt>
            <dd className="text-sm text-zinc-200">{formatTimestamp(event.receivedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 mb-1">Delivered At</dt>
            <dd className="text-sm text-zinc-200">{event.deliveredAt ? formatTimestamp(event.deliveredAt) : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 mb-1">Last Retry At</dt>
            <dd className="text-sm text-zinc-200">{event.lastRetryAt ? formatTimestamp(event.lastRetryAt) : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 mb-1">Created At</dt>
            <dd className="text-sm text-zinc-200">{formatTimestamp(event.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 mb-1">Event ID</dt>
            <dd className="font-mono text-xs text-zinc-400 break-all">{event.id}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 mb-1">Script ID</dt>
            <dd className="font-mono text-xs text-zinc-500">{event.scriptId}</dd>
          </div>
        </div>
      </div>

      {/* Error card (only if error present) */}
      {event.errorMessage && (
        <div className="rounded-xl border border-red-800 bg-red-950/30 p-6 space-y-2">
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider">Error</h2>
          <p className="text-sm text-red-300 font-mono break-all">{event.errorMessage}</p>
        </div>
      )}

      {/* Payload card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Payload</h2>
        <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-xs text-zinc-300 font-mono whitespace-pre-wrap break-all">
          {JSON.stringify(event.payload, null, 2)}
        </pre>
      </div>
    </div>
  )
}
