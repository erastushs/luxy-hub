import { NextRequest, NextResponse } from 'next/server'
import { processEventQueue, type DeliveryProvider } from '@/app/lib/services/event-queue-service'
import { discordProvider } from '@/app/lib/providers/discord-provider'

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

    return NextResponse.json({
      success: true,
      ...stats,
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
