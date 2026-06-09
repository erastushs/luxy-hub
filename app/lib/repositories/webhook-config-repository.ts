import { supabaseAdmin } from '@/app/lib/supabase'

export type WebhookProvider = 'discord' | 'telegram' | 'slack'

export type WebhookConfigRow = {
  id: string
  script_id: string
  creator_id: string
  provider: WebhookProvider
  config: Record<string, unknown>
  enabled: boolean
  created_at: string
  updated_at: string
}

const WEBHOOK_CONFIG_SELECT = [
  'id',
  'script_id',
  'creator_id',
  'provider',
  'config',
  'enabled',
  'created_at',
  'updated_at',
].join(', ')

export async function createWebhookConfig(params: {
  scriptId: string
  creatorId: string
  provider: WebhookProvider
  config: Record<string, unknown>
  enabled?: boolean
}): Promise<WebhookConfigRow> {
  const { data, error } = await supabaseAdmin
    .from('webhook_config')
    .insert({
      script_id: params.scriptId,
      creator_id: params.creatorId,
      provider: params.provider,
      config: params.config,
      enabled: params.enabled ?? false,
    })
    .select(WEBHOOK_CONFIG_SELECT)
    .single()

  if (error) throw error
  return data as unknown as WebhookConfigRow
}

export async function getWebhookConfigByScriptId(scriptId: string): Promise<WebhookConfigRow | null> {
  const { data, error } = await supabaseAdmin
    .from('webhook_config')
    .select(WEBHOOK_CONFIG_SELECT)
    .eq('script_id', scriptId)
    .maybeSingle()

  if (error) throw error
  return data as unknown as WebhookConfigRow | null
}

export async function getEnabledWebhookConfigByScriptId(scriptId: string): Promise<WebhookConfigRow | null> {
  const { data, error } = await supabaseAdmin
    .from('webhook_config')
    .select(WEBHOOK_CONFIG_SELECT)
    .eq('script_id', scriptId)
    .eq('enabled', true)
    .maybeSingle()

  if (error) throw error
  return data as unknown as WebhookConfigRow | null
}

export async function getWebhookConfigsByCreator(creatorId: string): Promise<WebhookConfigRow[]> {
  const { data, error } = await supabaseAdmin
    .from('webhook_config')
    .select(WEBHOOK_CONFIG_SELECT)
    .eq('creator_id', creatorId)

  if (error) throw error
  return (data as unknown as WebhookConfigRow[]) ?? []
}

export async function updateWebhookConfig(params: {
  scriptId: string
  provider?: WebhookProvider
  config?: Record<string, unknown>
  enabled?: boolean
}): Promise<WebhookConfigRow | null> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (params.provider !== undefined) updates.provider = params.provider
  if (params.config !== undefined) updates.config = params.config
  if (params.enabled !== undefined) updates.enabled = params.enabled

  const { data, error } = await supabaseAdmin
    .from('webhook_config')
    .update(updates)
    .eq('script_id', params.scriptId)
    .select(WEBHOOK_CONFIG_SELECT)
    .single()

  if (error) return null
  return data as unknown as WebhookConfigRow
}

export async function deleteWebhookConfig(scriptId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('webhook_config')
    .delete()
    .eq('script_id', scriptId)

  return !error
}
