'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/app/lib/auth/session-auth'
import {
  getWebhookConfigSafe,
  saveWebhookConfig,
  toggleWebhookConfig,
  sendTestWebhookEvent,
} from '@/app/lib/services/dashboard-webhook-service'
import type {
  WebhookConfigDTO,
  WebhookServiceResult,
  TestEventResult,
} from '@/app/lib/services/dashboard-webhook-service'

// ---------------------------------------------------------------------------
// Get webhook config (read-only, returns safe DTO or null)
// ---------------------------------------------------------------------------

export async function getWebhookAction(
  slug: string,
): Promise<WebhookServiceResult<WebhookConfigDTO | null>> {
  const user = await requireAuth()
  return getWebhookConfigSafe(slug, user.id)
}

// ---------------------------------------------------------------------------
// Save (create or update) webhook config
// ---------------------------------------------------------------------------

export async function saveWebhookAction(
  slug: string,
  _prevState: WebhookServiceResult,
  formData: FormData,
): Promise<WebhookServiceResult> {
  const user = await requireAuth()

  const provider = formData.get('provider')
  const webhookUrl = formData.get('webhook_url')
  const enabled = formData.get('enabled') === 'true'

  if (typeof provider !== 'string' || typeof webhookUrl !== 'string') {
    return { success: false, message: 'Provider and webhook URL are required', status: 400 }
  }

  const result = await saveWebhookConfig(slug, user.id, provider, webhookUrl, enabled)

  if (result.success) {
    revalidatePath(`/dashboard/scripts/${slug}/webhooks`)
  }

  return result
}

// ---------------------------------------------------------------------------
// Toggle enabled/disabled
// ---------------------------------------------------------------------------

export async function toggleWebhookAction(
  slug: string,
  enabled: boolean,
): Promise<WebhookServiceResult> {
  const user = await requireAuth()
  const result = await toggleWebhookConfig(slug, user.id, enabled)

  if (result.success) {
    revalidatePath(`/dashboard/scripts/${slug}/webhooks`)
  }

  return result
}

// ---------------------------------------------------------------------------
// Send test webhook event
// ---------------------------------------------------------------------------

export async function sendTestEventAction(slug: string): Promise<TestEventResult> {
  const user = await requireAuth()
  return sendTestWebhookEvent(slug, user.id)
}
