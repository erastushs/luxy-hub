'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  AlertOctagon,
  Info,
} from 'lucide-react'
import type {
  AlertDashboardDTO,
  AlertEventDTO,
  AlertSeverity,
  AlertStatus,
} from '@/app/lib/services/internal-alert-service'

// ---------------------------------------------------------------------------
// Severity badge
// ---------------------------------------------------------------------------

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const SEVERITY_ICONS: Record<AlertSeverity, typeof Info> = {
  low: Info,
  medium: AlertTriangle,
  high: AlertOctagon,
  critical: ShieldAlert,
}

const STATUS_COLORS: Record<AlertStatus, string> = {
  active: 'bg-red-500/10 text-red-400 border-red-500/20',
  resolved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
}

function relativeTime(isoStr: string): string {
  const dt = new Date(isoStr).getTime()
  const diff = Date.now() - dt
  if (diff < 60_000) return 'just now'
  if (diff < 3600_000) return `${Math.round(diff / 60_000)}m ago`
  if (diff < 86400_000) return `${Math.round(diff / 3600_000)}h ago`
  return `${Math.round(diff / 86400_000)}d ago`
}

function AlertSeverityBadge({ severity }: { severity: AlertSeverity }) {
  const Icon = SEVERITY_ICONS[severity]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[severity]}`}
    >
      <Icon className="h-3 w-3" />
      {severity.toUpperCase()}
    </span>
  )
}

function AlertStatusBadge({ status }: { status: AlertStatus }) {
  const Icon = status === 'active' ? ShieldAlert : ShieldCheck
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      <Icon className="h-3 w-3" />
      {status === 'active' ? 'Active' : 'Resolved'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

function AlertRow({ alert }: { alert: AlertEventDTO }) {
  return (
    <tr className="border-b border-zinc-800 hover:bg-zinc-800/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-100">
            {alert.alertType.replace(/_/g, ' ')}
          </span>
          <span className="text-xs text-zinc-500 max-w-xs truncate">
            {alert.message}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <AlertSeverityBadge severity={alert.severity} />
      </td>
      <td className="px-4 py-3">
        <AlertStatusBadge status={alert.status} />
      </td>
      <td className="px-4 py-3 text-sm text-zinc-300 tabular-nums">
        {alert.currentValue}
      </td>
      <td className="px-4 py-3 text-sm text-zinc-300 tabular-nums">
        {alert.thresholdValue}
      </td>
      <td className="px-4 py-3 text-sm text-zinc-400 whitespace-nowrap">
        {relativeTime(alert.createdAt)}
      </td>
      {alert.status === 'resolved' && (
        <td className="px-4 py-3 text-sm text-zinc-400 whitespace-nowrap">
          {alert.resolvedAt ? relativeTime(alert.resolvedAt) : '—'}
        </td>
      )}
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Active alerts table
// ---------------------------------------------------------------------------

function ActiveAlertsTable({ alerts, total, page, totalPages, onPage }: {
  alerts: AlertEventDTO[]
  total: number
  page: number
  totalPages: number
  onPage: (p: number) => void
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-red-400" />
          Active Alerts
          <span className="text-xs font-normal text-zinc-500">({total})</span>
        </h2>
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
          <ShieldCheck className="h-10 w-10 text-emerald-500" />
          <p className="mt-3 text-sm">No active alerts</p>
          <p className="text-xs">All systems operational</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-800 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  <th className="px-4 py-2">Alert</th>
                  <th className="px-4 py-2">Severity</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Current</th>
                  <th className="px-4 py-2">Threshold</th>
                  <th className="px-4 py-2">Triggered</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => <AlertRow key={a.id} alert={a} />)}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPage={onPage} />
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Alert history table
// ---------------------------------------------------------------------------

function AlertHistoryTable({ alerts, total, page, totalPages, onPage }: {
  alerts: AlertEventDTO[]
  total: number
  page: number
  totalPages: number
  onPage: (p: number) => void
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          Resolved Alerts
          <span className="text-xs font-normal text-zinc-500">({total})</span>
        </h2>
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
          <Shield className="h-10 w-10" />
          <p className="mt-3 text-sm">No resolved alerts</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-800 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  <th className="px-4 py-2">Alert</th>
                  <th className="px-4 py-2">Severity</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Peak</th>
                  <th className="px-4 py-2">Threshold</th>
                  <th className="px-4 py-2">Triggered</th>
                  <th className="px-4 py-2">Resolved</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => <AlertRow key={a.id} alert={a} />)}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPage={onPage} />
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

function Pagination({ page, totalPages, onPage }: {
  page: number
  totalPages: number
  onPage: (p: number) => void
}) {
  return (
    <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-3">
      <span className="text-xs text-zinc-500">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-1">
        <button
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Previous
        </button>
        <button
          onClick={() => onPage(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

function FilterBar({
  currentStatus,
  currentSeverity,
  onFilter,
}: {
  currentStatus: string
  currentSeverity: string
  onFilter: (status: string, severity: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800/50 p-0.5">
        {(['active', 'resolved'] as const).map((s) => (
          <button
            key={s}
            onClick={() => onFilter(s, currentSeverity)}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              currentStatus === s
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {s === 'active' ? 'Active' : 'Resolved'}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800/50 p-0.5">
        <button
          onClick={() => onFilter(currentStatus, '')}
          className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
            !currentSeverity
              ? 'bg-zinc-700 text-zinc-100'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          All
        </button>
        {(['low', 'medium', 'high', 'critical'] as const).map((s) => (
          <button
            key={s}
            onClick={() => onFilter(currentStatus, s)}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              currentSeverity === s
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Summary cards
// ---------------------------------------------------------------------------

function SummaryCards({ dashboard }: { dashboard: AlertDashboardDTO }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-red-400" />
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Active Alerts
          </span>
        </div>
        <div className="mt-2 text-2xl font-bold text-red-400 tabular-nums">
          {dashboard.totalActive}
        </div>
      </div>
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Resolved
          </span>
        </div>
        <div className="mt-2 text-2xl font-bold text-emerald-400 tabular-nums">
          {dashboard.totalResolved}
        </div>
      </div>
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/30 p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Total
          </span>
        </div>
        <div className="mt-2 text-2xl font-bold text-zinc-100 tabular-nums">
          {dashboard.totalActive + dashboard.totalResolved}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function AlertsClient({
  dashboard,
  currentStatus,
  currentSeverity,
}: {
  dashboard: AlertDashboardDTO
  currentStatus: string
  currentSeverity: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function onFilter(status: string, severity: string) {
    const params = new URLSearchParams()
    params.set('status', status)
    if (severity) params.set('severity', severity)
    router.push(`/dashboard/admin/alerts?${params.toString()}`)
  }

  function onPage(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (p <= 1) params.delete('page')
    else params.set('page', String(p))
    router.push(`/dashboard/admin/alerts?${params.toString()}`)
  }

  const isActive = currentStatus === 'active'
  const alerts = isActive ? dashboard.activeAlerts : dashboard.resolvedAlerts

  return (
    <div className="space-y-6">
      <SummaryCards dashboard={dashboard} />

      <FilterBar
        currentStatus={currentStatus}
        currentSeverity={currentSeverity}
        onFilter={onFilter}
      />

      {isActive ? (
        <ActiveAlertsTable
          alerts={alerts}
          total={dashboard.totalActive}
          page={dashboard.page}
          totalPages={dashboard.totalPages}
          onPage={onPage}
        />
      ) : (
        <AlertHistoryTable
          alerts={alerts}
          total={dashboard.totalResolved}
          page={dashboard.page}
          totalPages={dashboard.totalPages}
          onPage={onPage}
        />
      )}
    </div>
  )
}
