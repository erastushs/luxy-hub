import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'
import {
  deleteDeadLetterEventsBefore,
  deleteDeliveredEventsBefore,
  deletePendingEventsBefore,
} from '@/app/lib/repositories/event-repository'

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
    const now = new Date().toISOString()

    const { error: keysError } = await supabaseAdmin
      .from('keys')
      .update({ is_active: false })
      .lt('expires_at', now)
      .eq('is_active', true)

    if (keysError) {
      console.error('Cleanup keys error')
    }

    const threeDaysAgo = new Date(
      Date.now() - 3 * 24 * 60 * 60 * 1000
    ).toISOString()

    const { error: tokensError } = await supabaseAdmin
      .from('used_workink_tokens')
      .delete()
      .lt('used_at', threeDaysAgo)
      .limit(5000)

    if (tokensError) {
      console.error('Cleanup tokens error')
    }

    const { error: rateLimitError } = await supabaseAdmin
      .from('rate_limits')
      .delete()
      .lt('created_at', threeDaysAgo)
      .limit(10000)

    if (rateLimitError) {
      console.error('Cleanup rate_limits error')
    }

    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString()

    const { error: logsError } = await supabaseAdmin
      .from('verification_logs')
      .delete()
      .lt('created_at', thirtyDaysAgo)
      .limit(5000)

    if (logsError) {
      console.error('Cleanup logs error')
    }

    const ninetyDaysAgo = new Date(
      Date.now() - 90 * 24 * 60 * 60 * 1000
    ).toISOString()

    const { error: downloadsError } = await supabaseAdmin
      .from('script_downloads')
      .delete()
      .lt('created_at', ninetyDaysAgo)
      .limit(10000)

    if (downloadsError) {
      console.error('Cleanup script_downloads error')
    }

    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    )

    const eventCleanup = {
      delivered: await deleteDeliveredEventsBefore(new Date(thirtyDaysAgo)),
      deadLetter: await deleteDeadLetterEventsBefore(new Date(ninetyDaysAgo)),
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
