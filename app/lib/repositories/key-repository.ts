import { supabaseAdmin } from '@/app/lib/supabase'

export type KeyRow = {
  id: string
  key: string
  is_active: boolean
  expires_at: string
  created_at: string
}

const KEY_SELECT = 'id, key, is_active, expires_at, created_at'

export async function findKey(key: string) {
  const { data, error } = await supabaseAdmin
    .from('keys')
    .select(KEY_SELECT)
    .eq('key', key)
    .single()

  if (error) return null
  return data as KeyRow
}

export async function listKeys(params: { search?: string | null; limit?: number } = {}): Promise<KeyRow[]> {
  let query = supabaseAdmin
    .from('keys')
    .select(KEY_SELECT)
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 100)

  const search = params.search?.trim()
  if (search) {
    query = query.ilike('key', `%${search}%`)
  }

  const { data, error } = await query

  if (error) throw error
  return (data ?? []) as KeyRow[]
}

export async function insertKey(key: string, expiresAt: string) {
  const { error } = await supabaseAdmin.from('keys').insert({
    key,
    expires_at: expiresAt,
  })

  if (error && error.code !== '23505') {
    throw error
  }

  return !error
}

export async function deactivateExpiredKeys() {
  const now = new Date().toISOString()
  return supabaseAdmin
    .from('keys')
    .update({ is_active: false })
    .lt('expires_at', now)
    .eq('is_active', true)
}

export async function setKeyActiveState(keyId: string, isActive: boolean): Promise<KeyRow | null> {
  const { data, error } = await supabaseAdmin
    .from('keys')
    .update({ is_active: isActive })
    .eq('id', keyId)
    .select(KEY_SELECT)
    .single()

  if (error) return null
  return data as KeyRow
}
