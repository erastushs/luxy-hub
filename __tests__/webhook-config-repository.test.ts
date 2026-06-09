import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { WebhookConfigRow } from '@/app/lib/repositories/webhook-config-repository'

vi.mock('@/app/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

import { supabaseAdmin } from '@/app/lib/supabase'
import {
  createWebhookConfig,
  getWebhookConfigByScriptId,
  getEnabledWebhookConfigByScriptId,
  getWebhookConfigsByCreator,
  updateWebhookConfig,
  deleteWebhookConfig,
} from '@/app/lib/repositories/webhook-config-repository'

type QueryChain = {
  insert: Mock
  update: Mock
  select: Mock
  eq: Mock
  maybeSingle: Mock
  single: Mock
  delete: Mock
  then: (resolve: (value: { data: unknown; error: unknown }) => void) => void
}

function mockWebhookRow(overrides: Partial<WebhookConfigRow> = {}): WebhookConfigRow {
  return {
    id: 'wh-uuid-1',
    script_id: 'script-uuid-1',
    creator_id: 'creator-uuid-1',
    provider: 'discord',
    config: { webhook_url: 'https://discord.com/api/webhooks/test' },
    enabled: false,
    created_at: '2026-06-09T12:00:00.000Z',
    updated_at: '2026-06-09T12:00:00.000Z',
    ...overrides,
  }
}

function createQueryChain(
  data: WebhookConfigRow | WebhookConfigRow[] | null,
  error: unknown = null
): QueryChain {
  const chain = {} as QueryChain
  chain.insert = vi.fn(() => chain)
  chain.update = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(async () => ({
    data: Array.isArray(data) ? data[0] ?? null : data,
    error,
  }))
  chain.single = vi.fn(async () => ({
    data: Array.isArray(data) ? data[0] ?? null : data,
    error,
  }))
  chain.delete = vi.fn(() => chain)
  chain.then = (resolve) => {
    resolve({ data: Array.isArray(data) ? data : data, error })
  }
  return chain
}

describe('webhook config repository', () => {
  const mockedFrom = supabaseAdmin.from as unknown as Mock

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('creates a webhook config with disabled default', async () => {
    const row = mockWebhookRow()
    const chain = createQueryChain(row)
    mockedFrom.mockReturnValue(chain)

    const result = await createWebhookConfig({
      scriptId: 'script-uuid-1',
      creatorId: 'creator-uuid-1',
      provider: 'discord',
      config: { webhook_url: 'https://discord.com/api/webhooks/test' },
    })

    expect(result.id).toBe('wh-uuid-1')
    expect(result.provider).toBe('discord')
    expect(result.script_id).toBe('script-uuid-1')
    expect(result.creator_id).toBe('creator-uuid-1')
    expect(result.enabled).toBe(false)
    expect(chain.insert).toHaveBeenCalledWith({
      script_id: 'script-uuid-1',
      creator_id: 'creator-uuid-1',
      provider: 'discord',
      config: { webhook_url: 'https://discord.com/api/webhooks/test' },
      enabled: false,
    })
  })

  it('creates an explicitly enabled webhook config when requested', async () => {
    const chain = createQueryChain(mockWebhookRow({ enabled: true }))
    mockedFrom.mockReturnValue(chain)

    const result = await createWebhookConfig({
      scriptId: 'script-uuid-1',
      creatorId: 'creator-uuid-1',
      provider: 'slack',
      config: { webhook_url: 'https://hooks.slack.com/services/test' },
      enabled: true,
    })

    expect(result.enabled).toBe(true)
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }))
  })

  it('propagates insert errors', async () => {
    const chain = createQueryChain(null, new Error('insert failed'))
    mockedFrom.mockReturnValue(chain)

    await expect(
      createWebhookConfig({
        scriptId: 'script-uuid-1',
        creatorId: 'creator-uuid-1',
        provider: 'discord',
        config: {},
      })
    ).rejects.toThrow('insert failed')
  })

  it('returns config by script id', async () => {
    const chain = createQueryChain(mockWebhookRow())
    mockedFrom.mockReturnValue(chain)

    const result = await getWebhookConfigByScriptId('script-uuid-1')

    expect(result!.script_id).toBe('script-uuid-1')
    expect(chain.eq).toHaveBeenCalledWith('script_id', 'script-uuid-1')
  })

  it('returns enabled config by script id', async () => {
    const chain = createQueryChain(mockWebhookRow({ enabled: true }))
    mockedFrom.mockReturnValue(chain)

    const result = await getEnabledWebhookConfigByScriptId('script-uuid-1')

    expect(result!.enabled).toBe(true)
    expect(chain.eq).toHaveBeenCalledWith('script_id', 'script-uuid-1')
    expect(chain.eq).toHaveBeenCalledWith('enabled', true)
  })

  it('returns null when no config exists', async () => {
    const chain = createQueryChain(null)
    mockedFrom.mockReturnValue(chain)

    await expect(getWebhookConfigByScriptId('unknown-script')).resolves.toBeNull()
  })

  it('returns configs for a creator', async () => {
    const chain = createQueryChain([mockWebhookRow()])
    mockedFrom.mockReturnValue(chain)

    const result = await getWebhookConfigsByCreator('creator-uuid-1')

    expect(result).toHaveLength(1)
    expect(chain.eq).toHaveBeenCalledWith('creator_id', 'creator-uuid-1')
  })

  it('updates provider, config, enabled state, and timestamp', async () => {
    const updated = mockWebhookRow({
      provider: 'telegram',
      config: { bot_token: 'encrypted-token', chat_id: '123' },
      enabled: true,
    })
    const chain = createQueryChain(updated)
    mockedFrom.mockReturnValue(chain)

    const result = await updateWebhookConfig({
      scriptId: 'script-uuid-1',
      provider: 'telegram',
      config: { bot_token: 'encrypted-token', chat_id: '123' },
      enabled: true,
    })

    expect(result!.provider).toBe('telegram')
    expect(result!.enabled).toBe(true)
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'telegram',
      config: { bot_token: 'encrypted-token', chat_id: '123' },
      enabled: true,
      updated_at: expect.any(String),
    }))
  })

  it('returns null when update finds no row', async () => {
    const chain = createQueryChain(null)
    mockedFrom.mockReturnValue(chain)

    await expect(updateWebhookConfig({ scriptId: 'missing', enabled: true })).resolves.toBeNull()
  })

  it('deletes config for a script', async () => {
    const chain = createQueryChain(null)
    mockedFrom.mockReturnValue(chain)

    const result = await deleteWebhookConfig('script-uuid-1')

    expect(result).toBe(true)
    expect(chain.eq).toHaveBeenCalledWith('script_id', 'script-uuid-1')
  })

  it.each(['discord', 'telegram', 'slack'] as const)('supports %s provider type', async (provider) => {
    const chain = createQueryChain(mockWebhookRow({ provider }))
    mockedFrom.mockReturnValue(chain)

    const result = await createWebhookConfig({
      scriptId: 'script-uuid-1',
      creatorId: 'creator-uuid-1',
      provider,
      config: {},
    })

    expect(result.provider).toBe(provider)
  })
})
