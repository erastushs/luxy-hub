import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}))

vi.mock('@/app/lib/services/provider-key-issuance-service', () => ({
  issueProviderKey: vi.fn(),
}))

vi.mock('@/app/lib/providers/registry', () => ({
  listProviderMetadata: () => [
    {
      key: 'workink',
      displayName: 'Work.ink',
      description: 'Complete a short verification offer to receive a 24-hour LuxyHub key.',
      enabled: true,
      order: 10,
      ctaLabel: 'Generate Key via Work.ink',
      estimatedTimeLabel: 'Usually 30-60 seconds',
    },
    {
      key: 'linkvertise',
      displayName: 'Linkvertise',
      description: 'Planned provider support for future key generation flows.',
      enabled: false,
      order: 20,
      ctaLabel: 'Coming Soon',
      estimatedTimeLabel: 'Not available yet',
    },
    {
      key: 'lootlabs',
      displayName: 'LootLabs',
      description: 'Planned provider support for future key generation flows.',
      enabled: false,
      order: 30,
      ctaLabel: 'Coming Soon',
      estimatedTimeLabel: 'Not available yet',
    },
  ],
}))

vi.mock('@/app/lib/providers/config', () => ({
  getProviderRuntimeConfig: (key: string) => key === 'workink'
    ? { href: 'https://work.ink/2Dlr/luxyhub' }
    : {},
}))

vi.mock('@/app/components/CopyKeyButton', () => ({
  default: ({ value }: { value: string }) => <button type="button">Copy {value}</button>,
}))

vi.mock('@/app/components/Navbar', () => ({
  default: () => <nav>Navbar</nav>,
}))

vi.mock('@/app/components/Footer', () => ({
  default: () => <footer>Footer</footer>,
}))

import { headers } from 'next/headers'
import GetKeyPage from '@/app/get-key/page'
import VerifyTokenPage from '@/app/verify-token/page'
import { issueProviderKey } from '@/app/lib/services/provider-key-issuance-service'

const mockedHeaders = vi.mocked(headers)
const mockedIssueProviderKey = vi.mocked(issueProviderKey)

describe('provider-aware get-key flow', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedHeaders.mockResolvedValue({
      get: (name: string) => name === 'x-forwarded-for' ? '203.0.113.10' : null,
    } as Awaited<ReturnType<typeof headers>>)
  })

  it('renders enabled Work.ink and disabled future provider cards', () => {
    const html = renderToStaticMarkup(<GetKeyPage />)

    expect(html).toContain('Work.ink')
    expect(html).toContain('Generate Key via Work.ink')
    expect(html).toContain('https://work.ink/2Dlr/luxyhub')
    expect(html).toContain('Linkvertise')
    expect(html).toContain('LootLabs')
    expect(html).toContain('Coming soon')
  })

  it('uses explicit provider query param during verification', async () => {
    mockedIssueProviderKey.mockResolvedValue({
      success: true,
      key: 'LUXY-AAAA-BBBB-CCCC',
      expires_at: '2026-06-18T00:00:00.000Z',
      verification: { success: true, message: 'Token verified', validToken: true },
    })

    const element = await VerifyTokenPage({ searchParams: Promise.resolve({ provider: 'workink', token: 'token-1' }) })
    const html = renderToStaticMarkup(element)

    expect(mockedIssueProviderKey).toHaveBeenCalledWith({ providerKey: 'workink', token: 'token-1', clientIP: '203.0.113.10' })
    expect(html).toContain('Your Key is Ready')
    expect(html).toContain('LUXY-AAAA-BBBB-CCCC')
  })

  it('defaults missing provider to Work.ink for backward compatibility', async () => {
    mockedIssueProviderKey.mockResolvedValue({
      success: true,
      key: 'LUXY-AAAA-BBBB-CCCC',
      expires_at: '2026-06-18T00:00:00.000Z',
      verification: { success: true, message: 'Token verified', validToken: true },
    })

    await VerifyTokenPage({ searchParams: Promise.resolve({ token: 'legacy-token' }) })

    expect(mockedIssueProviderKey).toHaveBeenCalledWith({ providerKey: 'workink', token: 'legacy-token', clientIP: '203.0.113.10' })
  })

  it('renders unavailable provider failures safely', async () => {
    mockedIssueProviderKey.mockResolvedValue({
      success: false,
      message: 'Provider unavailable',
      errorCode: 'provider_unavailable',
      verification: { success: false, message: 'Provider unavailable', validToken: false, errorCode: 'provider_unavailable' },
    })

    const element = await VerifyTokenPage({ searchParams: Promise.resolve({ provider: 'linkvertise', token: 'token-1' }) })
    const html = renderToStaticMarkup(element)

    expect(mockedIssueProviderKey).toHaveBeenCalledWith({ providerKey: 'linkvertise', token: 'token-1', clientIP: '203.0.113.10' })
    expect(html).toContain('Invalid Token')
    expect(html).toContain('selected provider')
  })
})
