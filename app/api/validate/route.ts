import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { key } = await req.json()

    const { data, error } = await supabase.from('keys').select('*').eq('key', key).single()

    if (error || !data) {
      return NextResponse.json({
        success: false,
        message: 'Invalid key',
      })
    }

    if (!data.is_active) {
      return NextResponse.json({
        success: false,
        message: 'Key disabled',
      })
    }

    if (new Date(data.expires_at) < new Date()) {
      return NextResponse.json({
        success: false,
        message: 'Key expired',
      })
    }

    return NextResponse.json({
      success: true,
    })
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'Server error',
      },
      { status: 500 },
    )
  }
}
