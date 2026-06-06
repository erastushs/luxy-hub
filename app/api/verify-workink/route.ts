import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'
import { generateKey } from '@/app/lib/key-generator'
import { checkRateLimit, getClientIP } from '@/app/lib/rate-limiter'
import { logEvent } from '@/app/lib/logger'

export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req)

  try {
    const { token } = await req.json()

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Token required' },
        { status: 400 },
      )
    }

    const rateLimit = await checkRateLimit(clientIP, 'VERIFY_WORKINK')

    if (!rateLimit.allowed) {
      await logEvent({ event: 'RATE_LIMITED', ip: clientIP, token, message: 'verify-workink rate limit exceeded' })

      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
      )
    }

    const response = await fetch(`https://work.ink/_api/v2/token/isValid/${token}`)

    if (!response.ok) {
      console.error(`Work.ink API returned ${response.status} for token ${token.slice(0, 8)}...`)
    }

    const data = await response.json()

    if (!data.valid) {
      await logEvent({ event: 'VERIFY_WORKINK_FAILED', ip: clientIP, token, message: 'Work.ink token invalid' })

      return NextResponse.json(
        { success: false, message: 'Invalid token' },
        { status: 403 },
      )
    }

    if (data.info?.byIp) {
      const workinkIP = data.info.byIp.trim()

      if (workinkIP !== clientIP && clientIP !== '127.0.0.1') {
        console.warn(`IP mismatch: Work.ink=${workinkIP} client=${clientIP} — allowing (soft check)`)

        await logEvent({
          event: 'IP_MISMATCH',
          ip: clientIP,
          token,
          message: `Soft mismatch: Work.ink IP ${workinkIP} vs client IP ${clientIP}`,
        })
      }
    }

    const { data: existingToken } = await supabase
      .from('used_workink_tokens')
      .select('token')
      .eq('token', token)
      .single()

    if (existingToken) {
      await logEvent({ event: 'TOKEN_ALREADY_USED', ip: clientIP, token, message: 'Replay attempt detected' })

      return NextResponse.json(
        { success: false, message: 'Token already used' },
        { status: 403 },
      )
    }

    const { error: insertError } = await supabase.from('used_workink_tokens').insert({ token, used_at: new Date().toISOString() })

    if (insertError) {
      await logEvent({ event: 'TOKEN_ALREADY_USED', ip: clientIP, token, message: 'Replay attempt detected (insert conflict)' })

      return NextResponse.json(
        { success: false, message: 'Token already used' },
        { status: 403 },
      )
    }

    const key = generateKey()

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 1)

    const { error } = await supabase.from('keys').insert({
      key,
      expires_at: expiresAt.toISOString(),
    })

    if (error) {
      throw error
    }

    await logEvent({ event: 'KEY_GENERATED', ip: clientIP, token, key, message: 'Key generated successfully' })

    return NextResponse.json({
      success: true,
      key,
      expires_at: expiresAt.toISOString(),
      tokenInfo: data.info,
    })
  } catch (error) {
    console.error('verify-workink error:', error)

    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 },
    )
  }
}
