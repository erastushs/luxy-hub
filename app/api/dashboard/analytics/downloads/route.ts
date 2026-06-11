import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/app/lib/auth/session-auth'

export async function GET() {
  try {
    await requireAuth()
    return NextResponse.json(
      { success: false, message: 'Download trend analytics are not available in Analytics V1' },
      { status: 410 }
    )
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      )
    }

    return NextResponse.json(
      { success: false, message: 'Download trend analytics are not available in Analytics V1' },
      { status: 500 }
    )
  }
}
