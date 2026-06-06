import { supabase } from './supabase'

type LogEvent = 'VERIFY_WORKINK_FAILED' | 'KEY_GENERATED' | 'TOKEN_ALREADY_USED' | 'IP_MISMATCH' | 'RATE_LIMITED' | 'VALIDATE_SUCCESS' | 'VALIDATE_FAILED'

type LogData = {
  event: LogEvent
  ip?: string
  token?: string
  key?: string
  message?: string
}

export async function logEvent(data: LogData) {
  const timestamp = new Date().toISOString()

  console.log(`[${timestamp}] [${data.event}]`, {
    ip: data.ip,
    token: data.token ? `${data.token.slice(0, 8)}...` : undefined,
    key: data.key ? `${data.key.slice(0, 8)}...` : undefined,
    message: data.message,
  })

  try {
    supabase.from('verification_logs').insert({
      event: data.event,
      ip: data.ip,
      token_snippet: data.token ? data.token.slice(0, 12) : null,
      key_snippet: data.key ? data.key.slice(0, 12) : null,
      message: data.message,
      created_at: timestamp,
    }).then(
      () => {},
      (err) => console.error('Failed to persist log:', err),
    )
  } catch (error) {
    console.error('Failed to queue log:', error)
  }
}
