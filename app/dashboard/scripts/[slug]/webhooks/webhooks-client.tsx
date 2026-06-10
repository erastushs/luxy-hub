'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, BookOpen, Webhook, Send, Loader2, CheckCircle2, XCircle, AlertTriangle, Power, PowerOff } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import { saveWebhookAction, toggleWebhookAction, sendTestEventAction } from '@/app/actions/webhooks'
import { Tooltip } from '@/app/dashboard/components/Tooltip'
import type { WebhookConfigDTO } from '@/app/lib/services/dashboard-webhook-service'

// ---------------------------------------------------------------------------
// WebhookStatusBadge
// ---------------------------------------------------------------------------

function WebhookStatusBadge({ config }: { config: WebhookConfigDTO | null }) {
  if (!config) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-zinc-800 text-zinc-400 ring-zinc-700">
        <XCircle className="h-3 w-3" aria-hidden="true" />
        Not configured
      </span>
    )
  }

  if (!config.enabled) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-amber-500/10 text-amber-400 ring-amber-500/20">
        <PowerOff className="h-3 w-3" aria-hidden="true" />
        Disabled
      </span>
    )
  }

  if (!config.isValid) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-red-500/10 text-red-400 ring-red-500/20">
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        Invalid config
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-emerald-500/10 text-emerald-400 ring-emerald-500/20">
      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
      Active
    </span>
  )
}

// ---------------------------------------------------------------------------
// TestWebhookButton
// ---------------------------------------------------------------------------

function TestWebhookButton({
  slug,
  disabled,
}: {
  slug: string
  disabled: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleClick = () => {
    setResult(null)
    startTransition(async () => {
      const res = await sendTestEventAction(slug)
      setResult(res)
    })
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isPending}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm font-medium transition',
          disabled || isPending
            ? 'cursor-not-allowed text-zinc-600'
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
        )}
        aria-label="Send test webhook event"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="h-4 w-4" aria-hidden="true" />
        )}
        Send Test Event
      </button>

      {result && (
        <span
          className={cn(
            'text-xs',
            result.success ? 'text-emerald-400' : 'text-red-400'
          )}
          role="status"
          aria-live="polite"
        >
          {result.message}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// WebhookSettingsCard
// ---------------------------------------------------------------------------

type ActionState = {
  success: boolean
  message?: string
  config?: WebhookConfigDTO
}

export default function WebhookSettings({
  slug,
  config,
}: {
  slug: string
  config: WebhookConfigDTO | null
}) {
  const saveWithSlug = saveWebhookAction.bind(null, slug)
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    saveWithSlug as never,
    { success: false }
  )

  const [isToggling, startToggle] = useTransition()
  const [toggleError, setToggleError] = useState<string | null>(null)

  const currentConfig = state.success && state.config ? state.config : config

  const router = useRouter()

  const handleToggle = () => {
    if (!currentConfig) return
    setToggleError(null)
    startToggle(async () => {
      try {
        const result = await toggleWebhookAction(slug, !currentConfig.enabled)
        if (!result.success) {
          setToggleError(result.message)
        } else {
          router.refresh()
        }
      } catch (err) {
        setToggleError(err instanceof Error ? err.message : 'Toggle failed')
      }
    })
  }

  const canTest = currentConfig !== null && currentConfig.enabled && currentConfig.hasWebhookUrl && currentConfig.isValid

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Tooltip text="Back to Edit">
            <Link
              href={`/dashboard/scripts/${slug}/edit`}
              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
              aria-label="Back to edit script"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Link>
          </Tooltip>
          <div>
            <h1 className="text-2xl font-bold text-white">Webhooks</h1>
            <p className="mt-1 text-sm text-zinc-400">
              <span className="text-zinc-600">/{slug}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <WebhookStatusBadge config={currentConfig} />
        </div>
      </div>

      {/* Error banner */}
      {state.message && !state.success && (
        <div
          className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400"
          role="alert"
        >
          {state.message}
        </div>
      )}

      {/* Success banner */}
      {state.message && state.success && (
        <div
          className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-400"
          role="status"
        >
          {state.message}
        </div>
      )}

      {/* Settings form */}
      <form action={formAction} className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        {/* Provider (read-only — Discord only) */}
        <div>
          <label className="block text-sm font-medium text-zinc-400">
            Provider
          </label>
          <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
            <Webhook className="h-4 w-4 text-zinc-500" aria-hidden="true" />
            Discord
          </div>
          <input type="hidden" name="provider" value="discord" />
        </div>

        {/* Webhook URL */}
        <div>
          <label htmlFor="webhook_url" className="block text-sm font-medium text-zinc-400">
            Discord Webhook URL
          </label>
          <p className="mt-1 text-xs text-zinc-500">
            Paste your Discord webhook URL. It will be stored securely and never displayed again.
          </p>
          <input
            id="webhook_url"
            name="webhook_url"
            type="text"
            required
            placeholder="https://discord.com/api/webhooks/..."
            className={cn(
              'mt-1.5 w-full rounded-lg border bg-zinc-900 px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 transition',
              'border-zinc-800 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600'
            )}
            autoComplete="off"
          />
          {currentConfig?.hasWebhookUrl && (
            <p className="mt-1 text-xs text-emerald-400">
              {currentConfig.webhookUrlMasked}
            </p>
          )}
        </div>

        {/* Enable / Disable */}
        <div className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-zinc-300">
              {currentConfig?.enabled ? 'Enabled' : 'Disabled'}
            </p>
            <p className="text-xs text-zinc-500">
              {currentConfig?.enabled
                ? 'Events will be delivered to Discord'
                : 'Events will be queued but not delivered'}
            </p>
          </div>
          {currentConfig && (
            <button
              type="button"
              onClick={handleToggle}
              disabled={isToggling}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
                currentConfig.enabled
                  ? 'border border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                  : 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20',
                isToggling && 'opacity-50 cursor-not-allowed'
              )}
              aria-label={currentConfig.enabled ? 'Disable webhook' : 'Enable webhook'}
            >
              {isToggling ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : currentConfig.enabled ? (
                <PowerOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Power className="h-4 w-4" aria-hidden="true" />
              )}
              {currentConfig.enabled ? 'Disable' : 'Enable'}
            </button>
          )}
          {toggleError && (
            <p className="text-xs text-red-400" role="alert">{toggleError}</p>
          )}
        </div>
        <input type="hidden" name="enabled" value={currentConfig?.enabled ? 'true' : 'false'} />

        {/* Save */}
        <div className="flex items-center justify-between pt-2">
          <TestWebhookButton slug={slug} disabled={!canTest} />
          <button
            type="submit"
            disabled={isPending}
            className={cn(
              'rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition',
              'hover:bg-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600',
              isPending && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Saving…
              </span>
            ) : (
              'Save Webhook'
            )}
          </button>
        </div>
      </form>

      {/* Event Platform help card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 mt-0.5">
            <BookOpen className="h-5 w-5 text-zinc-500" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">
              Need help integrating events?
            </h3>
            <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
              Learn how to create delivery sessions, generate HMAC signatures,
              send events from your runtime, and use webhook delivery safely —
              without exposing your Discord webhook URL to clients.
            </p>
            <Link
              href="/docs/event-platform"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-300 transition-colors"
            >
              View Event Platform Docs
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
