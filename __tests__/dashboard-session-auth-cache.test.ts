import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setRequestAuthHeaders } from '@/app/lib/auth/request-auth-headers'

type MockProfile = {
  id: string
  role: 'creator' | 'admin'
  display_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

const getUser = vi.fn()
const getProfile = vi.fn()
const ensureProfile = vi.fn()
const headersMock = vi.fn()
const createSupabaseServerClient = vi.fn()

function profile(id: string, role: 'creator' | 'admin' = 'creator'): MockProfile {
  return {
    id,
    role,
    display_name: `Creator ${id}`,
    avatar_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

async function loadSessionAuth(currentHeaders = new Headers()) {
  vi.resetModules()
  getUser.mockReset()
  getProfile.mockReset()
  ensureProfile.mockReset()
  headersMock.mockReset()
  createSupabaseServerClient.mockReset()

  headersMock.mockResolvedValue(currentHeaders)
  createSupabaseServerClient.mockResolvedValue({ auth: { getUser } })

  vi.doMock('next/headers', () => ({ headers: headersMock }))
  vi.doMock('@/app/lib/supabase/server', () => ({ createSupabaseServerClient }))
  vi.doMock('@/app/lib/services/profile-service', () => ({ getProfile, ensureProfile }))
  vi.doMock('react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react')>()
    return {
      ...actual,
      cache: <T extends (...args: never[]) => unknown>(fn: T): T => {
        let cached = false
        let value: unknown

        return ((...args: Parameters<T>) => {
          if (!cached) {
            cached = true
            value = fn(...args)
          }

          return value
        }) as T
      },
    }
  })

  return import('@/app/lib/auth/session-auth')
}

describe('dashboard request-scoped auth cache', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('dedupes repeated getCurrentUser calls during one SSR render', async () => {
    const { getCurrentUser } = await loadSessionAuth()
    getUser.mockResolvedValue({
      data: { user: { id: 'user-a', email: 'user-a@example.test', user_metadata: {} } },
      error: null,
    })
    getProfile.mockResolvedValue({ success: true, profile: profile('user-a') })

    const [first, second, third] = await Promise.all([
      getCurrentUser(),
      getCurrentUser(),
      getCurrentUser(),
    ])

    expect(first?.id).toBe('user-a')
    expect(second).toBe(first)
    expect(third).toBe(first)
    expect(getUser).toHaveBeenCalledTimes(1)
    expect(getProfile).toHaveBeenCalledTimes(1)
    expect(ensureProfile).not.toHaveBeenCalled()
  })

  it('uses proxy-forwarded request auth without a second Supabase auth validation', async () => {
    const forwardedHeaders = new Headers()
    setRequestAuthHeaders(forwardedHeaders, {
      id: 'forwarded-user',
      email: 'forwarded@example.test',
      displayName: 'Forwarded Creator',
      avatarUrl: 'https://cdn.example.test/avatar.png',
    })

    const { getCurrentUser } = await loadSessionAuth(forwardedHeaders)
    getProfile.mockResolvedValue({ success: true, profile: profile('forwarded-user') })
    const user = await getCurrentUser()

    expect(user?.id).toBe('forwarded-user')
    expect(user?.email).toBe('forwarded@example.test')
    expect(createSupabaseServerClient).not.toHaveBeenCalled()
    expect(getUser).not.toHaveBeenCalled()
    expect(getProfile).toHaveBeenCalledTimes(1)
  })

  it('falls back to direct Supabase validation outside proxy-forwarded requests', async () => {
    const { getCurrentUser } = await loadSessionAuth(new Headers())
    getUser.mockResolvedValue({
      data: { user: { id: 'fallback-user', email: 'fallback@example.test', user_metadata: {} } },
      error: null,
    })
    getProfile.mockResolvedValue({ success: true, profile: profile('fallback-user') })

    const user = await getCurrentUser()

    expect(user?.id).toBe('fallback-user')
    expect(createSupabaseServerClient).toHaveBeenCalledTimes(1)
    expect(getUser).toHaveBeenCalledTimes(1)
  })

  it('does not reuse cached users across separate request/module scopes', async () => {
    const headersA = new Headers()
    setRequestAuthHeaders(headersA, {
      id: 'user-a',
      email: 'user-a@example.test',
      displayName: null,
      avatarUrl: null,
    })

    const requestA = await loadSessionAuth(headersA)
    getProfile.mockResolvedValue({ success: true, profile: profile('user-a') })
    const userA = await requestA.getCurrentUser()

    const headersB = new Headers()
    setRequestAuthHeaders(headersB, {
      id: 'user-b',
      email: 'user-b@example.test',
      displayName: null,
      avatarUrl: null,
    })

    const requestB = await loadSessionAuth(headersB)
    getProfile.mockResolvedValue({ success: true, profile: profile('user-b') })
    const userB = await requestB.getCurrentUser()

    expect(userA?.id).toBe('user-a')
    expect(userB?.id).toBe('user-b')
    expect(userB?.id).not.toBe(userA?.id)
  })

  it('returns a controlled auth failure and logs unexpected Supabase transport errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const transportError = new Error('network unavailable: secret-token-123')
    const { getCurrentUser } = await loadSessionAuth()
    getUser.mockRejectedValue(transportError)

    const user = await getCurrentUser()

    expect(user).toBeNull()
    expect(getProfile).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith('Unexpected Supabase auth transport failure', transportError)
  })

  it('logs unexpected invalid sessions without throwing an SSR error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { getCurrentUser } = await loadSessionAuth()
    const authError = { name: 'AuthApiError', status: 401, message: 'invalid token secret-token-123' }
    getUser.mockResolvedValue({ data: { user: null }, error: authError })

    const user = await getCurrentUser()

    expect(user).toBeNull()
    expect(getProfile).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith('Supabase auth validation failed', authError)
  })
})
