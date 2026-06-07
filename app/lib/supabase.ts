import { cookies } from 'next/headers'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!serviceRoleKey) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required in production')
  }
  console.warn('SUPABASE_SERVICE_ROLE_KEY not set — RLS will block all queries')
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

type AuthenticatedSupabaseClient = SupabaseClient

function getAccessTokenFromCookieStore(cookieStore: Awaited<ReturnType<typeof cookies>>): string | null {
  const authCookie = cookieStore
    .getAll()
    .find((cookie) => cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token'))

  if (!authCookie?.value) {
    return null
  }

  try {
    const parsed = JSON.parse(authCookie.value) as { access_token?: unknown }
    return typeof parsed.access_token === 'string' ? parsed.access_token : null
  } catch {
    return null
  }
}

export async function createSupabaseServerClient(): Promise<AuthenticatedSupabaseClient> {
  const cookieStore = await cookies()
  const accessToken = getAccessTokenFromCookieStore(cookieStore)

  return createClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      global: {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}
