import { NextRequest, NextResponse } from 'next/server'
import {
  jsonError,
  requireOwnedLicenseById,
  serializeLicense,
  withLicenseAuth,
} from '@/app/api/licenses/license-api'
import { disableLicense } from '@/app/lib/services/license-service'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withLicenseAuth(async ({ actor }) => {
    const { id } = await params
    const license = await requireOwnedLicenseById(id, actor.id)
    if (!license) return jsonError('License not found', 404)

    const updated = await disableLicense(license.id)
    if (!updated) return jsonError('License not found', 404)

    return NextResponse.json({ success: true, license: serializeLicense(updated) })
  })
}
