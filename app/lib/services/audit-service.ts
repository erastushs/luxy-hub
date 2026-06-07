import { insertAuditLog, type AuditAction, type AuditResourceType } from '@/app/lib/repositories/audit-repository'

export type AuditEventParams = {
  actor_id: string
  actor_role: string
  action: AuditAction
  resource_type: AuditResourceType
  resource_id?: string | null
  resource_slug?: string | null
  metadata?: Record<string, unknown>
}

export function logAuditEvent(params: AuditEventParams): void {
  insertAuditLog({
    actor_id: params.actor_id,
    actor_role: params.actor_role,
    action: params.action,
    resource_type: params.resource_type,
    resource_id: params.resource_id ?? null,
    resource_slug: params.resource_slug ?? null,
    metadata: params.metadata ?? {},
  }).catch((err: unknown) => {
    console.error(`[audit] Async audit log write failed for ${params.action}:`, err)
  })
}
