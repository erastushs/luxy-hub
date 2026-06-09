import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const migration = readFileSync('migrations/008_event_platform.sql', 'utf8')
const rollback = readFileSync('migrations/008_event_platform_rollback.sql', 'utf8')

function indexOf(fragment: string): number {
  const index = migration.indexOf(fragment)
  expect(index).toBeGreaterThanOrEqual(0)
  return index
}

describe('Phase 8B.1 event platform migration', () => {
  it('creates webhook_config with owner and script constraints', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS webhook_config')
    expect(migration).toContain('id uuid PRIMARY KEY DEFAULT gen_random_uuid()')
    expect(migration).toContain('script_id uuid NOT NULL UNIQUE')
    expect(migration).toContain('REFERENCES scripts(id) ON DELETE CASCADE')
    expect(migration).toContain('creator_id uuid NOT NULL')
    expect(migration).toContain("CHECK (provider IN ('discord', 'telegram', 'slack'))")
    expect(migration).toContain("config jsonb NOT NULL DEFAULT '{}'::jsonb")
    expect(migration).toContain('enabled boolean NOT NULL DEFAULT false')
  })

  it('creates event_logs with the Phase 8B.1 event allowlist', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS event_logs')
    expect(migration).toContain('event_type text NOT NULL')
    for (const eventType of [
      'execute',
      'purchase',
      'error',
      'ban',
      'key_redeem',
      'heartbeat',
      'license_activate',
      'license_revoke',
    ]) {
      expect(migration).toContain(`'${eventType}'`)
    }
    expect(migration).not.toContain("'enter_world'")
    expect(migration).not.toContain("'leave_world'")
  })

  it('stores payload, delivery status, retry count, and timestamps', () => {
    expect(migration).toContain("payload jsonb NOT NULL DEFAULT '{}'::jsonb")
    expect(migration).toContain("delivery_status text NOT NULL DEFAULT 'pending'")
    expect(migration).toContain("CHECK (delivery_status IN ('pending', 'delivered', 'dead_letter'))")
    expect(migration).toContain('retry_count integer NOT NULL DEFAULT 0')
    expect(migration).toContain('timestamp timestamp with time zone NOT NULL')
    expect(migration).toContain('received_at timestamp with time zone NOT NULL DEFAULT now()')
    expect(migration).toContain('created_at timestamp with time zone NOT NULL DEFAULT now()')
  })

  it('adds event_secret as nullable and rollback removes it', () => {
    expect(migration).toContain('ALTER TABLE delivery_sessions')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS event_secret text')
    expect(migration).not.toContain('event_secret text NOT NULL')
    expect(rollback).toContain('DROP COLUMN IF EXISTS event_secret')
  })

  it('enables RLS with owner-aware webhook access and deny-all event access', () => {
    expect(migration).toContain('ALTER TABLE webhook_config ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('CREATE POLICY webhook_config_owner_select')
    expect(migration).toContain('scripts.creator_id = auth.uid()')
    expect(migration).toContain('CREATE POLICY webhook_config_service_access')
    expect(migration).toContain('ALTER TABLE event_logs ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('CREATE POLICY event_logs_deny_all')
    expect(migration).toContain('TO anon, authenticated')
    expect(migration).toContain('USING (false)')
    expect(migration).toContain('CREATE POLICY event_logs_service_access')
  })

  it('creates only Phase 8A recommended indexes with documented purposes', () => {
    const indexes = [
      'idx_webhook_config_script_id',
      'idx_webhook_config_creator_id',
      'idx_webhook_config_enabled_provider',
      'idx_event_logs_pending_delivery',
      'idx_event_logs_session_nonce',
      'idx_event_logs_script_event_time',
      'idx_event_logs_dead_letter',
      'idx_event_logs_delivered_latency',
      'idx_event_logs_delivered_created',
    ]

    for (const name of indexes) {
      expect(migration).toContain(`CREATE INDEX IF NOT EXISTS ${name}`)
    }

    expect([...migration.matchAll(/CREATE INDEX IF NOT EXISTS /g)]).toHaveLength(indexes.length)
    expect(indexOf('-- lookup by script')).toBeLessThan(indexOf('CREATE INDEX IF NOT EXISTS idx_webhook_config_script_id'))
    expect(indexOf('-- Worker polling')).toBeLessThan(indexOf('CREATE INDEX IF NOT EXISTS idx_event_logs_pending_delivery'))
    expect(indexOf('-- Nonce replay check')).toBeLessThan(indexOf('CREATE INDEX IF NOT EXISTS idx_event_logs_session_nonce'))
    expect(indexOf('-- Cleanup selector')).toBeLessThan(indexOf('CREATE INDEX IF NOT EXISTS idx_event_logs_delivered_created'))
  })

  it('rollback drops event platform tables before removing event_secret', () => {
    expect(rollback).toContain('DROP TABLE IF EXISTS event_logs')
    expect(rollback).toContain('DROP TABLE IF EXISTS webhook_config')
    expect(rollback.indexOf('DROP TABLE IF EXISTS event_logs')).toBeLessThan(
      rollback.indexOf('DROP TABLE IF EXISTS webhook_config')
    )
    expect(rollback.indexOf('DROP TABLE IF EXISTS webhook_config')).toBeLessThan(
      rollback.indexOf('DROP COLUMN IF EXISTS event_secret')
    )
  })
})
