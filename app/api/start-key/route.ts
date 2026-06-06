import { NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'
import { generateSessionId } from '@/app/lib/session-generator'

export async function POST() {
  try {
    const sessionId = generateSessionId()

    const { error } = await supabase.from('lootlabs_sessions').insert({
      session_id: sessionId,
    })

    if (error) throw error

    const lootlabsUrl = `${process.env.LOOTLABS_URL}?puid=${sessionId}`

    return NextResponse.json({
      success: true,
      redirect_url: lootlabsUrl,
    })
  } catch {
    return NextResponse.json(
      {
        success: false,
      },
      { status: 500 },
    )
  }
}
