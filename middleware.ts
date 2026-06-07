import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const API_MAX_BODY = 64 * 1024

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: response.headers })
    }
  }

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.vercel-insights.com https://*.vercel-analytics.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob: http:",
    "connect-src 'self' https://*.supabase.co https://*.vercel-analytics.com https://*.vercel-insights.com",
    "font-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  )
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  )

  if (request.method === 'POST' && request.nextUrl.pathname.startsWith('/api/')) {
    const contentLength = request.headers.get('content-length')
    if (contentLength) {
      const size = parseInt(contentLength, 10)
      if (!isNaN(size) && size > API_MAX_BODY) {
        return NextResponse.json(
          { success: false, message: 'Payload too large' },
          { status: 413 }
        )
      }
    }
  }

  return response
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
}
