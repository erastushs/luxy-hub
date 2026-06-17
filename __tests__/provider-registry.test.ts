import { describe, expect, it, vi } from 'vitest'

vi.mock('@/app/lib/repositories/token-repository', () => ({
  insertToken: vi.fn(),
}))

import {
  getProvider,
  listEnabledProviderMetadata,
  listEnabledProviders,
  listProviderMetadata,
  listProviders,
  registerProvider,
  resolveEnabledProvider,
} from '@/app/lib/providers/registry'
import type { KeyProvider } from '@/app/lib/providers/types'

describe('provider registry', () => {
  it('registers Work.ink by default', () => {
    const provider = getProvider('workink')

    expect(provider.key).toBe('workink')
    expect(provider.metadata).toMatchObject({
      key: 'workink',
      displayName: 'Work.ink',
      enabled: true,
      order: 10,
    })
    expect(listProviders().some((entry) => entry.key === 'workink')).toBe(true)
  })

  it('returns ordered provider metadata with disabled placeholders', () => {
    const metadata = listProviderMetadata()

    expect(metadata.map((provider) => provider.key)).toEqual(['workink', 'linkvertise', 'lootlabs'])
    expect(metadata.find((provider) => provider.key === 'workink')).toMatchObject({ enabled: true, displayName: 'Work.ink' })
    expect(metadata.find((provider) => provider.key === 'linkvertise')).toMatchObject({ enabled: false, displayName: 'Linkvertise' })
    expect(metadata.find((provider) => provider.key === 'lootlabs')).toMatchObject({ enabled: false, displayName: 'LootLabs' })
  })

  it('filters enabled providers and metadata', () => {
    expect(listEnabledProviders().map((provider) => provider.key)).toEqual(['workink'])
    expect(listEnabledProviderMetadata().map((provider) => provider.key)).toEqual(['workink'])
  })

  it('throws for unknown providers', () => {
    expect(() => getProvider('missing-provider')).toThrow('Unknown key provider: missing-provider')
  })

  it('registers and retrieves a provider adapter', async () => {
    const provider: KeyProvider = {
      key: 'test-provider',
      metadata: {
        key: 'test-provider',
        displayName: 'Test Provider',
        description: 'Test provider',
        enabled: true,
        order: 5,
        ctaLabel: 'Test',
        estimatedTimeLabel: 'Instant',
      },
      verifyToken: async () => ({ success: true, message: 'ok', validToken: true }),
    }

    registerProvider(provider)

    expect(getProvider('test-provider')).toBe(provider)
    await expect(getProvider('test-provider').verifyToken({ token: 'token', clientIP: '127.0.0.1' }))
      .resolves.toEqual({ success: true, message: 'ok', validToken: true })
  })

  it('resolves only enabled providers safely', () => {
    expect(resolveEnabledProvider('workink')?.key).toBe('workink')
    expect(resolveEnabledProvider('linkvertise')).toBeNull()
    expect(resolveEnabledProvider('missing-provider')).toBeNull()
  })
})
