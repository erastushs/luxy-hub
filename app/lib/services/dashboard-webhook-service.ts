import { getOwnedScript } from '@/app/lib/auth/ownership'
import {
  getWebhookConfigByScriptId,
  createWebhookConfig,
  updateWebhookConfig,
  type WebhookConfigRow,
} from '@/app/lib/repositories/webhook-config-repository'
import { createEventLog, type EventType } from '@/app/lib/repositories/event-repository'
import { validateWebhookUrl, validateConfig } from '@/app/lib/providers/discord-provider'
import { processSingleEvent, type ProviderResolver } from '@/app/lib/services/event-queue-service'
import { discordProvider } from '@/app/lib/providers/discord-provider'

// ---------------------------------------------------------------------------
// Safe DTO — never leaks raw webhook URL
// ---------------------------------------------------------------------------

export type WebhookConfigDTO = {
  id: string
  scriptId: string
  provider: string
  enabled: boolean
  webhookUrlMasked: string
  hasWebhookUrl: boolean
  isValid: boolean
  validationReason: string | null
  lastUpdated: string
}

function maskWebhookUrl(raw: unknown): { masked: string; hasUrl: boolean } {
  if (typeof raw !== 'string' || raw.length === 0) {
    return { masked: '', hasUrl: false }
  }
  return { masked: 'Discord webhook configured', hasUrl: true }
}

function toSafeDTO(row: WebhookConfigRow): WebhookConfigDTO {
  const { masked, hasUrl } = maskWebhookUrl(row.config?.webhook_url)
  const validation = validateConfig(row)
  return {
    id: row.id,
    scriptId: row.script_id,
    provider: row.provider,
    enabled: row.enabled,
    webhookUrlMasked: masked,
    hasWebhookUrl: hasUrl,
    isValid: validation.valid,
    validationReason: validation.reason ?? null,
    lastUpdated: row.updated_at,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveOwnedScript(slug: string, userId: string): Promise<{ id: string } | null> {
  const script = await getOwnedScript(slug, userId)
  if (!script) return null
  return { id: script.id }
}

// ---------------------------------------------------------------------------
// Service result types
// ---------------------------------------------------------------------------

export type WebhookServiceResult<T = WebhookConfigDTO> =
  | { success: true; config: T }
  | { success: false; message: string; status: number }

export type TestEventResult =
  | { success: true; message: string }
  | { success: false; message: string; status: number }

// ---------------------------------------------------------------------------
// Get config (ownership-enforced via slug)
// ---------------------------------------------------------------------------

export async function getWebhookConfigSafe(
  slug: string,
  userId: string,
): Promise<WebhookServiceResult<WebhookConfigDTO | null>> {
  const script = await resolveOwnedScript(slug, userId)
  if (!script) {
    return { success: false, message: 'Script not found', status: 404 }
  }

  const row = await getWebhookConfigByScriptId(script.id)
  if (!row) {
    return { success: true, config: null }
  }

  return { success: true, config: toSafeDTO(row) }
}

// ---------------------------------------------------------------------------
// Create or update config (ownership-enforced via slug)
// ---------------------------------------------------------------------------

export async function saveWebhookConfig(
  slug: string,
  userId: string,
  provider: string,
  webhookUrl: string,
  enabled: boolean,
): Promise<WebhookServiceResult> {
  const script = await resolveOwnedScript(slug, userId)
  if (!script) {
    return { success: false, message: 'Script not found', status: 404 }
  }

  if (provider !== 'discord') {
    return { success: false, message: 'Only Discord webhooks are supported', status: 400 }
  }

  const validation = validateWebhookUrl(webhookUrl)
  if (!validation.valid) {
    return { success: false, message: validation.reason ?? 'Invalid webhook URL', status: 400 }
  }

  const existing = await getWebhookConfigByScriptId(script.id)

  let row: WebhookConfigRow
  if (existing) {
    const updated = await updateWebhookConfig({
      scriptId: script.id,
      provider: provider as WebhookConfigRow['provider'],
      config: { webhook_url: webhookUrl },
      enabled,
    })
    if (!updated) {
      return { success: false, message: 'Failed to update webhook config', status: 500 }
    }
    row = updated
  } else {
    row = await createWebhookConfig({
      scriptId: script.id,
      creatorId: userId,
      provider: provider as WebhookConfigRow['provider'],
      config: { webhook_url: webhookUrl },
      enabled,
    })
  }

  return { success: true, config: toSafeDTO(row) }
}

// ---------------------------------------------------------------------------
// Toggle enabled/disabled (ownership-enforced via slug)
// ---------------------------------------------------------------------------

export async function toggleWebhookConfig(
  slug: string,
  userId: string,
  enabled: boolean,
): Promise<WebhookServiceResult> {
  const script = await resolveOwnedScript(slug, userId)
  if (!script) {
    return { success: false, message: 'Script not found', status: 404 }
  }

  const existing = await getWebhookConfigByScriptId(script.id)
  if (!existing) {
    return { success: false, message: 'No webhook config exists', status: 404 }
  }

  const updated = await updateWebhookConfig({
    scriptId: script.id,
    enabled,
  })

  if (!updated) {
    return { success: false, message: 'Failed to toggle webhook', status: 500 }
  }

  return { success: true, config: toSafeDTO(updated) }
}

// ---------------------------------------------------------------------------
// Send test event (through normal queue flow, ownership-enforced via slug)
// ---------------------------------------------------------------------------

export async function sendTestWebhookEvent(
  slug: string,
  userId: string,
): Promise<TestEventResult> {
  const script = await resolveOwnedScript(slug, userId)
  if (!script) {
    return { success: false, message: 'Script not found', status: 404 }
  }

  const config = await getWebhookConfigByScriptId(script.id)
  if (!config) {
    return { success: false, message: 'No webhook config exists', status: 400 }
  }

  if (!config.enabled) {
    return { success: false, message: 'Webhook is disabled', status: 400 }
  }

  const webhookUrl = config.config?.webhook_url
  if (typeof webhookUrl !== 'string' || webhookUrl.length === 0) {
    return { success: false, message: 'No webhook URL configured', status: 400 }
  }

  const urlValidation = validateWebhookUrl(webhookUrl)
  if (!urlValidation.valid) {
    return { success: false, message: urlValidation.reason ?? 'Invalid webhook URL', status: 400 }
  }

  // Create a heartbeat event with test payload
  const timestamp = new Date().toISOString()
  const nonce = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')

  const event = await createEventLog({
    scriptId: script.id,
    sessionId: '00000000-0000-0000-0000-000000000000',
    eventType: 'heartbeat' as EventType,
    payload: { test: true, note: 'Webhook test event from dashboard' },
    timestamp,
    nonce,
  })

  // Deliver only the created test event through the normal queue/provider flow.
  const resolveProvider: ProviderResolver = (provider: string) => {
    if (provider === 'discord') return discordProvider
    return null
  }

  const result = await processSingleEvent(event.id, resolveProvider)

  if (result.deadLettered > 0) {
    return { success: false, message: 'Test event delivery failed — webhook may be invalid or deleted', status: 400 }
  }

  return { success: true, message: 'Test event sent and queued for delivery' }
}
