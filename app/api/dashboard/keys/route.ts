import { NextRequest, NextResponse } from 'next/server'
import { AuthError, requireAuth } from '@/app/lib/auth/session-auth'
import { issuePaidKey, PaidKeyValidationError } from '@/app/lib/services/paid-key-service'

export async function POST(req: NextRequest) {
  try {
    await requireAuth()

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const duration = body.duration

    if (duration !== 'weekly' && duration !== 'monthly' && duration !== 'custom') {
      return jsonError('Invalid key duration', 400)
    }

    const result = await issuePaidKey(
      duration === 'custom'
        ? { duration, expiresAt: typeof body.expires_at === 'string' ? body.expires_at : '' }
        : { duration }
    )

    return NextResponse.json({ success: true, key: result.key, expires_at: result.expires_at }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.status)
    }

    if (error instanceof PaidKeyValidationError) {
      return jsonError(error.message, 400)
    }

    return jsonError('Failed to issue key', 500)
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status })
}
