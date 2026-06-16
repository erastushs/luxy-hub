import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/app/lib/rate-limiter'
import { verifyAdminAuth } from '@/app/lib/auth/admin-auth'
import { getRawContent } from '@/app/lib/services/script-service'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const clientIP = getClientIP(req)

  try {
    const rateLimit = await checkRateLimit(clientIP, 'SCRIPT_RAW')

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const { slug } = await params
    const isAuthenticated = verifyAdminAuth(req)
    const url = new URL(req.url)

    const result = await getRawContent(slug, {
      isAuthenticated,
      key: url.searchParams.get('key'),
      license: url.searchParams.get('license') ?? url.searchParams.get('license_key'),
      customerIdentifier: url.searchParams.get('customer_identifier'),
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      )
    }

    return new NextResponse(result.content, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': isAuthenticated ? 'no-store' : 'public, max-age=300, s-maxage=3600',
      },
    })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Failed to fetch script content' },
      { status: 500 }
    )
  }
}
