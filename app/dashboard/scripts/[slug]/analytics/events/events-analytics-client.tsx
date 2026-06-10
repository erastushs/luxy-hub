'use client'

import {
  Hash,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Radio,
  Layers,
  Shield,
} from 'lucide-react'
import { formatDateTime } from '@/app/dashboard/lib/format-date'
import type {
  EventAnalyticsDTO,
  TrendBreakdown,
  ProviderHealthDTO,
  SecurityMetricsDTO,
} from '@/app/lib/services/event-analytics-service'
import type { ScriptQueueSnapshot } from '@/app/lib/repositories/event-repository'

// ---------------------------------------------------------------------------
// 1. AnalyticsOverviewCards
// ---------------------------------------------------------------------------

function AnalyticsOverviewCards({ analytics }: { analytics: EventAnalyticsDTO }) {
  const cards = [
    {
      label: 'Total Events',
      value: analytics.totalEvents.toLocaleString(),
      icon: Hash,
      iconClass: 'text-zinc-400',
    },
    {
      label: 'Delivered',
      value: analytics.deliveredEvents.toLocaleString(),
      icon: CheckCircle2,
      iconClass: 'text-emerald-400',
    },
    {
      label: 'Pending',
      value: analytics.pendingEvents.toLocaleString(),
      icon: Clock,
      iconClass: 'text-amber-400',
    },
    {
      label: 'Dead Letter',
      value: analytics.deadLetterEvents.toLocaleString(),
      icon: AlertTriangle,
      iconClass: 'text-red-400',
    },
    {
      label: 'Success Rate',
      value: `${analytics.successRatePercent}%`,
      icon: TrendingUp,
      iconClass: 'text-zinc-400',
    },
  ] as const

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              {card.label}
            </span>
            <card.icon className={`h-4 w-4 ${card.iconClass}`} />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-white">{card.value}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 2. EventTrendChart
// ---------------------------------------------------------------------------

function EventTrendChart({
  trends,
  title,
}: {
  trends: TrendBreakdown
  title: string
}) {
  const entries = Object.entries(trends.byType)

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h3 className="text-sm font-medium text-zinc-300">{title}</h3>
        <div className="mt-4 flex h-[200px] items-center justify-center text-xs text-zinc-500">
          No events in this period
        </div>
      </div>
    )
  }

  const chartHeight = 200
  const barGroupWidth = 40
  const gap = 12
  const totalWidth = Math.max(
    entries.length * (barGroupWidth + gap) + 40,
    300,
  )
  const viewBoxHeight = chartHeight + 50

  // Find max stack height across all types for scaling
  let maxStack = 0
  for (const [, entry] of entries) {
    const total = entry.delivered + entry.pending + entry.deadLetter
    if (total > maxStack) maxStack = total
  }
  if (maxStack === 0) maxStack = 1

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h3 className="text-sm font-medium text-zinc-300">{title}</h3>
      <div className="mt-4">
        <svg
          viewBox={`0 0 ${totalWidth} ${viewBoxHeight}`}
          className="h-[220px] w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {entries.map(([type, entry], i) => {
            const deliveredH = (entry.delivered / maxStack) * chartHeight
            const pendingH = (entry.pending / maxStack) * chartHeight
            const deadLetterH = (entry.deadLetter / maxStack) * chartHeight

            const x = 20 + i * (barGroupWidth + gap)
            const barW = barGroupWidth

            // Stack from bottom: deadLetter → pending → delivered
            const deadLetterY = chartHeight - deadLetterH
            const pendingY = deadLetterY - pendingH
            const deliveredY = pendingY - deliveredH

            return (
              <g key={type}>
                {/* Dead letter (bottom) */}
                {deadLetterH > 0 && (
                  <rect
                    x={x}
                    y={deadLetterY}
                    width={barW}
                    height={deadLetterH}
                    rx={2}
                    className="fill-red-600/70"
                  />
                )}
                {/* Pending (middle) */}
                {pendingH > 0 && (
                  <rect
                    x={x}
                    y={pendingY}
                    width={barW}
                    height={pendingH}
                    rx={deadLetterH === 0 ? 2 : 0}
                    className="fill-amber-500/70"
                  />
                )}
                {/* Delivered (top) */}
                {deliveredH > 0 && (
                  <rect
                    x={x}
                    y={deliveredY}
                    width={barW}
                    height={deliveredH}
                    rx={
                      deadLetterH === 0 && pendingH === 0 ? 2 : 0
                    }
                    className="fill-emerald-500/70"
                  />
                )}
                {/* Label */}
                <text
                  x={x + barW / 2}
                  y={chartHeight + 20}
                  textAnchor="middle"
                  className="fill-zinc-500"
                  fontSize="10"
                >
                  {type}
                </text>
              </g>
            )
          })}

          {/* Legend */}
          <g transform={`translate(20, ${chartHeight + 38})`}>
            <rect width={8} height={8} rx={1} className="fill-emerald-500/70" />
            <text x={12} y={8} className="fill-zinc-500" fontSize="9">
              Delivered
            </text>
            <rect
              x={72}
              width={8}
              height={8}
              rx={1}
              className="fill-amber-500/70"
            />
            <text x={84} y={8} className="fill-zinc-500" fontSize="9">
              Pending
            </text>
            <rect
              x={130}
              width={8}
              height={8}
              rx={1}
              className="fill-red-600/70"
            />
            <text x={142} y={8} className="fill-zinc-500" fontSize="9">
              Dead Letter
            </text>
          </g>
        </svg>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 3. ProviderHealthCard
// ---------------------------------------------------------------------------

function ProviderHealthCard({ health }: { health: ProviderHealthDTO | null }) {
  if (!health) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Webhooks
          </span>
          <Radio className="h-4 w-4 text-zinc-600" />
        </div>
        <div className="mt-3">
          <p className="text-sm text-zinc-500">No webhook configured</p>
        </div>
      </div>
    )
  }

  const providerLabel =
    health.provider.charAt(0).toUpperCase() + health.provider.slice(1)

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          Webhooks
        </span>
        <Radio className="h-4 w-4 text-zinc-400" />
      </div>
      <div className="mt-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-white">
            {providerLabel}
          </span>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              health.enabled
                ? 'bg-emerald-400/10 text-emerald-400'
                : 'bg-zinc-700 text-zinc-400'
            }`}
          >
            {health.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-xs text-zinc-500">Deliveries</span>
            <p className="font-semibold text-white">
              {health.totalDeliveries.toLocaleString()}
            </p>
          </div>
          <div>
            <span className="text-xs text-zinc-500">Failures</span>
            <p className="font-semibold text-red-400">
              {health.totalFailures.toLocaleString()}
            </p>
          </div>
          <div>
            <span className="text-xs text-zinc-500">Failure Rate</span>
            <p className="font-semibold text-white">
              {health.failureRatePercent}%
            </p>
          </div>
          <div>
            <span className="text-xs text-zinc-500">Last Delivery</span>
            <p className="text-xs text-zinc-400">
              {health.lastDeliveryAt
                ? formatDateTime(health.lastDeliveryAt)
                : '--'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 4. QueueHealthCard
// ---------------------------------------------------------------------------

function formatAge(seconds: number | null): string {
  if (seconds === null) return '--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}m ${s}s`
}

function QueueHealthCard({ queue }: { queue: ScriptQueueSnapshot }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          Queue
        </span>
        <Layers className="h-4 w-4 text-zinc-400" />
      </div>
      <div className="mt-3 space-y-3">
        <div>
          <span className="text-xs text-zinc-500">Current Pending</span>
          <p className="text-lg font-semibold text-amber-400">
            {queue.pendingCount.toLocaleString()}
          </p>
        </div>
        <div>
          <span className="text-xs text-zinc-500">Dead Letter</span>
          <p className="text-lg font-semibold text-red-400">
            {queue.deadLetterCount.toLocaleString()}
          </p>
        </div>
        <div>
          <span className="text-xs text-zinc-500">Oldest Pending Age</span>
          <p className="text-sm text-zinc-300">
            {formatAge(queue.oldestPendingAgeSeconds)}
          </p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 5. SecurityMetricsCard
// ---------------------------------------------------------------------------

function SecurityMetricsCard({
  metrics,
}: {
  metrics: SecurityMetricsDTO
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          Platform Security Signals
        </span>
        <Shield className="h-4 w-4 text-zinc-400" />
      </div>
      <p className="mt-1 text-xs text-zinc-600 leading-relaxed">
        Platform-wide monitoring data, not specific to this script.
      </p>
      <div className="mt-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">Invalid Signatures</span>
          <span className="text-sm font-medium text-zinc-300">
            {metrics.invalidSignatures.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">Replay Attempts</span>
          <span className="text-sm font-medium text-zinc-300">
            {metrics.replayAttempts.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">Rate Limit Hits</span>
          <span className="text-sm font-medium text-zinc-300">
            {metrics.rateLimitHits.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Wrapper
// ---------------------------------------------------------------------------

export function EventAnalyticsClient({
  analytics,
}: {
  analytics: EventAnalyticsDTO
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <AnalyticsOverviewCards analytics={analytics} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-3">
          <EventTrendChart trends={analytics.trends24h} title="Last 24 Hours" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-3">
          <EventTrendChart trends={analytics.trends7d} title="Last 7 Days" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-3">
          <EventTrendChart trends={analytics.trends30d} title="Last 30 Days" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ProviderHealthCard health={analytics.providerHealth} />
        <QueueHealthCard queue={analytics.queueHealth} />
        <SecurityMetricsCard metrics={analytics.securityMetrics} />
      </div>
    </div>
  )
}
