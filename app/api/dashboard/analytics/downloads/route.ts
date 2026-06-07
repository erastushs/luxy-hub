import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/app/lib/rate-limiter'
import { requireAuth, AuthError } from '@/app/lib/auth/session-auth'
import { getDownloadTrends } from '@/app/lib/services/analytics-service'

export async function GET(req: NextRequest) {
  const clientIP = getClientIP(req)

  try {
    const actor = await requireAuth()
    const rateLimit = await checkRateLimit(clientIP, 'DASHBOARD_ANALYTICS_DOWNLOADS')

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const url = new URL(req.url)
    const range = url.searchParams.get('range')
    const slug = url.searchParams.get('slug')

    const result = await getDownloadTrends(actor.id, range, slug)

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      )
    }

    return NextResponse.json({ success: true, trends: result.trends })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      )
    }

    return NextResponse.json(
      { success: false, message: 'Failed to fetch download trends' },
      { status: 500 }
    )
  }
}
