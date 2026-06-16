import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { getOverview } from '@/app/lib/services/analytics-service'
import type { CreatorAnalyticsOverviewType } from '@/app/lib/services/analytics-service'
import { AnalyticsCard } from '@/app/dashboard/components/AnalyticsCard'
import { ErrorBanner } from '@/app/dashboard/components/ErrorBanner'
import {
  BarChart3,
  FileCode,
  Activity,
  Eye,
  BookOpen,
  Code2,
  Zap,
} from 'lucide-react'
import Link from 'next/link'

export default async function DashboardHomePage() {
  const user = await getCurrentUser()

  let overview: CreatorAnalyticsOverviewType | null = null
  let error: string | null = null

  if (user) {
    const result = await getOverview(user.id)
    if (result.success) {
      overview = result.overview
    } else {
      error = result.message ?? 'Failed to load analytics'
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Welcome back, {user?.profile.display_name ?? 'Creator'}
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AnalyticsCard
          label="Total Scripts"
          value={overview?.total_scripts ?? '—'}
          icon={FileCode}
          sublabel={
            overview
              ? `${overview.published_scripts} published, ${overview.private_scripts} private`
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
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-zinc-600" aria-hidden="true" />
        <h2 className="mt-3 text-sm font-medium text-zinc-300">
          Full Analytics
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          View execution totals, per-script counts, and top scripts in the{' '}
          <Link href="/dashboard/analytics" className="text-red-400 hover:text-red-300 underline">
            Analytics section
          </Link>.
        </p>
      </div>

      {/* Developer Resources */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Developer Resources</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link
            href="/docs/reference/api"
            className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-zinc-600 hover:bg-zinc-900 transition-colors"
          >
            <Code2 className="h-5 w-5 text-zinc-500 group-hover:text-red-400 transition-colors" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold text-white group-hover:text-red-400 transition-colors">
              API Integration
            </h3>
            <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
              Validate API keys from any runtime — Luau, Python, Node.js, and more.
            </p>
          </Link>

          <Link
            href="/docs/event-platform"
            className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-zinc-600 hover:bg-zinc-900 transition-colors"
          >
            <Zap className="h-5 w-5 text-zinc-500 group-hover:text-red-400 transition-colors" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold text-white group-hover:text-red-400 transition-colors">
              Event Platform
            </h3>
            <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
              Send telemetry events securely — no exposed Discord webhooks.
            </p>
          </Link>

          <Link
            href="/docs/event-platform/quickstart"
            className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-zinc-600 hover:bg-zinc-900 transition-colors"
          >
            <BookOpen className="h-5 w-5 text-zinc-500 group-hover:text-red-400 transition-colors" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold text-white group-hover:text-red-400 transition-colors">
              Quickstart Guide
            </h3>
            <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
              5-minute guide to sending your first event.
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}
