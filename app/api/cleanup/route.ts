import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date().toISOString()

    const { error: keysError } = await supabase
      .from('keys')
      .update({ is_active: false })
      .lt('expires_at', now)
      .eq('is_active', true)

    if (keysError) {
      console.error('Cleanup keys error:', keysError)
    } else {
      console.log(`[cleanup] Expired keys deactivated at ${now}`)
    }

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

    const { error: tokensError } = await supabase
      .from('used_workink_tokens')
      .delete()
      .lt('used_at', threeDaysAgo)
      .limit(5000)

    if (tokensError) {
      console.error('Cleanup tokens error:', tokensError)
    } else {
      console.log(`[cleanup] Old tokens purged at ${now}`)
    }

    const { error: rateLimitError } = await supabase
      .from('rate_limits')
      .delete()
      .lt('created_at', threeDaysAgo)
      .limit(10000)

    if (rateLimitError) {
      console.error('Cleanup rate_limits error:', rateLimitError)
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { error: logsError } = await supabase
      .from('verification_logs')
      .delete()
      .lt('created_at', thirtyDaysAgo)
      .limit(5000)

    if (logsError) {
      console.error('Cleanup logs error:', logsError)
    }

    return NextResponse.json({
      success: true,
      message: 'Cleanup completed',
      timestamp: now,
    })
  } catch (error) {
    console.error('Cleanup error:', error)

    return NextResponse.json(
      { success: false, message: 'Cleanup failed' },
      { status: 500 },
    )
  }
}
