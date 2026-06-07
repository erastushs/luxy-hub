import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/app/lib/rate-limiter'
import { requireAuth, AuthError } from '@/app/lib/auth/session-auth'
import { changeVisibility } from '@/app/lib/services/script-service'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const actor = await requireAuth()
    const clientIP = getClientIP(req)
    const rateLimit = await checkRateLimit(clientIP, 'SCRIPT_UPDATE')

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const { slug } = await params
    const body = await req.json().catch(() => ({}))
    const { visibility } = body || {}

    const result = await changeVisibility(slug, actor.id, visibility)

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      )
    }

    return NextResponse.json({ success: true, script: result.script })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      )
    }

    return NextResponse.json(
      { success: false, message: 'Failed to update visibility' },
      { status: 500 }
    )
  }
}
