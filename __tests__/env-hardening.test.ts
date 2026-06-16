import { afterEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

describe('environment hardening', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    process.env = { ...ORIGINAL_ENV }
  })

  it('does not fall back to SUPABASE_SERVICE_ROLE_KEY for delivery payload encryption', async () => {
    delete process.env.DELIVERY_PAYLOAD_SECRET
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret'
    const { getDeliveryPayloadSecret } = await import('@/app/config/env')

    expect(getDeliveryPayloadSecret()).toBeUndefined()
  })

  it('fails fast in production when DELIVERY_PAYLOAD_SECRET is missing', async () => {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-secret')
    vi.stubEnv('DELIVERY_PAYLOAD_SECRET', '')
    const { getDeliveryPayloadSecretOrDevDefault } = await import('@/app/config/env')

    expect(() => getDeliveryPayloadSecretOrDevDefault()).toThrow('Payload secret is not configured')
  })
})
