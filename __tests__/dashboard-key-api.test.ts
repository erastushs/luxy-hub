import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

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

vi.mock('@/app/lib/services/paid-key-service', () => ({
  issuePaidKey: vi.fn(),
}))

import { requireAuth } from '@/app/lib/auth/session-auth'
import { issuePaidKey } from '@/app/lib/services/paid-key-service'
import { POST as issueDashboardKeyRoute } from '@/app/api/dashboard/keys/route'

const mockedRequireAuth = vi.mocked(requireAuth)
const mockedIssuePaidKey = vi.mocked(issuePaidKey)

function jsonRequest(body?: Record<string, unknown>): NextRequest {
  return new Request('https://example.test/api/dashboard/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }) as NextRequest
}

describe('dashboard key API', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedRequireAuth.mockResolvedValue({
      id: 'creator-uuid-1',
      email: 'creator@example.test',
      role: 'creator',
      profile: {} as Awaited<ReturnType<typeof requireAuth>>['profile'],
    })
  })

  it('issues authenticated weekly keys', async () => {
    mockedIssuePaidKey.mockResolvedValue({
      key: 'LUXY-WEEK-BBBB-CCCC',
      expires_at: '2026-06-23T00:00:00.000Z',
      duration: 'weekly',
    })

    const response = await issueDashboardKeyRoute(jsonRequest({ duration: 'weekly' }))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body).toEqual({ success: true, key: 'LUXY-WEEK-BBBB-CCCC', expires_at: '2026-06-23T00:00:00.000Z' })
    expect(mockedIssuePaidKey).toHaveBeenCalledWith({ duration: 'weekly' })
  })

  it('passes custom expiration to the paid key service', async () => {
    mockedIssuePaidKey.mockResolvedValue({
      key: 'LUXY-CUST-BBBB-CCCC',
      expires_at: '2026-07-01T00:00:00.000Z',
      duration: 'custom',
    })

    const response = await issueDashboardKeyRoute(jsonRequest({
      duration: 'custom',
      expires_at: '2026-07-01T00:00:00.000Z',
    }))

    expect(response.status).toBe(201)
    expect(mockedIssuePaidKey).toHaveBeenCalledWith({ duration: 'custom', expiresAt: '2026-07-01T00:00:00.000Z' })
  })

  it('rejects invalid durations before issuing', async () => {
    const response = await issueDashboardKeyRoute(jsonRequest({ duration: 'daily' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ success: false, message: 'Invalid key duration' })
    expect(mockedIssuePaidKey).not.toHaveBeenCalled()
  })
})
