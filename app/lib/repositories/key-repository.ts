import { supabaseAdmin } from '@/app/lib/supabase'

export async function findKey(key: string) {
  const { data, error } = await supabaseAdmin
    .from('keys')
    .select('id, key, key_hash, hash_version, is_active, expires_at, created_at')
    .or(`key.eq.${key},key_hash.eq.${key}`)
    .maybeSingle()

  if (error) return null
  return data
}

export async function insertKey(keyHash: string, expiresAt: string): Promise<boolean> {
  const { error } = await supabaseAdmin.from('keys').insert({
    key: null,
    key_hash: keyHash,
    hash_version: 'hmac-sha256:v1',
    expires_at: expiresAt,
  })

  if (!error) {
    return true
  }

  if (error.code === '23505') {
    return false
  }

  if (error) {
    throw error
  }

  return false
}

export async function upgradeKeyHash(id: string, keyHash: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('keys')
    .update({
      key: null,
      key_hash: keyHash,
      hash_version: 'hmac-sha256:v1',
    })
    .eq('id', id)

  if (error) throw error
}

export async function deactivateExpiredKeys() {
  const now = new Date().toISOString()
  return supabaseAdmin
    .from('keys')
    .update({ is_active: false })
    .lt('expires_at', now)
    .eq('is_active', true)
}
