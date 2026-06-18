import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  clearRequestAuthHeaders,
  setRequestAuthHeaders,
} from '@/app/lib/auth/request-auth-headers'

export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  const responseCookies: Parameters<NextResponse['cookies']['set']>[] = []
  clearRequestAuthHeaders(requestHeaders)

  let supabaseResponse = createSupabaseResponse(requestHeaders, responseCookies)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          requestHeaders.set('cookie', request.cookies.toString())
          for (const { name, value, options } of cookiesToSet) {
            responseCookies.push([name, value, options])
          }
          supabaseResponse = createSupabaseResponse(requestHeaders, responseCookies)
        },
      },
    }
  )

  let authResult: Awaited<ReturnType<typeof supabase.auth.getUser>> | null = null
  let authTransportError: unknown = null

  try {
    authResult = await supabase.auth.getUser()
  } catch (error) {
    console.error('Unexpected Supabase auth transport failure in proxy', error)
    authTransportError = error
  }

  const user = authResult?.data.user ?? null
  const error = authResult?.error ?? authTransportError

  const isAuthPage = request.nextUrl.pathname.startsWith('/login')
  const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard')
  const isStaticAsset =
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/favicon.ico')

  if (isStaticAsset) {
    return supabaseResponse
  }

  if (user) {
    setRequestAuthHeaders(requestHeaders, {
      id: user.id,
      email: user.email ?? null,
      displayName: extractDisplayName(user.user_metadata),
      avatarUrl: extractAvatarUrl(user.user_metadata),
    })
    supabaseResponse = createSupabaseResponse(requestHeaders, responseCookies)
  } else if (error && !isAuthSessionMissingError(error)) {
    console.error('Supabase auth validation failed in proxy', error)
  }

  if (!user && isDashboardRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return createRedirectResponse(url, responseCookies)
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return createRedirectResponse(url, responseCookies)
  }

  return supabaseResponse
}

function createSupabaseResponse(
  requestHeaders: Headers,
  responseCookies: Parameters<NextResponse['cookies']['set']>[]
) {
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  for (const cookie of responseCookies) {
    response.cookies.set(...cookie)
  }

  return response
}

function createRedirectResponse(
  url: URL,
  responseCookies: Parameters<NextResponse['cookies']['set']>[]
) {
  const response = NextResponse.redirect(url)

  for (const cookie of responseCookies) {
    response.cookies.set(...cookie)
  }

  return response
}

function extractDisplayName(userMetadata: unknown): string | null {
  if (!isRecord(userMetadata)) {
    return null
  }

  const candidate = userMetadata['display_name'] ?? userMetadata['full_name'] ?? userMetadata['name']
  return typeof candidate === 'string' ? candidate : null
}

function extractAvatarUrl(userMetadata: unknown): string | null {
  if (!isRecord(userMetadata)) {
    return null
  }

  const candidate = userMetadata['avatar_url']
  return typeof candidate === 'string' ? candidate : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAuthSessionMissingError(error: unknown): boolean {
  return isRecord(error) && error['name'] === 'AuthSessionMissingError'
}
