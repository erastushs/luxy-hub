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
  PaidKeyValidationError: class PaidKeyValidationError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'PaidKeyValidationError'
    }
  },
  issuePaidKey: vi.fn(),
}))

vi.mock('@/app/lib/services/key-service', () => ({
  listDashboardKeys: vi.fn(),
  updateDashboardKeyState: vi.fn(),
}))

import { requireAuth } from '@/app/lib/auth/session-auth'
import { issuePaidKey, PaidKeyValidationError } from '@/app/lib/services/paid-key-service'
import { listDashboardKeys, updateDashboardKeyState } from '@/app/lib/services/key-service'
import { GET as listDashboardKeysRoute, POST as issueDashboardKeyRoute } from '@/app/api/dashboard/keys/route'
import { PATCH as updateDashboardKeyRoute } from '@/app/api/dashboard/keys/[id]/route'

const mockedRequireAuth = vi.mocked(requireAuth)
const mockedIssuePaidKey = vi.mocked(issuePaidKey)
const mockedListDashboardKeys = vi.mocked(listDashboardKeys)
const mockedUpdateDashboardKeyState = vi.mocked(updateDashboardKeyState)

function jsonRequest(body?: Record<string, unknown>): NextRequest {
  return new Request('https://example.test/api/dashboard/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }) as NextRequest
}

function params<T extends Record<string, string>>(value: T) {
  return { params: Promise.resolve(value) }
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
    mockedIssuePaidKey.mockRejectedValue(new PaidKeyValidationError('Premium key name is required'))

    const response = await issueDashboardKeyRoute(jsonRequest({ duration: 'weekly' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ success: false, message: 'Premium key name is required' })
    expect(mockedIssuePaidKey).toHaveBeenCalledWith({ duration: 'weekly', name: '', description: null })
  })

  it('issues authenticated weekly keys with required premium metadata', async () => {
    mockedIssuePaidKey.mockResolvedValue({
      key: 'LUXY-PREM-BBBB-CCCC',
      expires_at: '2026-06-23T00:00:00.000Z',
      duration: 'weekly',
    })

    const response = await issueDashboardKeyRoute(jsonRequest({ duration: 'weekly', name: 'Monthly Discord', description: 'June supporter' }))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body).toEqual({ success: true, key: 'LUXY-PREM-BBBB-CCCC', expires_at: '2026-06-23T00:00:00.000Z' })
    expect(mockedIssuePaidKey).toHaveBeenCalledWith({ duration: 'weekly', name: 'Monthly Discord', description: 'June supporter' })
  })

  it('passes custom expiration to the paid key service', async () => {
    mockedIssuePaidKey.mockResolvedValue({
      key: 'LUXY-CUST-BBBB-CCCC',
      expires_at: '2026-07-01T00:00:00.000Z',
      duration: 'custom',
    })

    const response = await issueDashboardKeyRoute(jsonRequest({
      duration: 'custom',
      name: 'Giveaway Winner',
      expires_at: '2026-07-01T00:00:00.000Z',
    }))

    expect(response.status).toBe(201)
    expect(mockedIssuePaidKey).toHaveBeenCalledWith({ duration: 'custom', expiresAt: '2026-07-01T00:00:00.000Z', name: 'Giveaway Winner', description: null })
  })

  it('rejects invalid durations before issuing', async () => {
    const response = await issueDashboardKeyRoute(jsonRequest({ duration: 'daily' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ success: false, message: 'Invalid key duration' })
    expect(mockedIssuePaidKey).not.toHaveBeenCalled()
  })

  it('lists dashboard keys with summary data', async () => {
    mockedListDashboardKeys.mockResolvedValue({
      keys: [{ id: 'key-1', key: 'LUXY-PREM-AAAA-BBBB', key_category: 'premium', key_type: 'monthly', name: 'Monthly Discord', description: null, is_active: true, status: 'active', expires_at: '2026-06-18T00:00:00.000Z', created_at: '2026-06-17T00:00:00.000Z' }],
      summary: { total: 1, active: 1, expired: 0, disabled: 0 },
    })

    const response = await listDashboardKeysRoute(new Request('https://example.test/api/dashboard/keys?search=AAAA') as NextRequest)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mockedListDashboardKeys).toHaveBeenCalledWith('AAAA')
    expect(body).toEqual({
      success: true,
      keys: [{ id: 'key-1', key: 'LUXY-PREM-AAAA-BBBB', key_category: 'premium', key_type: 'monthly', name: 'Monthly Discord', description: null, is_active: true, status: 'active', expires_at: '2026-06-18T00:00:00.000Z', created_at: '2026-06-17T00:00:00.000Z' }],
      summary: { total: 1, active: 1, expired: 0, disabled: 0 },
    })
  })

  it('updates dashboard key active state', async () => {
    mockedUpdateDashboardKeyState.mockResolvedValue({
      id: 'key-1',
      key: 'LUXY-PREM-AAAA-BBBB',
      key_category: 'premium',
      key_type: 'weekly',
      name: 'Monthly Discord',
      description: null,
      is_active: false,
      status: 'disabled',
      expires_at: '2026-06-18T00:00:00.000Z',
      created_at: '2026-06-17T00:00:00.000Z',
    })

    const response = await updateDashboardKeyRoute(jsonRequest({ is_active: false }), params({ id: 'key-1' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mockedUpdateDashboardKeyState).toHaveBeenCalledWith('key-1', false)
    expect(body.key.status).toBe('disabled')
  })
})
