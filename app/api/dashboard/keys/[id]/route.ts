import { NextRequest, NextResponse } from 'next/server'
import { AuthError, requireAuth } from '@/app/lib/auth/session-auth'
import { updateDashboardKeyState } from '@/app/lib/services/key-service'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()

    const { id } = await params
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const key = await updateDashboardKeyState(id, body.is_active)

    if (!key) {
      return jsonError('Key not found', 404)
    }

    return NextResponse.json({ success: true, key })
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.status)
    }

    return jsonError('Failed to update key', 500)
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status })
}
