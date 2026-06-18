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

export async function deleteExpiredSessionsWithoutExecutions(
  before: Date = new Date(),
  limit: number = 5000,
  maxScanBatches: number = 10
): Promise<number> {
  const cappedLimit = Math.max(1, Math.min(limit, 10000))
  const cappedScanBatches = Math.max(1, Math.min(maxScanBatches, 50))
  let offset = 0

  for (let batch = 0; batch < cappedScanBatches; batch++) {
    const { data: expiredSessions, error: expiredError } = await supabaseAdmin
      .from('delivery_sessions')
      .select('id')
      .lt('expires_at', before.toISOString())
      .order('expires_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + cappedLimit - 1)

    if (expiredError) throw expiredError

    const expiredSessionIds = (expiredSessions ?? [])
      .map((row) => row.id)
      .filter((sessionId): sessionId is string => typeof sessionId === 'string')

    if (expiredSessionIds.length === 0) {
      return 0
    }

    const { data: executionRows, error: executionError } = await supabaseAdmin
      .from('script_executions')
      .select('session_id')
      .in('session_id', expiredSessionIds)

    if (executionError) throw executionError

    const executionSessionIds = new Set(
      (executionRows ?? [])
        .map((row) => row.session_id)
        .filter((sessionId): sessionId is string => typeof sessionId === 'string')
    )

    const deletableSessionIds = expiredSessionIds.filter(
      (sessionId) => !executionSessionIds.has(sessionId)
    )

    if (deletableSessionIds.length > 0) {
      const { count, error } = await supabaseAdmin
        .from('delivery_sessions')
        .delete({ count: 'exact' })
        .in('id', deletableSessionIds)

      if (error) throw error
      return count ?? 0
    }

    if (expiredSessionIds.length < cappedLimit) {
      return 0
    }

    offset += cappedLimit
  }

  return 0
}
