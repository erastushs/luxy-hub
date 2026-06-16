import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/app/lib/rate-limiter'
import { logEvent } from '@/app/lib/logger'
import { issueProviderKey } from '@/app/lib/services/provider-key-issuance-service'
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

    const issuance = await issueProviderKey({ providerKey: 'workink', token, clientIP })

    if (!issuance.success) {
      const statusMap: Record<string, number> = {
        'Token required': 400,
        'Too many requests': 429,
        'Invalid token': 403,
        'Token already used': 403,
        'Internal server error': 500,
      }

      return NextResponse.json(
        { success: false, message: issuance.message },
        { status: statusMap[issuance.message] || 500 }
      )
    }

    await logEvent({
      event: 'KEY_GENERATED',
      ip: clientIP,
      key: issuance.key,
      message: 'Key generated via Work.ink verification',
    })

    return NextResponse.json({
      success: true,
      key: issuance.key,
      expires_at: issuance.expires_at,
      tokenInfo: issuance.verification.tokenInfo,
    })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
