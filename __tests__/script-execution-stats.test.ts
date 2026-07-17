import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/lib/supabase', () => ({
  supabaseAdmin: {
    rpc: vi.fn(),
  },
}))

import { supabaseAdmin } from '@/app/lib/supabase'
import { incrementScriptExecutionStats } from '@/app/lib/repositories/script-repository'

describe('script execution stats', () => {
  const mockedRpc = vi.mocked(supabaseAdmin.rpc)

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('uses the atomic PostgreSQL increment RPC', async () => {
    mockedRpc.mockResolvedValue({ data: null, error: null } as never)

    await incrementScriptExecutionStats('script-uuid-1')

    expect(mockedRpc).toHaveBeenCalledWith('increment_script_execution_stats', {
      p_script_id: 'script-uuid-1',
    })
  })

  it('propagates RPC failures so delivery does not report a successful analytics update', async () => {
    const error = { message: 'database unavailable' }
    mockedRpc.mockResolvedValue({ data: null, error } as never)

    await expect(incrementScriptExecutionStats('script-uuid-1')).rejects.toThrow(error)
  })
})
