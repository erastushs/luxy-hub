import { NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'
import { generateKey } from '@/app/lib/key-generator'

export async function POST() {
  try {
    let key
    let exists = true

    while (exists) {
      key = generateKey()

      const { data } = await supabase.from('keys').select('id').eq('key', key).maybeSingle()

      exists = !!data
    }

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
      expires_at: expiresAt,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate key',
      },
      { status: 500 },
    )
  }
}
