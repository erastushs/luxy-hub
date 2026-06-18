import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LicensesClient } from '@/app/dashboard/licenses/licenses-client'
import { KeysClient, serializeCustomMaxDevices } from '@/app/dashboard/keys/keys-client'
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
          key_type: 'monthly',
          max_devices: 3,
          device_count: 2,
          name: 'Monthly Discord',
          description: 'June supporter',
          is_active: true,
          status: 'active',
          expires_at: '2026-06-18T00:00:00.000Z',
          created_at: '2026-06-17T00:00:00.000Z',
        }, {
          id: 'key-2',
          key: 'LUXY-PREM-UNLM-BBBB',
          key_category: 'premium',
          key_type: 'custom',
          max_devices: null,
          device_count: 0,
          name: 'Partner',
          description: null,
          is_active: true,
          status: 'active',
          expires_at: '2026-06-18T00:00:00.000Z',
          created_at: '2026-06-17T00:00:00.000Z',
        }]}
        initialSummary={{ total: 2, active: 2, expired: 0, disabled: 0 }}
      />
    )

    expect(html).toContain('Keys')
    expect(html).toContain('Generate and manage access keys.')
    expect(html).toContain('Create Key')
    expect(html).toContain('Total Keys')
    expect(html).toContain('Active Keys')
    expect(html).toContain('Expired Keys')
    expect(html).toContain('Disabled Keys')
    expect(html).toContain('Existing keys')
    expect(html).toContain('monthly')
    expect(html).toContain('Devices')
    expect(html).toContain('2 / 3')
    expect(html).toContain('0 / Unlimited')
    expect(html).toContain('Monthly Discord')
    expect(html).toContain('June supporter')
    expect(html).toContain('LUXY-PREM-AAAA-BBBB')
    expect(html).toContain('Disable Key')
  })

  it('adds keys to dashboard navigation', () => {
    const html = renderToStaticMarkup(<Sidebar />)

    expect(html).toContain('/dashboard/keys')
    expect(html).toContain('Keys')
    expect(html).toContain('/docs')
    expect(html).toContain('Documentation')
  })

  it('serializes blank custom max devices as unlimited', () => {
    expect(serializeCustomMaxDevices('')).toBeNull()
    expect(serializeCustomMaxDevices('   ')).toBeNull()
    expect(serializeCustomMaxDevices('10')).toBe(10)
  })
})
