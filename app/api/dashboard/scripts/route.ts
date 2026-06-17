import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/app/lib/rate-limiter'
import { logEvent } from '@/app/lib/logger'
import { requireAuth, AuthError } from '@/app/lib/auth/session-auth'
import { listCreatorScripts, createScript } from '@/app/lib/services/script-service'

export async function GET(req: NextRequest) {
  const clientIP = getClientIP(req)

  try {
    const actor = await requireAuth()
    const rateLimit = await checkRateLimit(clientIP, 'DASHBOARD_SCRIPTS_LIST')

    if (!rateLimit.allowed) {
      await logEvent({
        event: 'RATE_LIMITED',
        ip: clientIP,
        message: 'dashboard scripts list rate limit exceeded',
      })

      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const url = new URL(req.url)
    const limit = url.searchParams.get('limit')
    const offset = url.searchParams.get('offset')
    const visibility = url.searchParams.get('visibility')
    const search = url.searchParams.get('search')

    const result = await listCreatorScripts(actor.id, { visibility, search, limit, offset })

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      )
    }

    return NextResponse.json({
      success: true,
      scripts: result.scripts,
      total: result.total,
      limit: typeof limit === 'string' && limit ? parseInt(limit, 10) || 20 : 20,
      offset: typeof offset === 'string' && offset ? parseInt(offset, 10) || 0 : 0,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      )
    }

    return NextResponse.json(
      { success: false, message: 'Failed to list scripts' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req)

  try {
    const actor = await requireAuth()
    const rateLimit = await checkRateLimit(clientIP, 'DASHBOARD_SCRIPTS_CREATE')

    if (!rateLimit.allowed) {
      await logEvent({
        event: 'RATE_LIMITED',
        ip: clientIP,
        message: 'dashboard script create rate limit exceeded',
      })

      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const body = await req.json()
    const { slug, name, description, visibility, access_mode, content } = body || {}

    const result = await createScript({
      slug,
      name,
      description,
      visibility,
      accessMode: access_mode,
      content,
      creatorId: actor.id,
      creatorRole: actor.role,
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      )
    }

    await logEvent({
      event: 'VALIDATE_SUCCESS',
      ip: clientIP,
      message: `Script created via dashboard: ${result.script.slug}`,
    })

    return NextResponse.json({ success: true, script: result.script }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      )
    }

    return NextResponse.json(
      { success: false, message: 'Failed to create script' },
      { status: 500 }
    )
  }
}
