import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LicensesClient } from '@/app/dashboard/licenses/licenses-client'
import { KeysClient } from '@/app/dashboard/keys/keys-client'
import { Sidebar } from '@/app/dashboard/components/Sidebar'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/licenses',
}))

vi.mock('@/app/actions/auth', () => ({
  logout: vi.fn(),
}))

describe('license dashboard UI', () => {
  it('renders license management controls and one-time key warning', () => {
    const html = renderToStaticMarkup(
      <LicensesClient
        initialError={null}
        initialCreatedLicense="LUXY-PREM-XXXX-XXXX-XXXX"
        initialLicenses={[{
          id: 'license-uuid-1',
          status: 'active',
          max_assignments: 3,
          activation_count: 0,
          delivery_count: 0,
          expires_at: null,
          created_at: '2026-06-11T00:00:00.000Z',
        }]}
        scripts={[{ id: 'script-uuid-1', name: 'Premium Script', slug: 'premium-script' }]}
      />
    )

    expect(html).toContain('License Management')
    expect(html).toContain('Create License')
    expect(html).toContain('Max assignments')
    expect(html).toContain('Expires at')
    expect(html).toContain('Save this key now. It cannot be viewed again.')
    expect(html).toContain('LUXY-PREM-XXXX-XXXX-XXXX')
    expect(html).toContain('Active')
    expect(html).toContain('Disable')
    expect(html).toContain('Revoke')
    expect(html).toContain('View Assignments')
  })

  it('does not render sensitive license or assignment hashes', () => {
    const html = renderToStaticMarkup(
      <LicensesClient
        initialError={null}
        scripts={[{ id: 'script-uuid-1', name: 'Premium Script', slug: 'premium-script' }]}
      />
    )

    expect(html).not.toContain('key_hash')
    expect(html).not.toContain('customer_identifier_hash')
  })

  it('hides licenses from dashboard navigation without removing license UI', () => {
    const html = renderToStaticMarkup(<Sidebar />)

    expect(html).not.toContain('/dashboard/licenses')
    expect(html).not.toContain('Licenses')
  })

  it('renders key management and paid key issuance controls', () => {
    const html = renderToStaticMarkup(
      <KeysClient
        initialKeys={[{
          id: 'key-1',
          key: 'LUXY-PREM-AAAA-BBBB',
          key_category: 'premium',
          name: 'Monthly Discord',
          description: 'June supporter',
          is_active: true,
          status: 'active',
          expires_at: '2026-06-18T00:00:00.000Z',
          created_at: '2026-06-17T00:00:00.000Z',
        }]}
        initialSummary={{ total: 1, active: 1, expired: 0, disabled: 0 }}
      />
    )

    expect(html).toContain('Dashboard Keys')
    expect(html).toContain('Total Keys')
    expect(html).toContain('Active Keys')
    expect(html).toContain('Expired Keys')
    expect(html).toContain('Disabled Keys')
    expect(html).toContain('Existing keys')
    expect(html).toContain('Monthly Discord')
    expect(html).toContain('June supporter')
    expect(html).toContain('LUXY-PREM-AAAA-BBBB')
    expect(html).toContain('Disable Key')
    expect(html).toContain('Name')
    expect(html).toContain('Description')
    expect(html).toContain('Weekly')
    expect(html).toContain('Monthly')
    expect(html).toContain('Custom')
    expect(html).toContain('Issue key')
  })

  it('adds keys to dashboard navigation', () => {
    const html = renderToStaticMarkup(<Sidebar />)

    expect(html).toContain('/dashboard/keys')
    expect(html).toContain('Keys')
  })
})
