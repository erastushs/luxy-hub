import { NextRequest, NextResponse } from 'next/server'
import { processEventQueue, type DeliveryProvider } from '@/app/lib/services/event-queue-service'
import { discordProvider } from '@/app/lib/providers/discord-provider'
import { checkAlerts } from '@/app/lib/services/internal-alert-service'

/**
 * Internal event queue worker — polls pending events and hands them
 * off to the configured delivery provider.
 *
 * Auth: CRON_SECRET (Bearer token), same as /api/cleanup.
 * Invocation: Vercel Cron every 5 minutes.
 */

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
    const resolveProvider = (provider: string): DeliveryProvider | null => {
      if (provider === 'discord') return discordProvider
      return null
    }
    const stats = await processEventQueue(resolveProvider)

    // Run alert check after queue processing so counters are fresh.
    // Fire-and-forget — alert check failures should never block queue processing.
    let alertResult: { triggered: number; resolved: number } | null = null
    try {
      alertResult = await checkAlerts()
    } catch {
      console.error('Alert check failed during event worker run')
    }

    return NextResponse.json({
      success: true,
      ...stats,
      ...(alertResult ? { alerts: alertResult } : {}),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Worker failed'
    console.error('Event worker error:', message)
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
