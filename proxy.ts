import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/app/lib/supabase/proxy'

import { MAX_SCRIPT_REQUEST_BODY_BYTES } from '@/app/lib/constants/size-limits'

const API_MAX_BODY = MAX_SCRIPT_REQUEST_BODY_BYTES

export async function proxy(request: NextRequest) {
  if (request.method === 'OPTIONS' && request.nextUrl.pathname.startsWith('/api/')) {
    const response = new NextResponse(null, { status: 204 })
    setCorsHeaders(request, response)
    return response
  }

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

  const response = await updateSession(request)

  if (request.nextUrl.pathname.startsWith('/api/')) {
    setCorsHeaders(request, response)
  }

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.vercel-insights.com https://*.vercel-analytics.com https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob: http:",
    "connect-src 'self' https://*.supabase.co https://*.vercel-analytics.com https://*.vercel-insights.com https://challenges.cloudflare.com",
    "font-src 'self'",
    "frame-src https://challenges.cloudflare.com",
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

  return response
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
}

function setCorsHeaders(request: NextRequest, response: NextResponse) {
  const origin = request.headers.get('origin')
  const allowOrigin = getAllowedCorsOrigin(request, origin)

  if (allowOrigin) {
    response.headers.set('Access-Control-Allow-Origin', allowOrigin)
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function getAllowedCorsOrigin(request: NextRequest, origin: string | null): string | null {
  if (!isSensitiveCorsPath(request.nextUrl.pathname)) {
    return '*'
  }

  if (!origin) {
    return null
  }

  return isTrustedOrigin(request, origin) ? origin : null
}

function isSensitiveCorsPath(pathname: string): boolean {
  if (pathname === '/api/validate' || pathname === '/api/cleanup') {
    return true
  }

  if (pathname.startsWith('/api/admin/')) {
    return true
  }

  return pathname.startsWith('/api/scripts/') && pathname.endsWith('/raw')
}

function isTrustedOrigin(request: NextRequest, origin: string): boolean {
  try {
    const parsedOrigin = new URL(origin)
    const requestOrigin = request.nextUrl.origin
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

    return origin === requestOrigin || (siteUrl ? parsedOrigin.origin === new URL(siteUrl).origin : false)
  } catch {
    return false
  }
}
