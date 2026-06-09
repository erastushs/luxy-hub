import type { SupabaseClient } from '@supabase/supabase-js'
import type * as ReactModule from 'react'
import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { useActionState } from 'react'
import { changePasswordAction } from '@/app/actions/security'
import { ProfileClient } from '@/app/dashboard/profile/profile-client'
import { createSupabaseServerClient } from '@/app/lib/supabase/server'
import type { AuthenticatedUser } from '@/app/lib/auth/session-auth'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))


vi.mock('@/app/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}))

vi.mock('@/app/actions/profile', () => ({
  updateProfileAction: vi.fn(),
}))


vi.mock('@/app/actions/auth', () => ({
  logout: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
}))

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>()
  return {
    ...actual,
    useActionState: vi.fn(),
  }
})


const mockedCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient)
const mockedUseActionState = vi.mocked(useActionState)

const creator: AuthenticatedUser = {
  id: 'creator-uuid',
  email: 'creator@example.com',
  role: 'creator',
  profile: {
    id: 'creator-uuid',
    display_name: 'Creator',
    username: 'creator',
    avatar_url: null,
    role: 'creator',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
}

function passwordForm(params: {
  newPassword?: string
  confirmPassword?: string
}) {
  const form = new FormData()
  if (params.newPassword !== undefined) form.set('new_password', params.newPassword)
  if (params.confirmPassword !== undefined) form.set('confirm_password', params.confirmPassword)
  return form
}

function mockSupabase(updateUser: Mock) {
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: creator.id } }, error: null })
  mockedCreateSupabaseServerClient.mockResolvedValue({
    auth: { getUser, updateUser },
  } as unknown as SupabaseClient)
}

describe('account password management', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockSupabase(vi.fn())
  })

  it('rejects an empty password before calling Supabase Auth', async () => {
    const result = await changePasswordAction({ success: false }, passwordForm({
      newPassword: '',
      confirmPassword: '',
    }))

    expect(result).toEqual({ success: false, message: 'Enter a new password.' })
    expect(mockedCreateSupabaseServerClient).toHaveBeenCalledOnce()
  })

  it('rejects a short password before calling Supabase Auth', async () => {
    const result = await changePasswordAction({ success: false }, passwordForm({
      newPassword: 'short',
      confirmPassword: 'short',
    }))

    expect(result).toEqual({ success: false, message: 'Password must be at least 8 characters.' })
    expect(mockedCreateSupabaseServerClient).toHaveBeenCalledOnce()
  })

  it('rejects mismatched confirmation before calling Supabase Auth', async () => {
    const result = await changePasswordAction({ success: false }, passwordForm({
      newPassword: 'valid-password',
      confirmPassword: 'different-password',
    }))

    expect(result).toEqual({ success: false, message: 'Passwords do not match.' })
    expect(mockedCreateSupabaseServerClient).toHaveBeenCalledOnce()
  })

  it('rejects unauthenticated requests before validating password fields', async () => {
    mockedCreateSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'missing' } }),
        updateUser: vi.fn(),
      },
    } as unknown as SupabaseClient)

    const result = await changePasswordAction({ success: false }, passwordForm({
      newPassword: 'valid-password',
      confirmPassword: 'valid-password',
    }))

    expect(result).toEqual({ success: false, message: 'Sign in again to change your password.' })
  })

  it('updates the authenticated user password through Supabase Auth only', async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null })
    mockSupabase(updateUser)

    const result = await changePasswordAction({ success: false }, passwordForm({
      newPassword: 'valid-password',
      confirmPassword: 'valid-password',
    }))

    expect(result).toEqual({ success: true, message: 'Password updated.' })
    expect(mockedCreateSupabaseServerClient).toHaveBeenCalledOnce()
    expect(updateUser).toHaveBeenCalledWith({ password: 'valid-password' })
  })

  it('returns friendly Supabase Auth errors without storing passwords', async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: { message: 'Auth session missing' } })
    mockSupabase(updateUser)

    const result = await changePasswordAction({ success: false }, passwordForm({
      newPassword: 'valid-password',
      confirmPassword: 'valid-password',
    }))

    expect(result).toEqual({ success: false, message: 'Auth session missing' })
    expect(updateUser).toHaveBeenCalledWith({ password: 'valid-password' })
  })

  it('renders password fields and save controls on the profile security card', () => {
    mockedUseActionState
      .mockReturnValueOnce([{ success: false }, vi.fn(), false])
      .mockReturnValueOnce([{ success: false }, vi.fn(), false])

    const html = renderToStaticMarkup(<ProfileClient user={creator} />)

    expect(html).toContain('Security')
    expect(html).toContain('type="password"')
    expect(html).toContain('name="new_password"')
    expect(html).toContain('name="confirm_password"')
    expect(html).toContain('Save Password')
  })
})
