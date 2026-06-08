import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/app/lib/rate-limiter'
import { consumeDeliverySession } from '@/app/lib/services/delivery-session-service'

export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req)

  try {
    const rateLimit = await checkRateLimit(clientIP, 'DELIVERY_FETCH')
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter), 'Cache-Control': 'no-store' } }
      )
    }

    const body = await req.json().catch(() => null)
    const result = await consumeDeliverySession(body?.session_token)

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    return NextResponse.json(
      {
        runtime_payload: result.runtime_payload,
        build_version: result.build_version,
        version_id: result.version_id,
        runtime_format_version: result.runtime_format_version,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid delivery session' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
