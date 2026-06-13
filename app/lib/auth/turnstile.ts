import { getTurnstileSecretKey } from '@/app/config/env'

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const TURNSTILE_ACTION = 'login'

type TurnstileSiteVerifyResponse = {
  success?: boolean
  action?: string
}

export type TurnstileResult =
  | { success: true }
  | { success: false; message: string }

export async function verifyTurnstileToken(token: FormDataEntryValue | null): Promise<TurnstileResult> {
  if (typeof token !== 'string' || token.trim().length === 0) {
    return { success: false, message: 'Security verification required' }
  }

  const secret = getTurnstileSecretKey()
  if (!secret) {
    return { success: false, message: 'Security verification unavailable' }
  }

  const body = new FormData()
  body.set('secret', secret)
  body.set('response', token.trim())

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body,
    })

    if (!response.ok) {
      return { success: false, message: 'Security verification failed' }
    }

    const result = await response.json() as TurnstileSiteVerifyResponse
    if (!result.success || result.action !== TURNSTILE_ACTION) {
      return { success: false, message: 'Security verification failed' }
    }

    return { success: true }
  } catch {
    return { success: false, message: 'Security verification failed' }
  }
}
