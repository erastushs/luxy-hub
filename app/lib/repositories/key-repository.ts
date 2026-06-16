import { supabaseAdmin } from '@/app/lib/supabase'

export async function findKey(key: string) {
  const { data, error } = await supabaseAdmin
    .from('keys')
    .select('id, key, is_active, expires_at, created_at')
    .eq('key', key)
    .single()

  if (error) return null
  return data
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
