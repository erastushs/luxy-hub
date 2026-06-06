import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'
import { generateKey } from '@/app/lib/key-generator'
import { checkRateLimit, getClientIP } from '@/app/lib/rate-limiter'
import { logEvent } from '@/app/lib/logger'

export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req)

  try {
    const rateLimit = await checkRateLimit(clientIP, 'GENERATE')

    if (!rateLimit.allowed) {
      await logEvent({ event: 'RATE_LIMITED', ip: clientIP, message: 'generate-key rate limit exceeded' })

      return NextResponse.json(
        { success: false, message: 'Too many keys generated. Try again tomorrow.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
      )
    }

    let key
    let exists = true

    while (exists) {
      key = generateKey()

      const { data } = await supabase.from('keys').select('id').eq('key', key).maybeSingle()

      exists = !!data
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 1)

    const { error } = await supabase.from('keys').insert({
      key,
      expires_at: expiresAt.toISOString(),
    })

    if (error) {
      throw error
    }

    await logEvent({ event: 'KEY_GENERATED', ip: clientIP, key, message: 'Key generated via generate-key API' })

    return NextResponse.json({
      success: true,
      key,
      expires_at: expiresAt,
    })
  } catch (error) {
    console.error('generate-key error:', error)

    return NextResponse.json(
      { success: false, message: 'Failed to generate key' },
      { status: 500 },
    )
  }
}
