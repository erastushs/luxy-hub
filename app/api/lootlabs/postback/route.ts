import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const clickId = searchParams.get('click_id')
    const uniqueId = searchParams.get('unique_id')
    const ip = searchParams.get('ip')
    console.log('LOOTLABS POSTBACK', {
      clickId,
      uniqueId,
      ip,
    })

    if (!clickId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing click_id',
        },
        { status: 400 },
      )
    }

    const { error } = await supabase
      .from('lootlabs_sessions')
      .update({
        completed: true,
      })
      .eq('session_id', clickId)

    console.log('SESSION UPDATED', clickId)

    if (error) throw error

    return NextResponse.json({
      success: true,
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
