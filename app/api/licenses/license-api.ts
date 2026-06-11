import { NextResponse } from 'next/server'
import { AuthError, requireAuth, type AuthenticatedUser } from '@/app/lib/auth/session-auth'
import { findScriptByIdForOwner } from '@/app/lib/repositories/script-repository'
import { getOwnedLicense } from '@/app/lib/services/license-service'
import type { LicenseAssignmentRow, LicenseRow } from '@/app/lib/repositories/license-repository'

export type LicenseRouteContext = {
  actor: AuthenticatedUser
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status })
}

export async function withLicenseAuth(
  handler: (context: LicenseRouteContext) => Promise<Response>
): Promise<Response> {
  try {
    const actor = await requireAuth()
    return await handler({ actor })
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.status)
    }

    return jsonError('License operation failed', 500)
  }
}

export async function requireOwnedScriptById(scriptId: unknown, ownerId: string) {
  if (typeof scriptId !== 'string' || scriptId.trim().length === 0) {
    return null
  }

  return findScriptByIdForOwner(scriptId.trim(), ownerId)
}

export async function requireOwnedLicenseById(licenseId: string, ownerId: string) {
  return getOwnedLicense(licenseId, ownerId)
}

export function serializeLicense(license: LicenseRow) {
  return {
    id: license.id,
    status: license.status,
    max_assignments: license.max_assignments,
    activation_count: license.activation_count,
    delivery_count: license.delivery_count,
    expires_at: license.expires_at,
    created_at: license.created_at,
  }
}

export function serializeAssignment(assignment: LicenseAssignmentRow) {
  return {
    id: assignment.id,
    license_id: assignment.license_id,
    customer_identifier_hash: assignment.customer_identifier_hash,
    display_name: assignment.display_name,
    status: assignment.status,
    created_at: assignment.created_at,
    updated_at: assignment.updated_at,
  }
}

export function parseCreateAssignmentBody(body: Record<string, unknown>): {
  customer_identifier: string
  display_name: string | null
} | null {
  const customerIdentifier = body.customer_identifier
  if (typeof customerIdentifier !== 'string' || customerIdentifier.trim().length === 0) {
    return null
  }

  const displayName = body.display_name
  return {
    customer_identifier: customerIdentifier.trim(),
    display_name: typeof displayName === 'string' && displayName.trim().length > 0
      ? displayName.trim()
      : null,
  }
}
