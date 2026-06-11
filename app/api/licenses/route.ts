import { NextRequest, NextResponse } from 'next/server'
import {
  jsonError,
  requireOwnedScriptById,
  serializeLicense,
  withLicenseAuth,
} from '@/app/api/licenses/license-api'
import { createLicense, getLicensesForScript } from '@/app/lib/services/license-service'

export async function GET(req: NextRequest) {
  return withLicenseAuth(async ({ actor }) => {
    const scriptId = new URL(req.url).searchParams.get('script_id')
    const script = await requireOwnedScriptById(scriptId, actor.id)
    if (!script) return jsonError('Script not found', 404)

    const licenses = await getLicensesForScript(script.id)
    return NextResponse.json({
      success: true,
      licenses: licenses.map(serializeLicense),
    })
  })
}

export async function POST(req: NextRequest) {
  return withLicenseAuth(async ({ actor }) => {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const script = await requireOwnedScriptById(body.script_id, actor.id)
    if (!script) return jsonError('Script not found', 404)

    const maxAssignments = typeof body.max_assignments === 'number'
      && Number.isInteger(body.max_assignments)
      && body.max_assignments > 0
      ? body.max_assignments
      : undefined
    const expiresAt = typeof body.expires_at === 'string' || body.expires_at === null
      ? body.expires_at
      : null

    const result = await createLicense({
      script_id: script.id,
      creator_id: actor.id,
      max_assignments: maxAssignments,
      expires_at: expiresAt,
    })

    return NextResponse.json({ success: true, license: result.raw_key }, { status: 201 })
  })
}
