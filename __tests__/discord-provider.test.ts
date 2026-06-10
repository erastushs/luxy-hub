import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventLogRow } from '@/app/lib/repositories/event-repository'
import type { WebhookConfigRow } from '@/app/lib/repositories/webhook-config-repository'
import { discordProvider, validateConfig, validateWebhookUrl } from '@/app/lib/providers/discord-provider'

const VALID_WEBHOOK_URL = 'https://discord.com/api/webhooks/1234567890/abc123def456'

function eventRow(overrides: Partial<EventLogRow> = {}): EventLogRow {
  return {
    id: 'event-001',
    script_id: 'script-001',
    session_id: 'session-001',
    event_type: 'execute',
    payload: { player: 'Player1', score: 100 },
    delivery_status: 'pending',
    retry_count: 0,
    timestamp: '2026-06-09T12:00:00.000Z',
    received_at: '2026-06-09T12:00:01.000Z',
    nonce: 'a'.repeat(32),
    last_retry_at: null,
    delivered_at: null,
    error_message: null,
    claimed_at: null,
    created_at: '2026-06-09T12:00:01.000Z',
    ...overrides,
  }
}

function webhookConfig(overrides: Partial<WebhookConfigRow> = {}): WebhookConfigRow {
  return {
    id: 'cfg-001',
    script_id: 'script-001',
    creator_id: 'creator-001',
    provider: 'discord',
    config: { webhook_url: VALID_WEBHOOK_URL },
    enabled: true,
    created_at: '2026-06-09T12:00:00.000Z',
    updated_at: '2026-06-09T12:00:00.000Z',
    ...overrides,
  }
}

function stubFetch(status: number, body: BodyInit | null = null) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status })))
}

function stubNetworkError(message: string) {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error(message)))
}

// ---------------------------------------------------------------------------
// validateWebhookUrl
// ---------------------------------------------------------------------------

describe('validateWebhookUrl', () => {
  it('accepts a valid Discord webhook URL', () => {
    expect(validateWebhookUrl(VALID_WEBHOOK_URL)).toEqual({ valid: true })
    expect(validateWebhookUrl('https://discordapp.com/api/webhooks/999/xyz')).toEqual({ valid: true })
  })

  it('rejects non-string inputs', () => {
    expect(validateWebhookUrl(null).valid).toBe(false)
    expect(validateWebhookUrl(undefined).valid).toBe(false)
    expect(validateWebhookUrl(123).valid).toBe(false)
    expect(validateWebhookUrl('').valid).toBe(false)
  })

  it('rejects malformed webhook URLs', () => {
    expect(validateWebhookUrl('not-a-url').valid).toBe(false)
    expect(validateWebhookUrl('https://example.com/webhook').valid).toBe(false)
    expect(validateWebhookUrl('https://discord.com/api/webhooks/').valid).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// validateConfig
// ---------------------------------------------------------------------------

describe('validateConfig', () => {
  it('accepts a valid enabled discord config', () => {
    expect(validateConfig(webhookConfig())).toEqual({ valid: true })
  })

  it('rejects wrong provider', () => {
    const cfg = webhookConfig({ provider: 'telegram' })
    expect(validateConfig(cfg).valid).toBe(false)
    expect(validateConfig(cfg).reason).toContain('not discord')
  })

  it('rejects disabled config', () => {
    const cfg = webhookConfig({ enabled: false })
    expect(validateConfig(cfg).valid).toBe(false)
    expect(validateConfig(cfg).reason).toContain('disabled')
  })

  it('rejects config with missing webhook_url', () => {
    const cfg = webhookConfig({ config: {} })
    expect(validateConfig(cfg).valid).toBe(false)
  })

  it('rejects config with malformed webhook_url', () => {
    const cfg = webhookConfig({ config: { webhook_url: 'bad-url' } })
    expect(validateConfig(cfg).valid).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Discord delivery
// ---------------------------------------------------------------------------

describe('discordProvider.deliver', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('succeeds when Discord returns 200', async () => {
    stubFetch(200, '{}')
    const result = await discordProvider.deliver(eventRow(), VALID_WEBHOOK_URL)
    expect(result.success).toBe(true)
    expect(result.retryable).toBe(false)
  })

  it('succeeds when Discord returns 204 (no body)', async () => {
    stubFetch(204)
    const result = await discordProvider.deliver(eventRow(), VALID_WEBHOOK_URL)
    expect(result.success).toBe(true)
  })

  it('marks 429 as retryable', async () => {
    stubFetch(429, JSON.stringify({ retry_after: 1 }))
    const result = await discordProvider.deliver(eventRow(), VALID_WEBHOOK_URL)
    expect(result.success).toBe(false)
    expect(result.retryable).toBe(true)
    expect(result.error).toContain('rate limited')
  })

  it('marks 5xx as retryable', async () => {
    stubFetch(502, '{}')
    const result = await discordProvider.deliver(eventRow(), VALID_WEBHOOK_URL)
    expect(result.success).toBe(false)
    expect(result.retryable).toBe(true)
    expect(result.error).toContain('502')
  })

  it('marks network errors as retryable', async () => {
    stubNetworkError('fetch failed')
    const result = await discordProvider.deliver(eventRow(), VALID_WEBHOOK_URL)
    expect(result.success).toBe(false)
    expect(result.retryable).toBe(true)
    expect(result.error).toContain('fetch failed')
  })

  it('marks 404 code 10015 as permanent', async () => {
    stubFetch(404, JSON.stringify({ code: 10015, message: 'Unknown Webhook' }))
    const result = await discordProvider.deliver(eventRow(), VALID_WEBHOOK_URL)
    expect(result.success).toBe(false)
    expect(result.retryable).toBe(false)
    expect(result.error).toContain('deleted')
  })

  it('marks 400 as permanent', async () => {
    stubFetch(400, JSON.stringify({ message: 'Bad request' }))
    const result = await discordProvider.deliver(eventRow(), VALID_WEBHOOK_URL)
    expect(result.success).toBe(false)
    expect(result.retryable).toBe(false)
    expect(result.error).toContain('400')
  })

  it('marks 401 as permanent', async () => {
    stubFetch(401, JSON.stringify({}))
    const result = await discordProvider.deliver(eventRow(), VALID_WEBHOOK_URL)
    expect(result.success).toBe(false)
    expect(result.retryable).toBe(false)
  })

  it('rejects invalid webhook URL before HTTP call', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const result = await discordProvider.deliver(eventRow(), 'not-a-url')

    expect(result.success).toBe(false)
    expect(result.retryable).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('sends a Discord embed with correct title', async () => {
    let capturedBody: unknown = null
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string)
      return new Response('{}', { status: 200 })
    }))

    await discordProvider.deliver(eventRow({ event_type: 'purchase' }), VALID_WEBHOOK_URL)

    const embeds = (capturedBody as { embeds: Array<{ title: string }> })?.embeds
    expect(embeds[0].title).toBe('Purchase')
  })

  it('includes payload fields in the embed', async () => {
    let capturedBody: unknown = null
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string)
      return new Response('{}', { status: 200 })
    }))

    await discordProvider.deliver(eventRow({ payload: { player: 'Player1', score: 100 } }), VALID_WEBHOOK_URL)

    const embeds = (capturedBody as { embeds: Array<{ fields: Array<{ name: string; value: string }> }> })?.embeds
    const fields = embeds[0].fields
    expect(fields.find((f) => f.name === 'player')).toBeDefined()
    expect(fields.find((f) => f.name === 'score')).toBeDefined()
  })

  it.each(['execute', 'purchase', 'error', 'ban', 'key_redeem', 'heartbeat', 'license_activate', 'license_revoke'])(
    'includes color and timestamp for %s',
    async (eventType) => {
      let capturedBody: unknown = null
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        capturedBody = JSON.parse(init.body as string)
        return new Response('{}', { status: 200 })
      }))

      await discordProvider.deliver(
        eventRow({ event_type: eventType as EventLogRow['event_type'] }),
        VALID_WEBHOOK_URL,
      )

      const embed = (capturedBody as { embeds: Array<{ color: number; timestamp: string }> }).embeds[0]
      expect(typeof embed.color).toBe('number')
      expect(embed.timestamp).toBe('2026-06-09T12:00:00.000Z')
    }
  )
})
