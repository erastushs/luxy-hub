import type { EventLogRow } from '@/app/lib/repositories/event-repository'
import type { DeliveryProvider, DeliveryResult } from '@/app/lib/services/event-queue-service'
import type { WebhookConfigRow } from '@/app/lib/repositories/webhook-config-repository'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DISCORD_WEBHOOK_RE = /^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/

const EVENT_COLORS: Record<string, number> = {
  execute:          0x57F287, // green
  purchase:         0xFEE75C, // yellow
  error:            0xED4245, // red
  ban:              0xED4245, // red
  key_redeem:       0x5865F2, // blurple
  heartbeat:        0x95A5A6, // grey
  license_activate: 0x57F287, // green
  license_revoke:   0xED4245, // red
}

const EVENT_LABELS: Record<string, string> = {
  execute:          'Execute',
  purchase:         'Purchase',
  error:            'Error',
  ban:              'Ban',
  key_redeem:       'Key Redeem',
  heartbeat:        'Heartbeat',
  license_activate: 'License Activate',
  license_revoke:   'License Revoke',
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateWebhookUrl(url: unknown): { valid: boolean; reason?: string } {
  if (typeof url !== 'string' || url.length === 0) {
    return { valid: false, reason: 'Missing webhook URL' }
  }
  if (!DISCORD_WEBHOOK_RE.test(url)) {
    return { valid: false, reason: 'Invalid Discord webhook URL format' }
  }
  return { valid: true }
}

export function validateConfig(config: WebhookConfigRow): { valid: boolean; reason?: string } {
  if (config.provider !== 'discord') {
    return { valid: false, reason: 'Provider is not discord' }
  }
  if (!config.enabled) {
    return { valid: false, reason: 'Webhook config is disabled' }
  }
  const webhookUrl = (config.config as Record<string, unknown>)?.webhook_url
  return validateWebhookUrl(webhookUrl)
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function formatEventEmbed(event: EventLogRow): object {
  const label = EVENT_LABELS[event.event_type] ?? event.event_type
  const color = EVENT_COLORS[event.event_type] ?? 0x95A5A6

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [
    { name: 'Script', value: event.script_id, inline: true },
    { name: 'Event ID', value: event.id, inline: true },
  ]

  // Surface top-level payload entries as fields (up to 8)
  const payloadEntries = Object.entries(event.payload ?? {})
  for (const [key, value] of payloadEntries.slice(0, 8)) {
    const display = typeof value === 'string'
      ? value.slice(0, 1024)
      : JSON.stringify(value).slice(0, 1024)
    fields.push({ name: key, value: display, inline: true })
  }

  return {
    embeds: [{
      title: label,
      color,
      timestamp: event.timestamp,
      fields,
    }],
  }
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

function classifyHttpError(status: number, body: unknown): { retryable: boolean; error: string } {
  if (status === 429) {
    return { retryable: true, error: `Discord rate limited (${status})` }
  }
  if (status >= 500) {
    return { retryable: true, error: `Discord server error (${status})` }
  }

  // 404 with code 10015 = unknown webhook (deleted)
  if (status === 404) {
    try {
      const parsed = typeof body === 'string' ? JSON.parse(body) : body
      const code = (parsed as Record<string, unknown>)?.code
      if (code === 10015) {
        return { retryable: false, error: 'Discord webhook deleted or not found' }
      }
    } catch { /* not JSON */ }
    return { retryable: false, error: `Discord webhook not found (${status})` }
  }

  // 400, 401, 403 = bad/malformed → permanent
  if (status === 400 || status === 401 || status === 403) {
    return { retryable: false, error: `Discord rejected request (${status})` }
  }

  // Unknown codes — treat as retryable to be safe
  return { retryable: true, error: `Discord unexpected response (${status})` }
}

async function postToDiscord(webhookUrl: string, body: object): Promise<DeliveryResult> {
  let response: Response
  try {
    response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    // Network / DNS / timeout → retryable
    const message = err instanceof Error ? err.message : 'Network error'
    return { success: false, retryable: true, error: message }
  }

  const responseText = await response.text().catch(() => '')

  if (response.ok) {
    return { success: true, retryable: false }
  }

  const classified = classifyHttpError(response.status, responseText)
  return {
    success: false,
    retryable: classified.retryable,
    error: classified.error,
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const discordProvider: DeliveryProvider = {
  async deliver(event: EventLogRow, webhookUrl: string): Promise<DeliveryResult> {
    const urlCheck = validateWebhookUrl(webhookUrl)
    if (!urlCheck.valid) {
      return { success: false, retryable: false, error: urlCheck.reason }
    }

    const embed = formatEventEmbed(event)

    const result = await postToDiscord(webhookUrl, embed)

    return result
  },
}
