import { describe, expect, it, vi } from 'vitest'

vi.mock('@/app/lib/repositories/token-repository', () => ({
  insertToken: vi.fn(),
}))

import { getProvider, listProviders, registerProvider } from '@/app/lib/providers/registry'
import type { KeyProvider } from '@/app/lib/providers/types'

describe('provider registry', () => {
  it('registers Work.ink by default', () => {
    const provider = getProvider('workink')

    expect(provider.key).toBe('workink')
    expect(listProviders().some((entry) => entry.key === 'workink')).toBe(true)
  })

  it('throws for unknown providers', () => {
    expect(() => getProvider('missing-provider')).toThrow('Unknown key provider: missing-provider')
  })

  it('registers and retrieves a provider adapter', async () => {
    const provider: KeyProvider = {
      key: 'test-provider',
      verifyToken: async () => ({ success: true, message: 'ok', validToken: true }),
    }

    registerProvider(provider)

    expect(getProvider('test-provider')).toBe(provider)
    await expect(getProvider('test-provider').verifyToken({ token: 'token', clientIP: '127.0.0.1' }))
      .resolves.toEqual({ success: true, message: 'ok', validToken: true })
  })
})
