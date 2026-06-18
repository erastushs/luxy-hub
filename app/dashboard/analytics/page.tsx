import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { getOverview, getTopScripts } from '@/app/lib/services/analytics-service'
import type { CreatorAnalyticsOverviewType, TopScript } from '@/app/lib/services/analytics-service'
import { AnalyticsCard } from '@/app/dashboard/components/AnalyticsCard'
import { TopScriptsTable } from '@/app/dashboard/components/TopScriptsTable'
import { ErrorBanner } from '@/app/dashboard/components/ErrorBanner'
import {
  BarChart3,
  FileCode,
  Activity,
  Eye,
  Globe,
} from 'lucide-react'

export default async function AnalyticsPage() {
  const user = await getCurrentUser()

  let overview: CreatorAnalyticsOverviewType | null = null
  let topScripts: TopScript[] = []
  let error: string | null = null

  if (user) {
    const [overviewResult, topScriptsResult] =
      await Promise.all([
        getOverview(user.id),
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
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="mt-1 text-sm text-zinc-400">View execution statistics.</p>
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

      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">Top Scripts by Executions</h2>
        <TopScriptsTable scripts={topScripts} />
      </div>
    </div>
  )
}
