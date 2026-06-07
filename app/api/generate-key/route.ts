import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/app/lib/rate-limiter'
import { logEvent } from '@/app/lib/logger'
import { verifyWorkinkToken } from '@/app/lib/services/workink-service'
import { createKey } from '@/app/lib/services/key-service'
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

    const workinkResult = await verifyWorkinkToken(token, clientIP)

    if (!workinkResult.success) {
      return NextResponse.json(
        { success: false, message: workinkResult.message },
        { status: 403 }
      )
    }

    const key = await createKey()

    await logEvent({
      event: 'KEY_GENERATED',
      ip: clientIP,
      key,
      message: 'Key generated via generate-key API',
    })

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 1)

    return NextResponse.json({
      success: true,
      key,
      expires_at: expiresAt.toISOString(),
    })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Failed to generate key' },
      { status: 500 }
    )
  }
}
