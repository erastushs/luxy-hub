'use client'

import { useState } from 'react'
import { CalendarClock, CheckCircle2, KeyRound, Loader2 } from 'lucide-react'
import { CopyButton } from '@/app/dashboard/components/CopyButton'
import { cn } from '@/app/lib/utils'

type Duration = 'weekly' | 'monthly' | 'custom'

type IssuedKey = {
  key: string
  expires_at: string
}

const options: Array<{
  duration: Duration
  title: string
  description: string
}> = [
  {
    duration: 'weekly',
    title: 'Weekly',
    description: 'Expires seven days after issuance.',
  },
  {
    duration: 'monthly',
    title: 'Monthly',
    description: 'Expires thirty days after issuance.',
  },
  {
    duration: 'custom',
    title: 'Custom',
    description: 'Choose a specific expiration date and time.',
  },
]

export function KeysClient() {
  const [duration, setDuration] = useState<Duration>('weekly')
  const [customExpiresAt, setCustomExpiresAt] = useState('')
  const [issuedKey, setIssuedKey] = useState<IssuedKey | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIssuedKey(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/dashboard/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration,
          expires_at: duration === 'custom' && customExpiresAt
            ? new Date(customExpiresAt).toISOString()
            : undefined,
        }),
      })
      const body = await response.json().catch(() => ({})) as Record<string, unknown>

      if (!response.ok || body.success !== true) {
        setError(typeof body.message === 'string' ? body.message : 'Failed to issue key')
        return
      }

      setIssuedKey({
        key: String(body.key),
        expires_at: String(body.expires_at),
      })
    } catch {
      setError('Failed to issue key')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-red-400">Paid Key Infrastructure</p>
        <h1 className="mt-2 text-2xl font-bold text-white">Dashboard Key Issuance</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          Generate paid access keys using the existing Luxy key format and the current key expiration field.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 shadow-2xl shadow-black/20">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600/10 text-red-400">
              <KeyRound className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Create paid key</h2>
              <p className="text-sm text-zinc-500">Weekly, monthly, or custom expiration.</p>
            </div>
          </div>

          <fieldset className="mt-5">
            <legend className="text-sm font-medium text-zinc-200">Expiration</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {options.map((option) => {
                const selected = duration === option.duration

                return (
                  <label
                    key={option.duration}
                    className={cn(
                      'cursor-pointer rounded-xl border p-4 transition focus-within:ring-2 focus-within:ring-red-600',
                      selected
                        ? 'border-red-500/60 bg-red-600/10'
                        : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700'
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
                    <span className="mt-2 block text-xs leading-relaxed text-zinc-500">{option.description}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {duration === 'custom' && (
            <div className="mt-5">
              <label htmlFor="custom-expires-at" className="block text-sm font-medium text-zinc-200">
                Custom expiration
              </label>
              <input
                id="custom-expires-at"
                type="datetime-local"
                value={customExpiresAt}
                onChange={(event) => setCustomExpiresAt(event.target.value)}
                required
                className="mt-2 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/40"
              />
              <p className="mt-2 text-xs text-zinc-500">Custom keys must expire in the future and within 366 days.</p>
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Issue key
          </button>
        </form>

        <aside className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
              <CalendarClock className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Issued key</h2>
              <p className="text-sm text-zinc-500">The raw key is shown once after creation.</p>
            </div>
          </div>

          {issuedKey ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-300">Save this key now</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <code className="break-all rounded-lg bg-black/30 px-2 py-1 text-sm text-emerald-100">{issuedKey.key}</code>
                  <CopyButton value={issuedKey.key} label="Copy key" compact />
                </div>
              </div>
              <dl className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <dt className="text-xs uppercase tracking-wide text-zinc-500">Expires</dt>
                <dd className="mt-1 text-sm font-medium text-zinc-200">{formatDate(issuedKey.expires_at)}</dd>
              </dl>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-500">
              No paid key issued in this session yet.
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
