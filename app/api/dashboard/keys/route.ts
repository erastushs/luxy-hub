import { NextRequest, NextResponse } from 'next/server'
import { AuthError, requireAuth } from '@/app/lib/auth/session-auth'
import { listDashboardKeys } from '@/app/lib/services/key-service'
import { issuePaidKey, PaidKeyValidationError } from '@/app/lib/services/paid-key-service'

export async function GET(req: NextRequest) {
  try {
    await requireAuth()

    const search = new URL(req.url).searchParams.get('search')
    const result = await listDashboardKeys(search)

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.status)
    }

    return jsonError('Failed to list keys', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth()

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const duration = body.duration
    const name = typeof body.name === 'string' ? body.name : ''
    const description = typeof body.description === 'string' ? body.description : null

    if (duration !== 'weekly' && duration !== 'monthly' && duration !== 'custom') {
      return jsonError('Invalid key duration', 400)
    }

    const result = await issuePaidKey(
      duration === 'custom'
        ? { duration, expiresAt: typeof body.expires_at === 'string' ? body.expires_at : '', maxDevices: normalizeMaxDevices(body.maxDevices), name, description }
        : { duration, name, description }
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

function normalizeMaxDevices(value: unknown): number | null {
  if (value === null || typeof value === 'undefined') return null
  return typeof value === 'number' ? value : Number.NaN
}
