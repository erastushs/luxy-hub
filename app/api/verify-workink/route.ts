import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/app/lib/rate-limiter'
import { logEvent } from '@/app/lib/logger'
import { verifyWorkinkToken } from '@/app/lib/services/workink-service'
import { createKey } from '@/app/lib/services/key-service'
import { isValidToken } from '@/app/lib/validators'

export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req)

  try {
    const rateLimit = await checkRateLimit(clientIP, 'VERIFY_WORKINK')

    if (!rateLimit.allowed) {
      await logEvent({
        event: 'RATE_LIMITED',
        ip: clientIP,
        message: 'verify-workink rate limit exceeded',
      })

      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const { token } = await req.json()

    if (!isValidToken(token)) {
      return NextResponse.json(
        { success: false, message: 'Token required' },
        { status: 400 }
      )
    }

    const workinkResult = await verifyWorkinkToken(token, clientIP)

    if (!workinkResult.success) {
      const statusMap: Record<string, number> = {
        'Token required': 400,
        'Too many requests': 429,
        'Invalid token': 403,
        'Token already used': 403,
        'Internal server error': 500,
      }

      return NextResponse.json(
        { success: false, message: workinkResult.message },
        { status: statusMap[workinkResult.message] || 500 }
      )
    }

    const key = await createKey()

    await logEvent({
      event: 'KEY_GENERATED',
      ip: clientIP,
      key,
      message: 'Key generated via Work.ink verification',
    })

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 1)

    return NextResponse.json({
      success: true,
      key,
      expires_at: expiresAt.toISOString(),
      tokenInfo: workinkResult.tokenInfo,
    })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
