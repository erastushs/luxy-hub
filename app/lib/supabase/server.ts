import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getPublicSupabaseAnonKey, getPublicSupabaseUrl } from '@/app/config/env'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    getPublicSupabaseUrl(),
    getPublicSupabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // cookies() cannot be set in a Server Component — this is fine,
            // the middleware handles cookie refresh on the response path
          }
        },
      },
    }
  )
}
