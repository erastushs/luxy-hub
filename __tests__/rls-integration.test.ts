import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const describeIfDb = TEST_DATABASE_URL ? describe : describe.skip

function psql(args: string[], input?: string) {
  return execFileSync('psql', [TEST_DATABASE_URL!, ...args], {
    input,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

function runSql(sql: string) {
  psql(['--set', 'ON_ERROR_STOP=1', '--quiet'], sql)
}

describeIfDb('RLS integration validation', () => {
  it('applies migrations and validates owner/license/runtime isolation primitives', () => {
    const migrationsDir = path.join(process.cwd(), 'migrations')
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter((file) => /^\d+_.*\.sql$/.test(file) && !file.includes('_rollback'))
      .sort()

    for (const file of migrationFiles) {
      runSql(fs.readFileSync(path.join(migrationsDir, file), 'utf-8'))
    }

    const rls = psql(['--tuples-only', '--no-align', '--command', `
      select relname || ':' || relrowsecurity
      from pg_class
      where relname in ('scripts', 'script_versions', 'licenses', 'license_assignments', 'delivery_sessions', 'audit_logs')
      order by relname;
    `])

    expect(rls).toContain('scripts:t')
    expect(rls).toContain('script_versions:t')
    expect(rls).toContain('licenses:t')
    expect(rls).toContain('license_assignments:t')
    expect(rls).toContain('delivery_sessions:t')
    expect(rls).toContain('audit_logs:t')

    const rpcGrants = psql(['--tuples-only', '--no-align', '--command', `
      select proname
      from pg_proc
      where proname in ('authorize_license_assignment', 'increment_license_delivery_count')
      order by proname;
    `])

    expect(rpcGrants).toContain('authorize_license_assignment')
    expect(rpcGrants).toContain('increment_license_delivery_count')
  })

  it('validates runtime enforcement rollback migration applies after migration 014', () => {
    const migration = fs.readFileSync(path.join(process.cwd(), 'migrations', '014_runtime_license_enforcement.sql'), 'utf-8')
    const rollback = fs.readFileSync(path.join(process.cwd(), 'migrations', '014_runtime_license_enforcement_rollback.sql'), 'utf-8')

    runSql(migration)
    runSql(rollback)

    const actorRoleConstraint = psql(['--tuples-only', '--no-align', '--command', `
      select conname from pg_constraint where conname = 'audit_logs_actor_role_check';
    `])

    expect(actorRoleConstraint).toContain('audit_logs_actor_role_check')
  })
})
