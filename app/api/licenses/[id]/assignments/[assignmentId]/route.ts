import { NextRequest, NextResponse } from 'next/server'
import {
  jsonError,
  requireOwnedLicenseById,
  serializeAssignment,
  withLicenseAuth,
} from '@/app/api/licenses/license-api'
import { getAssignments, removeAssignment } from '@/app/lib/services/license-service'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  return withLicenseAuth(async ({ actor }) => {
    const { id, assignmentId } = await params
    const license = await requireOwnedLicenseById(id, actor.id)
    if (!license) return jsonError('License not found', 404)

    const assignments = await getAssignments(license.id)
    if (!assignments.some((assignment) => assignment.id === assignmentId)) {
      return jsonError('Assignment not found', 404)
    }

    const removed = await removeAssignment(assignmentId)
    if (!removed) return jsonError('Assignment not found', 404)

    return NextResponse.json({ success: true, assignment: serializeAssignment(removed) })
  })
}
