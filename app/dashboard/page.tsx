import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { getOverview } from '@/app/lib/services/analytics-service'
import type { CreatorAnalyticsOverviewType } from '@/app/lib/services/analytics-service'
import { AnalyticsCard } from '@/app/dashboard/components/AnalyticsCard'
import { ErrorBanner } from '@/app/dashboard/components/ErrorBanner'
import {
  BarChart3,
  FileCode,
  Download,
  Eye,
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
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-zinc-600" aria-hidden="true" />
        <h2 className="mt-3 text-sm font-medium text-zinc-300">
          Full Analytics
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          View detailed charts, trends, and top scripts in the{' '}
          <Link href="/dashboard/analytics" className="text-red-400 hover:text-red-300 underline">
            Analytics section
          </Link>.
        </p>
      </div>
    </div>
  )
}
