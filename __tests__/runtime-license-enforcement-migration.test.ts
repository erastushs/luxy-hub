import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const migration = readFileSync('migrations/014_runtime_license_enforcement.sql', 'utf8')
const rollback = readFileSync('migrations/014_runtime_license_enforcement_rollback.sql', 'utf8')

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
  })

  it('fully qualifies privileged table references and enforces expiry', () => {
    expect(migration).toContain('FROM public.licenses')
    expect(migration).toContain('FROM public.license_assignments')
    expect(migration).toContain('INSERT INTO public.license_assignments')
    expect(migration).toContain('UPDATE public.licenses')
    expect(migration).toContain('v_license.expires_at IS NOT NULL AND v_license.expires_at <= v_now')
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
})
