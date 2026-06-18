import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'
import {
  deleteDeadLetterEventsBefore,
  deleteDeliveredEventsBefore,
  deletePendingEventsBefore,
} from '@/app/lib/repositories/event-repository'
import { deleteExpiredSessionsWithoutExecutions } from '@/app/lib/repositories/delivery-session-repository'

const CLEANUP_BATCHES = 25
const RATE_LIMIT_CLEANUP_BATCH_SIZE = 10000
const GENERAL_CLEANUP_BATCH_SIZE = 1000
const IN_FILTER_BATCH_SIZE = 500

type CleanupStatus = 'success' | 'partial' | 'failed'

type CleanupResult = {
  deleted: number
  status: CleanupStatus
}

type CleanupErrorResult = CleanupResult & {
  error: 'cleanup_failed'
}

type CleanupTable =
  | 'rate_limits'
  | 'used_workink_tokens'
  | 'verification_logs'
  | 'script_downloads'

type CleanupRow = {
  id?: unknown
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

function getTimestampRange(rows: CleanupRow[], timestampColumn: string) {
  const timestamps = rows
    .map((row) => row[timestampColumn])
    .filter((timestamp): timestamp is string => typeof timestamp === 'string')

  return {
    oldestTimestamp: timestamps[0] ?? null,
    newestTimestamp: timestamps[timestamps.length - 1] ?? null,
  }
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

async function deleteOldRowsById(params: {
  table: CleanupTable
  timestampColumn: string
  idColumn?: string
  beforeIso: string
  batchSize: number
  maxBatches: number
}): Promise<number> {
  let totalDeleted = 0
  const idColumn = params.idColumn ?? 'id'

  for (let batch = 0; batch < params.maxBatches; batch++) {
    const selectQueryChain = `from(${params.table}).select(${idColumn}).lt(${params.timestampColumn}, beforeIso).order(${params.timestampColumn}, ascending).order(${idColumn}, ascending).limit(${params.batchSize})`

    logCleanupQuery({
      table: params.table,
      batchSize: params.batchSize,
      batchNumber: batch + 1,
      selectedIdsCount: 0,
      oldestTimestamp: null,
      newestTimestamp: null,
      operation: 'select_ids_before_delete:start',
      queryChain: selectQueryChain,
    })

    const { data: rows, error: selectError } = await supabaseAdmin
      .from(params.table)
      .select(idColumn)
      .lt(params.timestampColumn, params.beforeIso)
      .order(params.timestampColumn, { ascending: true })
      .order(idColumn, { ascending: true })
      .limit(params.batchSize)

    if (selectError) {
      logCleanupError(`${params.table} select`, selectError)
      throw selectError
    }

    const selectedRows = (rows ?? []) as unknown as CleanupRow[]
    const { oldestTimestamp, newestTimestamp } = getTimestampRange(
      selectedRows,
      params.timestampColumn
    )
    const ids = selectedRows
      .map((row) => row[idColumn])
      .filter((id): id is string => typeof id === 'string')

    console.log('Cleanup select succeeded', {
      table: params.table,
      batchNumber: batch + 1,
      rowsReturned: selectedRows.length,
      firstId: ids[0] ?? null,
      lastId: ids[ids.length - 1] ?? null,
      selectedIdsCount: ids.length,
      oldestTimestamp,
      newestTimestamp,
      queryChain: selectQueryChain,
    })

    if (ids.length === 0) {
      break
    }

    for (let offset = 0; offset < ids.length; offset += IN_FILTER_BATCH_SIZE) {
      const idsBatch = ids.slice(offset, offset + IN_FILTER_BATCH_SIZE)
      const requestEstimate = estimateInFilterRequest(idColumn, idsBatch)
      const deleteQueryChain = `from(${params.table}).delete(count: exact).in(${idColumn}, idsBatch)`

      logCleanupQuery({
        table: params.table,
        batchSize: params.batchSize,
        batchNumber: batch + 1,
        selectedIdsCount: ids.length,
        oldestTimestamp,
        newestTimestamp,
        operation: 'delete_by_selected_ids:start',
        queryChain: deleteQueryChain,
        idsPreview: idsBatch.slice(0, 5),
        ...requestEstimate,
      })

      const { count, error: deleteError } = await supabaseAdmin
        .from(params.table)
        .delete({ count: 'exact' })
        .in(idColumn, idsBatch)

      if (deleteError) {
        logCleanupError(`${params.table} delete`, deleteError)
        throw deleteError
      }

      console.log('Cleanup delete succeeded', {
        table: params.table,
        batchNumber: batch + 1,
        idsPassedToInCount: idsBatch.length,
        idsPreview: idsBatch.slice(0, 5),
        deletedCount: count ?? 0,
        deletedRows: count ?? 0,
        queryChain: deleteQueryChain,
        ...requestEstimate,
      })

      totalDeleted += count ?? 0
    }

    if (ids.length < params.batchSize) {
      break
    }
  }

  return totalDeleted
}

async function runCleanupTarget(
  name: string,
  cleanup: () => Promise<number>
): Promise<CleanupResult | CleanupErrorResult> {
  try {
    const deleted = await cleanup()
    return { deleted, status: 'success' }
  } catch (error) {
    logCleanupError(name, error)
    return { deleted: 0, status: 'failed', error: 'cleanup_failed' }
  }
}

async function disableExpiredKeys(nowIso: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('keys')
    .update({ is_active: false }, { count: 'exact' })
    .lt('expires_at', nowIso)
    .eq('is_active', true)

  if (error) {
    throw error
  }

  return count ?? 0
}

async function deleteOldRateLimits(beforeIso: string): Promise<number> {
  return deleteOldRowsById({
    table: 'rate_limits',
    timestampColumn: 'created_at',
    beforeIso,
    batchSize: RATE_LIMIT_CLEANUP_BATCH_SIZE,
    maxBatches: CLEANUP_BATCHES,
  })
}

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json(
      { success: false, message: 'CRON_SECRET not configured' },
      { status: 500 }
    )
  }

  const authHeader = req.headers.get('authorization')

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const startedAt = Date.now()
    const now = new Date().toISOString()

    const keysResult = await runCleanupTarget('keys', () => disableExpiredKeys(now))

    const threeDaysAgo = new Date(
      Date.now() - 3 * 24 * 60 * 60 * 1000
    ).toISOString()

    const usedWorkinkTokensResult = await runCleanupTarget('used_workink_tokens', () =>
      deleteOldRowsById({
        table: 'used_workink_tokens',
        timestampColumn: 'used_at',
        idColumn: 'token',
        beforeIso: threeDaysAgo,
        batchSize: GENERAL_CLEANUP_BATCH_SIZE,
        maxBatches: CLEANUP_BATCHES,
      })
    )

    const rateLimitsResult = await runCleanupTarget('rate_limits', () =>
      deleteOldRateLimits(threeDaysAgo)
    )

    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString()

    const verificationLogsResult = await runCleanupTarget('verification_logs', () =>
      deleteOldRowsById({
        table: 'verification_logs',
        timestampColumn: 'created_at',
        beforeIso: thirtyDaysAgo,
        batchSize: GENERAL_CLEANUP_BATCH_SIZE,
        maxBatches: CLEANUP_BATCHES,
      })
    )

    const ninetyDaysAgo = new Date(
      Date.now() - 90 * 24 * 60 * 60 * 1000
    ).toISOString()

    const scriptDownloadsResult = await runCleanupTarget('script_downloads', () =>
      deleteOldRowsById({
        table: 'script_downloads',
        timestampColumn: 'created_at',
        beforeIso: ninetyDaysAgo,
        batchSize: GENERAL_CLEANUP_BATCH_SIZE,
        maxBatches: CLEANUP_BATCHES,
      })
    )

    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    )

    const eventCleanup = {
      delivered: await deleteDeliveredEventsBefore(new Date(thirtyDaysAgo)),
      deadLetter: await deleteDeadLetterEventsBefore(new Date(ninetyDaysAgo)),
      pending: await deletePendingEventsBefore(sevenDaysAgo),
    }

    const deliverySessionsResult = await runCleanupTarget('delivery_sessions', () =>
      deleteExpiredSessionsWithoutExecutions(new Date())
    )

    const cleanupResults = [
      keysResult,
      usedWorkinkTokensResult,
      rateLimitsResult,
      verificationLogsResult,
      scriptDownloadsResult,
      deliverySessionsResult,
    ]
    const status: CleanupStatus = cleanupResults.some((result) => result.status === 'failed')
      ? cleanupResults.some((result) => result.status === 'success')
        ? 'partial'
        : 'failed'
      : 'success'

    return NextResponse.json({
      success: status !== 'failed',
      status,
      message: 'Cleanup completed',
      timestamp: now,
      execution_time_ms: Date.now() - startedAt,
      keys_disabled: keysResult,
      used_workink_tokens_deleted: usedWorkinkTokensResult,
      rate_limits_deleted: rateLimitsResult,
      verification_logs_deleted: verificationLogsResult,
      script_downloads_deleted: scriptDownloadsResult,
      delivery_sessions_deleted: deliverySessionsResult,
      event_logs: eventCleanup,
    }, { status: status === 'failed' ? 500 : 200 })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Cleanup failed' },
      { status: 500 }
    )
  }
}
