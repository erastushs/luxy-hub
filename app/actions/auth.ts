'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/app/lib/supabase/server'
import { verifyTurnstileToken } from '@/app/lib/auth/turnstile'
import {
  checkLoginFailureLimit,
  clearLoginFailures,
  getClientIPFromHeaders,
  recordLoginFailure,
} from '@/app/lib/rate-limiter'

type AuthResult = {
  error?: string
  success?: string
}

export async function login(_prevState: AuthResult, formData: FormData): Promise<AuthResult> {
  const turnstile = await verifyTurnstileToken(formData.get('cf-turnstile-response'))
  if (!turnstile.success) {
    return { error: turnstile.message }
  }

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  const clientIP = getClientIPFromHeaders(await headers())
  const loginLimit = await checkLoginFailureLimit(clientIP, email)
  if (!loginLimit.allowed) {
    return { error: 'Too many login attempts. Please try again in a few minutes.' }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    await recordLoginFailure(clientIP, email)
    return { error: error.message }
  }

  await clearLoginFailures(clientIP, email)
  revalidatePath('/dashboard', 'layout')
  redirect('/dashboard')
}

export async function logout(): Promise<void> {
  const supabase = await createSupabaseServerClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    throw error
  }

  revalidatePath('/', 'layout')
  redirect('/login')
}
