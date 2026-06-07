import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { getOverview } from '@/app/lib/services/analytics-service'
import type { CreatorAnalyticsOverviewType } from '@/app/lib/services/analytics-service'
import {
  BarChart3,
  FileCode,
  Download,
  Eye,
  type LucideIcon,
} from 'lucide-react'

type StatCardProps = {
  label: string
  value: number | string
  icon: LucideIcon
  sublabel?: string
}

function StatCard({ label, value, icon: Icon, sublabel }: StatCardProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          {label}
        </span>
        <Icon className="h-4 w-4 text-zinc-600" />
      </div>
      <div className="mt-3">
        <span className="text-2xl font-bold text-white">{value}</span>
        {sublabel && (
          <span className="ml-2 text-xs text-zinc-500">{sublabel}</span>
        )}
      </div>
    </div>
  )
}

export default async function DashboardHomePage() {
  const user = await getCurrentUser()

  let overview: CreatorAnalyticsOverviewType | null = null

  if (user) {
    const result = await getOverview(user.id)
    if (result.success) {
      overview = result.overview
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Scripts"
          value={overview?.total_scripts ?? '—'}
          icon={FileCode}
          sublabel={
            overview
              ? `${overview.published_scripts} published, ${overview.private_scripts} private`
              : undefined
          }
        />
        <StatCard
          label="Total Downloads"
          value={overview?.total_downloads ?? '—'}
          icon={Download}
        />
        <StatCard
          label="Downloads (7 Days)"
          value={overview?.downloads_7d ?? '—'}
          icon={BarChart3}
        />
        <StatCard
          label="Downloads Today"
          value={overview?.downloads_today ?? '—'}
          icon={Eye}
        />
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-zinc-600" />
        <h3 className="mt-3 text-sm font-medium text-zinc-300">
          Analytics Overview
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          Detailed charts and trends will be available in the Analytics section.
        </p>
      </div>
    </div>
  )
}
