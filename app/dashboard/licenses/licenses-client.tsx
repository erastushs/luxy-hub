'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, BadgeCheck, Ban, BarChart3, Copy, KeyRound, Loader2, RotateCcw, Search, ShieldOff, SlidersHorizontal, Trash2, Users } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import { CopyButton } from '@/app/dashboard/components/CopyButton'
import { EmptyState } from '@/app/dashboard/components/EmptyState'
import { ErrorBanner } from '@/app/dashboard/components/ErrorBanner'
import { formatDate, formatDateTime } from '@/app/dashboard/lib/format-date'
import {
  createLicenseAction,
  createLicenseAssignmentAction,
  removeLicenseAssignmentAction,
  updateLicenseStatusAction,
} from '@/app/actions/licenses'

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
  display_name: string | null
  created_at: string
}

type LicenseFilter = LicenseStatus | 'assigned' | 'unassigned'

type LicenseSort = 'newest' | 'oldest' | 'updated' | 'status'

type BulkAction = 'enable' | 'disable' | 'revoke'

type AssignmentsState = {
  loading: boolean
  items: AssignmentItem[]
  error: string | null
  visible?: boolean
}

type LicensesClientProps = {
  scripts: ScriptOption[]
  initialError: string | null
  initialLicenses?: LicenseItem[]
  initialCreatedLicense?: string | null
}

function statusLabel(status: LicenseStatus) {
  if (status === 'active') return 'Active'
  if (status === 'disabled') return 'Disabled'
  return 'Revoked'
}

function StatusBadge({ status }: { status: LicenseStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
        status === 'active' && 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20',
        status === 'disabled' && 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20',
        status === 'revoked' && 'bg-red-500/10 text-red-300 ring-1 ring-red-500/20'
      )}
    >
      {statusLabel(status)}
    </span>
  )
}

function filterLabel(filter: LicenseFilter) {
  if (filter === 'assigned') return 'Assigned'
  if (filter === 'unassigned') return 'Unassigned'
  return statusLabel(filter)
}

function bulkActionLabel(action: BulkAction) {
  if (action === 'enable') return 'Enable selected'
  if (action === 'disable') return 'Disable selected'
  return 'Revoke selected'
}

function canApplyBulkAction(status: LicenseStatus, action: BulkAction) {
  if (action === 'enable') return status === 'disabled'
  if (action === 'disable') return status === 'active'
  return status !== 'revoked'
}

function getActiveAssignmentCount(assignments?: AssignmentItem[]) {
  return assignments?.length ?? 0
}

function formatUtilization(used: number, maxAssignments: number) {
  return `${used} / ${maxAssignments > 0 ? maxAssignments : 'Unlimited'}`
}

async function readApiError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { message?: unknown } | null
  return typeof body?.message === 'string' ? body.message : fallback
}

function readActionError(result: { success: false; message: string }, fallback: string) {
  return result.message || fallback
}

function LicenseListSkeleton() {
  return (
    <div className="divide-y divide-zinc-800" aria-label="Loading licenses">
      {[0, 1, 2].map((item) => (
        <div key={item} className="p-5">
          <div className="animate-pulse space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-20 rounded-full bg-zinc-800" />
                  <div className="h-4 w-48 rounded bg-zinc-800" />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {[0, 1, 2, 3, 4].map((metric) => (
                    <div key={metric} className="space-y-2">
                      <div className="h-3 w-14 rounded bg-zinc-800" />
                      <div className="h-4 w-20 rounded bg-zinc-800" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-9 w-20 rounded-lg bg-zinc-800" />
                <div className="h-9 w-28 rounded-lg bg-zinc-800" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function BulkActionDialog({
  action,
  count,
  skippedCount,
  onCancel,
  onConfirm,
  busy,
}: {
  action: BulkAction
  count: number
  skippedCount: number
  onCancel: () => void
  onConfirm: () => void
  busy: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={bulkActionLabel(action)}>
      <div className="fixed inset-0 bg-black/70" onClick={busy ? undefined : onCancel} />
      <div className="relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-600/10" aria-hidden="true">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{bulkActionLabel(action)}</h3>
            <p className="text-xs text-zinc-400">
              This will {action} {count} selected license{count === 1 ? '' : 's'} using existing single-license operations.
              {skippedCount > 0 && ` ${skippedCount} selected license${skippedCount === 1 ? '' : 's'} will be skipped because the transition is not allowed.`}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || count === 0}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            {busy ? 'Applying...' : bulkActionLabel(action)}
          </button>
        </div>
      </div>
    </div>
  )
}

export function LicensesClient({
  scripts,
  initialError,
  initialLicenses = [],
  initialCreatedLicense = null,
}: LicensesClientProps) {
  const [selectedScriptId, setSelectedScriptId] = useState(scripts[0]?.id ?? '')
  const [licenses, setLicenses] = useState<LicenseItem[]>(initialLicenses)
  const [assignmentsByLicense, setAssignmentsByLicense] = useState<Record<string, AssignmentsState>>({})
  const [createdLicense, setCreatedLicense] = useState<string | null>(initialCreatedLicense)
  const [error, setError] = useState<string | null>(initialError)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState<LicenseFilter[]>([])
  const [sortBy, setSortBy] = useState<LicenseSort>('newest')
  const [selectedLicenseIds, setSelectedLicenseIds] = useState<string[]>([])
  const [bulkDialogAction, setBulkDialogAction] = useState<BulkAction | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [isPending, startTransition] = useTransition()
  const licenseLoadRequestId = useRef(0)
  const createLicenseRequestId = useRef(0)
  const assignmentMetadataRequestId = useRef(0)

  const selectedScript = scripts.find((script) => script.id === selectedScriptId) ?? null
  const normalizedSearch = searchQuery.trim().toLowerCase()
  const filtersActive = normalizedSearch.length > 0 || activeFilters.length > 0
  const needsAssignmentData = normalizedSearch.length > 0 || activeFilters.includes('assigned') || activeFilters.includes('unassigned') || sortBy === 'updated'
  const assignmentMetadataStates = needsAssignmentData ? licenses.map((license) => assignmentsByLicense[license.id]) : []
  const assignmentMetadataLoading = assignmentMetadataStates.some((state) => !state || state.loading)
  const assignmentMetadataErrors = assignmentMetadataStates.filter((state) => state?.error).map((state) => state!.error!)
  const assignmentMetadataReady = !needsAssignmentData || (!assignmentMetadataLoading && assignmentMetadataErrors.length === 0)
  const visibleLicenses = [...licenses]
    .filter((license) => {
      const assignmentState = assignmentsByLicense[license.id]
      const assignments = assignmentState?.items ?? []
      const hasAssignments = assignments.length > 0
      const matchesFilters = activeFilters.length === 0 || activeFilters.some((filter) => {
        if (filter === 'assigned') return hasAssignments
        if (filter === 'unassigned') return assignmentState && !assignmentState.loading && !assignmentState.error && !hasAssignments
        return license.status === filter
      })

      if (!matchesFilters) return false

      if (!normalizedSearch) return true

      const searchValues = [
        license.id,
        selectedScript?.name,
        selectedScript?.slug,
        ...assignments.flatMap((assignment) => [assignment.display_name, assignment.id]),
      ]

      return searchValues.some((value) => value?.toLowerCase().includes(normalizedSearch))
    })
    .sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sortBy === 'updated') {
        const aAssignments = assignmentsByLicense[a.id]?.items ?? []
        const bAssignments = assignmentsByLicense[b.id]?.items ?? []
        const aLatestAssignment = Math.max(0, ...aAssignments.map((assignment) => new Date(assignment.created_at).getTime()))
        const bLatestAssignment = Math.max(0, ...bAssignments.map((assignment) => new Date(assignment.created_at).getTime()))
        return Math.max(new Date(b.created_at).getTime(), bLatestAssignment) - Math.max(new Date(a.created_at).getTime(), aLatestAssignment)
      }
      if (sortBy === 'status') {
        const statusOrder: Record<LicenseStatus, number> = { active: 0, disabled: 1, revoked: 2 }
        return statusOrder[a.status] - statusOrder[b.status] || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  const selectedVisibleCount = visibleLicenses.filter((license) => selectedLicenseIds.includes(license.id)).length
  const allVisibleSelected = visibleLicenses.length > 0 && selectedVisibleCount === visibleLicenses.length
  const selectedLicenses = visibleLicenses.filter((license) => selectedLicenseIds.includes(license.id))
  const selectableBulkActions = (['enable', 'disable', 'revoke'] as BulkAction[]).filter((action) => selectedLicenses.some((license) => canApplyBulkAction(license.status, action)))
  const bulkDialogEligibleLicenses = bulkDialogAction ? selectedLicenses.filter((license) => canApplyBulkAction(license.status, bulkDialogAction)) : []
  const bulkDialogSkippedCount = bulkDialogAction ? selectedLicenses.length - bulkDialogEligibleLicenses.length : 0

  async function fetchLicensesForScript(scriptId: string, requestId: number) {
    const response = await fetch(`/api/licenses?script_id=${encodeURIComponent(scriptId)}`)
    if (requestId !== licenseLoadRequestId.current || scriptId !== selectedScriptId) return

    if (!response.ok) {
      setError(await readApiError(response, 'Failed to load licenses'))
      setLicenses([])
      return
    }

    const body = await response.json() as { licenses?: LicenseItem[] }
    if (requestId !== licenseLoadRequestId.current || scriptId !== selectedScriptId) return
    setLicenses(body.licenses ?? [])
  }

  function loadLicenses(scriptId: string) {
    const requestId = ++licenseLoadRequestId.current

    startTransition(async () => {
      setError(null)
      setCreatedLicense(null)
      setAssignmentsByLicense({})
      setSelectedLicenseIds([])

      try {
        await fetchLicensesForScript(scriptId, requestId)
      } catch {
        if (requestId !== licenseLoadRequestId.current || scriptId !== selectedScriptId) return
        setError('Failed to load licenses')
        setLicenses([])
      }
    })
  }

  async function loadAssignmentsForLicense(licenseId: string, options: { forceOpen?: boolean } = {}) {
    const current = assignmentsByLicense[licenseId]
    if (current?.loading) return

    setAssignmentsByLicense((state) => ({
      ...state,
      [licenseId]: { loading: true, items: current?.items ?? [], error: null },
    }))

    try {
      const response = await fetch(`/api/licenses/${licenseId}/assignments`)
      if (!response.ok) {
        const message = await readApiError(response, 'Failed to load assignments')
        setAssignmentsByLicense((state) => ({
          ...state,
          [licenseId]: { loading: false, items: current?.items ?? [], error: message, visible: options.forceOpen ?? current?.visible ?? false },
        }))
        return
      }

      const body = await response.json() as { assignments?: AssignmentItem[] }
      setAssignmentsByLicense((state) => ({
        ...state,
        [licenseId]: {
          loading: false,
          items: body.assignments ?? [],
          error: null,
          visible: options.forceOpen ?? current?.visible ?? false,
        },
      }))
    } catch {
      setAssignmentsByLicense((state) => ({
        ...state,
        [licenseId]: { loading: false, items: current?.items ?? [], error: 'Failed to load assignments', visible: options.forceOpen ?? current?.visible ?? false },
      }))
    }
  }

  useEffect(() => {
    if (!selectedScriptId) return

    createLicenseRequestId.current += 1
    assignmentMetadataRequestId.current += 1
    const requestId = ++licenseLoadRequestId.current

    startTransition(async () => {
      setError(null)
      setCreatedLicense(null)
      setAssignmentsByLicense({})
      setSelectedLicenseIds([])

      try {
        const response = await fetch(`/api/licenses?script_id=${encodeURIComponent(selectedScriptId)}`)
        if (requestId !== licenseLoadRequestId.current) return

        if (!response.ok) {
          setError(await readApiError(response, 'Failed to load licenses'))
          setLicenses([])
          return
        }

        const body = await response.json() as { licenses?: LicenseItem[] }
        if (requestId !== licenseLoadRequestId.current) return
        setLicenses(body.licenses ?? [])
      } catch {
        if (requestId !== licenseLoadRequestId.current) return
        setError('Failed to load licenses')
        setLicenses([])
      }
    })
  }, [selectedScriptId])

  useEffect(() => {
    if (licenses.length === 0) return

    const requestId = assignmentMetadataRequestId.current

    licenses.forEach((license) => {
      if (assignmentsByLicense[license.id]) return

      setAssignmentsByLicense((state) => ({
        ...state,
        [license.id]: { loading: true, items: [], error: null, visible: false },
      }))

      void fetch(`/api/licenses/${license.id}/assignments`)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(await readApiError(response, 'Failed to load assignments'))
          }

          return response.json() as Promise<{ assignments?: AssignmentItem[] }>
        })
        .then((body) => {
          if (requestId !== assignmentMetadataRequestId.current) return

          setAssignmentsByLicense((state) => ({
            ...state,
            [license.id]: { loading: false, items: body.assignments ?? [], error: null, visible: false },
          }))
        })
        .catch(() => {
          if (requestId !== assignmentMetadataRequestId.current) return

          setAssignmentsByLicense((state) => ({
            ...state,
            [license.id]: { loading: false, items: [], error: 'Failed to load assignments', visible: false },
          }))
        })
    })
  }, [licenses, assignmentsByLicense])

  function toggleFilter(filter: LicenseFilter) {
    setSelectedLicenseIds([])
    setActiveFilters((current) => current.includes(filter)
      ? current.filter((item) => item !== filter)
      : [...current, filter])
  }

  function clearSearchControls() {
    setSearchQuery('')
    setActiveFilters([])
    setSortBy('newest')
    setSelectedLicenseIds([])
  }

  function toggleLicenseSelection(licenseId: string) {
    setSelectedLicenseIds((current) => current.includes(licenseId)
      ? current.filter((id) => id !== licenseId)
      : [...current, licenseId])
  }

  function selectAllVisible() {
    setSelectedLicenseIds((current) => Array.from(new Set([...current, ...visibleLicenses.map((license) => license.id)])))
  }

  function clearSelection() {
    setSelectedLicenseIds([])
  }

  async function createLicense(formData: FormData) {
    if (!selectedScriptId) return

    const scriptId = selectedScriptId
    const requestId = ++createLicenseRequestId.current
    const maxAssignments = Number(formData.get('max_assignments') ?? 1)
    const expiresAt = String(formData.get('expires_at') ?? '')

    startTransition(async () => {
      setError(null)
      try {
        const result = await createLicenseAction({
          scriptId,
          maxAssignments: Number.isInteger(maxAssignments) && maxAssignments > 0 ? maxAssignments : 1,
          expiresAt: expiresAt ? new Date(`${expiresAt}T00:00:00`).toISOString() : null,
        })

        if (!result.success) {
          setError(readActionError(result, 'Failed to create license'))
          return
        }

        if (requestId !== createLicenseRequestId.current || scriptId !== selectedScriptId) return

        setCreatedLicense(result.license)
        toast.success('License created')

        const listResponse = await fetch(`/api/licenses?script_id=${encodeURIComponent(scriptId)}`)
        if (requestId !== createLicenseRequestId.current || scriptId !== selectedScriptId) return

        if (listResponse.ok) {
          const listBody = await listResponse.json() as { licenses?: LicenseItem[] }
          if (requestId !== createLicenseRequestId.current || scriptId !== selectedScriptId) return
          setLicenses(listBody.licenses ?? [])
          setSelectedLicenseIds([])
        }
      } catch {
        setError('Failed to create license')
      }
    })
  }

  async function updateLicenseStatus(id: string, action: 'disable' | 'enable' | 'revoke') {
    startTransition(async () => {
      setError(null)
      try {
        const result = await updateLicenseStatusAction(id, action)
        if (!result.success) {
          setError(readActionError(result, `Failed to ${action} license`))
          return
        }

        setLicenses((current) => current.map((license) => license.id === id ? result.license : license))
        toast.success(`License ${action === 'disable' ? 'disabled' : action === 'enable' ? 'enabled' : 'revoked'}`)
      } catch {
        setError(`Failed to ${action} license`)
      }
    })
  }

  async function runSingleLicenseStatusUpdate(id: string, action: BulkAction) {
    const result = await updateLicenseStatusAction(id, action)
    if (!result.success) {
      throw new Error(readActionError(result, `Failed to ${action} license`))
    }

    setLicenses((current) => current.map((license) => license.id === id ? result.license : license))
  }

  async function confirmBulkAction() {
    if (!bulkDialogAction || selectedLicenses.length === 0) return

    setBulkBusy(true)
    setError(null)
    try {
      for (const license of bulkDialogEligibleLicenses) {
        await runSingleLicenseStatusUpdate(license.id, bulkDialogAction)
      }

      toast.success(`${bulkDialogEligibleLicenses.length} changed, ${bulkDialogSkippedCount} skipped`)
      setSelectedLicenseIds([])
      setBulkDialogAction(null)
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : `Failed to ${bulkDialogAction} selected licenses`)
    } finally {
      setBulkBusy(false)
    }
  }

  async function toggleAssignments(licenseId: string) {
    const current = assignmentsByLicense[licenseId]
    if (current && !current.loading && current.visible) {
      setAssignmentsByLicense((state) => {
        const next = state[licenseId]
        if (!next) return state

        return {
          ...state,
          [licenseId]: { ...next, visible: false },
        }
      })
      return
    }

    if (current && !current.loading) {
      setAssignmentsByLicense((state) => ({
        ...state,
        [licenseId]: { ...current, visible: true },
      }))
      return
    }

    await loadAssignmentsForLicense(licenseId, { forceOpen: true })
  }

  async function removeAssignment(licenseId: string, assignmentId: string) {
    startTransition(async () => {
      try {
        const result = await removeLicenseAssignmentAction(licenseId, assignmentId)
        if (!result.success) {
          setError(readActionError(result, 'Failed to remove assignment'))
          return
        }

        setAssignmentsByLicense((state) => ({
          ...state,
          [licenseId]: {
            loading: false,
            error: null,
            visible: state[licenseId]?.visible ?? true,
            items: (state[licenseId]?.items ?? []).filter((assignment) => assignment.id !== assignmentId),
          },
        }))
        toast.success('Assignment removed')
      } catch {
        setError('Failed to remove assignment')
      }
    })
  }

  async function createAssignment(licenseId: string, formData: FormData) {
    const customerIdentifier = String(formData.get('customer_identifier') ?? '').trim()
    const displayName = String(formData.get('display_name') ?? '').trim()
    let assignmentAlreadyExists = false

    if (!customerIdentifier) {
      setAssignmentsByLicense((state) => ({
        ...state,
        [licenseId]: {
          loading: false,
          items: state[licenseId]?.items ?? [],
          error: 'Customer identifier is required',
          visible: true,
        },
      }))
      return
    }

    startTransition(async () => {
      setError(null)
      setAssignmentsByLicense((state) => ({
        ...state,
        [licenseId]: {
          loading: true,
          items: state[licenseId]?.items ?? [],
          error: null,
          visible: true,
        },
      }))

      try {
        const result = await createLicenseAssignmentAction({
          licenseId,
          customerIdentifier,
          displayName: displayName || null,
        })

        if (!result.success) {
          const message = readActionError(result, 'Failed to create assignment')
          setAssignmentsByLicense((state) => ({
            ...state,
            [licenseId]: {
              loading: false,
              items: state[licenseId]?.items ?? [],
              error: message,
              visible: true,
            },
          }))
          return
        }

        setAssignmentsByLicense((state) => {
          const current = state[licenseId]
          const existingItems = current?.items ?? []
          assignmentAlreadyExists = result.assignment
            ? existingItems.some((assignment) => assignment.id === result.assignment.id)
            : false
          const nextItems = result.assignment && !assignmentAlreadyExists
            ? [result.assignment, ...existingItems]
            : existingItems

          return {
            ...state,
            [licenseId]: {
              loading: false,
              items: nextItems,
              error: null,
              visible: true,
            },
          }
        })
        toast.success(assignmentAlreadyExists ? 'Assignment already exists' : 'Assignment created')
      } catch {
        setAssignmentsByLicense((state) => ({
          ...state,
          [licenseId]: {
            loading: false,
            items: state[licenseId]?.items ?? [],
            error: 'Failed to create assignment',
            visible: true,
          },
        }))
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">License Management</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Create premium license keys and manage assignments for scripts you own. Raw keys are shown only once.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end lg:w-auto">
          <Link
            href="/dashboard/licenses/analytics"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            License Analytics
          </Link>
          <div className="w-full lg:w-80">
            <label htmlFor="license-script" className="mb-1.5 block text-sm font-medium text-zinc-300">
              Script
            </label>
            <select
              id="license-script"
              value={selectedScriptId}
              onChange={(event) => setSelectedScriptId(event.target.value)}
              className="block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
            >
              {scripts.map((script) => (
                <option key={script.id} value={script.id}>{script.name} / {script.slug}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {scripts.length === 0 ? (
        <EmptyState
          title="No scripts available"
          description="Create a script before managing premium licenses."
          action={(
            <Link href="/dashboard/scripts/new" className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950">
              Create Script
            </Link>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600/15 text-red-400">
                  <KeyRound className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Create License</h2>
                  <p className="text-sm text-zinc-400">For {selectedScript?.name ?? 'selected script'}</p>
                </div>
              </div>

              <form action={createLicense} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <div>
                  <label htmlFor="max_assignments" className="block text-sm font-medium text-zinc-300">Max assignments</label>
                  <input
                    id="max_assignments"
                    name="max_assignments"
                    type="number"
                    min={1}
                    defaultValue={1}
                    className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-white focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                  />
                </div>
                <div>
                  <label htmlFor="expires_at" className="block text-sm font-medium text-zinc-300">Expires at</label>
                  <input
                    id="expires_at"
                    name="expires_at"
                    type="date"
                    className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-white focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}
                  Create
                </button>
              </form>

              {createdLicense && (
                <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <p className="text-sm font-semibold text-emerald-200">Save this key now. It cannot be viewed again.</p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <code className="break-all rounded-lg bg-zinc-950 px-3 py-2 font-mono text-sm text-white">{createdLicense}</code>
                    <CopyButton value={createdLicense} label="Copy License" />
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
              <div className="border-b border-zinc-800 px-5 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Licenses</h2>
                    <p className="text-sm text-zinc-400">
                      {visibleLicenses.length} visible of {licenses.length} license{licenses.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                    {assignmentMetadataLoading && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 px-2.5 py-1">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Loading assignments
                      </span>
                    )}
                    {isPending && <Loader2 className="h-5 w-5 animate-spin text-zinc-500" aria-label="Loading" />}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_13rem]">
                  <div>
                    <label htmlFor="license-search" className="sr-only">Search licenses</label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
                      <input
                        id="license-search"
                        type="search"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search license, assignment target, customer label, or script name"
                        className="block w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2.5 pl-9 pr-3.5 text-sm text-white placeholder:text-zinc-600 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="license-sort" className="sr-only">Sort licenses</label>
                    <select
                      id="license-sort"
                      value={sortBy}
                      onChange={(event) => setSortBy(event.target.value as LicenseSort)}
                      className="block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-white focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                    >
                      <option value="newest">Newest first</option>
                      <option value="oldest">Oldest first</option>
                      <option value="updated">Recent activity</option>
                      <option value="status">Status</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                      <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" /> Filters
                    </span>
                    {(['active', 'disabled', 'revoked', 'unassigned', 'assigned'] as LicenseFilter[]).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => toggleFilter(filter)}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600',
                          activeFilters.includes(filter)
                            ? 'border-red-500/60 bg-red-600/15 text-red-300'
                            : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                        )}
                      >
                        {filterLabel(filter)}
                      </button>
                    ))}
                    {filtersActive && (
                      <button type="button" onClick={clearSearchControls} className="text-xs font-medium text-zinc-500 hover:text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600">
                        Reset filters
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllVisible}
                      disabled={visibleLicenses.length === 0 || allVisibleSelected}
                      className="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                    >
                      Select all visible
                    </button>
                    <button
                      type="button"
                      onClick={clearSelection}
                      disabled={selectedLicenseIds.length === 0}
                      className="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                    >
                      Clear selection
                    </button>
                  </div>
                </div>

                {selectedLicenseIds.length > 0 && (
                  <div className="mt-4 flex flex-col gap-3 rounded-xl border border-red-900/50 bg-red-950/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-red-100">
                      {selectedLicenses.length} visible license{selectedLicenses.length === 1 ? '' : 's'} selected. Bulk actions reuse existing single-license operations.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectableBulkActions.length === 0 ? (
                        <span className="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-500">No valid bulk actions</span>
                      ) : selectableBulkActions.map((action) => (
                        <button
                          key={action}
                          type="button"
                          onClick={() => setBulkDialogAction(action)}
                          className="rounded-lg border border-red-900/70 px-3 py-2 text-xs font-medium text-red-200 hover:bg-red-950/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                        >
                          {bulkActionLabel(action)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {assignmentMetadataErrors.length > 0 && (
                  <div className="mt-4">
                    <ErrorBanner message="Some assignment metadata failed to load. Assignment filters and assignment search are paused until you refresh." />
                  </div>
                )}
              </div>

              {isPending && licenses.length === 0 ? (
                <LicenseListSkeleton />
              ) : licenses.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="No licenses yet" description="Create a license above to begin managing premium access." />
                </div>
              ) : needsAssignmentData && !assignmentMetadataReady ? (
                <LicenseListSkeleton />
              ) : visibleLicenses.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="No matching licenses" description="Adjust your search, status filters, assignment filters, or sort scope." />
                </div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {visibleLicenses.map((license) => {
                    const assignments = assignmentsByLicense[license.id]
                    const activeAssignmentCount = getActiveAssignmentCount(assignments?.items)
                    const utilizationPercent = license.max_assignments > 0
                      ? Math.min(100, Math.round((activeAssignmentCount / license.max_assignments) * 100))
                      : 0
                    const isSelected = selectedLicenseIds.includes(license.id)
                    return (
                      <article key={license.id} className={cn('p-5 transition', isSelected && 'bg-red-950/10')}>
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleLicenseSelection(license.id)}
                                aria-label={`Select license ${license.id}`}
                                className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-red-600 focus:ring-red-600 focus:ring-offset-zinc-950"
                              />
                              <StatusBadge status={license.status} />
                              <span className="break-all font-mono text-xs text-zinc-500">{license.id}</span>
                            </div>
                            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
                              <div>
                                <dt className="text-xs text-zinc-500">Created</dt>
                                <dd className="mt-1 text-zinc-200">{formatDate(license.created_at)}</dd>
                              </div>
                              <div>
                                <dt className="text-xs text-zinc-500">Expires</dt>
                                <dd className="mt-1 text-zinc-200">{license.expires_at ? formatDate(license.expires_at) : 'Never'}</dd>
                              </div>
                              <div>
                                <dt className="text-xs text-zinc-500">Max</dt>
                                <dd className="mt-1 text-zinc-200">{license.max_assignments}</dd>
                              </div>
                              <div>
                                <dt className="text-xs text-zinc-500">Assignments Used</dt>
                                <dd className="mt-1 text-zinc-200">{!assignments || assignments.loading ? 'Loading...' : formatUtilization(activeAssignmentCount, license.max_assignments)}</dd>
                              </div>
                              <div>
                                <dt className="text-xs text-zinc-500">Activations</dt>
                                <dd className="mt-1 text-zinc-200">{license.activation_count}</dd>
                              </div>
                              <div>
                                <dt className="text-xs text-zinc-500">Deliveries</dt>
                                <dd className="mt-1 text-zinc-200">{license.delivery_count}</dd>
                              </div>
                            </dl>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {license.status === 'active' && (
                              <button type="button" onClick={() => updateLicenseStatus(license.id, 'disable')} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600">
                                <Ban className="h-3.5 w-3.5" aria-hidden="true" /> Disable
                              </button>
                            )}
                            {license.status === 'disabled' && (
                              <button type="button" onClick={() => updateLicenseStatus(license.id, 'enable')} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600">
                                <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Enable
                              </button>
                            )}
                            {license.status !== 'revoked' && (
                              <button type="button" onClick={() => updateLicenseStatus(license.id, 'revoke')} className="inline-flex items-center gap-1.5 rounded-lg border border-red-900/70 px-3 py-2 text-xs text-red-300 hover:bg-red-950/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600">
                                <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" /> Revoke
                              </button>
                            )}
                            <button type="button" onClick={() => toggleAssignments(license.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600">
                              <Users className="h-3.5 w-3.5" aria-hidden="true" /> {assignments?.visible ? 'Hide' : 'View'} Assignments
                            </button>
                          </div>
                        </div>

                        {assignments && !assignments.loading && !assignments.error && (
                          <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800" aria-label={`Assignment utilization ${formatUtilization(activeAssignmentCount, license.max_assignments)}`}>
                            <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${utilizationPercent}%` }} />
                          </div>
                        )}

                        {assignments?.visible && (
                          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                            {assignments.loading ? (
                              <div className="space-y-3 animate-pulse" aria-label="Loading assignments">
                                <div className="h-4 w-40 rounded bg-zinc-800" />
                                <div className="h-14 rounded-lg bg-zinc-800/70" />
                                <div className="h-14 rounded-lg bg-zinc-800/70" />
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {assignments.error && <ErrorBanner message={assignments.error} />}
                                <form action={createAssignment.bind(null, license.id)} className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
                                  <div>
                                    <label htmlFor={`customer_identifier_${license.id}`} className="block text-xs font-medium text-zinc-400">Customer identifier</label>
                                    <input
                                      id={`customer_identifier_${license.id}`}
                                      name="customer_identifier"
                                      required
                                      className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                                      placeholder="customer@example.com or device id"
                                    />
                                  </div>
                                  <div>
                                    <label htmlFor={`display_name_${license.id}`} className="block text-xs font-medium text-zinc-400">Display name optional</label>
                                    <input
                                      id={`display_name_${license.id}`}
                                      name="display_name"
                                      className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                                      placeholder="Customer label"
                                    />
                                  </div>
                                  <button type="submit" disabled={isPending} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600">
                                    <Users className="h-3.5 w-3.5" aria-hidden="true" /> Create Assignment
                                  </button>
                                </form>
                                {assignments.items.length === 0 ? (
                                  <EmptyState title="No assignments" description="This license has no assignment targets yet." />
                                ) : assignments.items.map((assignment) => (
                                  <div key={assignment.id} className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                      <p className="text-sm font-medium text-white">{assignment.display_name ?? 'Unnamed assignment'}</p>
                                      <p className="text-xs text-zinc-500">Created {formatDateTime(assignment.created_at)}</p>
                                    </div>
                                    <button type="button" onClick={() => removeAssignment(license.id, assignment.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-900/70 px-3 py-2 text-xs text-red-300 hover:bg-red-950/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600">
                                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          <aside className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 xl:sticky xl:top-6 xl:self-start">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300">
              <Copy className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-white">Operational notes</h2>
            <ul className="mt-3 space-y-2 text-sm text-zinc-400">
              <li>Raw license keys are returned only immediately after creation.</li>
              <li>License hashes are never displayed in the dashboard.</li>
              <li>Assignment hashes are hidden; only display names and creation dates are shown.</li>
              <li>Assignment limits and device limits are not enforced in this phase.</li>
            </ul>
            <button
              type="button"
              onClick={() => selectedScriptId && loadLicenses(selectedScriptId)}
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-300 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Refresh selected script
            </button>
          </aside>
        </div>
      )}

      {bulkDialogAction && (
        <BulkActionDialog
          action={bulkDialogAction}
          count={bulkDialogEligibleLicenses.length}
          skippedCount={bulkDialogSkippedCount}
          busy={bulkBusy}
          onCancel={() => setBulkDialogAction(null)}
          onConfirm={confirmBulkAction}
        />
      )}
    </div>
  )
}
