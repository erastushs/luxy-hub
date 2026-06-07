import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/app/lib/rate-limiter'
import { logEvent } from '@/app/lib/logger'
import { verifyAdminAuth } from '@/app/lib/auth/admin-auth'
import { getScript, updateScript, deleteScript } from '@/app/lib/services/script-service'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const clientIP = getClientIP(req)

  try {
    const rateLimit = await checkRateLimit(clientIP, 'SCRIPT_GET')

    if (!rateLimit.allowed) {
      await logEvent({
        event: 'RATE_LIMITED',
        ip: clientIP,
        message: 'script get rate limit exceeded',
      })

      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const { slug } = await params
    const result = await getScript(slug)

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      )
    }

    return NextResponse.json({ success: true, script: result.script })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Failed to fetch script' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const clientIP = getClientIP(req)

  if (!verifyAdminAuth(req)) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const rateLimit = await checkRateLimit(clientIP, 'SCRIPT_UPDATE')

    if (!rateLimit.allowed) {
      await logEvent({
        event: 'RATE_LIMITED',
        ip: clientIP,
        message: 'script update rate limit exceeded',
      })

      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const { slug } = await params
    const body = await req.json().catch(() => ({}))
    const { name, description, visibility, content } = body || {}

    const result = await updateScript(slug, { name, description, visibility, content })

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      )
    }

    await logEvent({
      event: 'VALIDATE_SUCCESS',
      ip: clientIP,
      message: `Script updated: ${slug}`,
    })

    return NextResponse.json({ success: true, script: result.script })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Failed to update script' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!verifyAdminAuth(req)) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { slug } = await params
    const result = await deleteScript(slug)

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      )
    }

    return NextResponse.json({ success: true, message: result.message })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Failed to delete script' },
      { status: 500 }
    )
  }
}
