import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'
import { generateKey } from '@/app/lib/key-generator'

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: 'Token required',
        },
        { status: 400 },
      )
    }

    const response = await fetch(`https://work.ink/_api/v2/token/isValid/${token}`)

    const data = await response.json()

    console.log('WORKINK RESPONSE')
    console.log(data)

    if (!data.valid) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid token',
        },
        { status: 403 },
      )
    }

    const { data: existingToken } = await supabase
      .from('used_workink_tokens')
      .select('token')
      .eq('token', token)
      .single()

    if (existingToken) {
      return NextResponse.json(
        {
          success: false,
          message: 'Token already used',
        },
        { status: 403 },
      )
    }

    await supabase.from('used_workink_tokens').insert({
      token,
    })

    let key = generateKey()

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 1)

    const { error } = await supabase.from('keys').insert({
      key,
      expires_at: expiresAt.toISOString(),
    })

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      key,
      expires_at: expiresAt.toISOString(),
      tokenInfo: data.info,
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        success: false,
      },
      { status: 500 },
    )
  }
}
