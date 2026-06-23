import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

import { ValkeyRateLimitAdapter, createRateLimitKey } from '@/app/lib/rate-limit/valkey-adapter'
import { resolveRateLimitAdapter } from '@/app/lib/rate-limit/runtime'
import { PostgresRateLimitAdapter } from '@/app/lib/rate-limit/postgres-adapter'
import type { ValkeyClient } from '@/app/lib/valkey/types'
import type { ValkeyConnectionManager } from '@/app/lib/valkey/connection'

type ScriptCall = {
  script: string
  keys: string[]
  arguments: string[]
}

class MockValkeyClient implements ValkeyClient {
  isOpen = true
  isReady = true
  store = new Map<string, { count: number; ttlMs: number }>()
  evalCalls: ScriptCall[] = []
  delCalls: Array<string | string[]> = []
  failEval = false

  async connect() {}
  async quit() {}
  async ping() { return 'PONG' }
  async info() { return '' }
  on() { return this }

  async eval(script: string, options: { keys: string[]; arguments: string[] }) {
    this.evalCalls.push({ script, keys: options.keys, arguments: options.arguments })

    if (this.failEval) {
      throw new Error('valkey unavailable')
    }

    const key = options.keys[0]

    if (options.arguments.length === 0) {
      const current = this.store.get(key)
      return [current?.count ?? 0, current?.ttlMs ?? -2]
    }

    const ttlMs = Number(options.arguments[0])
    const current = this.store.get(key)
    const next = current
      ? { count: current.count + 1, ttlMs: current.ttlMs }
      : { count: 1, ttlMs }

    this.store.set(key, next)
    return [next.count, next.ttlMs]
  }

  async del(key: string | string[]) {
    this.delCalls.push(key)

    if (Array.isArray(key)) {
      let deleted = 0
      for (const entry of key) {
        deleted += this.store.delete(entry) ? 1 : 0
      }
      return deleted
    }

    return this.store.delete(key) ? 1 : 0
  }
}

function managerFor(client: MockValkeyClient | null): ValkeyConnectionManager {
  return {
    isEnabled: () => client !== null,
    getConfig: () => ({
      enabled: client !== null,
      requestedEnabled: client !== null,
      host: '127.0.0.1',
      port: 6379,
      password: null,
      database: 0,
      tls: false,
      connectTimeoutMs: 1000,
      commandTimeoutMs: 1000,
      errors: [],
    }),
    getState: () => client ? 'ready' : 'disabled',
    getClient: () => client,
    getConnectedSince: () => null,
    getLastReconnectAt: () => null,
    connect: async () => client,
    disconnect: async () => {},
    shutdown: () => {},
  }
}

describe('ValkeyRateLimitAdapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.VALKEY_NAMESPACE_ENV = 'test'
    process.env.ANALYTICS_PEPPER = 'test-pepper'
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('allows requests within the general limit and sets a TTL atomically', async () => {
    const client = new MockValkeyClient()
    const adapter = new ValkeyRateLimitAdapter(managerFor(client))

    const result = await adapter.checkGeneralLimit('203.0.113.10', 'VALIDATE')

    expect(result).toEqual({ allowed: true })
    expect(client.evalCalls).toHaveLength(1)
    expect(client.evalCalls[0].arguments).toEqual(['60000'])
    expect([...client.store.values()][0]).toEqual({ count: 1, ttlMs: 60_000 })
  })

  it('denies requests over the general limit with PostgreSQL-compatible retry-after', async () => {
    const client = new MockValkeyClient()
    const adapter = new ValkeyRateLimitAdapter(managerFor(client))

    let result = await adapter.checkGeneralLimit('203.0.113.10', 'VALIDATE')
    for (let index = 0; index < 30; index += 1) {
      result = await adapter.checkGeneralLimit('203.0.113.10', 'VALIDATE')
    }

    expect(result).toEqual({ allowed: false, retryAfter: 60 })
  })

  it('uses deterministic namespaced hashed keys without raw identifiers', () => {
    const first = createRateLimitKey('general', 'VALIDATE', '203.0.113.10')
    const second = createRateLimitKey('general', 'VALIDATE', '203.0.113.10')

    expect(first).toBe(second)
    expect(first).toMatch(/^luxyhub:test:rate:general:[a-f0-9]{64}:[a-f0-9]{64}$/)
    expect(first).not.toContain('203.0.113.10')
    expect(first).not.toContain('VALIDATE')
  })

  it('checks login failure limits without incrementing counters', async () => {
    const client = new MockValkeyClient()
    const adapter = new ValkeyRateLimitAdapter(managerFor(client))

    const result = await adapter.checkLoginFailure('203.0.113.10', 'creator@example.com')

    expect(result).toEqual({ allowed: true })
    expect(client.evalCalls).toHaveLength(2)
    expect(client.evalCalls.every((call) => call.arguments.length === 0)).toBe(true)
  })

  it('records login failures in IP and hashed email buckets', async () => {
    const client = new MockValkeyClient()
    const adapter = new ValkeyRateLimitAdapter(managerFor(client))

    await adapter.recordLoginFailure('203.0.113.10', 'Creator@Example.com')

    expect(client.evalCalls).toHaveLength(2)
    expect(client.evalCalls[0].arguments).toEqual(['300000'])
    expect(client.evalCalls[1].arguments).toEqual(['900000'])
    expect([...client.store.keys()].join('\n')).not.toContain('Creator@Example.com')
    expect([...client.store.keys()].join('\n')).not.toContain('203.0.113.10')
  })

  it('clears only the login email failure bucket', async () => {
    const client = new MockValkeyClient()
    const adapter = new ValkeyRateLimitAdapter(managerFor(client))

    await adapter.recordLoginFailure('203.0.113.10', 'creator@example.com')
    expect(client.store.size).toBe(2)

    await adapter.clearLoginFailures('203.0.113.10', 'creator@example.com')

    expect(client.delCalls).toHaveLength(1)
    expect(client.store.size).toBe(1)
  })

  it('denies login when IP failure count reaches the existing threshold', async () => {
    const client = new MockValkeyClient()
    const adapter = new ValkeyRateLimitAdapter(managerFor(client))

    for (let index = 0; index < 5; index += 1) {
      await adapter.recordLoginFailure('203.0.113.10', null)
    }

    const result = await adapter.checkLoginFailure('203.0.113.10', 'creator@example.com')

    expect(result).toEqual({ allowed: false, retryAfter: 300 })
  })

  it('enforces event limits and hashes raw session identifiers', async () => {
    const client = new MockValkeyClient()
    const adapter = new ValkeyRateLimitAdapter(managerFor(client))
    const sessionId = 'session-token-that-must-not-appear-in-key'

    let result = await adapter.checkEventLimit(sessionId)
    for (let index = 0; index < 10; index += 1) {
      result = await adapter.checkEventLimit(sessionId)
    }

    expect(result).toEqual({ allowed: false, retryAfter: 60 })
    const key = [...client.store.keys()][0]
    expect(key).toMatch(/^luxyhub:test:rate:event:/)
    expect(key).not.toContain(sessionId)
  })

  it('fails closed when the connection manager returns no client', async () => {
    const adapter = new ValkeyRateLimitAdapter(managerFor(null))

    await expect(adapter.checkGeneralLimit('203.0.113.10', 'VALIDATE')).resolves.toEqual({
      allowed: false,
      retryAfter: 60,
    })
  })

  it('fails closed and logs safely when Valkey commands fail', async () => {
    const client = new MockValkeyClient()
    client.failEval = true
    const adapter = new ValkeyRateLimitAdapter(managerFor(client))

    const result = await adapter.checkGeneralLimit('203.0.113.10', 'VALIDATE')

    expect(result).toEqual({ allowed: false, retryAfter: 60 })
    const output = vi.mocked(console.warn).mock.calls.flat().join('\n')
    expect(output).toContain('adapter_failure')
    expect(output).not.toContain('203.0.113.10')
  })

  it('can surface failures without logging for shadow execution', async () => {
    const client = new MockValkeyClient()
    client.failEval = true
    const adapter = new ValkeyRateLimitAdapter(managerFor(client), {
      logFailures: false,
      throwOnFailure: true,
    })

    await expect(adapter.checkGeneralLimit('203.0.113.10', 'VALIDATE')).rejects.toThrow('valkey unavailable')
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('is not selected by the runtime in this phase', () => {
    expect(resolveRateLimitAdapter({ RATE_LIMIT_MODE: 'valkey' })).toBeInstanceOf(PostgresRateLimitAdapter)
  })
})
