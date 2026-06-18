'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { CalendarClock, CheckCircle2, Loader2, Plus, Search } from 'lucide-react'
import { CopyButton } from '@/app/dashboard/components/CopyButton'
import { DashboardModal } from '@/app/dashboard/components/DashboardModal'
import { ErrorBanner } from '@/app/dashboard/components/ErrorBanner'
import { cn } from '@/app/lib/utils'
import type { DashboardKey, KeySummary } from '@/app/lib/services/key-service'

type Duration = 'weekly' | 'monthly' | 'custom'

type IssuedKey = {
  key: string
  expires_at: string
}

type KeysClientProps = {
  initialKeys: DashboardKey[]
  initialSummary: KeySummary
  initialError?: string | null
}

const options: Array<{
  duration: Duration
  title: string
  description: string
}> = [
  { duration: 'weekly', title: 'Weekly', description: 'Expires seven days after issuance.' },
  { duration: 'monthly', title: 'Monthly', description: 'Expires thirty days after issuance.' },
  { duration: 'custom', title: 'Custom', description: 'Choose a specific expiration date and time.' },
]

export function KeysClient({ initialKeys, initialSummary, initialError = null }: KeysClientProps) {
  const [duration, setDuration] = useState<Duration>('weekly')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [customExpiresAt, setCustomExpiresAt] = useState('')
  const [customMaxDevices, setCustomMaxDevices] = useState('')
  const [issuedKey, setIssuedKey] = useState<IssuedKey | null>(null)
  const [keys, setKeys] = useState(initialKeys)
  const [summary, setSummary] = useState(initialSummary)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(initialError)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [updatingKeyId, setUpdatingKeyId] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function refreshKeys(nextSearch = search) {
    const params = nextSearch.trim() ? `?search=${encodeURIComponent(nextSearch.trim())}` : ''
    const response = await fetch(`/api/dashboard/keys${params}`)
    const body = await response.json().catch(() => ({})) as Record<string, unknown>

    if (!response.ok || body.success !== true) {
      throw new Error(typeof body.message === 'string' ? body.message : 'Failed to load keys')
    }

    setKeys(Array.isArray(body.keys) ? body.keys as DashboardKey[] : [])
    setSummary(isSummary(body.summary) ? body.summary : { total: 0, active: 0, expired: 0, disabled: 0 })
  }

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    startTransition(() => {
      void refreshKeys().catch((refreshError) => {
        setError(refreshError instanceof Error ? refreshError.message : 'Failed to load keys')
      })
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIssuedKey(null)
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Premium key name is required')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/dashboard/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration,
          name: trimmedName,
          description: description.trim() || undefined,
          expires_at: duration === 'custom' && customExpiresAt
            ? new Date(customExpiresAt).toISOString()
            : undefined,
          maxDevices: duration === 'custom'
            ? serializeCustomMaxDevices(customMaxDevices)
            : undefined,
        }),
      })
      const body = await response.json().catch(() => ({})) as Record<string, unknown>

      if (!response.ok || body.success !== true) {
        setError(typeof body.message === 'string' ? body.message : 'Failed to issue key')
        return
      }

      setIssuedKey({ key: String(body.key), expires_at: String(body.expires_at) })
      setName('')
      setDescription('')
      setCustomMaxDevices('')
      await refreshKeys()
    } catch {
      setError('Failed to issue key')
    } finally {
      setIsSubmitting(false)
    }
  }

  function closeCreateModal() {
    if (isSubmitting) return
    setCreateModalOpen(false)
    setIssuedKey(null)
  }

  async function handleToggleKey(key: DashboardKey) {
    setError(null)
    setUpdatingKeyId(key.id)

    try {
      const response = await fetch(`/api/dashboard/keys/${encodeURIComponent(key.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !key.is_active }),
      })
      const body = await response.json().catch(() => ({})) as Record<string, unknown>

      if (!response.ok || body.success !== true) {
        setError(typeof body.message === 'string' ? body.message : 'Failed to update key')
        return
      }

      await refreshKeys()
    } catch {
      setError('Failed to update key')
    } finally {
      setUpdatingKeyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Keys</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Generate and manage access keys.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/docs/phase-7b-runtime-integration"
            className="inline-flex w-fit items-center justify-center rounded-lg border border-zinc-800 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            Runtime Docs
          </Link>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex w-fit items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create Key
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Keys" value={summary.total} />
        <SummaryCard label="Active Keys" value={summary.active} tone="emerald" />
        <SummaryCard label="Expired Keys" value={summary.expired} tone="amber" />
        <SummaryCard label="Disabled Keys" value={summary.disabled} tone="zinc" />
      </div>

      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Existing keys</h2>
            <p className="text-sm text-zinc-500">Search and enable or disable issued keys.</p>
          </div>
          <form onSubmit={handleSearch} className="flex gap-2">
            <label className="sr-only" htmlFor="key-search">Search keys</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
              <input
                id="key-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search key"
                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-red-500 focus:ring-2 focus:ring-red-600/40 sm:w-56"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="h-10 rounded-lg border border-zinc-800 px-3 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-60"
            >
              {isPending ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>

        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-800 text-sm">
            <thead className="bg-zinc-950/70 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Key</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Expires</th>
                <th className="px-4 py-3 font-medium">Devices</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-900/20">
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <p className="text-sm font-medium text-zinc-300">No keys yet</p>
                    <p className="mt-1 text-xs text-zinc-500">Create your first key to begin managing access.</p>
                  </td>
                </tr>
              ) : keys.map((key) => (
                <tr key={key.id}>
                  <td className="px-4 py-3">
                    <div className="max-w-48">
                      <p className="truncate font-medium text-zinc-200">{key.name}</p>
                      {key.description && <p className="mt-1 truncate text-xs text-zinc-500">{key.description}</p>}
                      <p className="mt-1 text-xs text-zinc-600">{key.key_type}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="block max-w-[16rem] truncate whitespace-nowrap text-xs text-zinc-200">{key.key}</code>
                    <p className="mt-1 text-xs text-zinc-600">Created {formatDate(key.created_at)}</p>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={key.status} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-400">{formatDate(key.expires_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-300">{formatDeviceLimit(key)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void handleToggleKey(key)}
                      disabled={updatingKeyId === key.id}
                      className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                    >
                      {updatingKeyId === key.id ? 'Saving...' : key.is_active ? 'Disable Key' : 'Enable Key'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {createModalOpen && (
        <DashboardModal
          title={issuedKey ? 'Key created' : 'Create Key'}
          description={issuedKey ? 'Save this key now. It is shown once after creation.' : 'Create a weekly, monthly, or custom access key.'}
          onClose={closeCreateModal}
          closeDisabled={isSubmitting}
          maxWidth="lg"
          footer={issuedKey ? (
            <button
              type="button"
              onClick={closeCreateModal}
              className="h-10 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              Close
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={isSubmitting}
                className="h-10 rounded-lg border border-zinc-800 px-4 text-sm text-zinc-400 transition hover:bg-zinc-800 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-key-form"
                disabled={isSubmitting}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Issue key
              </button>
            </>
          )}
        >
          {issuedKey ? (
            <IssuedKeySuccess issuedKey={issuedKey} />
          ) : (
            <CreateKeyForm
              name={name}
              setName={setName}
              description={description}
              setDescription={setDescription}
              duration={duration}
              setDuration={setDuration}
              customExpiresAt={customExpiresAt}
              setCustomExpiresAt={setCustomExpiresAt}
              customMaxDevices={customMaxDevices}
              setCustomMaxDevices={setCustomMaxDevices}
              onSubmit={handleSubmit}
            />
          )}
        </DashboardModal>
      )}
    </div>
  )
}

function SummaryCard({ label, value, tone = 'red' }: { label: string; value: number; tone?: 'red' | 'emerald' | 'amber' | 'zinc' }) {
  const toneClass = {
    red: 'text-red-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    zinc: 'text-zinc-300',
  }[tone]

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className={cn('mt-2 text-2xl font-bold', toneClass)}>{value}</p>
    </div>
  )
}

function CreateKeyForm({
  name,
  setName,
  description,
  setDescription,
  duration,
  setDuration,
  customExpiresAt,
  setCustomExpiresAt,
  customMaxDevices,
  setCustomMaxDevices,
  onSubmit,
}: {
  name: string
  setName: (value: string) => void
  description: string
  setDescription: (value: string) => void
  duration: Duration
  setDuration: (duration: Duration) => void
  customExpiresAt: string
  setCustomExpiresAt: (value: string) => void
  customMaxDevices: string
  setCustomMaxDevices: (value: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <form id="create-key-form" onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="premium-key-name" className="block text-sm font-medium text-zinc-200">Name <span className="text-red-400">*</span></label>
          <input
            id="premium-key-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            autoFocus
            placeholder="Monthly Discord"
            className="mt-1.5 block h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-red-500 focus:ring-2 focus:ring-red-600/40"
          />
        </div>

        <div>
          <label htmlFor="premium-key-description" className="block text-sm font-medium text-zinc-200">Description</label>
          <input
            id="premium-key-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Optional support context"
            className="mt-1.5 block h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-red-500 focus:ring-2 focus:ring-red-600/40"
          />
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-zinc-200">Expiration</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {options.map((option) => {
            const selected = duration === option.duration

            return (
              <label
                key={option.duration}
                className={cn(
                  'cursor-pointer rounded-lg border p-3 transition focus-within:ring-2 focus-within:ring-red-600',
                  selected ? 'border-red-500/60 bg-red-600/10' : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700'
                )}
              >
                <input
                  type="radio"
                  name="duration"
                  value={option.duration}
                  checked={selected}
                  onChange={() => setDuration(option.duration)}
                  className="sr-only"
                />
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white">{option.title}</span>
                  {selected && <CheckCircle2 className="h-4 w-4 text-red-400" aria-hidden="true" />}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-zinc-500">{option.description}</span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {duration === 'custom' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="custom-expires-at" className="block text-sm font-medium text-zinc-200">Custom expiration</label>
            <input
              id="custom-expires-at"
              type="datetime-local"
              value={customExpiresAt}
              onChange={(event) => setCustomExpiresAt(event.target.value)}
              required
              className="mt-1.5 block h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/40"
            />
            <p className="mt-1.5 text-xs text-zinc-500">Must be in the future and within 366 days.</p>
          </div>

          <div>
            <label htmlFor="custom-max-devices" className="block text-sm font-medium text-zinc-200">Max Devices</label>
            <input
              id="custom-max-devices"
              type="number"
              min={1}
              max={100}
              step={1}
              inputMode="numeric"
              value={customMaxDevices}
              onChange={(event) => setCustomMaxDevices(event.target.value)}
              placeholder="Unlimited"
              className="mt-1.5 block h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-red-500 focus:ring-2 focus:ring-red-600/40"
            />
            <p className="mt-1.5 text-xs text-zinc-500">Leave blank for unlimited. Use 1-100.</p>
          </div>
        </div>
      )}

    </form>
  )
}

function IssuedKeySuccess({ issuedKey }: { issuedKey: IssuedKey }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
          <CalendarClock className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">Issued key</h2>
          <p className="text-sm text-zinc-500">The raw key is shown once after creation.</p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-300">Save this key now</p>
          <div className="mt-2 flex flex-col gap-2">
            <code className="break-all rounded-lg bg-black/30 px-2 py-1 text-sm text-emerald-100">{issuedKey.key}</code>
            <CopyButton value={issuedKey.key} label="Copy key" compact />
          </div>
        </div>
        <dl className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Expires</dt>
          <dd className="mt-1 text-sm font-medium text-zinc-200">{formatDate(issuedKey.expires_at)}</dd>
        </dl>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: DashboardKey['status'] }) {
  const className = {
    active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    expired: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    disabled: 'border-zinc-600 bg-zinc-800 text-zinc-300',
  }[status]

  return <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize', className)}>{status}</span>
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatDeviceLimit(key: DashboardKey) {
  const count = key.device_count ?? 0
  return typeof key.max_devices === 'number' ? `${count} / ${key.max_devices}` : `${count} / Unlimited`
}

export function serializeCustomMaxDevices(value: string): number | null {
  const trimmed = value.trim()
  return trimmed ? Number(trimmed) : null
}

function isSummary(value: unknown): value is KeySummary {
  return typeof value === 'object'
    && value !== null
    && typeof (value as KeySummary).total === 'number'
    && typeof (value as KeySummary).active === 'number'
    && typeof (value as KeySummary).expired === 'number'
    && typeof (value as KeySummary).disabled === 'number'
}
