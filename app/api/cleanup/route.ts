import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'
import {
  deleteDeadLetterEventsBefore,
  deleteDeliveredEventsBefore,
  deletePendingEventsBefore,
} from '@/app/lib/repositories/event-repository'
import { cleanupConfig } from '@/app/config/cleanup'
import { getCronSecret } from '@/app/config/env'

export async function POST(req: NextRequest) {
  const cronSecret = getCronSecret()

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
    const now = new Date().toISOString()

    const { error: keysError } = await supabaseAdmin
      .from('keys')
      .update({ is_active: false })
      .lt('expires_at', now)
      .eq('is_active', true)

    if (keysError) {
      console.error('Cleanup keys error')
    }

    const threeDaysAgo = daysAgo(cleanupConfig.retentionDays.usedWorkinkTokens).toISOString()

    const { error: tokensError } = await supabaseAdmin
      .from('used_workink_tokens')
      .delete()
      .lt('used_at', threeDaysAgo)
      .limit(cleanupConfig.batchSizes.usedWorkinkTokens)

    if (tokensError) {
      console.error('Cleanup tokens error')
    }

    const { error: rateLimitError } = await supabaseAdmin
      .from('rate_limits')
      .delete()
      .lt('created_at', daysAgo(cleanupConfig.retentionDays.rateLimits).toISOString())
      .limit(cleanupConfig.batchSizes.rateLimits)

    if (rateLimitError) {
      console.error('Cleanup rate_limits error')
    }

    const thirtyDaysAgo = daysAgo(cleanupConfig.retentionDays.verificationLogs).toISOString()

    const { error: logsError } = await supabaseAdmin
      .from('verification_logs')
      .delete()
      .lt('created_at', thirtyDaysAgo)
      .limit(cleanupConfig.batchSizes.verificationLogs)

    if (logsError) {
      console.error('Cleanup logs error')
    }

    const ninetyDaysAgo = daysAgo(cleanupConfig.retentionDays.scriptDownloads).toISOString()

    const { error: downloadsError } = await supabaseAdmin
      .from('script_downloads')
      .delete()
      .lt('created_at', ninetyDaysAgo)
      .limit(cleanupConfig.batchSizes.scriptDownloads)

    if (downloadsError) {
      console.error('Cleanup script_downloads error')
    }

    const sevenDaysAgo = daysAgo(cleanupConfig.retentionDays.pendingEvents)

    const eventCleanup = {
      delivered: await deleteDeliveredEventsBefore(daysAgo(cleanupConfig.retentionDays.deliveredEvents)),
      deadLetter: await deleteDeadLetterEventsBefore(daysAgo(cleanupConfig.retentionDays.deadLetterEvents)),
      pending: await deletePendingEventsBefore(sevenDaysAgo),
    }

    return NextResponse.json({
      success: true,
      message: 'Cleanup completed',
      timestamp: now,
      event_logs: eventCleanup,
    })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Cleanup failed' },
      { status: 500 }
    )
  }
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}
