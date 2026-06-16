'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/app/lib/auth/session-auth'
import { findScriptByIdForOwner } from '@/app/lib/repositories/script-repository'
import {
  createAssignment,
  createLicense,
  disableLicense,
  enableLicense,
  getAssignments,
  getOwnedLicense,
  removeAssignment,
  revokeLicense,
} from '@/app/lib/services/license-service'
import type { LicenseAssignmentRow, LicenseRow } from '@/app/lib/repositories/license-repository'

type ActionResult<T = Record<string, never>> =
  | ({ success: true } & T)
  | { success: false; message: string; status: number }

function serializeLicense(license: LicenseRow) {
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

function serializeAssignment(assignment: LicenseAssignmentRow) {
  return {
    id: assignment.id,
    display_name: assignment.display_name,
    created_at: assignment.created_at,
  }
}

export async function createLicenseAction(input: {
  scriptId: string
  maxAssignments: number
  expiresAt: string | null
}): Promise<ActionResult<{ license: string }>> {
  const user = await requireAuth()
  const script = await findScriptByIdForOwner(input.scriptId, user.id)
  if (!script) return { success: false, message: 'Script not found', status: 404 }

  const result = await createLicense({
    script_id: script.id,
    creator_id: user.id,
    max_assignments: Number.isInteger(input.maxAssignments) && input.maxAssignments > 0 ? input.maxAssignments : undefined,
    expires_at: input.expiresAt,
  })

  revalidatePath('/dashboard/licenses')
  return { success: true, license: result.raw_key }
}

export async function updateLicenseStatusAction(
  id: string,
  action: 'disable' | 'enable' | 'revoke'
): Promise<ActionResult<{ license: ReturnType<typeof serializeLicense> }>> {
  const user = await requireAuth()
  const license = await getOwnedLicense(id, user.id)
  if (!license) return { success: false, message: 'License not found', status: 404 }

  const updated = action === 'disable'
    ? await disableLicense(license.id)
    : action === 'enable'
      ? await enableLicense(license.id)
      : await revokeLicense(license.id)

  if (!updated) return { success: false, message: 'License not found', status: 404 }

  revalidatePath('/dashboard/licenses')
  return { success: true, license: serializeLicense(updated) }
}

export async function createLicenseAssignmentAction(input: {
  licenseId: string
  customerIdentifier: string
  displayName: string | null
}): Promise<ActionResult<{ assignment: ReturnType<typeof serializeAssignment> }>> {
  const user = await requireAuth()
  const license = await getOwnedLicense(input.licenseId, user.id)
  if (!license) return { success: false, message: 'License not found', status: 404 }

  try {
    const assignment = await createAssignment({
      license_id: license.id,
      customer_identifier: input.customerIdentifier,
      display_name: input.displayName,
    })
    revalidatePath('/dashboard/licenses')
    return { success: true, assignment: serializeAssignment(assignment) }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create assignment',
      status: 400,
    }
  }
}

export async function removeLicenseAssignmentAction(
  licenseId: string,
  assignmentId: string
): Promise<ActionResult<{ assignment: ReturnType<typeof serializeAssignment> }>> {
  const user = await requireAuth()
  const license = await getOwnedLicense(licenseId, user.id)
  if (!license) return { success: false, message: 'License not found', status: 404 }

  const assignments = await getAssignments(license.id)
  if (!assignments.some((assignment) => assignment.id === assignmentId)) {
    return { success: false, message: 'Assignment not found', status: 404 }
  }

  const removed = await removeAssignment(assignmentId)
  if (!removed) return { success: false, message: 'Assignment not found', status: 404 }

  revalidatePath('/dashboard/licenses')
  return { success: true, assignment: serializeAssignment(removed) }
}
