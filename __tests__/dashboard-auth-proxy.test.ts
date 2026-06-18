import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import {
  AUTH_USER_AVATAR_URL_HEADER,
  AUTH_USER_DISPLAY_NAME_HEADER,
  AUTH_USER_EMAIL_HEADER,
  AUTH_USER_ID_HEADER,
} from '@/app/lib/auth/request-auth-headers'
import { updateSession } from '@/app/lib/supabase/proxy'

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}))

type CookieAdapter = {
  getAll: () => unknown[]
  setAll: (cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => void
}

const mockedCreateServerClient = vi.mocked(createServerClient)
const getUser = vi.fn()
let cookieAdapter: CookieAdapter | null = null

function request(pathname: string, headers?: HeadersInit): NextRequest {
  return new NextRequest(`https://luxy.example${pathname}`, { headers })
}

function authUser(id = 'user-a') {
  return {
    id,
    email: `${id}@example.test`,
    user_metadata: {
      display_name: `Creator ${id}`,
      avatar_url: `https://cdn.example.test/${id}.png`,
    },
  }
}

function middlewareRequestHeader(header: string): string {
  return `x-middleware-request-${header}`
}

function expectNoRawServerFailure(response: Response) {
  expect(response.status).not.toBe(500)
  expect(response.status).not.toBe(502)
}

describe('dashboard auth proxy regression', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    cookieAdapter = null
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.example.test'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'

    mockedCreateServerClient.mockImplementation((_url, _key, options) => {
      cookieAdapter = options.cookies as CookieAdapter
      return {
        auth: { getUser },
      } as ReturnType<typeof createServerClient>
    })
  })

  it('redirects unauthenticated dashboard requests to login without SSR crash', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })

    const response = await updateSession(request('/dashboard'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://luxy.example/login')
    expectNoRawServerFailure(response)
    expect(getUser).toHaveBeenCalledTimes(1)
  })

  it('loads authenticated dashboard requests and forwards validated request auth', async () => {
    getUser.mockResolvedValue({ data: { user: authUser('user-a') }, error: null })

    const response = await updateSession(request('/dashboard'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get(middlewareRequestHeader(AUTH_USER_ID_HEADER))).toBe('user-a')
    expect(response.headers.get(middlewareRequestHeader(AUTH_USER_EMAIL_HEADER))).toBe('user-a%40example.test')
    expect(response.headers.get(middlewareRequestHeader(AUTH_USER_DISPLAY_NAME_HEADER))).toBe('Creator%20user-a')
    expect(response.headers.get(middlewareRequestHeader(AUTH_USER_AVATAR_URL_HEADER))).toBe('https%3A%2F%2Fcdn.example.test%2Fuser-a.png')
    expect(getUser).toHaveBeenCalledTimes(1)
  })

  it('ignores client-supplied internal auth headers and replaces them with proxy-validated identity', async () => {
    getUser.mockResolvedValue({ data: { user: authUser('real-user') }, error: null })

    const response = await updateSession(request('/dashboard', {
      [AUTH_USER_ID_HEADER]: 'spoofed-user',
      [AUTH_USER_EMAIL_HEADER]: 'attacker@example.test',
    }))

    expect(response.headers.get(middlewareRequestHeader(AUTH_USER_ID_HEADER))).toBe('real-user')
    expect(response.headers.get(middlewareRequestHeader(AUTH_USER_EMAIL_HEADER))).toBe('real-user%40example.test')
    expect(response.headers.get(middlewareRequestHeader(AUTH_USER_ID_HEADER))).not.toBe('spoofed-user')
  })

  it('does not trust spoofed headers when Supabase does not validate a user', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })

    const response = await updateSession(request('/dashboard', {
      [AUTH_USER_ID_HEADER]: 'spoofed-user',
      [AUTH_USER_EMAIL_HEADER]: 'attacker@example.test',
    }))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://luxy.example/login')
    expect(response.headers.get(middlewareRequestHeader(AUTH_USER_ID_HEADER))).toBeNull()
    expectNoRawServerFailure(response)
  })

  it('preserves refreshed cookies and loads dashboard after access-token refresh', async () => {
    getUser.mockImplementation(async () => {
      cookieAdapter?.setAll([
        {
          name: 'sb-access-token',
          value: 'new-access-token',
          options: { path: '/', httpOnly: true },
        },
        {
          name: 'sb-refresh-token',
          value: 'new-refresh-token',
          options: { path: '/', httpOnly: true },
        },
      ])

      return { data: { user: authUser('refreshed-user') }, error: null }
    })

    const response = await updateSession(request('/dashboard'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(response.cookies.get('sb-access-token')?.value).toBe('new-access-token')
    expect(response.cookies.get('sb-refresh-token')?.value).toBe('new-refresh-token')
    expect(response.headers.get(middlewareRequestHeader(AUTH_USER_ID_HEADER))).toBe('refreshed-user')
    expect(getUser).toHaveBeenCalledTimes(1)
  })

  it('redirects expired refresh-token sessions without raw SSR failure', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthSessionMissingError', message: 'session missing' },
    })

    const response = await updateSession(request('/dashboard'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://luxy.example/login')
    expectNoRawServerFailure(response)
    expect(getUser).toHaveBeenCalledTimes(1)
  })

  it('turns invalid auth sessions into controlled redirects and logs unexpected auth failures', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthApiError', status: 401, message: 'invalid token' },
    })

    const response = await updateSession(request('/dashboard'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://luxy.example/login')
    expectNoRawServerFailure(response)
    expect(errorSpy).toHaveBeenCalledWith(
      'Supabase auth validation failed in proxy',
      expect.objectContaining({ name: 'AuthApiError' })
    )

    errorSpy.mockRestore()
  })

  it('logs unexpected auth transport failures without exposing a raw 500/502', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const transportError = new Error('network unavailable: secret-token-123')
    getUser.mockRejectedValue(transportError)

    const response = await updateSession(request('/dashboard'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://luxy.example/login')
    expectNoRawServerFailure(response)
    expect(errorSpy).toHaveBeenCalledWith('Unexpected Supabase auth transport failure in proxy', transportError)

    errorSpy.mockRestore()
  })

  it.each([
    '/dashboard',
    '/dashboard/scripts',
    '/dashboard/keys',
    '/dashboard/profile',
    '/dashboard/licenses',
    '/dashboard/licenses/analytics',
    '/dashboard/analytics',
    '/dashboard/versions',
  ])('protects %s for authenticated and unauthenticated direct requests', async (route) => {
    getUser.mockResolvedValueOnce({ data: { user: authUser('route-user') }, error: null })
    const authenticated = await updateSession(request(route))

    expect(authenticated.status).toBe(200)
    expect(authenticated.headers.get(middlewareRequestHeader(AUTH_USER_ID_HEADER))).toBe('route-user')

    getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    const unauthenticated = await updateSession(request(route))

    expect(unauthenticated.status).toBe(307)
    expect(unauthenticated.headers.get('location')).toBe('https://luxy.example/login')
    expectNoRawServerFailure(unauthenticated)
  })

  it.each([
    ['browser refresh', {}],
    ['hard refresh', { 'cache-control': 'no-cache' }],
    ['client navigation', { 'next-router-prefetch': '1' }],
    ['back/forward navigation', { 'sec-fetch-mode': 'navigate' }],
  ])('keeps dashboard navigation stable during %s', async (_label, headers) => {
    getUser.mockResolvedValue({ data: { user: authUser('nav-user') }, error: null })

    const response = await updateSession(request('/dashboard', headers))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get(middlewareRequestHeader(AUTH_USER_ID_HEADER))).toBe('nav-user')
    expectNoRawServerFailure(response)
  })

  it('handles multi-tab logout by redirecting the refreshed logged-out tab without SSR crash', async () => {
    getUser
      .mockResolvedValueOnce({ data: { user: authUser('tab-user') }, error: null })
      .mockResolvedValueOnce({ data: { user: authUser('tab-user') }, error: null })
      .mockResolvedValueOnce({ data: { user: null }, error: null })

    const tabA = await updateSession(request('/dashboard'))
    const tabB = await updateSession(request('/dashboard'))
    const tabBAfterLogout = await updateSession(request('/dashboard'))

    expect(tabA.status).toBe(200)
    expect(tabB.status).toBe(200)
    expect(tabBAfterLogout.status).toBe(307)
    expect(tabBAfterLogout.headers.get('location')).toBe('https://luxy.example/login')
    expectNoRawServerFailure(tabBAfterLogout)
  })
})
