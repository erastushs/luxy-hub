import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const migrations = [
  '001_enable_rls.sql',
  '002_cdn_tables.sql',
  '003_profiles.sql',
  '004_script_ownership.sql',
  '005_audit_logs.sql',
  '006_delivery_builds.sql',
  '007_delivery_sessions.sql',
  '008_event_platform.sql',
  '009_event_platform_hardening.sql',
  '010_internal_alerts.sql',
  '011_alert_events_rls.sql',
  '012_script_executions.sql',
  '013_license_schema_foundation.sql',
  '014_runtime_license_enforcement.sql',
] as const

const rollback014 = readFileSync('migrations/014_runtime_license_enforcement_rollback.sql', 'utf8')
const migrationSql = Object.fromEntries(
  migrations.map((name) => [name, readFileSync(`migrations/${name}`, 'utf8')])
) as Record<(typeof migrations)[number], string>

describe('security migration sequence and RLS permissions', () => {
  it('has a complete fresh upgrade path from 001 through 014 with transaction boundaries', () => {
    for (const name of migrations) {
      expect(migrationSql[name], `${name} should begin a transaction`).toContain('BEGIN;')
      expect(migrationSql[name], `${name} should commit explicitly`).toContain('COMMIT;')
    }
  })

  it('keeps privileged license assignment RPCs service_role-only', () => {
    const sql = migrationSql['014_runtime_license_enforcement.sql']

    for (const fn of [
      'public.authorize_license_assignment(uuid, text, text)',
      'public.increment_license_delivery_count(uuid)',
    ]) {
      expect(sql).toContain(`REVOKE ALL ON FUNCTION ${fn} FROM PUBLIC`)
      expect(sql).toContain(`REVOKE ALL ON FUNCTION ${fn} FROM anon, authenticated`)
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION ${fn} TO service_role`)
      expect(sql).not.toContain(`GRANT EXECUTE ON FUNCTION ${fn} TO anon`)
      expect(sql).not.toContain(`GRANT EXECUTE ON FUNCTION ${fn} TO authenticated`)
    }
  })

  it('validates role expectations for anon authenticated and service_role across sensitive tables', () => {
    const licenseFoundation = migrationSql['013_license_schema_foundation.sql']
    const auditLogs = migrationSql['005_audit_logs.sql']
    const eventPlatform = migrationSql['008_event_platform.sql']

    expect(licenseFoundation).toContain('CREATE POLICY licenses_deny_anon')
    expect(licenseFoundation).toContain('TO anon')
    expect(licenseFoundation).toContain('USING (false)')
    expect(licenseFoundation).toContain('CREATE POLICY licenses_service_access')
    expect(licenseFoundation).toContain('TO service_role')
    expect(licenseFoundation).toContain('USING (true)')
    expect(licenseFoundation).toContain('CREATE POLICY license_assignments_deny_anon')
    expect(licenseFoundation).toContain('CREATE POLICY license_assignments_service_access')

    expect(auditLogs).toContain('CREATE POLICY audit_logs_deny_all')
    expect(auditLogs).toContain('TO anon, authenticated')
    expect(auditLogs).toContain('USING (false)')

    expect(eventPlatform).toContain('CREATE POLICY event_logs_deny_all')
    expect(eventPlatform).toContain('TO anon, authenticated')
    expect(eventPlatform).toContain('CREATE POLICY event_logs_service_access')
    expect(eventPlatform).toContain('TO service_role')
  })

  it('locks Creator A and Creator B isolation into license and assignment RLS policies', () => {
    const sql = migrationSql['013_license_schema_foundation.sql']

    expect(sql).toContain('CREATE POLICY licenses_select_own')
    expect(sql).toContain('USING (creator_id = auth.uid())')
    expect(sql).toContain('CREATE POLICY licenses_update_own')
    expect(sql).toContain('WITH CHECK (creator_id = auth.uid())')
    expect(sql).toContain('CREATE POLICY license_assignments_select_own')
    expect(sql).toContain('WHERE licenses.id = license_assignments.license_id')
    expect(sql).toContain('AND licenses.creator_id = auth.uid()')
    expect(sql).toContain('CREATE POLICY license_assignments_update_own')
    expect(sql).toContain('CREATE POLICY license_assignments_delete_own')
  })

  it('keeps analytics and event data owner-scoped or service-role-only', () => {
    const scriptOwnership = migrationSql['004_script_ownership.sql']
    const auditLogs = migrationSql['005_audit_logs.sql']
    const eventPlatform = migrationSql['008_event_platform.sql']

    expect(scriptOwnership).toContain('CREATE POLICY scripts_select_own')
    expect(scriptOwnership).toContain('USING (creator_id = auth.uid())')
    expect(scriptOwnership).toContain('CREATE POLICY script_versions_select_own')
    expect(scriptOwnership).toContain('AND scripts.creator_id = auth.uid()')
    expect(auditLogs).toContain('CREATE POLICY audit_logs_deny_all')
    expect(eventPlatform).toContain('CREATE POLICY event_logs_deny_all')
    expect(eventPlatform).toContain('CREATE POLICY event_logs_service_access')
  })

  it('validates 014 rollback safety restores the pre-runtime schema contract', () => {
    expect(rollback014).toContain('BEGIN;')
    expect(rollback014).toContain('DROP FUNCTION IF EXISTS public.authorize_license_assignment(uuid, text, text)')
    expect(rollback014).toContain('DROP FUNCTION IF EXISTS public.increment_license_delivery_count(uuid)')
    expect(rollback014).toContain('DROP INDEX IF EXISTS public.idx_audit_logs_actor_action_created')
    expect(rollback014).toContain("CHECK (actor_role IN ('creator', 'admin'))")
    expect(rollback014.trim().endsWith('COMMIT;')).toBe(true)
  })
})
