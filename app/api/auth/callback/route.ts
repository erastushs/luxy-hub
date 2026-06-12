import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getPublicSupabaseAnonKey, getPublicSupabaseUrl } from '@/app/config/env'

export function getSafeAuthRedirect(next: string | null, requestUrl: string): URL {
  const requestOrigin = new URL(requestUrl).origin

  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return new URL('/dashboard', requestOrigin)
  }

  return new URL(next, requestOrigin)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'

  if (tokenHash && type) {
    const supabase = createServerClient(
      getPublicSupabaseUrl(),
      getPublicSupabaseAnonKey(),
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            for (const { name, value } of cookiesToSet) {
              request.cookies.set(name, value)
            }
            const response = NextResponse.next({ request })
            for (const { name, value, options } of cookiesToSet) {
              response.cookies.set(name, value, options)
            }
          },
        },
      }
    )

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    })

    if (!error) {
      const redirectTo = getSafeAuthRedirect(next, request.url)
      return NextResponse.redirect(redirectTo)
    }
  }

  const redirectTo = new URL('/login?error=auth_callback_error', request.url)
  return NextResponse.redirect(redirectTo)
}
