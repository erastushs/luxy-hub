import { supabaseAdmin } from '@/app/lib/supabase'

export type DeliverySessionRow = {
  id: string
  script_id: string
  build_id: string
  session_token_hash: string
  expires_at: string
  consumed_at: string | null
  event_secret: string | null
  created_at: string
}

const SESSION_SELECT = [
  'id',
  'script_id',
  'build_id',
  'session_token_hash',
  'expires_at',
  'consumed_at',
  'event_secret',
  'created_at',
].join(', ')

export async function createSession(params: {
  scriptId: string
  buildId: string
  tokenHash: string
  expiresAt: string
  eventSecret?: string | null
}): Promise<DeliverySessionRow> {
  const { data, error } = await supabaseAdmin
    .from('delivery_sessions')
    .insert({
      script_id: params.scriptId,
      build_id: params.buildId,
      session_token_hash: params.tokenHash,
      expires_at: params.expiresAt,
      event_secret: params.eventSecret ?? null,
      consumed_at: null,
      created_at: new Date().toISOString(),
    })
    .select(SESSION_SELECT)
    .single()

  if (error) throw error
  return data as unknown as DeliverySessionRow
}

export async function getSessionByTokenHash(tokenHash: string): Promise<DeliverySessionRow | null> {
  const { data, error } = await supabaseAdmin
    .from('delivery_sessions')
    .select(SESSION_SELECT)
    .eq('session_token_hash', tokenHash)
    .single()

  if (error) return null
  return data as unknown as DeliverySessionRow
}

export async function consumeSession(sessionId: string): Promise<DeliverySessionRow | null> {
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('delivery_sessions')
    .update({ consumed_at: now })
    .eq('id', sessionId)
    .is('consumed_at', null)
    .gt('expires_at', now)
    .select(SESSION_SELECT)
    .single()

  if (error) return null
  return data as unknown as DeliverySessionRow
}

export async function deleteExpiredSessions(before: Date = new Date()): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('delivery_sessions')
    .delete({ count: 'exact' })
    .lt('expires_at', before.toISOString())

  if (error) throw error
  return count ?? 0
}
