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

async function deleteOldRowsById(params: {
  table: CleanupTable
  timestampColumn: string
  beforeIso: string
  batchSize: number
  maxBatches: number
}): Promise<number> {
  let totalDeleted = 0

  for (let batch = 0; batch < params.maxBatches; batch++) {
    const { data: rows, error: selectError } = await supabaseAdmin
      .from(params.table)
      .select('id')
      .lt(params.timestampColumn, params.beforeIso)
      .order(params.timestampColumn, { ascending: true })
      .order('id', { ascending: true })
      .limit(params.batchSize)

    if (selectError) {
      throw selectError
    }

    const ids = (rows ?? [])
      .map((row) => row.id)
      .filter((id): id is string => typeof id === 'string')

    if (ids.length === 0) {
      break
    }

    const { count, error: deleteError } = await supabaseAdmin
      .from(params.table)
      .delete({ count: 'exact' })
      .in('id', ids)

    if (deleteError) {
      throw deleteError
    }

    totalDeleted += count ?? 0

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
    console.error(`Cleanup ${name} error`, error)
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
