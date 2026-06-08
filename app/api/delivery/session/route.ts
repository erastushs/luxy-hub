import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/app/lib/rate-limiter'
import { createDeliverySession } from '@/app/lib/services/delivery-session-service'

export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req)

  try {
    const rateLimit = await checkRateLimit(clientIP, 'DELIVERY_SESSION')
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter), 'Cache-Control': 'no-store' } }
      )
    }

    const body = await req.json().catch(() => null)
    const result = await createDeliverySession(body?.slug)

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    return NextResponse.json(
      {
        session_token: result.session_token,
        expires_in: result.expires_in,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json(
      { success: false, message: 'Delivery unavailable' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
