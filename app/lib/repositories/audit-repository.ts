import { supabaseAdmin } from '@/app/lib/supabase'

export type AuditAction =
  | 'script.created'
  | 'script.updated'
  | 'script.deleted'
  | 'script.visibility_changed'
  | 'script.version_created'
  | 'license.created'
  | 'license.disabled'
  | 'license.enabled'
  | 'license.revoked'
  | 'license.assignment_created'
  | 'license.authorization_allowed'
  | 'license.authorization_denied'
  | 'delivery.session_created'
  | 'auth.login'
  | 'auth.logout'

export type AuditResourceType = 'script' | 'script_version' | 'user' | 'license' | 'license_assignment' | 'delivery_session'

export type AuditRow = {
  id: string
  actor_id: string
  actor_role: string
  action: string
  resource_type: string
  resource_id: string | null
  resource_slug: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export type AuditLogInput = {
  actor_id: string
  actor_role: string
  action: AuditAction
  resource_type: AuditResourceType
  resource_id?: string | null
  resource_slug?: string | null
  metadata?: Record<string, unknown>
}

export async function insertAuditLog(input: AuditLogInput): Promise<void> {
  const sanitizedMetadata = sanitizeMetadata(input.metadata ?? {})

  const { error } = await supabaseAdmin
    .from('audit_logs')
    .insert({
      actor_id: input.actor_id,
      actor_role: input.actor_role,
      action: input.action,
      resource_type: input.resource_type,
      resource_id: input.resource_id ?? null,
      resource_slug: input.resource_slug ?? null,
      metadata: sanitizedMetadata,
      created_at: new Date().toISOString(),
    })

  if (error) {
    console.error(`[audit] Failed to write audit log for ${input.action}: ${error.message}`)
  }
}

const EXCLUDED_METADATA_KEYS = new Set([
  'token',
  'key',
  'license',
  'license_key',
  'customer_identifier',
  'api_key',
  'secret',
  'password',
  'authorization',
  'access_token',
  'refresh_token',
  'service_key',
  'content',
])

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}

  for (const key of Object.keys(metadata)) {
    if (EXCLUDED_METADATA_KEYS.has(key.toLowerCase())) continue

    const value = metadata[key]
    if (typeof value === 'string') {
      if (value.length > 512) {
        sanitized[key] = value.slice(0, 512) + '...'
      } else {
        sanitized[key] = value
      }
    } else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      sanitized[key] = value
    }
  }

  return sanitized
}

export async function listAuditLogsForActor(
  actorId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ logs: AuditRow[]; total: number }> {
  const { data, error, count } = await supabaseAdmin
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .eq('actor_id', actorId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return { logs: [], total: 0 }
  return { logs: data ?? [], total: count ?? 0 }
}
