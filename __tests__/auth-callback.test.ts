import { describe, expect, it } from 'vitest'
import { getSafeAuthRedirect } from '@/app/api/auth/callback/route'

describe('auth callback redirects', () => {
  const requestUrl = 'https://preview.example.com/api/auth/callback?token_hash=test&type=recovery'

  it('allows relative same-origin callback redirects', () => {
    expect(getSafeAuthRedirect('/dashboard', requestUrl).toString()).toBe('https://preview.example.com/dashboard')
    expect(getSafeAuthRedirect('/dashboard/scripts?tab=builds', requestUrl).toString()).toBe(
      'https://preview.example.com/dashboard/scripts?tab=builds'
    )
  })

  it('rejects absolute and protocol-relative callback redirects', () => {
    expect(getSafeAuthRedirect('https://www.luxyhub.space/dashboard', requestUrl).toString()).toBe(
      'https://preview.example.com/dashboard'
    )
    expect(getSafeAuthRedirect('//www.luxyhub.space/dashboard', requestUrl).toString()).toBe(
      'https://preview.example.com/dashboard'
    )
  })
})
