'use client'

import {
  AlertTriangle,
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  Ban,
  Shield,
  ShieldAlert,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import type {
  SecurityDashboardDTO,
  SecurityTrendBreakdown,
  SecurityEventItemDTO,
  RiskLevel,
} from '@/app/lib/services/security-monitoring-service'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const riskColors: Record<RiskLevel, string> = {
  LOW: 'emerald',
  MEDIUM: 'amber',
  HIGH: 'red',
}

function formatRelativeTime(lastSeen: string | null): string {
  if (!lastSeen) return '--'
  const diffMs = Date.now() - new Date(lastSeen).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMs / 3600000)
  const diffD = Math.floor(diffMs / 86400000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffH < 24) return `${diffH}h ago`
  return `${diffD}d ago`
}

function RiskBadge({ level }: { level: RiskLevel }) {
  const color = riskColors[level]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-${color}-800 bg-${color}-950/50 px-2.5 py-0.5 text-xs font-medium text-${color}-400`}
    >
      <span className={`h-1.5 w-1.5 rounded-full bg-${color}-500`} />
      {level}
    </span>
  )
}

function SeverityDot({ severity }: { severity: RiskLevel }) {
  const color = riskColors[severity]
  return <span className={`inline-block h-2 w-2 rounded-full bg-${color}-500`} />
}

// ---------------------------------------------------------------------------
// 1. SecurityOverviewCards
// ---------------------------------------------------------------------------

function SecurityOverviewCards({ overview }: { overview: SecurityDashboardDTO['overview'] }) {
  const scoreColor =
    overview.securityScore >= 80
      ? 'text-emerald-400'
      : overview.securityScore >= 50
        ? 'text-amber-400'
        : 'text-red-400'

  return (
    <div>
      <p className="mb-2 text-xs text-zinc-600 leading-relaxed">
        These are platform-wide security signals aggregated across all scripts.
        Values are not scoped to individual scripts.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {/* Invalid Signatures */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Invalid Sigs
            </span>
            <Ban className="h-4 w-4 text-red-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-amber-400">
              {overview.invalidSignatures.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Replay Attempts */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Replay Attempts
            </span>
            <ShieldAlert className="h-4 w-4 text-red-500" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-red-400">
              {overview.replayAttempts.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Rate Limit Hits */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Rate Limits
            </span>
            <Zap className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-amber-300">
              {overview.rateLimitHits.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Auth Failures */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Auth Failures
            </span>
            <AlertTriangle className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-zinc-300">
              {overview.authFailures.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Security Score */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Score
            </span>
            <Shield className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="mt-3">
            <span className={`text-2xl font-bold ${scoreColor}`}>
              {overview.securityScore}
            </span>
            <span className="ml-1 text-xs text-zinc-500">/100</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 2. SecurityTrendChart
// ---------------------------------------------------------------------------

const TREND_METRICS = [
  { key: 'invalidSignatures' as const, label: 'Invalid Sig', color: 'fill-amber-500/70' },
  { key: 'replayAttempts' as const, label: 'Replay', color: 'fill-red-500/70' },
  { key: 'rateLimitHits' as const, label: 'Rate Lim', color: 'fill-yellow-500/70' },
  { key: 'authFailures' as const, label: 'Auth Fail', color: 'fill-zinc-500/70' },
]

function SecurityTrendChart({
  trends,
  title,
}: {
  trends: SecurityTrendBreakdown
  title: string
}) {
  const values = TREND_METRICS.map((m) => trends[m.key])
  const maxVal = Math.max(...values, 1)
  const chartHeight = 160
  const barWidth = 48
  const gap = 16
  const totalWidth = 20 + (barWidth + gap) * values.length - gap + 80
  const viewBoxHeight = chartHeight + 50

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h3 className="mb-4 text-sm font-medium text-zinc-400">{title}</h3>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${totalWidth} ${viewBoxHeight}`}
          className="h-[220px] w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Horizontal grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const y = chartHeight - fraction * chartHeight
            return (
              <g key={fraction}>
                <line
                  x1={20}
                  y1={y}
                  x2={totalWidth - 20}
                  y2={y}
                  className="stroke-zinc-800"
                  strokeWidth={0.5}
                />
                <text
                  x={14}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-zinc-600"
                  fontSize={8}
                >
                  {Math.round(fraction * maxVal)}
                </text>
              </g>
            )
          })}

          {/* Bars */}
          {TREND_METRICS.map((metric, i) => {
            const val = trends[metric.key]
            const barH = maxVal > 0 ? (val / maxVal) * chartHeight : 0
            const x = 20 + i * (barWidth + gap)
            const y = chartHeight - barH

            return (
              <g key={metric.key}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barH > 0 ? barH : 0.5}
                  rx={2}
                  className={metric.color}
                />
                {/* Value label */}
                <text
                  x={x + barWidth / 2}
                  y={y - 6}
                  textAnchor="middle"
                  className="fill-zinc-400"
                  fontSize={10}
                >
                  {val > 0 ? val : ''}
                </text>
                {/* Metric label */}
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + 20}
                  textAnchor="middle"
                  className="fill-zinc-500"
                  fontSize={9}
                >
                  {metric.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 3. SecurityRiskCard
// ---------------------------------------------------------------------------

function SecurityRiskCard({
  risk,
}: {
  risk: SecurityDashboardDTO['risk']
}) {
  const color = riskColors[risk.level]

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          Risk Assessment
        </span>
        <RiskBadge level={risk.level} />
      </div>
      <div className="mt-3">
        <div className="flex items-end gap-2">
          <span className={`text-3xl font-bold text-${color}-400`}>
            {risk.score}
          </span>
          <span className="text-xs text-zinc-500 mb-1">/100</span>
        </div>
        <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
          {risk.explanation}
        </p>
        {risk.triggers.length > 0 && (
          <ul className="mt-3 space-y-1">
            {risk.triggers.map((t, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs text-zinc-500"
              >
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                {t}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 4. SecurityAnomalyCard
// ---------------------------------------------------------------------------

function SecurityAnomalyCard({
  anomalies,
}: {
  anomalies: SecurityDashboardDTO['anomalies']
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          Anomaly Detection
        </span>
        <TrendingUp className="h-4 w-4 text-zinc-400" />
      </div>
      {anomalies.length === 0 ? (
        <div className="mt-4 text-center">
          <Shield className="mx-auto h-8 w-8 text-zinc-700" />
          <p className="mt-2 text-sm text-zinc-500">
            No anomalies detected in the last 24 hours.
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {anomalies.map((a, i) => {
            const color = riskColors[a.severity]
            return (
              <div
                key={i}
                className={`rounded-lg border border-${color}-800/50 bg-${color}-950/20 p-3`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full bg-${color}-500`}
                  />
                  <span className={`text-sm font-medium text-${color}-400`}>
                    {a.description}
                  </span>
                </div>
                <div className="mt-1 ml-4 text-xs text-zinc-500">
                  Current: {a.current24h} • Baseline: {a.baseline24h}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 5. SecurityEventsTable
// ---------------------------------------------------------------------------

function SecurityEventsTable({
  events,
  slug,
  totalEvents,
  page,
  totalPages,
}: {
  events: SecurityEventItemDTO[]
  slug: string
  totalEvents: number
  page: number
  totalPages: number
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (p <= 1) params.delete('page')
    else params.set('page', String(p))
    router.push(`/dashboard/scripts/${slug}/security?${params.toString()}`)
  }

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Security Events
          </span>
          <ArrowDownUp className="h-4 w-4 text-zinc-400" />
        </div>
        <div className="mt-6 text-center">
          <Shield className="mx-auto h-8 w-8 text-zinc-700" />
          <p className="mt-2 text-sm text-zinc-500">No security events recorded.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          Security Events
        </span>
        <span className="text-xs text-zinc-600">{totalEvents} total</span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left">
              <th className="pb-2 text-xs font-medium text-zinc-500">Severity</th>
              <th className="pb-2 text-xs font-medium text-zinc-500">Event Type</th>
              <th className="pb-2 text-xs font-medium text-zinc-500 text-right">
                Count
              </th>
              <th className="pb-2 text-xs font-medium text-zinc-500 text-right">
                Last Seen
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {events.map((e) => {
              const relative = formatRelativeTime(e.lastSeen)
              return (
                <tr key={e.eventType} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="py-3">
                    <SeverityDot severity={e.severity} />
                  </td>
                  <td className="py-3">
                    <span className="text-zinc-300">{e.label}</span>
                  </td>
                  <td className="py-3 text-right">
                    <span className="font-mono text-zinc-400">
                      {e.count.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-xs text-zinc-500">{relative}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-4">
          <span className="text-xs text-zinc-600">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Previous
            </button>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Wrapper
// ---------------------------------------------------------------------------

export function SecurityClient({
  slug,
  dashboard,
}: {
  slug: string
  dashboard: SecurityDashboardDTO
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Overview Cards */}
      <SecurityOverviewCards overview={dashboard.overview} />

      {/* Trend Charts */}
      <SecurityTrendChart trends={dashboard.trends24h} title="Last 24 Hours" />
      <SecurityTrendChart trends={dashboard.trends7d} title="Last 7 Days" />
      <SecurityTrendChart trends={dashboard.trends30d} title="Last 30 Days" />

      {/* Risk + Anomalies */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SecurityRiskCard risk={dashboard.risk} />
        <SecurityAnomalyCard anomalies={dashboard.anomalies} />
      </div>

      {/* Events Table */}
      <SecurityEventsTable
        events={dashboard.events}
        slug={slug}
        totalEvents={dashboard.totalEvents}
        page={dashboard.page}
        totalPages={dashboard.totalPages}
      />
    </div>
  )
}
