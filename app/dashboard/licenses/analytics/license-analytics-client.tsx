'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import {
  Activity,
  BadgeCheck,
  Ban,
  BarChart3,
  KeyRound,
  Loader2,
  RotateCcw,
  ShieldOff,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { EmptyState } from '@/app/dashboard/components/EmptyState'
import { ErrorBanner } from '@/app/dashboard/components/ErrorBanner'
import { formatDateTime } from '@/app/dashboard/lib/format-date'
import { cn } from '@/app/lib/utils'

type ScriptOption = {
  id: string
  slug: string
  name: string
}

type LicenseStatus = 'active' | 'disabled' | 'revoked'

type LicenseItem = {
  id: string
  status: LicenseStatus
  max_assignments: number
  activation_count: number
  delivery_count: number
  expires_at: string | null
  created_at: string
}

type AssignmentItem = {
  id: string
  license_id: string
  display_name: string | null
  status: string
  created_at: string
  updated_at: string
}

type LicenseWithScript = LicenseItem & {
  scriptName: string
  scriptSlug: string
}

type AssignmentWithContext = AssignmentItem & {
  licenseStatus: LicenseStatus
  scriptName: string
  scriptSlug: string
}

type LicenseAnalyticsClientProps = {
  scripts: ScriptOption[]
  initialError: string | null
}

type StatusSummary = Record<LicenseStatus, number>

type AnalyticsData = {
  licenses: LicenseWithScript[]
  assignments: AssignmentWithContext[]
}

const statusStyles: Record<LicenseStatus, string> = {
  active: 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20',
  disabled: 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20',
  revoked: 'bg-red-500/10 text-red-300 ring-1 ring-red-500/20',
}

function statusLabel(status: LicenseStatus) {
  if (status === 'active') return 'Active'
  if (status === 'disabled') return 'Disabled'
  return 'Revoked'
}

function StatusBadge({ status }: { status: LicenseStatus }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', statusStyles[status])}>
      {statusLabel(status)}
    </span>
  )
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string
  value: number
  helper: string
  icon: LucideIcon
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600/15 text-red-400">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-4 text-xs text-zinc-500">{helper}</p>
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-5 animate-pulse" aria-label="Loading license analytics">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-3">
                <div className="h-4 w-28 rounded bg-zinc-800" />
                <div className="h-8 w-16 rounded bg-zinc-800" />
              </div>
              <div className="h-11 w-11 rounded-xl bg-zinc-800" />
            </div>
            <div className="mt-4 h-3 w-36 rounded bg-zinc-800" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="h-64 rounded-xl border border-zinc-800 bg-zinc-900/50" />
        <div className="h-64 rounded-xl border border-zinc-800 bg-zinc-900/50" />
      </div>
    </div>
  )
}

async function readApiError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { message?: unknown } | null
  return typeof body?.message === 'string' ? body.message : fallback
}

function sortNewest<T extends { created_at: string }>(items: T[]) {
  return [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

async function fetchAnalyticsData(selectedScripts: ScriptOption[]): Promise<AnalyticsData> {
  const licenseResults = await Promise.all(selectedScripts.map(async (script) => {
    const response = await fetch(`/api/licenses?script_id=${encodeURIComponent(script.id)}`)
    if (!response.ok) {
      throw new Error(await readApiError(response, `Failed to load licenses for ${script.name}`))
    }

    const body = await response.json() as { licenses?: LicenseItem[] }
    return (body.licenses ?? []).map((license) => ({
      ...license,
      scriptName: script.name,
      scriptSlug: script.slug,
    }))
  }))

  const licenses = licenseResults.flat()
  const assignmentResults = await Promise.all(licenses.map(async (license) => {
    const response = await fetch(`/api/licenses/${license.id}/assignments`)
    if (!response.ok) {
      throw new Error(await readApiError(response, `Failed to load assignments for ${license.id}`))
    }

    const body = await response.json() as { assignments?: AssignmentItem[] }
    return (body.assignments ?? []).map((assignment) => ({
      ...assignment,
      licenseStatus: license.status,
      scriptName: license.scriptName,
      scriptSlug: license.scriptSlug,
    }))
  }))

  return {
    licenses,
    assignments: assignmentResults.flat(),
  }
}

export function LicenseAnalyticsClient({ scripts, initialError }: LicenseAnalyticsClientProps) {
  const [selectedScriptId, setSelectedScriptId] = useState('all')
  const [licenses, setLicenses] = useState<LicenseWithScript[]>([])
  const [assignments, setAssignments] = useState<AssignmentWithContext[]>([])
  const [error, setError] = useState<string | null>(initialError)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const analyticsRequestId = useRef(0)

  const selectedScripts = selectedScriptId === 'all'
    ? scripts
    : scripts.filter((script) => script.id === selectedScriptId)
  const effectiveHasLoaded = selectedScripts.length === 0 || hasLoaded

  const summary = licenses.reduce<StatusSummary>((counts, license) => {
    counts[license.status] += 1
    return counts
  }, { active: 0, disabled: 0, revoked: 0 })

  const recentLicenses = sortNewest(licenses).slice(0, 8)
  const recentAssignments = sortNewest(assignments).slice(0, 8)
  const totalLicenses = licenses.length
  const assignmentCount = assignments.length

  function loadAnalytics() {
    const requestId = ++analyticsRequestId.current

    if (selectedScripts.length === 0) return

    startTransition(async () => {
      setError(null)
      setHasLoaded(false)
      setLicenses([])
      setAssignments([])

      try {
        const data = await fetchAnalyticsData(selectedScripts)
        if (requestId !== analyticsRequestId.current) return

        setLicenses(data.licenses)
        setAssignments(data.assignments)
        setHasLoaded(true)
      } catch (loadError) {
        if (requestId !== analyticsRequestId.current) return

        setError(loadError instanceof Error ? loadError.message : 'Failed to load license analytics')
        setHasLoaded(true)
      }
    })
  }

  useEffect(() => {
    const scopedScripts = selectedScriptId === 'all'
      ? scripts
      : scripts.filter((script) => script.id === selectedScriptId)

    const requestId = ++analyticsRequestId.current

    if (scopedScripts.length === 0) return

    let ignore = false

    async function loadInitialAnalytics() {
      try {
        const data = await fetchAnalyticsData(scopedScripts)
        if (ignore || requestId !== analyticsRequestId.current) return

        setError(null)
        setLicenses(data.licenses)
        setAssignments(data.assignments)
        setHasLoaded(true)
      } catch (loadError) {
        if (ignore || requestId !== analyticsRequestId.current) return
        setError(loadError instanceof Error ? loadError.message : 'Failed to load license analytics')
        setLicenses([])
        setAssignments([])
        setHasLoaded(true)
      }
    }

    void loadInitialAnalytics()

    return () => {
      ignore = true
    }
  }, [scripts, selectedScriptId])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-red-400">Phase 7A.7</p>
          <h1 className="mt-1 text-2xl font-bold text-white">License Analytics</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Read-only license health, activity, and assignment visibility built from existing license dashboard APIs.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full sm:w-80">
            <label htmlFor="license-analytics-script" className="mb-1.5 block text-sm font-medium text-zinc-300">
              Script scope
            </label>
            <select
              id="license-analytics-script"
              value={selectedScriptId}
              onChange={(event) => {
                setHasLoaded(false)
                setSelectedScriptId(event.target.value)
              }}
              className="block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
            >
              <option value="all">All scripts</option>
              {scripts.map((script) => (
                <option key={script.id} value={script.id}>{script.name} / {script.slug}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={loadAnalytics}
            disabled={isPending || scripts.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />}
            Refresh
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {scripts.length === 0 ? (
        <EmptyState
          title="No scripts available"
          description="Create a script before viewing license analytics."
          action={(
            <Link href="/dashboard/scripts/new" className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950">
              Create Script
            </Link>
          )}
        />
      ) : !effectiveHasLoaded ? (
        <AnalyticsSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total Licenses" value={totalLicenses} helper={`${assignmentCount} assignment${assignmentCount === 1 ? '' : 's'} visible`} icon={KeyRound} />
            <MetricCard label="Active Licenses" value={summary.active} helper="Ready for premium access checks" icon={BadgeCheck} />
            <MetricCard label="Disabled Licenses" value={summary.disabled} helper="Temporarily unavailable licenses" icon={Ban} />
            <MetricCard label="Revoked Licenses" value={summary.revoked} helper="Permanently revoked licenses" icon={ShieldOff} />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300">
                  <BarChart3 className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">License Status Distribution</h2>
                  <p className="text-sm text-zinc-400">Current status mix for the selected scope.</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {(['active', 'disabled', 'revoked'] as LicenseStatus[]).map((status) => {
                  const count = summary[status]
                  const percent = totalLicenses > 0 ? Math.round((count / totalLicenses) * 100) : 0

                  return (
                    <div key={status}>
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={status} />
                          <span className="text-zinc-400">{count} license{count === 1 ? '' : 's'}</span>
                        </div>
                        <span className="font-medium text-zinc-200">{percent}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            status === 'active' && 'bg-emerald-500',
                            status === 'disabled' && 'bg-amber-500',
                            status === 'revoked' && 'bg-red-500'
                          )}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300">
                  <Activity className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Activity Snapshot</h2>
                  <p className="text-sm text-zinc-400">Aggregated counters already exposed by license records.</p>
                </div>
              </div>
              <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                  <dt className="text-xs text-zinc-500">Activations</dt>
                  <dd className="mt-2 text-2xl font-semibold text-white">{licenses.reduce((total, license) => total + license.activation_count, 0)}</dd>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                  <dt className="text-xs text-zinc-500">Deliveries</dt>
                  <dd className="mt-2 text-2xl font-semibold text-white">{licenses.reduce((total, license) => total + license.delivery_count, 0)}</dd>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                  <dt className="text-xs text-zinc-500">Capacity</dt>
                  <dd className="mt-2 text-2xl font-semibold text-white">{licenses.reduce((total, license) => total + license.max_assignments, 0)}</dd>
                </div>
              </dl>
            </section>
          </div>

          <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
              <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">Recent License Activity</h2>
                  <p className="text-sm text-zinc-400">Newest licenses in the selected scope.</p>
                </div>
                {isPending && <Loader2 className="h-5 w-5 animate-spin text-zinc-500" aria-label="Loading" />}
              </div>
              {recentLicenses.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="No license activity" description="License records will appear here after creation." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-5 py-3 font-medium">License</th>
                        <th className="px-5 py-3 font-medium">Script</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                        <th className="px-5 py-3 font-medium">Created</th>
                        <th className="px-5 py-3 font-medium">Usage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {recentLicenses.map((license) => (
                        <tr key={license.id}>
                          <td className="break-all px-5 py-4 font-mono text-xs text-zinc-400">{license.id}</td>
                          <td className="px-5 py-4">
                            <p className="font-medium text-zinc-200">{license.scriptName}</p>
                            <p className="text-xs text-zinc-500">/{license.scriptSlug}</p>
                          </td>
                          <td className="px-5 py-4"><StatusBadge status={license.status} /></td>
                          <td className="px-5 py-4 text-zinc-300">{formatDateTime(license.created_at)}</td>
                          <td className="px-5 py-4 text-zinc-400">{license.activation_count} activations / {license.delivery_count} deliveries</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
              <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">Recent Assignments</h2>
                  <p className="text-sm text-zinc-400">Newest license assignments from existing assignment records.</p>
                </div>
                <Users className="h-5 w-5 text-zinc-500" aria-hidden="true" />
              </div>
              {recentAssignments.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="No assignments" description="Assignments will appear here after customers are attached to licenses." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-5 py-3 font-medium">Assignment</th>
                        <th className="px-5 py-3 font-medium">Script</th>
                        <th className="px-5 py-3 font-medium">License</th>
                        <th className="px-5 py-3 font-medium">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {recentAssignments.map((assignment) => (
                        <tr key={assignment.id}>
                          <td className="px-5 py-4">
                            <p className="font-medium text-zinc-200">{assignment.display_name ?? 'Unnamed assignment'}</p>
                            <p className="break-all font-mono text-xs text-zinc-500">{assignment.id}</p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-medium text-zinc-200">{assignment.scriptName}</p>
                            <p className="text-xs text-zinc-500">/{assignment.scriptSlug}</p>
                          </td>
                          <td className="px-5 py-4">
                            <div className="space-y-2">
                              <StatusBadge status={assignment.licenseStatus} />
                              <p className="break-all font-mono text-xs text-zinc-500">{assignment.license_id}</p>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-zinc-300">{formatDateTime(assignment.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Management Context</h2>
                <p className="text-sm text-zinc-400">Use the license management page for creation and status changes.</p>
              </div>
              <Link
                href="/dashboard/licenses"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-300 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
              >
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                Open License Management
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
