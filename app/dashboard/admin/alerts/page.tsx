import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { getAlertDashboard } from '@/app/lib/services/internal-alert-service'
import type { AlertSeverity, AlertStatus } from '@/app/lib/services/internal-alert-service'
import { ShieldAlert } from 'lucide-react'
import { AlertsClient } from './alerts-client'

type SearchParams = {
  status?: string
  severity?: string
  page?: string
}

export default async function AdminAlertsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-red-500" />
          <h1 className="mt-4 text-lg font-semibold text-zinc-100">Access Denied</h1>
          <p className="mt-1 text-sm text-zinc-400">Admin role required to view alerts.</p>
        </div>
      </div>
    )
  }

  const params = await searchParams
  const statusFilter = isValidStatus(params.status) ? params.status : undefined
  const severityFilter = isValidSeverity(params.severity) ? params.severity : undefined
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const dashboard = await getAlertDashboard(statusFilter, severityFilter, page)
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Internal Alerts</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Operational and security alert monitoring
        </p>
      </div>

      <AlertsClient
        dashboard={dashboard}
        currentStatus={statusFilter ?? 'active'}
        currentSeverity={severityFilter ?? ''}
      />
    </div>
  )
}

function isValidStatus(s: unknown): s is AlertStatus {
  return s === 'active' || s === 'resolved'
}

function isValidSeverity(s: unknown): s is AlertSeverity {
  return s === 'low' || s === 'medium' || s === 'high' || s === 'critical'
}
