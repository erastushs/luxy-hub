import { NextRequest, NextResponse } from 'next/server'
import {
  jsonError,
  parseCreateAssignmentBody,
  requireOwnedLicenseById,
  serializeAssignment,
  withLicenseAuth,
} from '@/app/api/licenses/license-api'
import { createAssignment, getAssignments } from '@/app/lib/services/license-service'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withLicenseAuth(async ({ actor }) => {
    const { id } = await params
    const license = await requireOwnedLicenseById(id, actor.id)
    if (!license) return jsonError('License not found', 404)

    const assignments = await getAssignments(license.id)
    return NextResponse.json({
      success: true,
      assignments: assignments.map(serializeAssignment),
    })
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withLicenseAuth(async ({ actor }) => {
    const { id } = await params
    const license = await requireOwnedLicenseById(id, actor.id)
    if (!license) return jsonError('License not found', 404)

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const parsed = parseCreateAssignmentBody(body)
    if (!parsed) return jsonError('Customer identifier is required', 400)

    const assignment = await createAssignment({
      license_id: license.id,
      customer_identifier: parsed.customer_identifier,
      display_name: parsed.display_name,
    })

    return NextResponse.json({ success: true, assignment: serializeAssignment(assignment) }, { status: 201 })
  })
}
