import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/lib/repositories/token-repository', () => ({
  insertToken: vi.fn(),
}))

import { insertToken } from '@/app/lib/repositories/token-repository'
import { workinkProvider } from '@/app/lib/providers/workink-provider'

const mockedInsertToken = vi.mocked(insertToken)
const mockedFetch = vi.fn()

describe('Work.ink provider adapter', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal('fetch', mockedFetch)
  })

  it('rejects missing tokens without calling Work.ink', async () => {
    const result = await workinkProvider.verifyToken({ token: '   ', clientIP: '127.0.0.1' })

    expect(result).toEqual({ success: false, message: 'Token required', validToken: false, errorCode: 'invalid_token' })
    expect(mockedFetch).not.toHaveBeenCalled()
  })

  it('rejects oversized tokens without calling Work.ink', async () => {
    const result = await workinkProvider.verifyToken({ token: 'a'.repeat(257), clientIP: '127.0.0.1' })

    expect(result).toEqual({ success: false, message: 'Invalid token', validToken: false, errorCode: 'invalid_token' })
    expect(mockedFetch).not.toHaveBeenCalled()
  })

  it('returns invalid token when Work.ink rejects the token', async () => {
    mockedFetch.mockResolvedValue({ json: async () => ({ valid: false }) })

    const result = await workinkProvider.verifyToken({ token: 'abc123', clientIP: '127.0.0.1' })

    expect(result).toEqual({ success: false, message: 'Invalid token', validToken: false, errorCode: 'invalid_token' })
    expect(mockedFetch).toHaveBeenCalledWith('https://work.ink/_api/v2/token/isValid/abc123')
  })

  it('consumes a sanitized valid token and returns token info', async () => {
    const tokenInfo = { byIp: '127.0.0.1', user: 'test' }
    mockedFetch.mockResolvedValue({ json: async () => ({ valid: true, info: tokenInfo }) })
    mockedInsertToken.mockResolvedValue(true)

    const result = await workinkProvider.verifyToken({ token: ' abc123 ', clientIP: '127.0.0.1' })

    expect(mockedFetch).toHaveBeenCalledWith('https://work.ink/_api/v2/token/isValid/abc123')
    expect(mockedInsertToken).toHaveBeenCalledWith('abc123')
    expect(result).toEqual({
      success: true,
      message: 'Token verified',
      validToken: true,
      tokenInfo,
    })
  })

  it('preserves soft IP mismatch behavior', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockedFetch.mockResolvedValue({ json: async () => ({ valid: true, info: { byIp: '10.0.0.1' } }) })
    mockedInsertToken.mockResolvedValue(true)

    const result = await workinkProvider.verifyToken({ token: 'abc123', clientIP: '10.0.0.2' })

    expect(result.success).toBe(true)
    expect(warn).toHaveBeenCalledWith('IP mismatch: Work.ink=10.0.0.1 client=10.0.0.2 — allowing (soft check)')
    warn.mockRestore()
  })

  it('rejects already consumed tokens', async () => {
    mockedFetch.mockResolvedValue({ json: async () => ({ valid: true, info: {} }) })
    mockedInsertToken.mockResolvedValue(false)

    const result = await workinkProvider.verifyToken({ token: 'abc123', clientIP: '127.0.0.1' })

    expect(result).toEqual({ success: false, message: 'Token already used', validToken: false, errorCode: 'token_used' })
  })

  it('returns internal server error on Work.ink failures', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockedFetch.mockRejectedValue(new Error('network failed'))

    const result = await workinkProvider.verifyToken({ token: 'abc123', clientIP: '127.0.0.1' })

    expect(result).toEqual({ success: false, message: 'Internal server error', validToken: false, errorCode: 'provider_unavailable' })
    expect(error).toHaveBeenCalledWith('Work.ink verification error')
    error.mockRestore()
  })
})
