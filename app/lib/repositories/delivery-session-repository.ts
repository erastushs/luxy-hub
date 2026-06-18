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

type DeliverySessionCleanupRpcRow = {
  deleted_count: number | null
  processed_count: number | null
  remaining_candidates: number | null
}

function serializeCleanupError(error: unknown, depth = 0): unknown {
  if (depth > 4) {
    return '[Max error depth reached]'
  }

  if (error === null || typeof error !== 'object') {
    return error
  }

  const serialized: Record<string, unknown> = {}

  for (const key of Object.getOwnPropertyNames(error)) {
    if (/authorization|apikey|cookie|password|secret|token/i.test(key)) {
      serialized[key] = '[REDACTED]'
      continue
    }

    const value = (error as Record<string, unknown>)[key]
    serialized[key] = key === 'cause' ? serializeCleanupError(value, depth + 1) : value
  }

  for (const [key, value] of Object.entries(error as Record<string, unknown>)) {
    if (key in serialized) continue
    if (/authorization|apikey|cookie|password|secret|token/i.test(key)) {
      serialized[key] = '[REDACTED]'
      continue
    }
    serialized[key] = key === 'cause' ? serializeCleanupError(value, depth + 1) : value
  }

  return serialized
}

function stringifyCleanupError(error: unknown): string {
  try {
    return JSON.stringify(serializeCleanupError(error), null, 2)
  } catch {
    return '[Unable to stringify cleanup error]'
  }
}

function logCleanupError(name: string, error: unknown) {
  const errorRecord = error as Partial<{
    code: unknown
    message: unknown
    details: unknown
    hint: unknown
    status: unknown
    statusText: unknown
    cause: unknown
  }>

  console.error(`Cleanup ${name} error`, {
    error,
    serialized: serializeCleanupError(error),
    json: stringifyCleanupError(error),
    code: errorRecord?.code,
    message: errorRecord?.message,
    details: errorRecord?.details,
    hint: errorRecord?.hint,
    status: errorRecord?.status,
    statusText: errorRecord?.statusText,
    cause: serializeCleanupError(errorRecord?.cause),
  })
}

function logCleanupQuery(context: {
  table: string
  batchSize: number
  batchNumber?: number
  selectedIdsCount: number
  oldestTimestamp: string | null
  newestTimestamp: string | null
  operation: string
  queryChain: string
  idsPreview?: string[]
  idsLength?: number
  estimatedSerializedSize?: number
  estimatedUrlFilterLength?: number
  deletedRows?: number
  processedCount?: number
  deletedCount?: number
  remainingCandidates?: number
  executionTimeMs?: number
}) {
  console.log('Cleanup query context', context)
}

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
  limit: number = 1000,
  maxScanBatches: number = 10
): Promise<number> {
  const cappedLimit = Math.max(1, Math.min(limit, 1000))
  const cappedScanBatches = Math.max(1, Math.min(maxScanBatches, 50))
  let totalDeleted = 0

  for (let batch = 0; batch < cappedScanBatches; batch++) {
    const startedAt = Date.now()
    const queryChain = 'rpc(cleanup_expired_delivery_sessions_without_executions)'

    logCleanupQuery({
      table: 'delivery_sessions',
      batchSize: cappedLimit,
      batchNumber: batch + 1,
      selectedIdsCount: 0,
      oldestTimestamp: null,
      newestTimestamp: null,
      operation: 'delivery_session_cleanup_rpc:start',
      queryChain,
    })

    const { data, error } = await supabaseAdmin.rpc(
      'cleanup_expired_delivery_sessions_without_executions',
      {
        before_timestamp: before.toISOString(),
        batch_size: cappedLimit,
      }
    )

    if (error) {
      logCleanupError('delivery_sessions cleanup rpc', error)
      throw error
    }

    const result = Array.isArray(data)
      ? (data[0] as DeliverySessionCleanupRpcRow | undefined)
      : (data as DeliverySessionCleanupRpcRow | null | undefined)
    const deletedCount = result?.deleted_count ?? 0
    const processedCount = result?.processed_count ?? 0
    const remainingCandidates = result?.remaining_candidates ?? 0
    const executionTimeMs = Date.now() - startedAt

    totalDeleted += deletedCount

    console.log('Cleanup delivery_sessions rpc succeeded', {
      table: 'delivery_sessions',
      batchNumber: batch + 1,
      batchSize: cappedLimit,
      processedCount,
      deletedCount,
      deletedRows: deletedCount,
      remainingCandidates,
      executionTimeMs,
      queryChain,
    })

    if (processedCount < cappedLimit || remainingCandidates === 0 || deletedCount === 0) {
      break
    }
  }

  return totalDeleted
}
