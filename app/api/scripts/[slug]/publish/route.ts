import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/app/lib/rate-limiter'
import { verifyAdminAuth } from '@/app/lib/auth/admin-auth'
import { changeVisibility } from '@/app/lib/services/script-service'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!verifyAdminAuth(req)) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
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

    const result = await changeVisibility(slug, visibility)

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      )
    }

    return NextResponse.json({ success: true, script: result.script })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Failed to update visibility' },
      { status: 500 }
    )
  }
}
