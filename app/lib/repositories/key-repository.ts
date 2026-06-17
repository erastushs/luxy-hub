import { supabaseAdmin } from '@/app/lib/supabase'

export type KeyRow = {
  id: string
  key: string
  key_category: KeyCategory
  key_type: KeyType
  name: string | null
  description: string | null
  is_active: boolean
  expires_at: string
  created_at: string
}

export type KeyCategory = 'free' | 'premium' | 'legacy'
export type KeyType = 'free' | 'weekly' | 'monthly' | 'custom' | 'legacy'

export type InsertKeyParams = {
  key: string
  expiresAt: string
  keyCategory?: KeyCategory
  keyType?: KeyType
  name?: string | null
  description?: string | null
}

const KEY_SELECT = 'id, key, key_category, key_type, name, description, is_active, expires_at, created_at'

export async function findKey(key: string) {
  const { data, error } = await supabaseAdmin
    .from('keys')
    .select(KEY_SELECT)
    .eq('key', key)
    .single()

  if (error) return null
  return data as KeyRow
}

export async function listKeys(params: { search?: string | null; limit?: number; category?: KeyCategory } = {}): Promise<KeyRow[]> {
  let query = supabaseAdmin
    .from('keys')
    .select(KEY_SELECT)
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 100)

  if (params.category) {
    query = query.eq('key_category', params.category)
  }

  const search = params.search?.trim()
  if (search) {
    query = query.or(`key.ilike.%${search}%,name.ilike.%${search}%,description.ilike.%${search}%`)
  }

  const { data, error } = await query

  if (error) throw error
  return (data ?? []) as KeyRow[]
}

export async function insertKey(params: InsertKeyParams) {
  const { error } = await supabaseAdmin.from('keys').insert({
    key: params.key,
    expires_at: params.expiresAt,
    key_category: params.keyCategory ?? 'legacy',
    key_type: params.keyType ?? 'legacy',
    name: params.name ?? null,
    description: params.description ?? null,
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
    .eq('key_category', 'premium')
    .select(KEY_SELECT)
    .single()

  if (error) return null
  return data as KeyRow
}
