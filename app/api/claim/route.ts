import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'
import { generateKey } from '@/app/lib/key-generator'

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json()

    if (!sessionId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Session ID required',
        },
        { status: 400 },
      )
    }

    const { data: session, error } = await supabase
      .from('lootlabs_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    if (error || !session) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid session',
        },
        { status: 404 },
      )
    }

    if (!session.completed) {
      return NextResponse.json(
        {
          success: false,
          message: 'Offer not completed',
        },
        { status: 403 },
      )
    }

    if (session.claimed) {
      return NextResponse.json(
        {
          success: false,
          message: 'Already claimed',
        },
        { status: 403 },
      )
    }

    let key
    let exists = true

    while (exists) {
      key = generateKey()

      const { data } = await supabase.from('keys').select('id').eq('key', key).maybeSingle()

      exists = !!data
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 1)

    const { error: keyError } = await supabase.from('keys').insert({
      key,
      expires_at: expiresAt.toISOString(),
    })

    if (keyError) throw keyError

    await supabase
      .from('lootlabs_sessions')
      .update({
        claimed: true,
      })
      .eq('session_id', sessionId)

    return NextResponse.json({
      success: true,
      key,
      expires_at: expiresAt,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: 'Server error',
      },
      { status: 500 },
    )
  }
}
