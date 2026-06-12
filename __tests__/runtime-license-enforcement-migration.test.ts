import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const migration = readFileSync('migrations/014_runtime_license_enforcement.sql', 'utf8')
const rollback = readFileSync('migrations/014_runtime_license_enforcement_rollback.sql', 'utf8')
const foundation = readFileSync('migrations/013_license_schema_foundation.sql', 'utf8')

function expectOrdered(sql: string, first: string, second: string) {
  const firstIndex = sql.indexOf(first)
  const secondIndex = sql.indexOf(second)
  expect(firstIndex).toBeGreaterThanOrEqual(0)
  expect(secondIndex).toBeGreaterThanOrEqual(0)
  expect(firstIndex).toBeLessThan(secondIndex)
}

describe('Phase 7B runtime license enforcement migration', () => {
  it('wraps upgrade and rollback in explicit transactions', () => {
    expect(migration).toContain('BEGIN;')
    expect(migration.trim().endsWith('COMMIT;')).toBe(true)
    expect(rollback).toContain('BEGIN;')
    expect(rollback.trim().endsWith('COMMIT;')).toBe(true)
  })

  it('hardens security definer RPC execution to service role only', () => {
    expect(migration).toContain('SECURITY DEFINER')
    expect(migration).toContain('SET search_path = public, pg_temp')
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.authorize_license_assignment(uuid, text, text) FROM PUBLIC')
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.increment_license_delivery_count(uuid) FROM PUBLIC')
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.authorize_license_assignment(uuid, text, text) FROM anon, authenticated')
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.increment_license_delivery_count(uuid) FROM anon, authenticated')
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.authorize_license_assignment(uuid, text, text) TO service_role')
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.increment_license_delivery_count(uuid) TO service_role')
    expect(migration).not.toContain('GRANT EXECUTE ON FUNCTION public.authorize_license_assignment(uuid, text, text) TO anon')
    expect(migration).not.toContain('GRANT EXECUTE ON FUNCTION public.authorize_license_assignment(uuid, text, text) TO authenticated')
    expect(migration).not.toContain('GRANT EXECUTE ON FUNCTION public.increment_license_delivery_count(uuid) TO anon')
    expect(migration).not.toContain('GRANT EXECUTE ON FUNCTION public.increment_license_delivery_count(uuid) TO authenticated')
  })

  it('fully qualifies privileged table references and enforces expiry', () => {
    expect(migration).toContain('FROM public.licenses')
    expect(migration).toContain('FROM public.license_assignments')
    expect(migration).toContain('INSERT INTO public.license_assignments')
    expect(migration).toContain('UPDATE public.licenses')
    expect(migration).toContain('v_license.expires_at IS NOT NULL AND v_license.expires_at <= v_now')
  })

  it('keeps assignment authorization atomic and capacity-safe', () => {
    expect(migration).toContain('FOR UPDATE')
    expect(migration).toContain("AND public.license_assignments.status = 'active'")
    expect(migration).toContain('IF v_active_assignments >= v_license.max_assignments THEN')
    expect(migration).toContain('UPDATE public.licenses')
    expect(migration).toContain('activation_count = activation_count + 1')
    expect(migration).toContain('last_activation_at = v_now')
    expect(migration).toContain('delivery_count = delivery_count + 1')
    expect(migration).toContain('last_delivery_at = now()')
  })

  it('preserves RPC return shape expected by the repository mapper', () => {
    expect(migration).toContain('RETURNS TABLE (')
    expect(migration).toContain('success boolean')
    expect(migration).toContain('created boolean')
    expect(migration).toContain('id uuid')
    expect(migration).toContain('license_id uuid')
    expect(migration).toContain('customer_identifier_hash text')
    expect(migration).toContain('display_name text')
    expect(migration).toContain('status text')
    expect(migration).toContain('created_at timestamptz')
    expect(migration).toContain('updated_at timestamptz')
  })

  it('supports runtime audit actor role and rolls it back', () => {
    expect(migration).toContain("CHECK (actor_role IN ('creator', 'admin', 'runtime'))")
    expect(rollback).toContain("CHECK (actor_role IN ('creator', 'admin'))")
  })

  it('removes obsolete activation counter RPC and rollback drops exact functions', () => {
    expect(migration).toContain('DROP FUNCTION IF EXISTS public.increment_license_activation_count(uuid)')
    expect(rollback).toContain('DROP FUNCTION IF EXISTS public.authorize_license_assignment(uuid, text, text)')
    expect(rollback).toContain('DROP FUNCTION IF EXISTS public.increment_license_delivery_count(uuid)')
    expect(rollback).toContain('DROP FUNCTION IF EXISTS public.increment_license_activation_count(uuid)')
  })

  it('applies rollback before restoring pre-runtime actor role constraint', () => {
    expectOrdered(
      rollback,
      'DROP FUNCTION IF EXISTS public.authorize_license_assignment(uuid, text, text)',
      "CHECK (actor_role IN ('creator', 'admin'))"
    )
    expect(rollback).toContain('DROP INDEX IF EXISTS public.idx_audit_logs_actor_action_created')
  })

  it('depends on license foundation tables and RLS policies from migration 013', () => {
    expect(foundation).toContain('CREATE TABLE IF NOT EXISTS licenses')
    expect(foundation).toContain('CREATE TABLE IF NOT EXISTS license_assignments')
    expect(foundation).toContain('ALTER TABLE licenses ENABLE ROW LEVEL SECURITY')
    expect(foundation).toContain('ALTER TABLE license_assignments ENABLE ROW LEVEL SECURITY')
    expectOrdered(foundation, 'CREATE TABLE IF NOT EXISTS licenses', 'CREATE TABLE IF NOT EXISTS license_assignments')
  })
})
