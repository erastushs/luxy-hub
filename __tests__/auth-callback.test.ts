import { describe, expect, it } from 'vitest'
import { getSafeAuthRedirect } from '@/app/api/auth/callback/route'

describe('auth callback redirects', () => {
  const requestUrl = 'https://luxyhub.dev/api/auth/callback?token_hash=test&type=recovery'

  it('allows relative same-origin callback redirects', () => {
    expect(getSafeAuthRedirect('/dashboard', requestUrl).toString()).toBe('https://luxyhub.dev/dashboard')
    expect(getSafeAuthRedirect('/dashboard/scripts?tab=builds', requestUrl).toString()).toBe(
      'https://luxyhub.dev/dashboard/scripts?tab=builds'
    )
  })

  it('rejects absolute and protocol-relative callback redirects', () => {
    expect(getSafeAuthRedirect('https://www.luxyhub.space/dashboard', requestUrl).toString()).toBe(
      'https://luxyhub.dev/dashboard'
    )
    expect(getSafeAuthRedirect('//www.luxyhub.space/dashboard', requestUrl).toString()).toBe(
      'https://luxyhub.dev/dashboard'
    )
  })
})
