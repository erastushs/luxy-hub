import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/app/lib/rate-limiter'
import { logEvent } from '@/app/lib/logger'
import { requireAuth, AuthError } from '@/app/lib/auth/session-auth'
import { listPublicScripts, createScript, type ScriptRow } from '@/app/lib/services/script-service'

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

export async function GET(req: NextRequest) {
  const clientIP = getClientIP(req)

  try {
    const rateLimit = await checkRateLimit(clientIP, 'SCRIPT_LIST')

    if (!rateLimit.allowed) {
      await logEvent({
        event: 'RATE_LIMITED',
        ip: clientIP,
        message: 'script list rate limit exceeded',
      })

      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const url = new URL(req.url)
    const limit = url.searchParams.get('limit')
    const offset = url.searchParams.get('offset')

    const result = await listPublicScripts(limit, offset)

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      )
    }

    return NextResponse.json({
      success: true,
      scripts: result.scripts.map(toPublicScript),
      total: result.total,
      limit: typeof limit === 'string' ? parseInt(limit, 10) || 20 : 20,
      offset: typeof offset === 'string' ? parseInt(offset, 10) || 0 : 0,
    })
  } catch {
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
    const rateLimit = await checkRateLimit(clientIP, 'SCRIPT_UPLOAD')

    if (!rateLimit.allowed) {
      await logEvent({
        event: 'RATE_LIMITED',
        ip: clientIP,
        message: 'script upload rate limit exceeded',
      })

      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const body = await req.json()
    const { slug, name, description, visibility, content } = body || {}

    const result = await createScript({
      slug,
      name,
      description,
      visibility,
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
      message: `Script created: ${result.script.slug}`,
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
