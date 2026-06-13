import { supabaseAdmin } from './supabase'
import { isProduction } from '@/app/config/env'

type LogEvent =
  | 'VERIFY_WORKINK_FAILED'
  | 'KEY_GENERATED'
  | 'TOKEN_ALREADY_USED'
  | 'IP_MISMATCH'
  | 'RATE_LIMITED'
  | 'VALIDATE_SUCCESS'
  | 'VALIDATE_FAILED'
  | 'KEY_USED'

type LogData = {
  event: LogEvent
  ip?: string
  token?: string
  key?: string
  message?: string
}

export async function logEvent(data: LogData) {
  const timestamp = new Date().toISOString()

  if (!isProduction) {
    console.log(`[${timestamp}] [${data.event}] ${data.message || ''}`)
  }

  try {
    supabaseAdmin
      .from('verification_logs')
      .insert({
        event: data.event,
        ip: data.ip,
        token_snippet: data.token ? data.token.slice(0, 12) : null,
        key_snippet: data.key ? data.key.slice(0, 12) : null,
        message: data.message,
        created_at: timestamp,
      })
      .then(
        () => {},
        () => {
          if (!isProduction) {
            console.error('Failed to persist log')
          }
        }
      )
  } catch {
    if (!isProduction) {
      console.error('Failed to queue log')
    }
  }
}
