import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { getOverview, getDownloadTrends, getTopScripts } from '@/app/lib/services/analytics-service'
import type { CreatorAnalyticsOverviewType, DownloadTrendsResultType, TopScript } from '@/app/lib/services/analytics-service'
import { AnalyticsCard } from '@/app/dashboard/components/AnalyticsCard'
import { DownloadsChart } from '@/app/dashboard/components/DownloadsChart'
import { TopScriptsTable } from '@/app/dashboard/components/TopScriptsTable'
import {
  BarChart3,
  FileCode,
  Download,
  Eye,
  Globe,
} from 'lucide-react'

export default async function AnalyticsPage() {
  const user = await getCurrentUser()

  let overview: CreatorAnalyticsOverviewType | null = null
  let trends7d: DownloadTrendsResultType | null = null
  let trends30d: DownloadTrendsResultType | null = null
  let topScripts: TopScript[] = []
  let error: string | null = null

  if (user) {
    const [overviewResult, trends7dResult, trends30dResult, topScriptsResult] =
      await Promise.all([
        getOverview(user.id),
        getDownloadTrends(user.id, '7d'),
        getDownloadTrends(user.id, '30d'),
        getTopScripts(user.id, 5),
      ])

    if (overviewResult.success) overview = overviewResult.overview
    if (trends7dResult.success) trends7d = trends7dResult.trends
    if (trends30dResult.success) trends30d = trends30dResult.trends
    topScripts = topScriptsResult

    if (!overviewResult.success && !trends7dResult.success) {
      error = overviewResult.message || trends7dResult.message || 'Failed to load analytics'
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="mt-1 text-sm text-zinc-400">Track your script performance</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          label="Total Downloads"
          value={overview?.total_downloads ?? '—'}
          icon={Download}
        />
        <AnalyticsCard
          label="Downloads (7 Days)"
          value={overview?.downloads_7d ?? '—'}
          icon={BarChart3}
        />
        <AnalyticsCard
          label="Downloads Today"
          value={overview?.downloads_today ?? '—'}
          icon={Eye}
        />
        <AnalyticsCard
          label="Published Scripts"
          value={overview?.published_scripts ?? '—'}
          icon={Globe}
        />
        <AnalyticsCard
          label="Downloads (30 Days)"
          value={overview?.downloads_30d ?? '—'}
          icon={BarChart3}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DownloadsChart
          points={trends7d?.points ?? []}
          title="Downloads — Last 7 Days"
        />
        <DownloadsChart
          points={trends30d?.points ?? []}
          title="Downloads — Last 30 Days"
        />
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">Top Scripts</h2>
        <TopScriptsTable scripts={topScripts} />
      </div>
    </div>
  )
}
