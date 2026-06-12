import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { getAnalyticsV2Overview, getTopScripts } from '@/app/lib/services/analytics-service'
import type { AnalyticsV2OverviewType, TopScript } from '@/app/lib/services/analytics-service'
import { AnalyticsCard } from '@/app/dashboard/components/AnalyticsCard'
import { TopScriptsTable } from '@/app/dashboard/components/TopScriptsTable'
import { ErrorBanner } from '@/app/dashboard/components/ErrorBanner'
import {
  BarChart3,
  FileCode,
  Activity,
  Eye,
  Globe,
  BadgeCheck,
  Ban,
  Boxes,
  KeyRound,
  ShieldCheck,
  Truck,
  Users,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'

type AnalyticsPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const WINDOW_OPTIONS = [7, 30, 90] as const

function parseWindowDays(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = Number(raw)
  return WINDOW_OPTIONS.includes(parsed as (typeof WINDOW_OPTIONS)[number]) ? parsed : 30
}

function formatMetric(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Unavailable'
  return value.toLocaleString()
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function WindowFilter({ activeWindow }: { activeWindow: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {WINDOW_OPTIONS.map((days) => (
        <Link
          key={days}
          href={`/dashboard/analytics?window=${days}`}
          className={days === activeWindow
            ? 'rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white'
            : 'rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-white'}
        >
          {days}d
        </Link>
      ))}
    </div>
  )
}

function DenialReasons({ reasons }: { reasons: Record<string, number> }) {
  const entries = Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 5)

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h3 className="text-sm font-semibold text-white">Denial Reasons</h3>
        <p className="mt-3 text-sm text-zinc-500">No authorization denials recorded in this window.</p>
      </div>
    )
  }

  const max = Math.max(...entries.map(([, count]) => count), 1)

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <h3 className="text-sm font-semibold text-white">Denial Reasons</h3>
      <div className="mt-4 space-y-3">
        {entries.map(([reason, count]) => (
          <div key={reason}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-zinc-300">{reason.replace(/_/g, ' ')}</span>
              <span className="font-mono text-zinc-500">{count.toLocaleString()}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-red-500"
                style={{ width: `${Math.max(6, Math.round((count / max) * 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const user = await getCurrentUser()
  const params = await searchParams
  const windowDays = parseWindowDays(params.window ?? params.window_days)

  let overview: AnalyticsV2OverviewType | null = null
  let topScripts: TopScript[] = []
  let error: string | null = null

  if (user) {
    const [overviewResult, topScriptsResult] =
      await Promise.all([
        getAnalyticsV2Overview(user.id, { windowDays }),
        getTopScripts(user.id, 5),
      ])

    if (overviewResult.success) overview = overviewResult.overview
    topScripts = topScriptsResult

    if (!overviewResult.success) {
      error = overviewResult.message || 'Failed to load analytics'
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics V2</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Runtime, delivery, license, and authorization metrics for the selected window.
          </p>
        </div>
        <WindowFilter activeWindow={windowDays} />
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <AnalyticsCard
          label="Total Scripts"
          value={overview?.total_scripts ?? '—'}
          icon={FileCode}
          sublabel={
            overview
              ? `${overview.published_scripts} public, ${overview.private_scripts} private`
              : undefined
          }
        />
        <AnalyticsCard
          label="Total Executions"
          value={overview?.total_executions ?? '—'}
          icon={Activity}
        />
        <AnalyticsCard
          label="Published Scripts"
          value={overview?.published_scripts ?? '—'}
          icon={BarChart3}
        />
        <AnalyticsCard
          label="Private Scripts"
          value={overview?.private_scripts ?? '—'}
          icon={Eye}
        />
        <AnalyticsCard
          label="Unlisted Scripts"
          value={overview?.unlisted_scripts ?? '—'}
          icon={Globe}
        />
        <AnalyticsCard
          label="Executions per Script"
          value={overview && overview.total_scripts > 0
            ? Math.round(overview.total_executions / overview.total_scripts)
            : '—'}
          icon={BarChart3}
        />
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Authorization</h2>
          <p className="text-sm text-zinc-500">License authorization outcomes from runtime audit events.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <AnalyticsCard label="Allowed" value={formatMetric(overview?.authorization.success)} icon={ShieldCheck} />
          <AnalyticsCard label="Denied" value={formatMetric(overview?.authorization.failure)} icon={XCircle} />
          <AnalyticsCard
            label="Allow Rate"
            value={overview && (overview.authorization.success + overview.authorization.failure) > 0
              ? formatPercent(overview.authorization.success / (overview.authorization.success + overview.authorization.failure))
              : '—'}
            icon={BadgeCheck}
          />
        </div>
        <DenialReasons reasons={overview?.authorization.denial_reasons ?? {}} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Licenses</h2>
          <p className="text-sm text-zinc-500">Current license state and assignment capacity utilization.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AnalyticsCard label="Active Licenses" value={formatMetric(overview?.licenses.active)} icon={KeyRound} />
          <AnalyticsCard label="Disabled Licenses" value={formatMetric(overview?.licenses.disabled)} icon={Ban} />
          <AnalyticsCard label="Revoked Licenses" value={formatMetric(overview?.licenses.revoked)} icon={XCircle} />
          <AnalyticsCard
            label="Assignment Utilization"
            value={overview ? formatPercent(overview.licenses.assignment_utilization) : '—'}
            icon={Users}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Runtime</h2>
          <p className="text-sm text-zinc-500">Runtime events from the event platform plus execution volume.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnalyticsCard label="Runtime Starts" value={formatMetric(overview?.runtime.starts)} icon={Activity} />
          <AnalyticsCard label="Runtime Failures" value={formatMetric(overview?.runtime.failures)} icon={XCircle} />
          <AnalyticsCard label="Execution Volume" value={formatMetric(overview?.runtime.execution_volume)} icon={Boxes} />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Delivery</h2>
          <p className="text-sm text-zinc-500">Measured delivery session events. Payload fetch metrics remain unavailable until fetch instrumentation ships.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnalyticsCard label="Sessions Created" value={formatMetric(overview?.delivery.session_creation)} icon={Truck} />
          <AnalyticsCard label="Payload Fetches" value={formatMetric(overview?.delivery.payload_fetch)} icon={BarChart3} />
          <AnalyticsCard label="Fetch Failures" value={formatMetric(overview?.delivery.fetch_failures)} icon={XCircle} />
        </div>
      </section>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">Top Scripts by Executions</h2>
        <TopScriptsTable scripts={topScripts} />
      </div>
    </div>
  )
}
