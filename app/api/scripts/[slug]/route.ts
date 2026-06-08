import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/app/lib/rate-limiter'
import { logEvent } from '@/app/lib/logger'
import { getCurrentUser, requireAuth, AuthError } from '@/app/lib/auth/session-auth'
import { getVisibleScript, updateScript, deleteScript, type ScriptRow } from '@/app/lib/services/script-service'

function toPublicScript(script: ScriptRow) {
  return {
    slug: script.slug,
    name: script.name,
    description: script.description,
    visibility: script.visibility,
    created_at: script.created_at,
    updated_at: script.updated_at,
  }
}

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
    const actor = await getCurrentUser()
    const result = await getVisibleScript(slug, actor?.id)

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      )
    }

    return NextResponse.json({
      success: true,
      script: actor ? result.script : toPublicScript(result.script),
    })
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

  try {
    const actor = await requireAuth()
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

    const result = await updateScript(slug, actor.id, { name, description, visibility, content }, actor.role)

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
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      )
    }

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
  const clientIP = getClientIP(req)

  try {
    const actor = await requireAuth()
    const rateLimit = await checkRateLimit(clientIP, 'SCRIPT_DELETE')

    if (!rateLimit.allowed) {
      await logEvent({
        event: 'RATE_LIMITED',
        ip: clientIP,
        message: 'script delete rate limit exceeded',
      })

      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const { slug } = await params
    const result = await deleteScript(slug, actor.id, actor.role)

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      )
    }

    return NextResponse.json({ success: true, message: result.message })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      )
    }

    return NextResponse.json(
      { success: false, message: 'Failed to delete script' },
      { status: 500 }
    )
  }
}
