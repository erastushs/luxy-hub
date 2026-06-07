import {
  findProfileById,
  upsertProfile,
  ProfileConflictError,
  type ProfileRow,
} from '@/app/lib/repositories/profile-repository'
import { isValidDisplayName, isValidProfileRole, isValidUsername, type ProfileRole } from '@/app/lib/validators'

export type ProfileResult =
  | { success: true; profile: ProfileRow }
  | { success: false; message: string; status: number }

export async function getProfile(userId: unknown): Promise<ProfileResult> {
  if (typeof userId !== 'string' || userId.length === 0) {
    return { success: false, message: 'Invalid user id', status: 400 }
  }

  try {
    const profile = await findProfileById(userId)
    if (!profile) {
      return { success: false, message: 'Profile not found', status: 404 }
    }

    return { success: true, profile }
  } catch {
    return { success: false, message: 'Failed to fetch profile', status: 500 }
  }
}

export async function ensureProfile(params: {
  id: string
  email?: string | null
  displayName?: unknown
  username?: unknown
  avatarUrl?: unknown
}): Promise<ProfileResult> {
  const normalizedDisplayName = resolveDisplayName(params.displayName, params.email)
  if (!normalizedDisplayName || !isValidDisplayName(normalizedDisplayName)) {
    return { success: false, message: 'Display name is required and must be 1-80 characters', status: 400 }
  }

  if (params.username !== undefined && params.username !== null && !isValidUsername(params.username)) {
    return { success: false, message: 'Username must be 3-30 lowercase characters, digits, or hyphens', status: 400 }
  }

  if (params.avatarUrl !== undefined && params.avatarUrl !== null && typeof params.avatarUrl !== 'string') {
    return { success: false, message: 'Avatar URL must be a string', status: 400 }
  }

  try {
    const profile = await upsertProfile({
      id: params.id,
      display_name: normalizedDisplayName,
      username: typeof params.username === 'string' ? params.username : null,
      avatar_url: typeof params.avatarUrl === 'string' ? params.avatarUrl : null,
    })

    return { success: true, profile }
  } catch (error) {
    if (error instanceof ProfileConflictError) {
      return { success: false, message: error.message, status: 409 }
    }

    return { success: false, message: 'Failed to create or update profile', status: 500 }
  }
}

export function assertProfileRole(role: unknown): role is ProfileRole {
  return isValidProfileRole(role)
}

function resolveDisplayName(displayName: unknown, email?: string | null): string | null {
  if (typeof displayName === 'string' && displayName.trim().length > 0) {
    return displayName.trim()
  }

  if (typeof email === 'string' && email.length > 0) {
    return email.split('@')[0] || email
  }

  return null
}
