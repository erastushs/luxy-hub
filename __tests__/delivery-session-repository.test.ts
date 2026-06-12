import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { DeliverySessionRow } from '@/app/lib/repositories/delivery-session-repository'

vi.mock('@/app/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

import { supabaseAdmin } from '@/app/lib/supabase'
import {
  consumeSession,
  createSession,
  deleteExpiredSessions,
  getSessionByTokenHash,
} from '@/app/lib/repositories/delivery-session-repository'

type QueryChain = {
  delete: Mock
  insert: Mock
  update: Mock
  select: Mock
  eq: Mock
  gt: Mock
  is: Mock
  lt: Mock
  single: Mock
  then: (resolve: (value: { data?: unknown; count?: number | null; error: unknown }) => void) => void
}

function sessionRow(overrides: Partial<DeliverySessionRow> = {}): DeliverySessionRow {
  return {
    id: 'session-uuid-1',
    script_id: 'script-uuid-1',
    build_id: 'build-uuid-1',
    session_token_hash: '0'.repeat(64),
    expires_at: '2026-01-01T00:01:00.000Z',
    consumed_at: null,
    event_secret: 'event-secret',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function createQueryChain(data: DeliverySessionRow | null, error: unknown = null, count: number | null = null): QueryChain {
  const chain = {} as QueryChain
  chain.delete = vi.fn(() => chain)
  chain.insert = vi.fn(() => chain)
  chain.update = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.gt = vi.fn(() => chain)
  chain.is = vi.fn(() => chain)
  chain.lt = vi.fn(() => chain)
  chain.single = vi.fn(async () => ({ data, error }))
  chain.then = (resolve) => {
    resolve({ data, count, error })
  }
  return chain
}

describe('delivery session repository', () => {
  const mockedFrom = supabaseAdmin.from as unknown as Mock

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('creates sessions with token hash and event secret only', async () => {
    const row = sessionRow()
    const chain = createQueryChain(row)
    mockedFrom.mockReturnValue(chain)

    await expect(createSession({
      scriptId: 'script-uuid-1',
      buildId: 'build-uuid-1',
      tokenHash: '0'.repeat(64),
      expiresAt: '2026-01-01T00:01:00.000Z',
      eventSecret: 'event-secret',
    })).resolves.toEqual(row)

    expect(mockedFrom).toHaveBeenCalledWith('delivery_sessions')
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
      script_id: 'script-uuid-1',
      build_id: 'build-uuid-1',
      session_token_hash: '0'.repeat(64),
      expires_at: '2026-01-01T00:01:00.000Z',
      event_secret: 'event-secret',
      consumed_at: null,
    }))
    expect(JSON.stringify(chain.insert.mock.calls[0][0])).not.toContain('raw-session-token')
  })

  it('returns null for token lookup errors to preserve uniform invalid-session handling', async () => {
    const chain = createQueryChain(null, { message: 'not found' })
    mockedFrom.mockReturnValue(chain)

    await expect(getSessionByTokenHash('0'.repeat(64))).resolves.toBeNull()
    expect(chain.eq).toHaveBeenCalledWith('session_token_hash', '0'.repeat(64))
  })

  it('consumes sessions atomically only when unconsumed and unexpired', async () => {
    const consumed = sessionRow({ consumed_at: '2026-01-01T00:00:10.000Z' })
    const chain = createQueryChain(consumed)
    mockedFrom.mockReturnValue(chain)

    await expect(consumeSession('session-uuid-1')).resolves.toEqual(consumed)

    expect(chain.update).toHaveBeenCalledWith({ consumed_at: expect.any(String) })
    expect(chain.eq).toHaveBeenCalledWith('id', 'session-uuid-1')
    expect(chain.is).toHaveBeenCalledWith('consumed_at', null)
    expect(chain.gt).toHaveBeenCalledWith('expires_at', expect.any(String))
  })

  it('returns null when atomic consume update fails', async () => {
    const chain = createQueryChain(null, { message: 'already consumed' })
    mockedFrom.mockReturnValue(chain)

    await expect(consumeSession('session-uuid-1')).resolves.toBeNull()
  })

  it('deletes expired sessions and returns exact count safely', async () => {
    const chain = createQueryChain(null, null, 3)
    mockedFrom.mockReturnValue(chain)

    await expect(deleteExpiredSessions(new Date('2026-01-01T00:00:00.000Z'))).resolves.toBe(3)

    expect(chain.delete).toHaveBeenCalledWith({ count: 'exact' })
    expect(chain.lt).toHaveBeenCalledWith('expires_at', '2026-01-01T00:00:00.000Z')
  })
})
