import { describe, expect, it } from 'vitest'
import { getClientIPFromHeaders } from '@/app/lib/rate-limit-ip'

describe('rate limit IP trust model', () => {
  it('uses local fallback for direct requests without proxy metadata', () => {
    expect(getClientIPFromHeaders(new Headers())).toBe('127.0.0.1')
  })

  it('trusts a single Vercel-provided forwarded IP', () => {
    expect(getClientIPFromHeaders(new Headers({
      'x-vercel-forwarded-for': '203.0.113.10',
    }))).toBe('203.0.113.10')
  })

  it('collapses spoofed forwarding chains into a shared untrusted bucket', () => {
    expect(getClientIPFromHeaders(new Headers({
      'x-forwarded-for': '198.51.100.1, 198.51.100.2',
    }))).toBe('untrusted-forwarded-chain')
  })

  it('rejects multi-hop Vercel forwarding chains as untrusted', () => {
    expect(getClientIPFromHeaders(new Headers({
      'x-vercel-forwarded-for': '203.0.113.10, 198.51.100.2',
    }))).toBe('untrusted-forwarded-chain')
  })
})
