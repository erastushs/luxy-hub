import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/app/lib/rate-limiter'
import { requireAuth, AuthError } from '@/app/lib/auth/session-auth'
import { getVersionDetail } from '@/app/lib/services/script-service'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; versionId: string }> }
) {
  const clientIP = getClientIP(req)

  try {
    const actor = await requireAuth()
    const rateLimit = await checkRateLimit(clientIP, 'DASHBOARD_VERSIONS_GET')

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const { slug, versionId } = await params
    const result = await getVersionDetail(actor.id, slug, versionId)

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      )
    }

    return NextResponse.json({ success: true, version: result.version })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      )
    }

    return NextResponse.json(
      { success: false, message: 'Failed to fetch version' },
      { status: 500 }
    )
  }
}
