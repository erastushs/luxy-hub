import { supabase } from './supabase'
import { generateKey } from './key-generator'
import { logEvent } from './logger'

type VerifyResult = {
  success: boolean
  message: string
  key?: string
  expires_at?: string
  tokenInfo?: unknown
}

export async function verifyWorkinkToken(clientIP: string, token: string): Promise<VerifyResult> {
  if (!token || typeof token !== 'string' || token.trim() === '') {
    return { success: false, message: 'Token required' }
  }

  try {
    const response = await fetch(`https://work.ink/_api/v2/token/isValid/${token}`)

    if (!response.ok) {
      console.error(`Work.ink API returned ${response.status} for token ${token.slice(0, 8)}...`)
    }

    const data = await response.json()

    if (!data.valid) {
      return { success: false, message: 'Invalid token' }
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
      return { success: false, message: 'Token already used' }
    }

    const { error: insertError } = await supabase.from('used_workink_tokens').insert({ token, used_at: new Date().toISOString() })

    if (insertError) {
      return { success: false, message: 'Token already used' }
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

    return {
      success: true,
      key,
      expires_at: expiresAt.toISOString(),
      tokenInfo: data.info,
    }
  } catch (error) {
    console.error('verify-workink error:', error)
    return { success: false, message: 'Internal server error' }
  }
}
