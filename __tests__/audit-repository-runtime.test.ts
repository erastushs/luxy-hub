import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

vi.mock('@/app/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

import { supabaseAdmin } from '@/app/lib/supabase'
import { insertAuditLog } from '@/app/lib/repositories/audit-repository'

describe('audit repository runtime safety', () => {
  const mockedFrom = supabaseAdmin.from as unknown as Mock

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('persists runtime authorization, assignment, and delivery event roles with sanitized metadata', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    mockedFrom.mockReturnValue({ insert })

    await insertAuditLog({
      actor_id: 'creator-uuid-1',
      actor_role: 'runtime',
      action: 'license.authorization_allowed',
      resource_type: 'license_assignment',
      resource_id: 'assignment-uuid-1',
      metadata: {
        license_id: 'license-uuid-1',
        assignment_id: 'assignment-uuid-1',
        customer_identifier_hash: 'b'.repeat(64),
        reason: 'assignment_reused',
        license_key: 'LUXY-PREM-SECRET-KEY1-KEY2',
        customer_identifier: 'customer@example.com',
        secret: 'runtime-secret',
      },
    })

    expect(mockedFrom).toHaveBeenCalledWith('audit_logs')
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      actor_id: 'creator-uuid-1',
      actor_role: 'runtime',
      action: 'license.authorization_allowed',
      resource_type: 'license_assignment',
      resource_id: 'assignment-uuid-1',
      metadata: {
        license_id: 'license-uuid-1',
        assignment_id: 'assignment-uuid-1',
        customer_identifier_hash: 'b'.repeat(64),
        reason: 'assignment_reused',
      },
    }))
  })

  it('persists creator and admin actor roles for non-runtime audit events', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    mockedFrom.mockReturnValue({ insert })

    await insertAuditLog({
      actor_id: 'creator-uuid-1',
      actor_role: 'creator',
      action: 'license.assignment_created',
      resource_type: 'license_assignment',
      resource_id: 'assignment-uuid-1',
    })
    await insertAuditLog({
      actor_id: 'admin-uuid-1',
      actor_role: 'admin',
      action: 'license.revoked',
      resource_type: 'license',
      resource_id: 'license-uuid-1',
    })

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ actor_role: 'creator' }))
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ actor_role: 'admin' }))
  })

  it('logs audit failures without throwing so runtime delivery can degrade gracefully', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: 'audit table unavailable' } })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockedFrom.mockReturnValue({ insert })

    await expect(insertAuditLog({
      actor_id: 'creator-uuid-1',
      actor_role: 'runtime',
      action: 'delivery.session_created',
      resource_type: 'delivery_session',
      resource_id: 'session-uuid-1',
    })).resolves.toBeUndefined()

    expect(consoleError).toHaveBeenCalledWith('[audit] Failed to write audit log for delivery.session_created: audit table unavailable')

    consoleError.mockRestore()
  })
})
