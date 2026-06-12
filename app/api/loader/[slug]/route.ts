import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/app/lib/rate-limiter'
import { createLoaderBootstrapLua } from '@/app/lib/loader/loader-bootstrap'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const clientIP = getClientIP(req)

  try {
    const rateLimit = await checkRateLimit(clientIP, 'LOADER_BOOTSTRAP')
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter), 'Cache-Control': 'no-store' } }
      )
    }

    const { slug } = await params
    const url = new URL(req.url)
    const bootstrap = createLoaderBootstrapLua({
      baseUrl: url.origin,
      slug,
      key: url.searchParams.get('key'),
      licenseKey: url.searchParams.get('license_key') ?? url.searchParams.get('license'),
      customerIdentifier: url.searchParams.get('customer_identifier'),
    })

    return new NextResponse(bootstrap, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Loader unavailable' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
