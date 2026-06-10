import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScriptRow } from '@/app/lib/repositories/script-repository'
import type { WebhookConfigRow } from '@/app/lib/repositories/webhook-config-repository'

// ---------------------------------------------------------------------------
// Mock: ownership
// ---------------------------------------------------------------------------

vi.mock('@/app/lib/auth/ownership', () => ({
  getOwnedScript: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Mock: webhook-config repository
// ---------------------------------------------------------------------------

vi.mock('@/app/lib/repositories/webhook-config-repository', () => ({
  getWebhookConfigByScriptId: vi.fn(),
  createWebhookConfig: vi.fn(),
  updateWebhookConfig: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Mock: event repository
// ---------------------------------------------------------------------------

vi.mock('@/app/lib/repositories/event-repository', () => ({
  createEventLog: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Mock: discord-provider (validateWebhookUrl, validateConfig)
// ---------------------------------------------------------------------------

vi.mock('@/app/lib/providers/discord-provider', () => ({
  validateWebhookUrl: vi.fn(),
  validateConfig: vi.fn(),
  discordProvider: { deliver: vi.fn().mockResolvedValue({ success: true, retryable: false }) },
}))

// ---------------------------------------------------------------------------
// Mock: event-queue-service
// ---------------------------------------------------------------------------

vi.mock('@/app/lib/services/event-queue-service', () => ({
  processEventQueue: vi.fn(),
  processSingleEvent: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Imports after hoisted mocks
// ---------------------------------------------------------------------------

import { getOwnedScript } from '@/app/lib/auth/ownership'
import {
  getWebhookConfigByScriptId,
  createWebhookConfig,
  updateWebhookConfig,
} from '@/app/lib/repositories/webhook-config-repository'
import { createEventLog } from '@/app/lib/repositories/event-repository'
import { validateWebhookUrl, validateConfig } from '@/app/lib/providers/discord-provider'
import { processEventQueue, processSingleEvent } from '@/app/lib/services/event-queue-service'
import {
  getWebhookConfigSafe,
  saveWebhookConfig,
  toggleWebhookConfig,
  sendTestWebhookEvent,
} from '@/app/lib/services/dashboard-webhook-service'

const mockedGetOwnedScript = vi.mocked(getOwnedScript)
const mockedGetConfig = vi.mocked(getWebhookConfigByScriptId)
const mockedCreateConfig = vi.mocked(createWebhookConfig)
const mockedUpdateConfig = vi.mocked(updateWebhookConfig)
const mockedCreateEventLog = vi.mocked(createEventLog)
const mockedValidateWebhookUrl = vi.mocked(validateWebhookUrl)
const mockedValidateConfig = vi.mocked(validateConfig)
const mockedProcessEventQueue = vi.mocked(processEventQueue)
const mockedProcessSingleEvent = vi.mocked(processSingleEvent)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_WEBHOOK_URL = 'https://discord.com/api/webhooks/1234567890/abc123'
const OWNER_ID = 'owner-001'
const SCRIPT_SLUG = 'my-script'
const SCRIPT_ID = 'script-001'

function ownedScript(): ScriptRow {
  return {
    id: SCRIPT_ID,
    slug: SCRIPT_SLUG,
    name: 'My Script',
    description: null,
    visibility: 'private',
    creator_id: OWNER_ID,
    current_version_id: null,
    created_at: '2026-06-09T12:00:00.000Z',
    updated_at: '2026-06-09T12:00:00.000Z',
  }
}

function webhookConfigRow(overrides: Partial<WebhookConfigRow> = {}): WebhookConfigRow {
  return {
    id: 'cfg-001',
    script_id: SCRIPT_ID,
    creator_id: OWNER_ID,
    provider: 'discord',
    config: { webhook_url: FAKE_WEBHOOK_URL },
    enabled: true,
    created_at: '2026-06-09T12:00:00.000Z',
    updated_at: '2026-06-09T12:00:00.000Z',
    ...overrides,
  } as WebhookConfigRow
}

function setValidWebhookUrl() {
  mockedValidateWebhookUrl.mockReturnValue({ valid: true })
  mockedValidateConfig.mockReturnValue({ valid: true })
}

function setDefaultProcessResult() {
  mockedProcessSingleEvent.mockResolvedValue({
    processed: 1,
    delivered: 1,
    failed: 0,
    deadLettered: 0,
    skipped: 0,
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getWebhookConfigSafe', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns 404 for non-owned script', async () => {
    mockedGetOwnedScript.mockResolvedValue(null)

    const result = await getWebhookConfigSafe(SCRIPT_SLUG, OWNER_ID)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.status).toBe(404)
  })

  it('returns null config when none exists', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetConfig.mockResolvedValue(null)

    const result = await getWebhookConfigSafe(SCRIPT_SLUG, OWNER_ID)

    expect(result.success).toBe(true)
    if (result.success) expect(result.config).toBeNull()
  })

  it('returns masked safe DTO', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetConfig.mockResolvedValue(webhookConfigRow())
    mockedValidateConfig.mockReturnValue({ valid: true })

    const result = await getWebhookConfigSafe(SCRIPT_SLUG, OWNER_ID)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.config).not.toBeNull()
      const cfg = result.config!
      expect(cfg.webhookUrlMasked).toBe('Discord webhook configured')
      expect(cfg.hasWebhookUrl).toBe(true)
      expect(cfg.enabled).toBe(true)
      // Raw URL must never leak
      expect(JSON.stringify(cfg)).not.toContain(FAKE_WEBHOOK_URL)
    }
  })

  it('reports invalid config', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetConfig.mockResolvedValue(webhookConfigRow())
    mockedValidateConfig.mockReturnValue({ valid: false, reason: 'disabled' })

    const result = await getWebhookConfigSafe(SCRIPT_SLUG, OWNER_ID)

    expect(result.success).toBe(true)
    if (result.success && result.config) {
      expect(result.config.isValid).toBe(false)
      expect(result.config.validationReason).toBe('disabled')
    }
  })

  it('reports missing webhook URL', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetConfig.mockResolvedValue(webhookConfigRow({ config: {} }))
    mockedValidateConfig.mockReturnValue({ valid: false, reason: 'no webhook_url' })

    const result = await getWebhookConfigSafe(SCRIPT_SLUG, OWNER_ID)

    expect(result.success).toBe(true)
    if (result.success && result.config) {
      expect(result.config.hasWebhookUrl).toBe(false)
      expect(result.config.webhookUrlMasked).toBe('')
    }
  })
})

describe('saveWebhookConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('rejects non-owned script', async () => {
    mockedGetOwnedScript.mockResolvedValue(null)

    const result = await saveWebhookConfig(SCRIPT_SLUG, OWNER_ID, 'discord', FAKE_WEBHOOK_URL, true)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.status).toBe(404)
  })

  it('rejects non-discord provider', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())

    const result = await saveWebhookConfig(SCRIPT_SLUG, OWNER_ID, 'telegram', FAKE_WEBHOOK_URL, true)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.status).toBe(400)
  })

  it('rejects invalid webhook URL', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedValidateWebhookUrl.mockReturnValue({ valid: false, reason: 'malformed' })

    const result = await saveWebhookConfig(SCRIPT_SLUG, OWNER_ID, 'discord', 'bad-url', true)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.status).toBe(400)
  })

  it('creates new config when none exists', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetConfig.mockResolvedValue(null)
    setValidWebhookUrl()
    mockedCreateConfig.mockResolvedValue(webhookConfigRow())

    const result = await saveWebhookConfig(SCRIPT_SLUG, OWNER_ID, 'discord', FAKE_WEBHOOK_URL, true)

    expect(result.success).toBe(true)
    expect(mockedCreateConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        scriptId: SCRIPT_ID,
        creatorId: OWNER_ID,
        provider: 'discord',
        config: { webhook_url: FAKE_WEBHOOK_URL },
        enabled: true,
      })
    )
  })

  it('updates existing config', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetConfig.mockResolvedValue(webhookConfigRow())
    setValidWebhookUrl()
    mockedUpdateConfig.mockResolvedValue(webhookConfigRow())

    const result = await saveWebhookConfig(SCRIPT_SLUG, OWNER_ID, 'discord', FAKE_WEBHOOK_URL, false)

    expect(result.success).toBe(true)
    expect(mockedUpdateConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        scriptId: SCRIPT_ID,
        enabled: false,
      })
    )
  })

  it('returns safe DTO on create', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetConfig.mockResolvedValue(null)
    setValidWebhookUrl()
    mockedCreateConfig.mockResolvedValue(webhookConfigRow())

    const result = await saveWebhookConfig(SCRIPT_SLUG, OWNER_ID, 'discord', FAKE_WEBHOOK_URL, true)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(JSON.stringify(result.config)).not.toContain(FAKE_WEBHOOK_URL)
    }
  })
})

describe('toggleWebhookConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('rejects non-owned script', async () => {
    mockedGetOwnedScript.mockResolvedValue(null)

    const result = await toggleWebhookConfig(SCRIPT_SLUG, OWNER_ID, true)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.status).toBe(404)
  })

  it('rejects when no config exists', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetConfig.mockResolvedValue(null)

    const result = await toggleWebhookConfig(SCRIPT_SLUG, OWNER_ID, true)

    expect(result.success).toBe(false)
  })

  it('enables a disabled config', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetConfig.mockResolvedValue(webhookConfigRow({ enabled: false }))
    mockedUpdateConfig.mockResolvedValue(webhookConfigRow({ enabled: true }))
    mockedValidateConfig.mockReturnValue({ valid: true })

    const result = await toggleWebhookConfig(SCRIPT_SLUG, OWNER_ID, true)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.config.enabled).toBe(true)
    }
    expect(mockedUpdateConfig).toHaveBeenCalledWith(
      expect.objectContaining({ scriptId: SCRIPT_ID, enabled: true })
    )
  })

  it('disables an enabled config', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetConfig.mockResolvedValue(webhookConfigRow({ enabled: true }))
    mockedUpdateConfig.mockResolvedValue(webhookConfigRow({ enabled: false }))
    mockedValidateConfig.mockReturnValue({ valid: true })

    const result = await toggleWebhookConfig(SCRIPT_SLUG, OWNER_ID, false)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.config.enabled).toBe(false)
    }
  })

  it('returns safe DTO', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetConfig.mockResolvedValue(webhookConfigRow())
    mockedUpdateConfig.mockResolvedValue(webhookConfigRow())
    mockedValidateConfig.mockReturnValue({ valid: true })

    const result = await toggleWebhookConfig(SCRIPT_SLUG, OWNER_ID, false)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.config.webhookUrlMasked).toBe('Discord webhook configured')
      expect(JSON.stringify(result.config)).not.toContain(FAKE_WEBHOOK_URL)
    }
  })
})

describe('sendTestWebhookEvent', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('rejects non-owned script', async () => {
    mockedGetOwnedScript.mockResolvedValue(null)

    const result = await sendTestWebhookEvent(SCRIPT_SLUG, OWNER_ID)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.status).toBe(404)
  })

  it('rejects when no config exists', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetConfig.mockResolvedValue(null)

    const result = await sendTestWebhookEvent(SCRIPT_SLUG, OWNER_ID)

    expect(result.success).toBe(false)
  })

  it('rejects disabled config', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetConfig.mockResolvedValue(webhookConfigRow({ enabled: false }))

    const result = await sendTestWebhookEvent(SCRIPT_SLUG, OWNER_ID)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.message).toContain('disabled')
  })

  it('rejects config with no webhook URL', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetConfig.mockResolvedValue(webhookConfigRow({ config: {} }))

    const result = await sendTestWebhookEvent(SCRIPT_SLUG, OWNER_ID)

    expect(result.success).toBe(false)
  })

  it('rejects invalid webhook URL', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetConfig.mockResolvedValue(webhookConfigRow())
    mockedValidateWebhookUrl.mockReturnValue({ valid: false, reason: 'malformed' })

    const result = await sendTestWebhookEvent(SCRIPT_SLUG, OWNER_ID)

    expect(result.success).toBe(false)
  })

  it('creates event and delivers it', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetConfig.mockResolvedValue(webhookConfigRow())
    mockedValidateWebhookUrl.mockReturnValue({ valid: true })
    mockedCreateEventLog.mockResolvedValue({
      id: 'test-event',
      script_id: SCRIPT_ID,
      session_id: '00000000-0000-0000-0000-000000000000',
      event_type: 'heartbeat',
      payload: { test: true },
      delivery_status: 'pending',
      retry_count: 0,
      timestamp: '2026-06-09T12:00:00.000Z',
      received_at: '2026-06-09T12:00:00.000Z',
      nonce: 'aaaa',
      last_retry_at: null,
      delivered_at: null,
      error_message: null,
      claimed_at: null,
      created_at: '2026-06-09T12:00:00.000Z',
    })
    setDefaultProcessResult()

    const result = await sendTestWebhookEvent(SCRIPT_SLUG, OWNER_ID)

    expect(result.success).toBe(true)
    expect(mockedCreateEventLog).toHaveBeenCalledWith(
      expect.objectContaining({
        scriptId: SCRIPT_ID,
        eventType: 'heartbeat',
        payload: { test: true, note: 'Webhook test event from dashboard' },
      })
    )
    expect(mockedProcessSingleEvent).toHaveBeenCalledWith('test-event', expect.any(Function))
    expect(mockedProcessEventQueue).not.toHaveBeenCalled()
  })

  it('returns failure when event dead-letters', async () => {
    mockedGetOwnedScript.mockResolvedValue(ownedScript())
    mockedGetConfig.mockResolvedValue(webhookConfigRow())
    mockedValidateWebhookUrl.mockReturnValue({ valid: true })
    mockedCreateEventLog.mockResolvedValue({
      id: 'test-event',
      script_id: SCRIPT_ID,
      session_id: '00000000-0000-0000-0000-000000000000',
      event_type: 'heartbeat',
      payload: { test: true },
      delivery_status: 'pending',
      retry_count: 0,
      timestamp: '2026-06-09T12:00:00.000Z',
      received_at: '2026-06-09T12:00:00.000Z',
      nonce: 'aaaa',
      last_retry_at: null,
      delivered_at: null,
      error_message: null,
      claimed_at: null,
      created_at: '2026-06-09T12:00:00.000Z',
    })
    mockedProcessSingleEvent.mockResolvedValue({
      processed: 1,
      delivered: 0,
      failed: 0,
      deadLettered: 1,
      skipped: 0,
    })

    const result = await sendTestWebhookEvent(SCRIPT_SLUG, OWNER_ID)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.message).toContain('invalid or deleted')
  })
})
