import { NextRequest, NextResponse } from 'next/server'
import { getClientIP } from '@/app/lib/rate-limiter'
import { generateVerifiedFreeKey } from '@/app/lib/services/free-key-generation-service'

export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req)

  try {
    const body = await req.json().catch(() => null)
    const { token } = body || {}
    const result = await generateVerifiedFreeKey(token, clientIP, 'generate-key API')

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        {
          status: result.status,
          ...(result.retryAfter ? { headers: { 'Retry-After': String(result.retryAfter) } } : {}),
        }
      )
    }

    return NextResponse.json({
      success: true,
      key: result.key,
      expires_at: result.expires_at,
    })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Failed to generate key' },
      { status: 500 }
    )
  }
}
