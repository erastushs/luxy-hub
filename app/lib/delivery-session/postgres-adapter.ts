import { supabaseAdmin } from '@/app/lib/supabase'
import type { DeliverySessionAdapter, DeliverySessionData, CreateDeliverySessionParams } from './types'

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

function normalizeRow(row: Record<string, unknown>): DeliverySessionData {
  return {
    id: String(row.id ?? ''),
    script_id: String(row.script_id ?? ''),
    build_id: String(row.build_id ?? ''),
    session_token_hash: String(row.session_token_hash ?? ''),
    expires_at: String(row.expires_at ?? ''),
    consumed_at: row.consumed_at ? String(row.consumed_at) : null,
    event_secret: row.event_secret ? String(row.event_secret) : null,
    created_at: String(row.created_at ?? ''),
  }
}

export class PostgresDeliverySessionAdapter implements DeliverySessionAdapter {
  async createSession(params: CreateDeliverySessionParams): Promise<DeliverySessionData> {
    const row = {
      script_id: params.scriptId,
      build_id: params.buildId,
      session_token_hash: params.tokenHash,
      expires_at: params.expiresAt,
      event_secret: params.eventSecret ?? null,
      consumed_at: null,
      created_at: new Date().toISOString(),
    } as Record<string, unknown>

    if (params.id) {
      row.id = params.id
    }

    const { data, error } = await supabaseAdmin
      .from('delivery_sessions')
      .insert(row)
      .select(SESSION_SELECT)
      .single()

    if (error) throw error
    return normalizeRow(data as unknown as Record<string, unknown>)
  }

  async getSessionByTokenHash(tokenHash: string): Promise<DeliverySessionData | null> {
    const { data, error } = await supabaseAdmin
      .from('delivery_sessions')
      .select(SESSION_SELECT)
      .eq('session_token_hash', tokenHash)
      .single()

    if (error) return null
    return normalizeRow(data as unknown as Record<string, unknown>)
  }

  async consumeSession(sessionId: string): Promise<DeliverySessionData | null> {
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
    return normalizeRow(data as unknown as Record<string, unknown>)
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const { count, error } = await supabaseAdmin
      .from('delivery_sessions')
      .delete({ count: 'exact' })
      .eq('id', sessionId)

    if (error) throw error
    return (count ?? 0) > 0
  }
}
