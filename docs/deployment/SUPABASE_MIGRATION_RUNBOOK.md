# Supabase Migration Readiness Runbook

Status: Audit-only readiness report  
Generated: 2026-06-16  
Scope: Supabase schema, data, RLS, storage, and runtime environment required for LuxyHub production migration.

## Executive Summary

This repository does not contain a Supabase CLI project directory such as `supabase/`. Database state is represented by root-level `schema.sql` and manually applied SQL files under `migrations/`.

Migration readiness depends on validating the live source Supabase project against the inventory below before cutover. Treat the live database catalog as canonical, then use the validation queries in this runbook to confirm the target project matches.

No application code changes are required or included in this report.

## Source Artifacts Reviewed

| Artifact | Purpose |
|---|---|
| `schema.sql` | Current schema snapshot and legacy bootstrap notes. |
| `migrations/001_enable_rls.sql` | RLS for legacy key/rate-limit/log tables. |
| `migrations/002_cdn_tables.sql` | Script, version, and download analytics tables. |
| `migrations/003_profiles.sql` | Creator profile table. |
| `migrations/004_script_ownership.sql` | Creator ownership FK and owner-scoped RLS. |
| `migrations/005_audit_logs.sql` | Audit log table. |
| `migrations/006_delivery_builds.sql` | Secure delivery build artifacts. |
| `migrations/007_delivery_sessions.sql` | Short-lived delivery sessions. |
| `migrations/008_event_platform.sql` | Webhook configuration and event log foundation. |
| `migrations/009_event_platform_hardening.sql` | Event worker claim lease column and index. |
| `migrations/010_internal_alerts.sql` | Internal alert event table. |
| `migrations/011_alert_events_rls.sql` | RLS hardening for internal alerts. |
| `migrations/012_script_executions.sql` | Execution analytics table, trigger, and cache columns. |
| `migrations/013_license_schema_foundation.sql` | License and assignment schema foundation. |
| `docs/operations/ENVIRONMENT_VARIABLES.md` | Canonical runtime environment variable reference. |
| `docs/database/RLS_POLICIES.md` | Current RLS behavior summary. |

## Readiness Risks

| Risk | Severity | Impact | Mitigation |
|---|---:|---|---|
| No Supabase CLI migration history found. | Medium | Target schema drift is possible if manual SQL has been applied differently in production. | Use live catalog validation queries before and after migration. Prefer `pg_dump`/`pg_restore` from the live source over reconstructing production from repository files alone. |
| `schema.sql` overlaps later migration files. | Medium | Replaying `schema.sql` and every migration blindly into an empty target can create duplicate-object or duplicate-constraint failures. | For production migration, clone live schema/data using Postgres-native dump/restore. Use repository SQL files as reference and drift checks. |
| `delivery_builds.payload_ciphertext` may be encrypted with `DELIVERY_PAYLOAD_SECRET` or fallback `SUPABASE_SERVICE_ROLE_KEY`. | High | Changing the effective payload secret during migration can make existing ready builds undecryptable. | Keep `DELIVERY_PAYLOAD_SECRET` stable. If unset in source, preserve old `SUPABASE_SERVICE_ROLE_KEY` until payloads are rebuilt, or set a dedicated payload secret before rebuilding. |
| `auth.users` is outside `public` schema but referenced by `profiles`, `scripts`, `webhook_config`, and `licenses`. | High | Public data restore can fail or orphan owner references if auth users are not migrated first. | Migrate Supabase Auth users before public owner-bound tables, or preserve UUIDs with an approved auth export/import procedure. |
| `event_logs` can contain active pending webhook deliveries. | Medium | Cutting over while queue workers run can duplicate or lose delivery attempts. | Pause workers before dump. Resume only after target validation. Treat pending events as critical during active incident/cutover windows. |

## Table Inventory

| Table | Source | Classification | Migration requirement |
|---|---|---|---|
| `profiles` | `003_profiles.sql` | Critical | Creator identity profile rows tied to `auth.users`; migrate after auth users. |
| `scripts` | `002_cdn_tables.sql`, `004_script_ownership.sql`, `012_script_executions.sql`, `013_license_schema_foundation.sql` | Critical | Core script metadata, ownership, access mode, cached execution counters. |
| `script_versions` | `002_cdn_tables.sql` | Critical | Immutable script source/version content. Required for delivery rebuild and script serving. |
| `delivery_builds` | `006_delivery_builds.sql` | Critical | Encrypted ready payload artifacts. Can be rebuilt only if source content and payload secrets are available, but migrating avoids downtime. |
| `licenses` | `013_license_schema_foundation.sql` | Critical | License keys are stored as hashes only; raw keys cannot be reconstructed if lost. |
| `license_assignments` | `013_license_schema_foundation.sql` | Critical | Customer assignment hashes and license activation state. |
| `keys` | `schema.sql`, `001_enable_rls.sql` | Critical | Legacy key storage with active key material. |
| `webhook_config` | `008_event_platform.sql` | Critical | Per-script webhook provider configuration and credentials. |
| `event_logs` | `008_event_platform.sql`, `009_event_platform_hardening.sql` | Recommended | Event audit and pending delivery queue. Treat as Critical if any `delivery_status = 'pending'` rows exist during cutover. |
| `script_executions` | `012_script_executions.sql` | Recommended | Canonical execution analytics. Cached counters can be recalculated from this table. |
| `script_downloads` | `002_cdn_tables.sql` | Recommended | Download analytics with hashed identifiers. |
| `audit_logs` | `005_audit_logs.sql` | Recommended | Internal compliance/audit history. |
| `verification_logs` | `schema.sql`, `001_enable_rls.sql` | Recommended | Operational validation logs. |
| `key_usage` | `schema.sql`, `001_enable_rls.sql` | Recommended | Legacy/future key analytics table. |
| `used_workink_tokens` | `schema.sql`, `001_enable_rls.sql` | Disposable | Replay-protection table. Migrating reduces replay risk, but old tokens can expire operationally. |
| `delivery_sessions` | `007_delivery_sessions.sql`, `008_event_platform.sql` | Disposable | Short-lived session token hashes and event secrets. Prefer draining/expiring sessions during cutover. |
| `rate_limits` | `schema.sql`, `001_enable_rls.sql` | Disposable | Ephemeral API/login rate-limit buckets. Resetting is acceptable during migration. |
| `alert_events` | `010_internal_alerts.sql`, `011_alert_events_rls.sql` | Disposable | Internal active/resolved alert state. Recreated by health checks after cutover. |

## Index Inventory

### Explicit Application Indexes

| Index | Table | Definition intent |
|---|---|---|
| `idx_used_workink_tokens_used_at` | `used_workink_tokens` | Cleanup/filter by `used_at`. |
| `idx_rate_limits_ip_endpoint_created_at` | `rate_limits` | Rate-limit lookups by IP, endpoint, and time. |
| `idx_verification_logs_event_created_at` | `verification_logs` | Event log lookup by event and time. |
| `idx_scripts_slug` | `scripts` | Script lookup by slug. |
| `idx_scripts_visibility` | `scripts` | Visibility filtering. |
| `idx_scripts_creator_id` | `scripts` | Owner filtering and ownership checks. |
| `idx_scripts_execute_count` | `scripts` | Execution count sorting. |
| `idx_scripts_last_executed_at` | `scripts` | Last-executed sorting. |
| `idx_scripts_access_mode` | `scripts` | Access-mode filtering. |
| `idx_scripts_id_creator_id` | `scripts` | Unique composite reference target for license ownership FK. |
| `idx_script_versions_script_id` | `script_versions` | Version lookup by script. |
| `idx_script_versions_script_version` | `script_versions` | Version lookup by script and version. |
| `idx_script_downloads_script_id` | `script_downloads` | Download analytics by script. |
| `idx_script_downloads_created_at` | `script_downloads` | Time-window analytics. |
| `idx_script_downloads_script_time` | `script_downloads` | Script-specific time-window analytics. |
| `idx_profiles_role` | `profiles` | Role filtering. |
| `idx_audit_logs_actor_id` | `audit_logs` | Audit lookup by actor. |
| `idx_audit_logs_created_at` | `audit_logs` | Recent audit lookup. |
| `idx_audit_logs_resource` | `audit_logs` | Resource audit lookup. |
| `idx_delivery_builds_version_status` | `delivery_builds` | Build lookup by version and status. |
| `idx_delivery_builds_script_status` | `delivery_builds` | Build lookup by script and status. |
| `idx_delivery_builds_compatibility` | `delivery_builds` | Build compatibility filtering. |
| `idx_delivery_builds_payload_sha256` | `delivery_builds` | Payload integrity lookup. |
| `idx_delivery_builds_created_at` | `delivery_builds` | Recent build ordering. |
| `idx_delivery_sessions_token_hash` | `delivery_sessions` | Session token hash lookup. |
| `idx_delivery_sessions_expires_at` | `delivery_sessions` | Expiration cleanup. |
| `idx_delivery_sessions_build_id` | `delivery_sessions` | Session lookup by build. |
| `idx_webhook_config_script_id` | `webhook_config` | Config lookup by script. |
| `idx_webhook_config_creator_id` | `webhook_config` | Owner dashboard lookup. |
| `idx_webhook_config_enabled_provider` | `webhook_config` | Partial index for enabled provider configs. |
| `idx_event_logs_pending_delivery` | `event_logs` | Partial FIFO worker lookup for pending events. |
| `idx_event_logs_pending_claim` | `event_logs` | Partial queue claim lease lookup for pending events. |
| `idx_event_logs_session_nonce` | `event_logs` | Event nonce replay check per session. |
| `idx_event_logs_script_event_time` | `event_logs` | Script event history by type and time. |
| `idx_event_logs_dead_letter` | `event_logs` | Partial dead-letter review lookup. |
| `idx_event_logs_delivered_latency` | `event_logs` | Partial delivered-event latency analytics. |
| `idx_event_logs_delivered_created` | `event_logs` | Partial delivered-event cleanup lookup. |
| `idx_alert_events_type_status` | `alert_events` | Alert deduplication/status lookup. |
| `idx_alert_events_severity_status` | `alert_events` | Alert severity/status lookup. |
| `idx_alert_events_created_at` | `alert_events` | Recent alert ordering. |
| `idx_alert_events_resolved_at` | `alert_events` | Partial resolved-alert ordering. |
| `idx_script_executions_script_id` | `script_executions` | Execution analytics by script. |
| `idx_script_executions_created_at` | `script_executions` | Time-window execution analytics. |
| `idx_script_executions_script_time` | `script_executions` | Script-specific execution history. |
| `idx_licenses_script_id` | `licenses` | License lookup by script. |
| `idx_licenses_creator_id` | `licenses` | License lookup by creator. |
| `idx_licenses_script_key_hash` | `licenses` | Unique license key hash per script. |
| `idx_licenses_status` | `licenses` | License status filtering. |
| `idx_licenses_expires_at` | `licenses` | Partial expiring-license lookup. |
| `idx_license_assignments_license_id` | `license_assignments` | Assignment lookup by license. |
| `idx_license_assignments_license_customer` | `license_assignments` | Unique assignment per license/customer hash. |
| `idx_license_assignments_customer_hash` | `license_assignments` | Customer hash lookup. |
| `idx_license_assignments_status` | `license_assignments` | Assignment status filtering. |

### Constraint-Backed Indexes Expected In PostgreSQL

| Index or constraint index | Table | Source constraint |
|---|---|---|
| `keys_pkey` | `keys` | Primary key. |
| `keys_key_key` | `keys` | Unique `key`. |
| `used_workink_tokens_pkey` | `used_workink_tokens` | Primary key on `token`. |
| `rate_limits_pkey` | `rate_limits` | Primary key. |
| `verification_logs_pkey` | `verification_logs` | Primary key. |
| `key_usage_pkey` | `key_usage` | Primary key. |
| `scripts_pkey` | `scripts` | Primary key. |
| `scripts_slug_key` | `scripts` | Unique `slug`. |
| `script_versions_pkey` | `script_versions` | Primary key. |
| `script_versions_script_id_version_key` | `script_versions` | Unique `(script_id, version)`. |
| `script_downloads_pkey` | `script_downloads` | Primary key. |
| `profiles_pkey` | `profiles` | Primary key and auth user reference. |
| `profiles_username_key` | `profiles` | Unique `username`. |
| `audit_logs_pkey` | `audit_logs` | Primary key. |
| `delivery_builds_pkey` | `delivery_builds` | Primary key. |
| `delivery_sessions_pkey` | `delivery_sessions` | Primary key. |
| `delivery_sessions_session_token_hash_key` | `delivery_sessions` | Unique `session_token_hash`. |
| `webhook_config_pkey` | `webhook_config` | Primary key. |
| `webhook_config_script_id_key` | `webhook_config` | Unique `script_id`. |
| `event_logs_pkey` | `event_logs` | Primary key. |
| `alert_events_pkey` | `alert_events` | Primary key. |
| `script_executions_pkey` | `script_executions` | Primary key. |
| `script_executions_session_id_key` | `script_executions` | Unique `session_id`. |
| `licenses_pkey` | `licenses` | Primary key. |
| `license_assignments_pkey` | `license_assignments` | Primary key. |

## RLS Policy Inventory

| Table | Policy | Role scope | Command | Behavior |
|---|---|---|---|---|
| `keys` | `keys_deny_all` | `anon`, `authenticated` | All | Deny direct client access. |
| `used_workink_tokens` | `used_workink_tokens_deny_all` | `anon`, `authenticated` | All | Deny direct client access. |
| `rate_limits` | `rate_limits_deny_all` | `anon`, `authenticated` | All | Deny direct client access. |
| `verification_logs` | `verification_logs_deny_all` | `anon`, `authenticated` | All | Deny direct client access. |
| `key_usage` | `key_usage_deny_all` | `anon`, `authenticated` | All | Deny direct client access. |
| `scripts` | `scripts_deny_all` | `anon`, `authenticated` | All | Baseline deny unless an owner policy permits access. |
| `scripts` | `scripts_select_own` | `authenticated` | Select | Allow owner select where `creator_id = auth.uid()`. |
| `scripts` | `scripts_insert_own` | `authenticated` | Insert | Allow owner insert where `creator_id = auth.uid()`. |
| `scripts` | `scripts_update_own` | `authenticated` | Update | Allow owner update where old and new `creator_id = auth.uid()`. |
| `scripts` | `scripts_delete_own` | `authenticated` | Delete | Allow owner delete where `creator_id = auth.uid()`. |
| `script_versions` | `script_versions_deny_all` | `anon`, `authenticated` | All | Baseline deny unless an owner policy permits access. |
| `script_versions` | `script_versions_select_own` | `authenticated` | Select | Allow select through owned parent script. |
| `script_versions` | `script_versions_insert_own` | `authenticated` | Insert | Allow insert through owned parent script. |
| `script_downloads` | `script_downloads_deny_all` | `anon`, `authenticated` | All | Deny direct client access. |
| `profiles` | `profiles_deny_all` | `anon`, `authenticated` | All | Deny direct client access; profile access is server-mediated. |
| `audit_logs` | `audit_logs_deny_all` | `anon`, `authenticated` | All | Deny direct client access. |
| `delivery_builds` | `delivery_builds_deny_all` | `anon`, `authenticated` | All | Deny direct client access to encrypted payload artifacts. |
| `delivery_sessions` | `delivery_sessions_deny_all` | `anon`, `authenticated` | All | Deny direct client access to token hashes and event secrets. |
| `webhook_config` | `webhook_config_owner_select` | `authenticated` | Select | Allow owner select for configs tied to owned scripts. |
| `webhook_config` | `webhook_config_owner_insert` | `authenticated` | Insert | Allow owner insert for owned scripts and matching `creator_id`. |
| `webhook_config` | `webhook_config_owner_update` | `authenticated` | Update | Allow owner update while preserving owned script linkage. |
| `webhook_config` | `webhook_config_owner_delete` | `authenticated` | Delete | Allow owner delete for configs tied to owned scripts. |
| `webhook_config` | `webhook_config_service_access` | `service_role` | All | Allow service role full access. |
| `event_logs` | `event_logs_deny_all` | `anon`, `authenticated` | All | Deny direct client access to event queue/audit data. |
| `event_logs` | `event_logs_service_access` | `service_role` | All | Allow service role full access. |
| `alert_events` | `alert_events_deny_all` | `anon`, `authenticated` | All | Deny direct client access to internal alert state. |
| `script_executions` | `script_executions_deny_all` | `anon`, `authenticated` | All | Deny direct client access to execution analytics events. |
| `script_executions` | `script_executions_service_access` | `service_role` | All | Allow service role full access. |
| `licenses` | `licenses_deny_anon` | `anon` | All | Deny anonymous access. |
| `licenses` | `licenses_service_access` | `service_role` | All | Allow service role full access. |
| `licenses` | `licenses_select_own` | `authenticated` | Select | Allow owner select where `creator_id = auth.uid()`. |
| `licenses` | `licenses_insert_own` | `authenticated` | Insert | Allow owner insert where `creator_id = auth.uid()`. |
| `licenses` | `licenses_update_own` | `authenticated` | Update | Allow owner update where old and new `creator_id = auth.uid()`. |
| `licenses` | `licenses_delete_own` | `authenticated` | Delete | Allow owner delete where `creator_id = auth.uid()`. |
| `license_assignments` | `license_assignments_deny_anon` | `anon` | All | Deny anonymous access. |
| `license_assignments` | `license_assignments_service_access` | `service_role` | All | Allow service role full access. |
| `license_assignments` | `license_assignments_select_own` | `authenticated` | Select | Allow select through owned parent license. |
| `license_assignments` | `license_assignments_insert_own` | `authenticated` | Insert | Allow insert through owned parent license. |
| `license_assignments` | `license_assignments_update_own` | `authenticated` | Update | Allow update through owned parent license. |
| `license_assignments` | `license_assignments_delete_own` | `authenticated` | Delete | Allow delete through owned parent license. |

## Trigger Inventory

| Trigger | Table | Timing | Function | Purpose |
|---|---|---|---|---|
| `trg_increment_script_execution_cache` | `script_executions` | `AFTER INSERT FOR EACH ROW` | `increment_script_execution_cache()` | Atomically increments `scripts.execute_count` and updates `scripts.last_executed_at`. |

## Function Inventory

| Function | Language | Return type | Source | Purpose |
|---|---|---|---|---|
| `increment_script_execution_cache()` | `plpgsql` | `trigger` | `migrations/012_script_executions.sql` | Maintains cached script execution counters after execution inserts. |

Postgres/Supabase built-ins such as `gen_random_uuid()` are used but are not application-defined functions.

## View Inventory

No application-defined views or materialized views were found in the reviewed SQL artifacts.

## Storage Bucket Inventory

No Supabase Storage buckets were found in the reviewed SQL artifacts or application code. Script content and encrypted delivery payloads are stored inline in database tables, primarily `script_versions.content` and `delivery_builds.payload_ciphertext`.

## Environment Variable Inventory

### Required Runtime Variables

| Variable | Location | Secret | Migration relevance |
|---|---|---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel | No | Must be updated to the target Supabase project URL at cutover. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel | No | Must match the target Supabase anon key; RLS must be validated first. |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel | Yes | Must match the target Supabase service role key; also used as payload encryption fallback if `DELIVERY_PAYLOAD_SECRET` is unset. |
| `CRON_SECRET` | Vercel and GitHub Actions | Yes | Must remain synchronized for cleanup, event worker, and alert checks. |
| `EVENT_WORKER_URL` | GitHub Actions | Yes in current docs | Must point to the production `/api/internal/event-worker` endpoint after cutover. |
| `ADMIN_API_KEY` | Vercel | Yes | Required for private raw script read authorization. |
| `ANALYTICS_PEPPER` | Vercel | Yes | Must remain stable to preserve analytics and login bucket hash continuity. |
| `TURNSTILE_SECRET_KEY` | Vercel | Yes | Required for login protection after cutover. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Vercel | No | Required for login widget rendering after cutover. |

### Optional Runtime Variables

| Variable | Location | Secret | Migration relevance |
|---|---|---:|---|
| `DELIVERY_PAYLOAD_SECRET` | Vercel | Yes | Strongly recommended. Preserve value across migration to keep existing encrypted payloads decryptable. |
| `DELIVERY_PAYLOAD_KEY_ID` | Vercel | No | Preserve if set so payload metadata remains traceable. |
| `NEXT_PUBLIC_SITE_URL` | Vercel | No | Preserve or update when production origin changes. |
| `INTERNAL_ALERT_DISCORD_WEBHOOK` | Vercel | Yes | Optional alert notification target. |

### Operator-Only Migration Inputs

| Input | Secret | Purpose |
|---|---:|---|
| Source Supabase database connection string | Yes | `pg_dump` source connection. |
| Target Supabase database connection string | Yes | `pg_restore` or `psql` target connection. |
| Source project reference | No | Supabase dashboard/API identification. |
| Target project reference | No | Supabase dashboard/API identification. |
| Source and target database passwords | Yes | Required for direct Postgres dump/restore if connection strings are not prebuilt. |

Do not commit operator-only migration inputs to the repository.

## Exact Migration Order

### Production Cutover Order

Use this order for a production Supabase project migration. It is designed around data integrity and foreign-key dependencies, not only repository file order.

1. Freeze writes by putting the application into maintenance mode or blocking mutating routes at the edge.
2. Pause scheduled workers that can mutate Supabase state: event worker, cleanup job, and internal alert checks.
3. Confirm no active deployment is running old code against the source project.
4. Export or replicate Supabase Auth users first, preserving user UUIDs.
5. Dump the source database schema from the live source project.
6. Restore schema into the target project.
7. Restore data in dependency order.
8. Restore or validate functions.
9. Restore or validate triggers.
10. Restore or validate indexes and constraints.
11. Enable and validate RLS policies.
12. Validate storage bucket absence or create buckets only if live source has buckets outside repository expectations.
13. Set target runtime environment variables in Vercel and GitHub Actions.
14. Deploy application configured for the target Supabase project.
15. Run validation queries and smoke tests.
16. Resume scheduled workers only after validation passes.
17. Keep source project read-only and retained for rollback until the rollback window expires.

### Public Data Restore Dependency Order

Restore `auth.users` before public tables that reference users. Then restore public data in this order:

1. `profiles`
2. `keys`
3. `used_workink_tokens`
4. `rate_limits`
5. `verification_logs`
6. `key_usage`
7. `scripts` with `current_version_id` temporarily nullable as already defined
8. `script_versions`
9. Update or validate `scripts.current_version_id`
10. `script_downloads`
11. `audit_logs`
12. `delivery_builds`
13. `delivery_sessions`
14. `script_executions`
15. `webhook_config`
16. `event_logs`
17. `alert_events`
18. `licenses`
19. `license_assignments`

### Repository SQL Reference Order

Use this sequence only for schema reconstruction in a non-production rehearsal. Because `schema.sql` overlaps later migrations, prefer live database dump/restore for production.

1. Bootstrap legacy/core objects from `schema.sql` only if an equivalent live schema dump is unavailable.
2. Apply `migrations/001_enable_rls.sql`.
3. Apply `migrations/002_cdn_tables.sql`.
4. Apply `migrations/003_profiles.sql`.
5. Apply `migrations/004_script_ownership.sql`.
6. Apply `migrations/005_audit_logs.sql`.
7. Apply `migrations/006_delivery_builds.sql`.
8. Apply `migrations/007_delivery_sessions.sql`.
9. Apply `migrations/008_event_platform.sql`.
10. Apply `migrations/009_event_platform_hardening.sql`.
11. Apply `migrations/010_internal_alerts.sql`.
12. Apply `migrations/011_alert_events_rls.sql`.
13. Apply `migrations/012_script_executions.sql`.
14. Apply `migrations/013_license_schema_foundation.sql`.

## Validation Queries

Run these queries on both source and target. Result sets should match unless a table is intentionally classified as Disposable and intentionally not migrated.

### Tables

```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

Expected public application tables:

```sql
SELECT expected.table_name,
       CASE WHEN actual.table_name IS NULL THEN 'missing' ELSE 'present' END AS status
FROM (VALUES
  ('alert_events'),
  ('audit_logs'),
  ('delivery_builds'),
  ('delivery_sessions'),
  ('event_logs'),
  ('key_usage'),
  ('keys'),
  ('license_assignments'),
  ('licenses'),
  ('profiles'),
  ('rate_limits'),
  ('script_downloads'),
  ('script_executions'),
  ('script_versions'),
  ('scripts'),
  ('used_workink_tokens'),
  ('verification_logs'),
  ('webhook_config')
) AS expected(table_name)
LEFT JOIN information_schema.tables actual
  ON actual.table_schema = 'public'
 AND actual.table_name = expected.table_name
ORDER BY expected.table_name;
```

### Row Counts

```sql
SELECT 'alert_events' AS table_name, count(*) FROM alert_events
UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs
UNION ALL SELECT 'delivery_builds', count(*) FROM delivery_builds
UNION ALL SELECT 'delivery_sessions', count(*) FROM delivery_sessions
UNION ALL SELECT 'event_logs', count(*) FROM event_logs
UNION ALL SELECT 'key_usage', count(*) FROM key_usage
UNION ALL SELECT 'keys', count(*) FROM keys
UNION ALL SELECT 'license_assignments', count(*) FROM license_assignments
UNION ALL SELECT 'licenses', count(*) FROM licenses
UNION ALL SELECT 'profiles', count(*) FROM profiles
UNION ALL SELECT 'rate_limits', count(*) FROM rate_limits
UNION ALL SELECT 'script_downloads', count(*) FROM script_downloads
UNION ALL SELECT 'script_executions', count(*) FROM script_executions
UNION ALL SELECT 'script_versions', count(*) FROM script_versions
UNION ALL SELECT 'scripts', count(*) FROM scripts
UNION ALL SELECT 'used_workink_tokens', count(*) FROM used_workink_tokens
UNION ALL SELECT 'verification_logs', count(*) FROM verification_logs
UNION ALL SELECT 'webhook_config', count(*) FROM webhook_config
ORDER BY table_name;
```

### Critical Data Integrity

```sql
SELECT s.id, s.slug
FROM scripts s
LEFT JOIN auth.users u ON u.id = s.creator_id
WHERE s.creator_id IS NOT NULL
  AND u.id IS NULL;
```

```sql
SELECT p.id
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE u.id IS NULL;
```

```sql
SELECT sv.id
FROM script_versions sv
LEFT JOIN scripts s ON s.id = sv.script_id
WHERE s.id IS NULL;
```

```sql
SELECT s.id, s.slug, s.current_version_id
FROM scripts s
LEFT JOIN script_versions sv ON sv.id = s.current_version_id
WHERE s.current_version_id IS NOT NULL
  AND sv.id IS NULL;
```

```sql
SELECT l.id
FROM licenses l
LEFT JOIN scripts s ON s.id = l.script_id AND s.creator_id = l.creator_id
WHERE s.id IS NULL;
```

```sql
SELECT la.id
FROM license_assignments la
LEFT JOIN licenses l ON l.id = la.license_id
WHERE l.id IS NULL;
```

### Indexes

```sql
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

### RLS Enabled

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'alert_events', 'audit_logs', 'delivery_builds', 'delivery_sessions',
    'event_logs', 'key_usage', 'keys', 'license_assignments', 'licenses',
    'profiles', 'rate_limits', 'script_downloads', 'script_executions',
    'script_versions', 'scripts', 'used_workink_tokens', 'verification_logs',
    'webhook_config'
  )
ORDER BY tablename;
```

Expected: every row has `rowsecurity = true`.

### RLS Policies

```sql
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Triggers

```sql
SELECT event_object_table AS table_name,
       trigger_name,
       action_timing,
       event_manipulation,
       action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
```

Expected application trigger:

```sql
SELECT tgname AS trigger_name,
       relname AS table_name,
       proname AS function_name,
       NOT tgisdisabled AS enabled
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT tgisinternal
  AND c.relnamespace = 'public'::regnamespace
ORDER BY relname, tgname;
```

### Functions

```sql
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_get_function_arguments(p.oid) AS arguments,
       pg_get_function_result(p.oid) AS result_type,
       l.lanname AS language
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname = 'public'
ORDER BY p.proname;
```

Expected application-defined function: `increment_script_execution_cache()`.

### Views

```sql
SELECT table_schema, table_name
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected: zero application-defined views unless live source has out-of-repository objects.

### Storage Buckets

```sql
SELECT id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at
FROM storage.buckets
ORDER BY id;
```

Expected from repository audit: zero application-required buckets.

### Delivery Payload Compatibility

```sql
SELECT build_status,
       encryption_scheme,
       encryption_key_id,
       count(*) AS builds
FROM delivery_builds
GROUP BY build_status, encryption_scheme, encryption_key_id
ORDER BY build_status, encryption_scheme, encryption_key_id;
```

```sql
SELECT count(*) AS ready_builds_missing_payload
FROM delivery_builds
WHERE build_status = 'ready'
  AND (payload_ciphertext IS NULL OR payload_sha256 IS NULL OR built_at IS NULL);
```

Expected: `ready_builds_missing_payload = 0`.

### Event Queue Drain Check

```sql
SELECT delivery_status, count(*)
FROM event_logs
GROUP BY delivery_status
ORDER BY delivery_status;
```

Before cutover, decide whether pending rows must be drained or migrated:

```sql
SELECT count(*) AS pending_events
FROM event_logs
WHERE delivery_status = 'pending';
```

### Script Execution Cache Check

```sql
SELECT s.id,
       s.slug,
       s.execute_count AS cached_count,
       count(se.id) AS actual_count
FROM scripts s
LEFT JOIN script_executions se ON se.script_id = s.id
GROUP BY s.id, s.slug, s.execute_count
HAVING s.execute_count <> count(se.id)
ORDER BY s.slug;
```

Expected: zero rows, unless counters were intentionally migrated without historical `script_executions`.

## Rollback Plan

### Rollback Preconditions

1. Keep source Supabase project intact and read-only during the rollback window.
2. Keep pre-cutover Vercel deployment and environment variable values available.
3. Keep source database dump and target database dump from immediately before cutover.
4. Keep workers paused until either cutover or rollback is selected.

### Application Rollback

1. Set Vercel environment variables back to the source Supabase project values: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
2. Restore the previous values of `DELIVERY_PAYLOAD_SECRET` and `DELIVERY_PAYLOAD_KEY_ID` if they were changed.
3. Redeploy the previous known-good Vercel deployment.
4. Point `EVENT_WORKER_URL` back to the active production endpoint if it changed.
5. Resume workers only after source-project smoke tests pass.

### Database Rollback

If target migration fails before production traffic is switched, discard the target project or restore it from the pre-cutover target dump.

If production traffic has already switched and writes occurred on the target, choose one path:

1. Fast rollback with data loss acceptance: switch application back to source and archive target writes for manual reconciliation.
2. Reconciliation rollback: export changed rows from target since cutover, merge into source in dependency order, then switch application back.
3. Forward fix: keep traffic on target and repair target schema/data if the source rollback would lose unacceptable writes.

### Available Repository Rollback SQL

Rollback SQL exists for later event/analytics migrations only:

| Rollback file | Reverts |
|---|---|
| `migrations/008_event_platform_rollback.sql` | `event_logs`, `webhook_config`, and `delivery_sessions.event_secret`. |
| `migrations/009_event_platform_hardening_rollback.sql` | `event_logs.claimed_at` and `idx_event_logs_pending_claim`. |
| `migrations/010_internal_alerts_rollback.sql` | `alert_events`. |
| `migrations/011_alert_events_rls_rollback.sql` | `alert_events` RLS policy and RLS enablement. |
| `migrations/012_script_executions_rollback.sql` | `script_executions`, execution trigger/function, and cached script execution columns. |

No rollback SQL was found for migrations `001` through `007` or `013`. For those, use database backups or explicit manual reverse SQL generated and reviewed during a rehearsal.

## Emergency Cutover Procedure

Use this procedure when the source Supabase project is degraded but still readable, or when a planned cutover must be accelerated.

1. Announce maintenance mode and stop mutating traffic.
2. Pause GitHub Actions event worker and any scheduled calls to cleanup or alert endpoints.
3. Capture a final source backup if the source database is reachable.
4. Export or verify Auth users with preserved UUIDs.
5. Restore schema and Critical tables first: `profiles`, `scripts`, `script_versions`, `delivery_builds`, `licenses`, `license_assignments`, `keys`, and `webhook_config`.
6. Restore `event_logs` if pending events must not be lost.
7. Skip Disposable tables if time is constrained: `rate_limits`, `delivery_sessions`, `alert_events`, and optionally `used_workink_tokens`.
8. Restore Recommended tables if time permits: `script_executions`, `script_downloads`, `audit_logs`, `verification_logs`, and `key_usage`.
9. Set Vercel Supabase variables to target project values.
10. Preserve `DELIVERY_PAYLOAD_SECRET`; do not rotate payload secrets during emergency cutover.
11. Deploy and run the critical validation queries for tables, RLS, functions, triggers, and ready delivery payloads.
12. Verify login, dashboard load, script delivery session creation, payload fetch, and license lookup.
13. Resume workers after event queue validation.
14. Keep the source project isolated for forensic review and fallback until post-cutover monitoring is stable.

Emergency acceptance criteria:

1. Authenticated creator can log in.
2. Creator profile loads.
3. Owned scripts and versions load.
4. At least one known ready delivery build can be fetched and decrypted by the application.
5. License validation path works for a known license-backed script if license mode is enabled.
6. Service role database access works for internal routes.
7. RLS is enabled on every application table.

## Post-Cutover Smoke Tests

1. `GET /api/health` returns healthy status.
2. `/login` renders Turnstile and accepts a valid login.
3. Dashboard pages load creator scripts without cross-account leakage.
4. A known public script can create a delivery session and fetch payload.
5. A protected script validates the expected key or license state.
6. Event reporting accepts a valid signed event and rejects a replayed nonce.
7. Event worker processes pending events without duplicate claims.
8. Cleanup endpoint runs with `CRON_SECRET`.
9. Internal alert check runs with `CRON_SECRET`.
10. RLS validation query still reports `rowsecurity = true` for all application tables.

## Final Readiness Checklist

| Check | Required before cutover |
|---|---:|
| Live source catalog matches this inventory or differences are documented. | Yes |
| Auth user migration preserves UUIDs. | Yes |
| Critical table row counts match source and target. | Yes |
| RLS enabled on all application tables. | Yes |
| Policy inventory matches expected service/owner access boundaries. | Yes |
| `increment_script_execution_cache()` exists on target. | Yes |
| `trg_increment_script_execution_cache` exists and is enabled. | Yes |
| No unexpected application views are missing. | Yes |
| Storage bucket query reviewed. | Yes |
| Runtime environment variables are set in Vercel and GitHub Actions. | Yes |
| Payload encryption secret continuity confirmed. | Yes |
| Workers paused during final dump and resumed after validation. | Yes |
| Rollback path tested or approved. | Yes |
