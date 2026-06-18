import { supabaseAdmin } from '@/app/lib/supabase'

const IN_FILTER_BATCH_SIZE = 500

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

type CleanupRow = {
  id?: unknown
  expires_at?: unknown
  [key: string]: unknown
}

function estimateInFilterRequest(column: string, ids: string[]) {
  const filter = `in.(${ids.join(',')})`

  return {
    idsLength: ids.length,
    estimatedSerializedSize: JSON.stringify(ids).length,
    estimatedUrlFilterLength: `${encodeURIComponent(column)}=${encodeURIComponent(filter)}`.length,
  }
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
  limit: number = 5000,
  maxScanBatches: number = 10
): Promise<number> {
  const cappedLimit = Math.max(1, Math.min(limit, 10000))
  const cappedScanBatches = Math.max(1, Math.min(maxScanBatches, 50))
  let offset = 0

  for (let batch = 0; batch < cappedScanBatches; batch++) {
    const selectQueryChain = `from(delivery_sessions).select(id).lt(expires_at, beforeIso).order(expires_at, ascending).order(id, ascending).range(${offset}, ${offset + cappedLimit - 1})`

    logCleanupQuery({
      table: 'delivery_sessions',
      batchSize: cappedLimit,
      batchNumber: batch + 1,
      selectedIdsCount: 0,
      oldestTimestamp: null,
      newestTimestamp: null,
      operation: 'select_expired_sessions:start',
      queryChain: selectQueryChain,
    })

    const { data: expiredSessions, error: expiredError } = await supabaseAdmin
      .from('delivery_sessions')
      .select('id')
      .lt('expires_at', before.toISOString())
      .order('expires_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + cappedLimit - 1)

    if (expiredError) {
      logCleanupError('delivery_sessions select', expiredError)
      throw expiredError
    }

    const expiredRows = (expiredSessions ?? []) as unknown as CleanupRow[]
    const expiredTimestamps = expiredRows
      .map((row) => row.expires_at)
      .filter((timestamp): timestamp is string => typeof timestamp === 'string')
    const expiredSessionIds = expiredRows
      .map((row) => row.id)
      .filter((sessionId): sessionId is string => typeof sessionId === 'string')

    console.log('Cleanup select succeeded', {
      table: 'delivery_sessions',
      batchNumber: batch + 1,
      rowsReturned: expiredRows.length,
      firstId: expiredSessionIds[0] ?? null,
      lastId: expiredSessionIds[expiredSessionIds.length - 1] ?? null,
      selectedIdsCount: expiredSessionIds.length,
      oldestTimestamp: expiredTimestamps[0] ?? null,
      newestTimestamp: expiredTimestamps[expiredTimestamps.length - 1] ?? null,
      queryChain: selectQueryChain,
    })

    if (expiredSessionIds.length === 0) {
      return 0
    }

    const executionRows: { session_id: unknown }[] = []

    for (let offset = 0; offset < expiredSessionIds.length; offset += IN_FILTER_BATCH_SIZE) {
      const idsBatch = expiredSessionIds.slice(offset, offset + IN_FILTER_BATCH_SIZE)
      const requestEstimate = estimateInFilterRequest('session_id', idsBatch)
      const executionsQueryChain = 'from(script_executions).select(session_id).in(session_id, idsBatch)'

      logCleanupQuery({
        table: 'script_executions',
        batchSize: cappedLimit,
        batchNumber: batch + 1,
        selectedIdsCount: expiredSessionIds.length,
        oldestTimestamp: expiredTimestamps[0] ?? null,
        newestTimestamp: expiredTimestamps[expiredTimestamps.length - 1] ?? null,
        operation: 'select_execution_refs:start',
        queryChain: executionsQueryChain,
        idsPreview: idsBatch.slice(0, 5),
        ...requestEstimate,
      })

      const { data, error: executionError } = await supabaseAdmin
        .from('script_executions')
        .select('session_id')
        .in('session_id', idsBatch)

      if (executionError) {
        logCleanupError('delivery_sessions script_executions select', executionError)
        throw executionError
      }

      console.log('Cleanup select succeeded', {
        table: 'script_executions',
        batchNumber: batch + 1,
        rowsReturned: data?.length ?? 0,
        selectedIdsCount: expiredSessionIds.length,
        idsPassedToInCount: idsBatch.length,
        idsPreview: idsBatch.slice(0, 5),
        oldestTimestamp: expiredTimestamps[0] ?? null,
        newestTimestamp: expiredTimestamps[expiredTimestamps.length - 1] ?? null,
        queryChain: executionsQueryChain,
        ...requestEstimate,
      })

      executionRows.push(...((data ?? []) as { session_id: unknown }[]))
    }

    const executionSessionIds = new Set(
      (executionRows ?? [])
        .map((row) => row.session_id)
        .filter((sessionId): sessionId is string => typeof sessionId === 'string')
    )

    const deletableSessionIds = expiredSessionIds.filter(
      (sessionId) => !executionSessionIds.has(sessionId)
    )

    if (deletableSessionIds.length > 0) {
      let deletedCount = 0

      for (let offset = 0; offset < deletableSessionIds.length; offset += IN_FILTER_BATCH_SIZE) {
        const idsBatch = deletableSessionIds.slice(offset, offset + IN_FILTER_BATCH_SIZE)
        const requestEstimate = estimateInFilterRequest('id', idsBatch)
        const deleteQueryChain = 'from(delivery_sessions).delete(count: exact).in(id, idsBatch)'

        logCleanupQuery({
          table: 'delivery_sessions',
          batchSize: cappedLimit,
          batchNumber: batch + 1,
          selectedIdsCount: deletableSessionIds.length,
          oldestTimestamp: expiredTimestamps[0] ?? null,
          newestTimestamp: expiredTimestamps[expiredTimestamps.length - 1] ?? null,
          operation: 'delete_expired_sessions_without_executions:start',
          queryChain: deleteQueryChain,
          idsPreview: idsBatch.slice(0, 5),
          ...requestEstimate,
        })

        const { count, error } = await supabaseAdmin
          .from('delivery_sessions')
          .delete({ count: 'exact' })
          .in('id', idsBatch)

        if (error) {
          logCleanupError('delivery_sessions delete', error)
          throw error
        }

        deletedCount += count ?? 0

        console.log('Cleanup delete succeeded', {
          table: 'delivery_sessions',
          batchNumber: batch + 1,
          idsPassedToInCount: idsBatch.length,
          idsPreview: idsBatch.slice(0, 5),
          deletedCount: count ?? 0,
          deletedRows: count ?? 0,
          queryChain: deleteQueryChain,
          ...requestEstimate,
        })
      }

      return deletedCount
    }

    if (expiredSessionIds.length < cappedLimit) {
      return 0
    }

    offset += cappedLimit
  }

  return 0
}
