import { supabase } from '@/app/lib/supabase'

export async function findToken(token: string) {
  const { data } = await supabase
    .from('used_workink_tokens')
    .select('token')
    .eq('token', token)
    .single()

  return data ?? null
}

export async function insertToken(token: string) {
  const now = new Date().toISOString()

  const { data: existing } = await supabase
    .from('used_workink_tokens')
    .select('token')
    .eq('token', token)
    .maybeSingle()

  if (existing) return false

  const { error } = await supabase
    .from('used_workink_tokens')
    .insert({ token, used_at: now })

  if (error && error.code === '23505') return false
  if (error) throw error
  return true
}
