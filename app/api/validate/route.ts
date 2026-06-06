import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'
import { isValidKeyFormat } from '@/app/lib/validators'
import { checkRateLimit, getClientIP } from '@/app/lib/rate-limiter'
import { logEvent } from '@/app/lib/logger'

export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req)

  try {
    const rateLimit = await checkRateLimit(clientIP, 'VALIDATE')

    if (!rateLimit.allowed) {
      await logEvent({ event: 'RATE_LIMITED', ip: clientIP, message: 'validate rate limit exceeded' })

      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
      )
    }

    const { key } = await req.json()

    if (!key) {
      return NextResponse.json(
        { success: false, message: 'Key is required' },
        { status: 400 },
      )
    }

    if (!isValidKeyFormat(key)) {
      await logEvent({ event: 'VALIDATE_FAILED', ip: clientIP, key, message: 'Invalid key format' })

      return NextResponse.json(
        { success: false, message: 'Invalid key format' },
        { status: 400 },
      )
    }

    const { data, error } = await supabase.from('keys').select('*').eq('key', key).single()

    if (error || !data) {
      await logEvent({ event: 'VALIDATE_FAILED', ip: clientIP, key, message: 'Key not found' })

      return NextResponse.json(
        { success: false, message: 'Invalid key' },
        { status: 404 },
      )
    }

    if (!data.is_active) {
      await logEvent({ event: 'VALIDATE_FAILED', ip: clientIP, key, message: 'Key disabled' })

      return NextResponse.json(
        { success: false, message: 'Key disabled' },
        { status: 403 },
      )
    }

    if (new Date(data.expires_at) < new Date()) {
      await logEvent({ event: 'VALIDATE_FAILED', ip: clientIP, key, message: 'Key expired' })

      return NextResponse.json(
        { success: false, message: 'Key expired' },
        { status: 403 },
      )
    }

    await logEvent({ event: 'VALIDATE_SUCCESS', ip: clientIP, key, message: 'Key validated' })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 },
    )
  }
}
