import { supabaseAdmin } from '@/app/lib/supabase'
import type { ProfileRole } from '@/app/lib/validators'

export type ProfileRow = {
  id: string
  username: string | null
  display_name: string
  avatar_url: string | null
  role: ProfileRole
  created_at: string
  updated_at: string
}

type UpsertProfileParams = {
  id: string
  username?: string | null
  display_name: string
  avatar_url?: string | null
}

export async function findProfileById(id: string): Promise<ProfileRow | null> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, created_at, updated_at')
    .eq('id', id)
    .single()

  if (error) return null
  return data
}

export async function upsertProfile(params: UpsertProfileParams): Promise<ProfileRow> {
  const now = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .upsert(
      {
        id: params.id,
        username: params.username ?? null,
        display_name: params.display_name,
        avatar_url: params.avatar_url ?? null,
        updated_at: now,
      },
      { onConflict: 'id' }
    )
    .select('id, username, display_name, avatar_url, role, created_at, updated_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new ProfileConflictError('username already exists')
    }
    throw error
  }

  return data
}

export class ProfileConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProfileConflictError'
  }
}
