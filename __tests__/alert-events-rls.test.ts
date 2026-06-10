import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const migration = readFileSync('migrations/011_alert_events_rls.sql', 'utf8')
const rollback = readFileSync('migrations/011_alert_events_rls_rollback.sql', 'utf8')

describe('Phase 8 alert_events RLS migration', () => {
  it('enables RLS on alert_events', () => {
    expect(migration).toContain('ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY')
  })

  it('creates deny-all policy for anon and authenticated roles', () => {
    expect(migration).toContain('CREATE POLICY alert_events_deny_all')
    expect(migration).toContain('ON alert_events')
    expect(migration).toContain('FOR ALL')
    expect(migration).toContain('TO anon, authenticated')
    expect(migration).toContain('USING (false)')
    expect(migration).toContain('WITH CHECK (false)')
  })

  it('drops pre-existing deny-all policy before creating', () => {
    // Must drop first to be re-runnable
    expect(migration).toContain('DROP POLICY IF EXISTS alert_events_deny_all ON alert_events')
    // Drop must appear before CREATE (DROP POLICY comes before CREATE POLICY in the file)
    const dropIdx = migration.indexOf('DROP POLICY IF EXISTS alert_events_deny_all')
    const createIdx = migration.indexOf('CREATE POLICY alert_events_deny_all')
    expect(dropIdx).toBeGreaterThanOrEqual(0)
    expect(createIdx).toBeGreaterThan(dropIdx)
  })

  it('is wrapped in a transaction', () => {
    expect(migration).toContain('BEGIN;')
    expect(migration).toContain('COMMIT;')
  })

  it('rollback drops the policy and disables RLS', () => {
    expect(rollback).toContain('DROP POLICY IF EXISTS alert_events_deny_all ON alert_events')
    expect(rollback).toContain('ALTER TABLE alert_events DISABLE ROW LEVEL SECURITY')
    expect(rollback).toContain('BEGIN;')
    expect(rollback).toContain('COMMIT;')
  })
})
