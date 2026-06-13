import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
}))

vi.mock('@/app/lib/logger', () => ({
  logEvent: vi.fn(),
}))

vi.mock('@/app/lib/services/workink-service', () => ({
  verifyWorkinkToken: vi.fn(),
}))

vi.mock('@/app/lib/services/key-service', () => ({
  createKey: vi.fn(),
}))

import { checkRateLimit } from '@/app/lib/rate-limiter'
import { logEvent } from '@/app/lib/logger'
import { createKey } from '@/app/lib/services/key-service'
import { verifyWorkinkToken } from '@/app/lib/services/workink-service'
import { generateVerifiedFreeKey } from '@/app/lib/services/free-key-generation-service'

const mockedCheckRateLimit = vi.mocked(checkRateLimit)
const mockedLogEvent = vi.mocked(logEvent)
const mockedVerifyWorkinkToken = vi.mocked(verifyWorkinkToken)
const mockedCreateKey = vi.mocked(createKey)

describe('free key generation service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedCheckRateLimit.mockResolvedValue({ allowed: true })
    mockedVerifyWorkinkToken.mockResolvedValue({
      success: true,
      message: 'Token verified',
      validToken: true,
      tokenInfo: { id: 'token-info' },
    })
    mockedCreateKey.mockResolvedValue('LUXY-FREE-ABCD-1234-EFGH')
  })

  it('applies canonical generation rate limiting before token verification', async () => {
    mockedCheckRateLimit.mockResolvedValue({ allowed: false, retryAfter: 60 })

    const result = await generateVerifiedFreeKey('token-1', '203.0.113.10', 'verify-token page')

    expect(result).toEqual({
      success: false,
      message: 'Too many requests. Please try again later.',
      status: 429,
      retryAfter: 60,
    })
    expect(mockedCheckRateLimit).toHaveBeenCalledWith('203.0.113.10', 'GENERATE')
    expect(mockedVerifyWorkinkToken).not.toHaveBeenCalled()
    expect(mockedLogEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: 'RATE_LIMITED',
      ip: '203.0.113.10',
    }))
  })

  it('logs rejected Work.ink tokens without creating a key', async () => {
    mockedVerifyWorkinkToken.mockResolvedValue({
      success: false,
      message: 'Token already used',
      validToken: false,
    })

    const result = await generateVerifiedFreeKey('token-1', '203.0.113.10', 'generate-key API')

    expect(result).toEqual({ success: false, message: 'Token already used', status: 403 })
    expect(mockedCreateKey).not.toHaveBeenCalled()
    expect(mockedLogEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: 'TOKEN_ALREADY_USED',
      ip: '203.0.113.10',
      token: 'token-1',
    }))
  })

  it('verifies Work.ink, creates a current-format key, and logs generation', async () => {
    const result = await generateVerifiedFreeKey('token-1', '203.0.113.10', 'verify-token page')

    expect(result).toEqual({
      success: true,
      key: 'LUXY-FREE-ABCD-1234-EFGH',
      expires_at: expect.any(String),
      tokenInfo: { id: 'token-info' },
    })
    expect(mockedCheckRateLimit).toHaveBeenCalledWith('203.0.113.10', 'GENERATE')
    expect(mockedVerifyWorkinkToken).toHaveBeenCalledWith('token-1', '203.0.113.10')
    expect(mockedCreateKey).toHaveBeenCalledOnce()
    expect(mockedLogEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: 'KEY_GENERATED',
      ip: '203.0.113.10',
      key: 'LUXY-FREE-ABCD-1234-EFGH',
      message: expect.stringContaining('format: current'),
    }))
  })
})
