import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse, type NextRequest } from 'next/server'

vi.mock('@/app/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
  getClientIP: vi.fn(() => '127.0.0.1'),
}))

vi.mock('@/app/lib/logger', () => ({
  logEvent: vi.fn(),
}))

vi.mock('@/app/lib/services/key-service', () => ({
  validateKey: vi.fn(),
}))

vi.mock('@/app/lib/services/script-service', () => ({
  listPublicScripts: vi.fn(),
  createScript: vi.fn(),
  getRawContent: vi.fn(),
}))

vi.mock('@/app/lib/auth/session-auth', () => ({
  requireAuth: vi.fn(),
  AuthError: class extends Error {
    status: number

    constructor(message: string, status = 401) {
      super(message)
      this.status = status
    }
  },
}))

vi.mock('@/app/lib/supabase/proxy', () => ({
  updateSession: vi.fn(() => NextResponse.next()),
}))

import { checkRateLimit } from '@/app/lib/rate-limiter'
import { validateKey } from '@/app/lib/services/key-service'
import { getRawContent, listPublicScripts } from '@/app/lib/services/script-service'
import { verifyAdminAuth } from '@/app/lib/auth/admin-auth'
import { POST as validateRoute } from '@/app/api/validate/route'
import { GET as listScriptsRoute } from '@/app/api/scripts/route'
import { GET as rawScriptRoute } from '@/app/api/scripts/[slug]/raw/route'
import { proxy } from '@/proxy'

const mockedCheckRateLimit = vi.mocked(checkRateLimit)
const mockedValidateKey = vi.mocked(validateKey)
const mockedListPublicScripts = vi.mocked(listPublicScripts)
const mockedGetRawContent = vi.mocked(getRawContent)

function jsonRequest(url: string, body: string): NextRequest {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }) as NextRequest
}

function getRequest(url: string): NextRequest {
  return new Request(url, { method: 'GET' }) as NextRequest
}

function proxyRequest(url: string, init: RequestInit = {}): NextRequest {
  const request = new Request(url, init) as NextRequest
  Object.defineProperty(request, 'nextUrl', { value: new URL(url) })
  return request
}

describe('security hardening', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedCheckRateLimit.mockResolvedValue({ allowed: true })
    delete process.env.ADMIN_API_KEY
    delete process.env.CRON_SECRET
    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  it('returns 400 for malformed validate JSON without calling key validation', async () => {
    const response = await validateRoute(jsonRequest('https://luxy.example/api/validate', '{'))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ success: false, message: 'Invalid JSON body' })
    expect(mockedValidateKey).not.toHaveBeenCalled()
  })

  it('returns 400 for an empty validate body', async () => {
    const response = await validateRoute(new Request('https://luxy.example/api/validate', {
      method: 'POST',
    }) as NextRequest)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ success: false, message: 'Invalid JSON body' })
    expect(mockedValidateKey).not.toHaveBeenCalled()
  })

  it('does not accept CRON_SECRET as an admin credential', () => {
    process.env.CRON_SECRET = 'cron-secret'

    const request = new Request('https://luxy.example/api/scripts/test/raw', {
      headers: { authorization: 'Bearer cron-secret' },
    }) as NextRequest

    expect(verifyAdminAuth(request)).toBe(false)
  })

  it('accepts only ADMIN_API_KEY for admin authentication', () => {
    process.env.ADMIN_API_KEY = 'admin-secret'

    const request = new Request('https://luxy.example/api/scripts/test/raw', {
      headers: { authorization: 'Bearer admin-secret' },
    }) as NextRequest

    expect(verifyAdminAuth(request)).toBe(true)
  })

  it('omits internal identifiers from the public scripts list response', async () => {
    mockedListPublicScripts.mockResolvedValue({
      success: true,
      total: 1,
      scripts: [
        {
          id: 'script-uuid',
          slug: 'my-script',
          name: 'My Script',
          description: 'A public script',
          visibility: 'public',
          creator_id: 'owner-uuid',
          current_version_id: 'version-uuid',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-02T00:00:00.000Z',
        },
      ],
    })

    const response = await listScriptsRoute(getRequest('https://luxy.example/api/scripts'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.scripts).toEqual([
      {
        slug: 'my-script',
        name: 'My Script',
        description: 'A public script',
        visibility: 'public',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
    ])
    expect(body.scripts[0]).not.toHaveProperty('id')
    expect(body.scripts[0]).not.toHaveProperty('creator_id')
    expect(body.scripts[0]).not.toHaveProperty('current_version_id')
  })

  it('does not wildcard CORS on sensitive API routes for untrusted origins', async () => {
    const response = await proxy(proxyRequest('https://luxy.example/api/validate', {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example' },
    }))

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('keeps wildcard CORS on non-sensitive public API routes', async () => {
    const response = await proxy(proxyRequest('https://luxy.example/api/scripts', {
      method: 'OPTIONS',
      headers: { origin: 'https://client.example' },
    }))

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('does not public-cache raw script responses fetched with admin auth', async () => {
    process.env.ADMIN_API_KEY = 'admin-secret'
    mockedGetRawContent.mockResolvedValue({ success: true, content: 'print("private")' })

    const response = await rawScriptRoute(
      new Request('https://luxy.example/api/scripts/private-script/raw', {
        method: 'GET',
        headers: { authorization: 'Bearer admin-secret' },
      }) as NextRequest,
      { params: Promise.resolve({ slug: 'private-script' }) }
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(mockedGetRawContent).toHaveBeenCalledWith('private-script', {
      isAuthenticated: true,
      key: null,
      license: null,
      customerIdentifier: null,
    })
  })
})
