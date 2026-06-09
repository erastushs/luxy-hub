'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import { cn } from '@/app/lib/utils'
import { replayEventAction, replayAllDeadLettersAction } from '@/app/actions/events'
import type { EventDashboardDTO } from '@/app/lib/services/event-dashboard-service'

// ---------------------------------------------------------------------------
// EventStatusBadge
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  delivered: 'Delivered',
  dead_letter: 'Dead Letter',
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
  delivered: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
  dead_letter: 'bg-red-500/10 text-red-400 ring-red-500/20',
}

export function EventStatusBadge({ status, retryCount }: { status: string; retryCount: number }) {
  const failed = status === 'pending' && retryCount > 0
  const label = failed ? 'Failed' : (STATUS_LABELS[status] ?? status)
  const style = failed ? STATUS_STYLES.dead_letter : (STATUS_STYLES[status] ?? STATUS_STYLES.pending)
  const IconComponent = failed ? AlertTriangle : status === 'delivered' ? CheckCircle2 : Clock

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        style,
      )}
    >
      <IconComponent className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// EventsTable
// ---------------------------------------------------------------------------

const EVENT_TYPES = [
  'execute',
  'purchase',
  'error',
  'ban',
  'key_redeem',
  'heartbeat',
  'license_activate',
  'license_revoke',
] as const

export function EventsTable({
  slug,
  events,
  total,
  page,
  pageSize,
  statusFilter,
  typeFilter,
  totalPages,
  pageHref,
  filterHref,
}: {
  slug: string
  events: EventDashboardDTO[]
  total: number
  page: number
  pageSize: number
  statusFilter: string
  typeFilter: string
  totalPages: number
  pageHref: (page: number) => string
  filterHref: (status: string, type: string) => string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleFilterChange = (newStatus: string, newType: string) => {
    startTransition(() => {
      router.push(filterHref(newStatus, newType))
    })
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          Status:
          <select
            value={statusFilter}
            onChange={(e) => handleFilterChange(e.target.value, typeFilter)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="delivered">Delivered</option>
            <option value="dead_letter">Dead Letter</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-zinc-400">
          Type:
          <select
            value={typeFilter}
            onChange={(e) => handleFilterChange(statusFilter, e.target.value)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            <option value="all">All</option>
            {EVENT_TYPES.map((et) => (
              <option key={et} value={et}>
                {et}
              </option>
            ))}
          </select>
        </label>

        {isPending && (
          <Loader2 className="h-4 w-4 animate-spin text-zinc-500" aria-label="Loading" />
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase text-zinc-500 bg-zinc-900/50">
            <tr>
              <th className="px-4 py-3 font-medium">Event Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Delivered</th>
              <th className="px-4 py-3 font-medium">Retries</th>
              <th className="px-4 py-3 font-medium">Provider</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                  No events found
                </td>
              </tr>
            ) : (
              events.map((event) => (
                <tr
                  key={event.id}
                  className="hover:bg-zinc-900/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/dashboard/scripts/${slug}/events/${event.id}`)}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-zinc-300">{event.eventType}</span>
                  </td>
                  <td className="px-4 py-3">
                    <EventStatusBadge status={event.deliveryStatus} retryCount={event.retryCount} />
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">
                    {formatTimestamp(event.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">
                    {event.deliveredAt ? formatTimestamp(event.deliveredAt) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-zinc-400">{event.retryCount}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-zinc-500">{event.provider ?? '—'}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-zinc-400">
        <span>
          {total === 0 ? 'No events' : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
        </span>

        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Link
              href={pageHref(page - 1)}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg border border-zinc-800 px-3 py-1.5 text-sm transition-colors',
                page <= 1
                  ? 'pointer-events-none text-zinc-700'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
              )}
              aria-disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Link>
            <span className="px-2 text-zinc-500">
              {page} / {totalPages}
            </span>
            <Link
              href={pageHref(page + 1)}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg border border-zinc-800 px-3 py-1.5 text-sm transition-colors',
                page >= totalPages
                  ? 'pointer-events-none text-zinc-700'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
              )}
              aria-disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DeadLetterTable
// ---------------------------------------------------------------------------

export function DeadLetterTable({
  slug,
  events,
  total,
  page,
  pageSize,
  totalPages,
  pageHref,
}: {
  slug: string
  events: EventDashboardDTO[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  pageHref: (page: number) => string
}) {
  const [replayingIds, setReplayingIds] = useState<Set<string>>(new Set())
  const [replayResults, setReplayResults] = useState<Record<string, string>>({})

  const handleReplayOne = async (eventId: string) => {
    setReplayingIds((prev) => new Set(prev).add(eventId))
    setReplayResults((prev) => {
      const next = { ...prev }
      delete next[eventId]
      return next
    })
    const result = await replayEventAction(slug, eventId)
    setReplayResults((prev) => ({ ...prev, [eventId]: result.message }))
    setReplayingIds((prev) => {
      const next = new Set(prev)
      next.delete(eventId)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* Replay All */}
      <ReplayAllButton slug={slug} hasEvents={events.length > 0} />

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase text-zinc-500 bg-zinc-900/50">
            <tr>
              <th className="px-4 py-3 font-medium">Event Type</th>
              <th className="px-4 py-3 font-medium">Error</th>
              <th className="px-4 py-3 font-medium">Retries</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <div className="text-zinc-500">
                    <CheckCircle2 className="mx-auto h-8 w-8 mb-2 text-emerald-500" />
                    No dead-letter events — everything is healthy
                  </div>
                </td>
              </tr>
            ) : (
              events.map((event) => (
                <tr key={event.id} className="hover:bg-zinc-900/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/scripts/${slug}/events/${event.id}`}
                      className="font-mono text-xs text-zinc-300 hover:text-red-400 transition-colors"
                    >
                      {event.eventType}
                    </Link>
                  </td>
                  <td className="px-4 py-3 max-w-[300px]">
                    <span className="text-xs text-red-400 truncate block" title={event.errorMessage ?? undefined}>
                      {event.errorMessage ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-zinc-400">{event.retryCount}</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">
                    {formatTimestamp(event.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleReplayOne(event.id)}
                        disabled={replayingIds.has(event.id)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-lg border border-zinc-800 px-2 py-1 text-xs font-medium transition-colors',
                          replayingIds.has(event.id)
                            ? 'cursor-not-allowed text-zinc-600'
                            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
                        )}
                      >
                        {replayingIds.has(event.id) ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        Replay
                      </button>
                      {replayResults[event.id] && (
                        <span className="text-xs text-emerald-400">{replayResults[event.id]}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-zinc-400">
        <span>
          {total === 0 ? 'No events' : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
        </span>

        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Link
              href={pageHref(page - 1)}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg border border-zinc-800 px-3 py-1.5 text-sm transition-colors',
                page <= 1
                  ? 'pointer-events-none text-zinc-700'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
              )}
              aria-disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Link>
            <span className="px-2 text-zinc-500">
              {page} / {totalPages}
            </span>
            <Link
              href={pageHref(page + 1)}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg border border-zinc-800 px-3 py-1.5 text-sm transition-colors',
                page >= totalPages
                  ? 'pointer-events-none text-zinc-700'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
              )}
              aria-disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ReplayAllButton
// ---------------------------------------------------------------------------

function ReplayAllButton({ slug, hasEvents }: { slug: string; hasEvents: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const handleClick = () => {
    setMessage(null)
    startTransition(async () => {
      const result = await replayAllDeadLettersAction(slug)
      setMessage(result.message)
    })
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={!hasEvents || isPending}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border border-red-800 px-3 py-2 text-sm font-medium transition-colors',
          !hasEvents || isPending
            ? 'cursor-not-allowed text-zinc-600 border-zinc-800'
            : 'text-red-400 hover:bg-red-950',
        )}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Replay All Dead Letters
      </button>
      {message && (
        <span className="text-sm text-emerald-400">{message}</span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  } catch {
    return '—'
  }
}
