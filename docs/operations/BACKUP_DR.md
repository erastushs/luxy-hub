# Backup and Disaster Recovery Runbook

Status: Operational documentation for current database-backed systems.

## Scope

This runbook covers diagnosis, common failures, recovery procedures, and escalation for backup and disaster recovery of:

- Supabase Postgres data
- Script/version metadata and source
- Secure delivery build/session state
- Event queue and alert records
- License foundation data
- Key system tables

## Recovery Priorities

1. Protect data integrity and prevent unauthorized access.
2. Restore authentication and dashboard access.
3. Restore key validation and secure delivery.
4. Restore event reporting and queue processing.
5. Restore analytics, alerts, and historical records.

## Critical Data Classes

### Must Preserve

- `scripts`
- `script_versions`
- `profiles`
- `licenses`
- `license_assignments`
- `keys`
- `audit_logs`

### Rebuildable or Ephemeral

- `delivery_builds`: encrypted payloads can be rebuilt from `script_versions` if payload secret is available.
- `delivery_sessions`: short-lived runtime sessions can be discarded after outage.
- `rate_limits`: ephemeral and safe to clean during recovery.
- `used_workink_tokens`: replay-protection history; preserve if possible, but operational recovery may require careful handling.

### Operational History

- `event_logs`: queue state and event history.
- `alert_events`: internal alert history.
- `verification_logs`: operational/security counters.
- `script_executions`: execution analytics and cached counter source.
- `script_downloads` and `key_usage`: historical analytics.

## Backup Expectations

- Supabase point-in-time recovery or scheduled backups should be enabled for production.
- Before applying schema migrations, confirm backup/PITR availability.
- Before secret rotations affecting delivery payloads, confirm `script_versions` and current build state are recoverable.
- Keep environment secrets in the approved secret manager/platform, not in repository backups.

## Common Failures

### Accidental Data Deletion

Symptoms:

- Missing scripts, versions, licenses, keys, or profiles.
- Dashboard 404s for known resources.
- Delivery unavailable for previously valid scripts.

Diagnosis:

1. Determine affected tables and time window.
2. Check `audit_logs` for destructive actions.
3. Check Vercel logs for erroneous service actions.
4. Confirm whether deletion was user-initiated, bug-induced, or unauthorized.

Recovery:

1. Stop the suspected writer path if bug/compromise is possible.
2. Restore from PITR to a separate recovery database when possible.
3. Export affected rows from recovery database.
4. Re-import only validated rows into production.
5. Rebuild delivery builds for restored current versions.
6. Validate dashboard and delivery behavior.

Escalation:

- P1 for creator data loss.
- P0 if widespread data loss or unauthorized deletion is suspected.

### Failed Migration or Schema Drift

Symptoms:

- Runtime errors after migration.
- Missing columns/indexes/policies.
- RLS behavior differs from expected docs.

Diagnosis:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

```sql
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Recovery:

1. Stop further migrations/deploys.
2. Identify last successful migration.
3. Compare production schema with migration files.
4. Prefer forward corrective migration after review.
5. Restore from backup only if schema/data corruption cannot be safely corrected.
6. Run lint/build and production smoke checks.

Escalation:

- P1 for production runtime impact.
- Database owner required for manual schema correction.

### Supabase Outage

Symptoms:

- DB-backed endpoints return 500.
- Health endpoint may still return 200.
- Dashboard and runtime delivery fail.

Diagnosis:

- Check Supabase status.
- Check Vercel function logs for connection/timeouts.
- Confirm failures across multiple DB-backed routes.

Recovery:

1. Wait for Supabase recovery if provider outage is confirmed.
2. Avoid repeated destructive recovery actions during provider outage.
3. After recovery, validate table integrity and runtime paths.
4. Run cleanup endpoint to reduce stale rate/session/queue data if needed.

Escalation:

- P1 or P0 depending scope and duration.

### Payload Builds Lost or Invalid

Symptoms:

- `delivery_builds` rows missing or invalid.
- `/api/delivery/session` returns `Delivery unavailable`.

Recovery:

1. Confirm `script_versions` still contain source.
2. Confirm `DELIVERY_PAYLOAD_SECRET` is available.
3. Rebuild all current public/unlisted versions.
4. Validate ready build creation.
5. Test delivery session/fetch.

Escalation:

- P1 if secure delivery is degraded broadly.
- P0 if all runtime delivery is unavailable.

### Event Queue Corruption or Loss

Symptoms:

- Queue counts inconsistent.
- Worker repeatedly fails on specific rows.
- Events missing after incident.

Recovery:

1. Preserve current `event_logs` snapshot before manual edits.
2. Identify malformed or blocking rows.
3. Move unrecoverable rows to `dead_letter` rather than deleting when possible.
4. Replay only events with valid config and provider availability.
5. Restore from backup only when historical event data is required and safe to merge.

Escalation:

- P2 for isolated queue data issue.
- P1 for broad event delivery loss.

## Disaster Recovery Procedure

### Full Database Restore

Use when production data is broadly corrupted or deleted.

1. Declare incident severity and freeze deploys/migrations.
2. Identify recovery point objective timestamp.
3. Restore Supabase backup/PITR to a new database or project if possible.
4. Validate restored schema through migration 014 state.
5. Validate RLS policies.
6. Validate critical data counts.
7. Configure environment variables for restored environment.
8. Run application smoke checks against restored environment.
9. Promote restored database/project only after incident lead approval.
10. Rebuild delivery payloads if secrets or build rows are inconsistent.
11. Resume worker/cleanup schedules.
12. Monitor alerts, queue, delivery, dashboard, and license APIs.

Critical count checks:

```sql
SELECT 'scripts' AS table_name, COUNT(*) FROM scripts
UNION ALL SELECT 'script_versions', COUNT(*) FROM script_versions
UNION ALL SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL SELECT 'licenses', COUNT(*) FROM licenses
UNION ALL SELECT 'license_assignments', COUNT(*) FROM license_assignments
UNION ALL SELECT 'keys', COUNT(*) FROM keys;
```

### Partial Table Restore

Use when a small known set of rows was deleted or corrupted.

1. Restore backup to separate recovery environment.
2. Export affected rows with dependencies.
3. Preserve original primary keys when safe and required by relationships.
4. Import parent rows before child rows.
5. Rebuild dependent delivery builds.
6. Validate ownership and RLS boundaries.
7. Record restored row ids in incident notes.

Dependency order example:

1. `profiles`
2. `scripts`
3. `script_versions`
4. `delivery_builds` or rebuild from versions
5. `licenses`
6. `license_assignments`
7. `webhook_config`
8. `event_logs` and analytics history if required

## Post-Recovery Validation

Run these checks after any major restore:

- `GET /api/health` returns 200.
- Invalid key validation returns controlled 403, not 500.
- Creator login and dashboard script list work.
- Script ownership isolation still holds across two test users if available.
- Known public/unlisted script can create and fetch a delivery session.
- Event worker runs with `CRON_SECRET` and returns stats.
- License dashboard/API loads for known owner.
- Internal alerts are not stuck active due only to recovery backlog.
- `npm run lint` and `npm run build` pass for the deployed codebase.

## Escalation Paths

- Database restore: infrastructure/database owner and incident lead.
- Security-related data loss or unauthorized access: security incident lead.
- Creator data loss: product/support owner and incident lead.
- Runtime delivery outage: application owner and incident lead.
- Provider outage: provider status owner and communications owner.
