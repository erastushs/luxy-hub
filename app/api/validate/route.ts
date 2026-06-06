import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'
import { isValidKeyFormat } from '@/app/lib/validators'

export async function POST(req: NextRequest) {
  try {
    const { key } = await req.json()

    if (!key) {
      return NextResponse.json(
        {
          success: false,
          message: 'Key is required',
        },
        { status: 400 },
      )
    }

    if (!isValidKeyFormat(key)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid key format',
      })
    }

    const { data, error } = await supabase.from('keys').select('*').eq('key', key).single()

    if (error || !data) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid key',
        },
        { status: 404 },
      )
    }

    if (!data.is_active) {
      return NextResponse.json(
        {
          success: false,
          message: 'Key disabled',
        },
        { status: 403 },
      )
    }

    if (new Date(data.expires_at) < new Date()) {
      return NextResponse.json(
        {
          success: false,
          message: 'Key expired',
        },
        { status: 403 },
      )
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
