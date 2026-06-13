import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/app/lib/rate-limiter'
import { logEvent } from '@/app/lib/logger'
import { validateKey } from '@/app/lib/services/key-service'
import { getFreeKeyFormat } from '@/app/lib/validators'

export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req)

  try {
    const rateLimit = await checkRateLimit(clientIP, 'VALIDATE')

    if (!rateLimit.allowed) {
      await logEvent({
        event: 'RATE_LIMITED',
        ip: clientIP,
        message: 'validate rate limit exceeded',
      })

      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const body = await req.json().catch(() => null)
    const { key } = body || {}
    const keyFormat = getFreeKeyFormat(key)

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const result = await validateKey(key)

    if (!result.valid) {
      await logEvent({
        event: 'VALIDATE_FAILED',
        ip: clientIP,
        message: `${result.message}${keyFormat ? ` (format: ${keyFormat})` : ''}`,
      })

      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      )
    }

    await logEvent({
      event: 'VALIDATE_SUCCESS',
      ip: clientIP,
      message: `Key validated (format: ${keyFormat})`,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    )
  }
}
