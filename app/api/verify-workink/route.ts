import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/app/lib/rate-limiter'
import { logEvent } from '@/app/lib/logger'
import { verifyWorkinkToken } from '@/app/lib/verify-workink'

export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req)

  try {
    const { token } = await req.json()

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ success: false, message: 'Token required' }, { status: 400 })
    }

    const rateLimit = await checkRateLimit(clientIP, 'VERIFY_WORKINK')

    if (!rateLimit.allowed) {
      await logEvent({ event: 'RATE_LIMITED', ip: clientIP, token, message: 'verify-workink rate limit exceeded' })
      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
      )
    }

    const result = await verifyWorkinkToken(clientIP, token)

    if (!result.success) {
      const statusMap: Record<string, number> = {
        'Token required': 400,
        'Too many requests': 429,
        'Invalid token': 403,
        'Token already used': 403,
        'Internal server error': 500,
      }
      return NextResponse.json(
        { success: false, message: result.message },
        { status: statusMap[result.message] || 500 },
      )
    }

    return NextResponse.json({
      success: true,
      key: result.key,
      expires_at: result.expires_at,
      tokenInfo: result.tokenInfo,
    })
  } catch {
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
