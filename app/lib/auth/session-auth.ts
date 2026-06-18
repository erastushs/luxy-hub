import { createSupabaseServerClient } from '@/app/lib/supabase/server'
import { getProfile, ensureProfile, type ProfileResult } from '@/app/lib/services/profile-service'
import type { ProfileRole } from '@/app/lib/validators'
import { readRequestAuthHeaders } from '@/app/lib/auth/request-auth-headers'
import { headers } from 'next/headers'
import { cache } from 'react'

export type AuthenticatedUser = {
  id: string
  email: string | null
  role: ProfileRole
  profile: NonNullable<Extract<ProfileResult, { success: true }>['profile']>
}

export class AuthError extends Error {
  status: number

  constructor(message: string, status: number = 401) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

export const getCurrentUser = cache(async (): Promise<AuthenticatedUser | null> => {
  const forwardedAuth = readRequestAuthHeaders(await headers())

  if (forwardedAuth) {
    return resolveAuthenticatedUser({
      id: forwardedAuth.id,
      email: forwardedAuth.email,
      displayName: forwardedAuth.displayName,
      avatarUrl: forwardedAuth.avatarUrl,
    })
  }

  const supabase = await createSupabaseServerClient()

  let authResult: Awaited<ReturnType<typeof supabase.auth.getUser>>

  try {
    authResult = await supabase.auth.getUser()
  } catch (error) {
    console.error('Unexpected Supabase auth transport failure', error)
    return null
  }

  const { data, error } = authResult

  if (error || !data.user) {
    if (error && !isAuthSessionMissingError(error)) {
      console.error('Supabase auth validation failed', error)
    }
    return null
  }

  return resolveAuthenticatedUser({
    id: data.user.id,
    email: data.user.email ?? null,
    displayName: extractDisplayName(data.user.user_metadata),
    avatarUrl: extractAvatarUrl(data.user.user_metadata),
  })
})

async function resolveAuthenticatedUser({
  id,
  email,
  displayName,
  avatarUrl,
}: {
  id: string
  email: string | null
  displayName: string | null
  avatarUrl: string | null
}): Promise<AuthenticatedUser | null> {
  const existingProfile = await getProfile(id)
  if (existingProfile.success) {
    return {
      id,
      email,
      role: existingProfile.profile.role,
      profile: existingProfile.profile,
    }
  }

  if (existingProfile.status !== 404) {
    return null
  }

  const provisionedProfile = await ensureProfile({
    id,
    email,
    displayName,
    avatarUrl,
  })

  if (!provisionedProfile.success) {
    return null
  }

  return {
    id,
    email,
    role: provisionedProfile.profile.role,
    profile: provisionedProfile.profile,
  }
}

export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser()

  if (!user) {
    throw new AuthError('Unauthorized', 401)
  }

  return user
}

export async function requireRole(requiredRole: ProfileRole): Promise<AuthenticatedUser> {
  const user = await requireAuth()

  if (user.role !== requiredRole) {
    throw new AuthError('Forbidden', 403)
  }

  return user
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
