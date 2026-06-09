import { NextRequest, NextResponse } from 'next/server'
import { reportEvent } from '@/app/lib/services/event-reporting-service'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, message: 'Invalid event payload' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const result = await reportEvent({
      sessionId: body.sessionId,
      event: body.event,
      timestamp: body.timestamp,
      nonce: body.nonce,
      signature: body.signature,
      payload: body.payload,
    })

    const status = result.success ? 200 : result.status
    const headers: Record<string, string> = { 'Cache-Control': 'no-store' }

    if (!result.success) {
      const body: Record<string, unknown> = { success: false, message: result.message }
      if (result.retryAfter !== undefined) {
        headers['Retry-After'] = String(result.retryAfter)
        body.retry_after = result.retryAfter
      }
      return NextResponse.json(body, { status, headers })
    }

    return NextResponse.json({ success: true }, { status, headers })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Event rejected' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
