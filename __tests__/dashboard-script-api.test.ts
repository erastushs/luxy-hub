import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@/app/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
  getClientIP: vi.fn(),
}))

vi.mock('@/app/lib/logger', () => ({
  logEvent: vi.fn(),
}))

vi.mock('@/app/lib/auth/session-auth', () => ({
  AuthError: class AuthError extends Error {
    status: number

    constructor(message: string, status: number = 401) {
      super(message)
      this.name = 'AuthError'
      this.status = status
    }
  },
  requireAuth: vi.fn(),
}))

vi.mock('@/app/lib/services/script-service', () => ({
  createScript: vi.fn(),
  deleteScript: vi.fn(),
  getVisibleScript: vi.fn(),
  listCreatorScripts: vi.fn(),
  updateScript: vi.fn(),
}))

import { checkRateLimit, getClientIP } from '@/app/lib/rate-limiter'
import { requireAuth } from '@/app/lib/auth/session-auth'
import { createScript, updateScript } from '@/app/lib/services/script-service'
import type { ScriptRow } from '@/app/lib/repositories/script-repository'
import { POST as createScriptRoute } from '@/app/api/dashboard/scripts/route'
import { PATCH as updateScriptRoute } from '@/app/api/dashboard/scripts/[slug]/route'

const mockedCheckRateLimit = vi.mocked(checkRateLimit)
const mockedGetClientIP = vi.mocked(getClientIP)
const mockedRequireAuth = vi.mocked(requireAuth)
const mockedCreateScript = vi.mocked(createScript)
const mockedUpdateScript = vi.mocked(updateScript)

function jsonRequest(url: string, body?: Record<string, unknown>): NextRequest {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }) as NextRequest
}

function params<T extends Record<string, string>>(value: T) {
  return { params: Promise.resolve(value) }
}

function script(overrides: Partial<ScriptRow> = {}): ScriptRow {
  return {
    id: 'script-uuid-1',
    slug: 'my-script',
    name: 'My Script',
    description: null,
    visibility: 'private',
    access_mode: 'public',
    creator_id: 'creator-uuid-1',
    current_version_id: null,
    created_at: '2026-06-17T00:00:00.000Z',
    updated_at: '2026-06-17T00:00:00.000Z',
    ...overrides,
  }
}

describe('dashboard script API access mode support', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedGetClientIP.mockReturnValue('203.0.113.10')
    mockedCheckRateLimit.mockResolvedValue({ allowed: true })
    mockedRequireAuth.mockResolvedValue({
      id: 'creator-uuid-1',
      email: 'creator@example.test',
      role: 'creator',
      profile: {} as Awaited<ReturnType<typeof requireAuth>>['profile'],
    })
  })

  it('deserializes and serializes access_mode on script creation', async () => {
    mockedCreateScript.mockResolvedValue({ success: true, script: script({ access_mode: 'key_required' }) })

    const response = await createScriptRoute(jsonRequest('https://example.test/api/dashboard/scripts', {
      slug: 'my-script',
      name: 'My Script',
      description: '',
      visibility: 'private',
      access_mode: 'key_required',
      content: 'print("hello")',
    }))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(mockedCreateScript).toHaveBeenCalledWith({
      slug: 'my-script',
      name: 'My Script',
      description: '',
      visibility: 'private',
      accessMode: 'key_required',
      content: 'print("hello")',
      creatorId: 'creator-uuid-1',
      creatorRole: 'creator',
    })
    expect(body.script.access_mode).toBe('key_required')
  })

  it('deserializes and serializes access_mode on script update', async () => {
    mockedUpdateScript.mockResolvedValue({ success: true, script: script({ access_mode: 'public' }) })

    const response = await updateScriptRoute(jsonRequest('https://example.test/api/dashboard/scripts/my-script', {
      name: 'My Script',
      description: '',
      visibility: 'private',
      access_mode: 'public',
    }), params({ slug: 'my-script' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mockedUpdateScript).toHaveBeenCalledWith(
      'my-script',
      'creator-uuid-1',
      { name: 'My Script', description: '', visibility: 'private', accessMode: 'public', content: undefined },
      'creator'
    )
    expect(body.script.access_mode).toBe('public')
  })
})
