import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

vi.mock('@/app/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

import { supabaseAdmin } from '@/app/lib/supabase'
import { PostgresRateLimitAdapter } from '@/app/lib/rate-limit/postgres-adapter'
import {
  checkEventRateLimit,
  checkLoginFailureLimit,
  checkRateLimit,
  clearLoginFailures,
  recordLoginFailure,
  resetRateLimitAdapterForTests,
  setRateLimitAdapterForTests,
  type RateLimitAdapter,
} from '@/app/lib/rate-limit'

type QueryChain = Record<string, Mock>

function createInsertResult(error: Error | null = null): QueryChain {
  return {
    insert: vi.fn(() => ({ error })),
  }
}

function createCountChain(count: number | null, error: Error | null = null): QueryChain {
  const chain = {} as QueryChain
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.gte = vi.fn(() => chain)
  chain.lte = vi.fn(() => ({ count, error }))
  return chain
}

function createDeleteChain(error: Error | null = null): QueryChain {
  const chain = {} as QueryChain
  chain.delete = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.then = vi.fn((resolve: (value: unknown) => void) => {
    resolve({ error })
    return undefined as unknown as Promise<unknown>
  })
  return chain
}

function adapterStub(): RateLimitAdapter {
  return {
    checkGeneralLimit: vi.fn(async () => ({ allowed: true as const })),
    checkLoginFailure: vi.fn(async () => ({ allowed: true as const })),
    recordLoginFailure: vi.fn(async () => {}),
    clearLoginFailures: vi.fn(async () => {}),
    checkEventLimit: vi.fn(async () => ({ allowed: true as const })),
  }
}

describe('RateLimitAdapter PostgreSQL implementation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    resetRateLimitAdapterForTests()
    process.env.ANALYTICS_PEPPER = 'test-pepper'
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('preserves general insert-before-count query behavior', async () => {
    const insert = createInsertResult()
    const count = createCountChain(30)
    ;(supabaseAdmin.from as Mock).mockReturnValueOnce(insert).mockReturnValueOnce(count)

    const result = await new PostgresRateLimitAdapter().checkGeneralLimit('203.0.113.10', 'VALIDATE')

    expect(result).toEqual({ allowed: true })
    expect(supabaseAdmin.from).toHaveBeenNthCalledWith(1, 'rate_limits')
    expect(insert.insert).toHaveBeenCalledWith({
      ip: '203.0.113.10',
      endpoint: 'VALIDATE',
      created_at: expect.any(String),
    })
    expect(supabaseAdmin.from).toHaveBeenNthCalledWith(2, 'rate_limits')
    expect(count.select).toHaveBeenCalledWith('id', { count: 'exact', head: true })
    expect(count.eq).toHaveBeenCalledWith('ip', '203.0.113.10')
    expect(count.eq).toHaveBeenCalledWith('endpoint', 'VALIDATE')
    expect(count.gte).toHaveBeenCalledWith('created_at', expect.any(String))
    expect(count.lte).toHaveBeenCalledWith('created_at', expect.any(String))
  })

  it('preserves general fail-closed retry-after behavior', async () => {
    ;(supabaseAdmin.from as Mock).mockReturnValueOnce(createInsertResult(new Error('insert failed')))

    const result = await new PostgresRateLimitAdapter().checkGeneralLimit('203.0.113.10', 'GENERATE')

    expect(result).toEqual({ allowed: false, retryAfter: 86400 })
  })

  it('preserves login IP and email bucket checks', async () => {
    const ipCount = createCountChain(0)
    const emailCount = createCountChain(9)
    ;(supabaseAdmin.from as Mock).mockReturnValueOnce(ipCount).mockReturnValueOnce(emailCount)

    const result = await new PostgresRateLimitAdapter().checkLoginFailure(
      '203.0.113.10',
      'Creator@Example.com '
    )

    expect(result).toEqual({ allowed: true })
    expect(ipCount.eq).toHaveBeenCalledWith('ip', '203.0.113.10')
    expect(ipCount.eq).toHaveBeenCalledWith('endpoint', 'LOGIN_FAILED_IP')
    expect(emailCount.eq).toHaveBeenCalledWith('ip', expect.stringMatching(/^email:[a-f0-9]{64}$/))
    expect(emailCount.eq).toHaveBeenCalledWith('endpoint', 'LOGIN_FAILED_EMAIL')
  })

  it('preserves login denial at max failure count', async () => {
    const ipCount = createCountChain(5)
    ;(supabaseAdmin.from as Mock).mockReturnValueOnce(ipCount)

    const result = await new PostgresRateLimitAdapter().checkLoginFailure('203.0.113.10', 'creator@example.com')

    expect(result).toEqual({ allowed: false, retryAfter: 300 })
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(1)
  })

  it('preserves login failure insert rows and email cleanup semantics', async () => {
    const insert = createInsertResult()
    const deleteChain = createDeleteChain()
    ;(supabaseAdmin.from as Mock).mockReturnValueOnce(insert).mockReturnValueOnce(deleteChain)
    const adapter = new PostgresRateLimitAdapter()

    await adapter.recordLoginFailure('203.0.113.10', 'creator@example.com')
    await adapter.clearLoginFailures('203.0.113.10', 'creator@example.com')

    expect(insert.insert).toHaveBeenCalledWith([
      { ip: '203.0.113.10', endpoint: 'LOGIN_FAILED_IP', created_at: expect.any(String) },
      { ip: expect.stringMatching(/^email:[a-f0-9]{64}$/), endpoint: 'LOGIN_FAILED_EMAIL', created_at: expect.any(String) },
    ])
    expect(deleteChain.delete).toHaveBeenCalled()
    expect(deleteChain.eq).toHaveBeenCalledWith('ip', expect.stringMatching(/^email:[a-f0-9]{64}$/))
    expect(deleteChain.eq).toHaveBeenCalledWith('endpoint', 'LOGIN_FAILED_EMAIL')
  })

  it('preserves event insert-before-count behavior', async () => {
    const insert = createInsertResult()
    const count = createCountChain(10)
    ;(supabaseAdmin.from as Mock).mockReturnValueOnce(insert).mockReturnValueOnce(count)

    const result = await new PostgresRateLimitAdapter().checkEventLimit('session-uuid-1')

    expect(result).toEqual({ allowed: true })
    expect(insert.insert).toHaveBeenCalledWith({
      ip: 'session-uuid-1',
      endpoint: 'EVENT_REPORT:session-uuid-1',
      created_at: expect.any(String),
    })
    expect(count.eq).toHaveBeenCalledWith('ip', 'session-uuid-1')
    expect(count.eq).toHaveBeenCalledWith('endpoint', 'EVENT_REPORT:session-uuid-1')
  })

  it('preserves event denial at count greater than max', async () => {
    ;(supabaseAdmin.from as Mock)
      .mockReturnValueOnce(createInsertResult())
      .mockReturnValueOnce(createCountChain(11))

    const result = await new PostgresRateLimitAdapter().checkEventLimit('session-uuid-1')

    expect(result).toEqual({ allowed: false, retryAfter: 60 })
  })
})

describe('rate-limiter facade delegation', () => {
  beforeEach(() => {
    resetRateLimitAdapterForTests()
  })

  it('delegates all public facade methods to the selected adapter', async () => {
    const adapter = adapterStub()
    setRateLimitAdapterForTests(adapter)

    await checkRateLimit('ip-1', 'VALIDATE')
    await checkLoginFailureLimit('ip-1', 'creator@example.com')
    await recordLoginFailure('ip-1', 'creator@example.com')
    await clearLoginFailures('ip-1', 'creator@example.com')
    await checkEventRateLimit('session-1')

    expect(adapter.checkGeneralLimit).toHaveBeenCalledWith('ip-1', 'VALIDATE')
    expect(adapter.checkLoginFailure).toHaveBeenCalledWith('ip-1', 'creator@example.com')
    expect(adapter.recordLoginFailure).toHaveBeenCalledWith('ip-1', 'creator@example.com')
    expect(adapter.clearLoginFailures).toHaveBeenCalledWith('ip-1', 'creator@example.com')
    expect(adapter.checkEventLimit).toHaveBeenCalledWith('session-1')
  })
})
