import { NextRequest, NextResponse } from 'next/server'
import { checkAlerts } from '@/app/lib/services/internal-alert-service'

/**
 * Internal alert check — evaluates all alert thresholds and creates/resolves
 * alerts as needed. Called by Vercel Cron alongside the event worker.
 *
 * Auth: CRON_SECRET (Bearer token), same as /api/cleanup and /api/internal/event-worker.
 * Invocation: Vercel Cron every 5 minutes (after event worker).
 */

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json(
      { success: false, message: 'CRON_SECRET not configured' },
      { status: 500 },
    )
  }

  const authHeader = req.headers.get('authorization')

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 },
    )
  }

  try {
    const result = await checkAlerts()

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Alert check failed'
    console.error('Alert check error:', message)
    return NextResponse.json(
      { success: false, message },
      { status: 500 },
    )
  }
}
