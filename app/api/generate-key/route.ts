import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/app/lib/rate-limiter'
import { logEvent } from '@/app/lib/logger'
import { issueProviderKey } from '@/app/lib/services/provider-key-issuance-service'
import { isValidToken } from '@/app/lib/validators'

export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req)

  try {
    const rateLimit = await checkRateLimit(clientIP, 'GENERATE')

    if (!rateLimit.allowed) {
      await logEvent({
        event: 'RATE_LIMITED',
        ip: clientIP,
        message: 'generate-key rate limit exceeded',
      })

      return NextResponse.json(
        { success: false, message: 'Too many keys generated. Try again tomorrow.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const body = await req.json()
    const { token } = body || {}

    if (!isValidToken(token)) {
      return NextResponse.json(
        { success: false, message: 'Work.ink verification token required' },
        { status: 400 }
      )
    }

    const issuance = await issueProviderKey({ providerKey: 'workink', token, clientIP })

    if (!issuance.success) {
      return NextResponse.json(
        { success: false, message: issuance.message },
        { status: 403 }
      )
    }

    await logEvent({
      event: 'KEY_GENERATED',
      ip: clientIP,
      key: issuance.key,
      message: 'Key generated via generate-key API',
    })

    return NextResponse.json({
      success: true,
      key: issuance.key,
      expires_at: issuance.expires_at,
    })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Failed to generate key' },
      { status: 500 }
    )
  }
}
