import { createSupabaseServerClient } from '@/app/lib/supabase/server'
import { getProfile, ensureProfile, type ProfileResult } from '@/app/lib/services/profile-service'
import type { ProfileRole } from '@/app/lib/validators'

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

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    return null
  }

  const existingProfile = await getProfile(data.user.id)
  if (existingProfile.success) {
    return {
      id: data.user.id,
      email: data.user.email ?? null,
      role: existingProfile.profile.role,
      profile: existingProfile.profile,
    }
  }

  if (existingProfile.status !== 404) {
    return null
  }

  const provisionedProfile = await ensureProfile({
    id: data.user.id,
    email: data.user.email ?? null,
    displayName: extractDisplayName(data.user.user_metadata),
    avatarUrl: extractAvatarUrl(data.user.user_metadata),
  })

  if (!provisionedProfile.success) {
    return null
  }

  return {
    id: data.user.id,
    email: data.user.email ?? null,
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
