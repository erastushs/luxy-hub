import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/app/lib/rate-limiter'
import { requireAuth, AuthError } from '@/app/lib/auth/session-auth'
import { listVersions } from '@/app/lib/services/script-service'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const clientIP = getClientIP(req)

  try {
    const actor = await requireAuth()
    const rateLimit = await checkRateLimit(clientIP, 'DASHBOARD_VERSIONS_LIST')

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const { slug } = await params
    const url = new URL(req.url)
    const limit = url.searchParams.get('limit')
    const offset = url.searchParams.get('offset')

    const result = await listVersions(actor.id, slug, limit, offset)

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      )
    }

    return NextResponse.json({
      success: true,
      versions: result.versions,
      total: result.total,
      limit: typeof limit === 'string' && limit ? parseInt(limit, 10) || 20 : 20,
      offset: typeof offset === 'string' && offset ? parseInt(offset, 10) || 0 : 0,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      )
    }

    return NextResponse.json(
      { success: false, message: 'Failed to list versions' },
      { status: 500 }
    )
  }
}
