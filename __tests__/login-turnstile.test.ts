import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`)
  }),
}))

vi.mock('@/app/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}))

import { createSupabaseServerClient } from '@/app/lib/supabase/server'
import { login } from '@/app/actions/auth'

const mockedCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient)
const mockedFetch = vi.fn()

function formData(params: {
  email?: string
  password?: string
  token?: string
}) {
  const form = new FormData()
  if (params.email !== undefined) form.set('email', params.email)
  if (params.password !== undefined) form.set('password', params.password)
  if (params.token !== undefined) form.set('cf-turnstile-response', params.token)
  return form
}

function siteverifyResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('login Turnstile verification', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal('fetch', mockedFetch)
    process.env.TURNSTILE_SECRET_KEY = 'turnstile-secret'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.TURNSTILE_SECRET_KEY
  })

  it('fails without a Turnstile token before authentication', async () => {
    const result = await login({}, formData({
      email: 'creator@example.com',
      password: 'password',
    }))

    expect(result).toEqual({ error: 'Security verification required' })
    expect(mockedFetch).not.toHaveBeenCalled()
    expect(mockedCreateSupabaseServerClient).not.toHaveBeenCalled()
  })

  it('fails with an invalid Turnstile token before authentication', async () => {
    mockedFetch.mockResolvedValue(siteverifyResponse({ success: false, action: 'login' }))

    const result = await login({}, formData({
      email: 'creator@example.com',
      password: 'password',
      token: 'invalid-token',
    }))

    expect(result).toEqual({ error: 'Security verification failed' })
    expect(mockedCreateSupabaseServerClient).not.toHaveBeenCalled()
  })

  it('fails safely when Cloudflare verification is unavailable', async () => {
    mockedFetch.mockRejectedValue(new Error('network unavailable'))

    const result = await login({}, formData({
      email: 'creator@example.com',
      password: 'password',
      token: 'valid-looking-token',
    }))

    expect(result).toEqual({ error: 'Security verification failed' })
    expect(mockedCreateSupabaseServerClient).not.toHaveBeenCalled()
  })

  it('continues the existing login flow with a valid Turnstile token', async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ error: null })
    mockedFetch.mockResolvedValue(siteverifyResponse({ success: true, action: 'login' }))
    mockedCreateSupabaseServerClient.mockResolvedValue({
      auth: { signInWithPassword },
    } as Awaited<ReturnType<typeof createSupabaseServerClient>>)

    await expect(login({}, formData({
      email: 'creator@example.com',
      password: 'password',
      token: 'valid-token',
    }))).rejects.toThrow('redirect:/dashboard')

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'creator@example.com',
      password: 'password',
    })
  })

  it('preserves authentication errors after valid Turnstile verification', async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    })
    mockedFetch.mockResolvedValue(siteverifyResponse({ success: true, action: 'login' }))
    mockedCreateSupabaseServerClient.mockResolvedValue({
      auth: { signInWithPassword },
    } as Awaited<ReturnType<typeof createSupabaseServerClient>>)

    const result = await login({}, formData({
      email: 'creator@example.com',
      password: 'wrong-password',
      token: 'valid-token',
    }))

    expect(result).toEqual({ error: 'Invalid login credentials' })
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'creator@example.com',
      password: 'wrong-password',
    })
  })
})
