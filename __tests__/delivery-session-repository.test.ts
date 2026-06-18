import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

vi.mock('@/app/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

import { supabaseAdmin } from '@/app/lib/supabase'
import { deleteExpiredSessionsWithoutExecutions } from '@/app/lib/repositories/delivery-session-repository'

type CleanupRpcRow = {
  deleted_count: number
  processed_count: number
  remaining_candidates: number
}

function rpcResult(row: CleanupRpcRow) {
  return { data: [row], error: null }
}

describe('delivery session repository cleanup', () => {
  const mockedRpc = supabaseAdmin.rpc as unknown as Mock

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('deletes expired sessions through the cleanup RPC', async () => {
    mockedRpc.mockResolvedValueOnce(rpcResult({
      deleted_count: 4,
      processed_count: 4,
      remaining_candidates: 0,
    }))

    const count = await deleteExpiredSessionsWithoutExecutions(
      new Date('2026-01-01T00:00:00.000Z'),
      100
    )

    expect(count).toBe(4)
    expect(mockedRpc).toHaveBeenCalledTimes(1)
    expect(mockedRpc).toHaveBeenCalledWith(
      'cleanup_expired_delivery_sessions_without_executions',
      {
        before_timestamp: '2026-01-01T00:00:00.000Z',
        batch_size: 100,
      }
    )
  })

  it('returns zero when there are no expired sessions', async () => {
    mockedRpc.mockResolvedValueOnce(rpcResult({
      deleted_count: 0,
      processed_count: 0,
      remaining_candidates: 0,
    }))

    const count = await deleteExpiredSessionsWithoutExecutions(new Date('2026-01-01T00:00:00.000Z'))

    expect(count).toBe(0)
    expect(mockedRpc).toHaveBeenCalledTimes(1)
  })

  it('does not delete sessions referenced by script executions', async () => {
    mockedRpc.mockResolvedValueOnce(rpcResult({
      deleted_count: 0,
      processed_count: 5,
      remaining_candidates: 0,
    }))

    const count = await deleteExpiredSessionsWithoutExecutions(
      new Date('2026-01-01T00:00:00.000Z'),
      5
    )

    expect(count).toBe(0)
    expect(mockedRpc).toHaveBeenCalledTimes(1)
  })

  it('stops after a partial batch', async () => {
    mockedRpc.mockResolvedValueOnce(rpcResult({
      deleted_count: 2,
      processed_count: 2,
      remaining_candidates: 10,
    }))

    const count = await deleteExpiredSessionsWithoutExecutions(
      new Date('2026-01-01T00:00:00.000Z'),
      5
    )

    expect(count).toBe(2)
    expect(mockedRpc).toHaveBeenCalledTimes(1)
  })

  it('runs multiple cleanup RPC batches until exhausted', async () => {
    mockedRpc
      .mockResolvedValueOnce(rpcResult({
        deleted_count: 5,
        processed_count: 5,
        remaining_candidates: 5,
      }))
      .mockResolvedValueOnce(rpcResult({
        deleted_count: 5,
        processed_count: 5,
        remaining_candidates: 0,
      }))

    const count = await deleteExpiredSessionsWithoutExecutions(
      new Date('2026-01-01T00:00:00.000Z'),
      5,
      10
    )

    expect(count).toBe(10)
    expect(mockedRpc).toHaveBeenCalledTimes(2)
  })
})
