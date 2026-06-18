# Database Migrations

Status: Current through `013_license_schema_foundation.sql`.

This document records the migration chain and operational expectations. It is documentation only and does not replace the SQL files in `migrations/`.

## Migration Order

Apply migrations in numeric order after the base `schema.sql` when provisioning a new environment:

1. `001_enable_rls.sql`
2. `002_cdn_tables.sql`
3. `003_profiles.sql`
4. `004_script_ownership.sql`
5. `005_audit_logs.sql`
6. `006_delivery_builds.sql`
7. `007_delivery_sessions.sql`
8. `008_event_platform.sql`
9. `009_event_platform_hardening.sql`
10. `010_internal_alerts.sql`
11. `011_alert_events_rls.sql`
12. `012_script_executions.sql`
13. `013_license_schema_foundation.sql`

Rollback files currently exist for some later event-platform migrations. Do not assume rollback coverage for all migrations. For production incidents, prefer restore-from-backup or forward corrective migration after review.

## Migration Summary

### Base `schema.sql`

Purpose: Bootstrap schema reference containing the key system, CDN/script tables, secure delivery, event platform, alert events, profiles, and ownership constraints as a consolidated view.

Operational notes:

- The base schema includes comments indicating follow-up migrations.
- The migration chain is the source of truth for staged evolution and RLS policy details.
- Use the base schema as a provisioning aid only when it matches the intended migration state.

### `001_enable_rls.sql`

Purpose: Enables RLS on base key-system tables and denies `anon` and `authenticated` all direct access.

Tables affected:

- `keys`
- `used_workink_tokens`
- `rate_limits`
- `verification_logs`
- `key_usage`

Security boundary:

- All five tables are service-role-only after this migration.

### `002_cdn_tables.sql`

Purpose: Adds script storage and historical download analytics.

Tables created:

- `scripts`
- `script_versions`
- `script_downloads`

Constraints and relationships:

- `script_versions.script_id` references `scripts(id)` with `ON DELETE CASCADE`.
- `scripts.current_version_id` references `script_versions(id)` with `ON DELETE SET NULL`.
- `script_downloads.script_id` references `scripts(id)` with `ON DELETE CASCADE`.
- `script_downloads.version_id` references `script_versions(id)` with `ON DELETE SET NULL`.

Security boundary:

- Initial policies deny `anon` and `authenticated` all access.

### `003_profiles.sql`

Purpose: Adds creator identity profile records linked to Supabase Auth.

Tables created:

- `profiles`

Constraints and relationships:

- `profiles.id` references `auth.users(id)` with `ON DELETE CASCADE`.
- `role` is constrained to `creator` or `admin`.

Security boundary:

- RLS denies `anon` and `authenticated` all access.
- Profile access is mediated by server-side auth helpers.

### `004_script_ownership.sql`

Purpose: Adds owner relationship and owner RLS for script resources.

Tables affected:

- `scripts`
- `script_versions`

Constraints and relationships:

- Adds `fk_scripts_creator` from `scripts.creator_id` to `auth.users(id)` with `ON DELETE SET NULL`, initially `NOT VALID` for migration safety.

RLS changes:

- Authenticated creators can select, insert, update, and delete only their own `scripts` rows.
- Authenticated creators can select and insert `script_versions` only for scripts they own.
- `script_downloads` remains service-role-only.

Operational notes:

- The migration includes a post-cleanup instruction to validate the creator FK after orphan checks are clean.

### `005_audit_logs.sql`

Purpose: Adds audit logging for creator/admin actions.

Tables created:

- `audit_logs`

Indexes:

- Actor lookup.
- Created-at sorting.
- Resource type/id lookup.

Security boundary:

- RLS denies `anon` and `authenticated` all access.

### `006_delivery_builds.sql`

Purpose: Adds pre-built secure delivery payload artifacts.

Tables created:

- `delivery_builds`

Constraints and relationships:

- References `scripts(id)` and `script_versions(id)`, both with `ON DELETE CASCADE`.
- Restricts `payload_storage_kind` to `inline_encrypted`.
- Restricts `build_status` to `pending`, `building`, `ready`, `failed`, or `invalidated`.
- Requires ready builds to have ciphertext, payload hash, and `built_at`.

Security boundary:

- RLS denies `anon` and `authenticated` all access.

### `007_delivery_sessions.sql`

Purpose: Adds short-lived secure delivery sessions.

Tables created:

- `delivery_sessions`

Constraints and relationships:

- References `scripts(id)` and `delivery_builds(id)`, both with `ON DELETE CASCADE`.
- `session_token_hash` is unique and constrained to SHA-256 hex format.
- `expires_at` must be after `created_at`.

Security boundary:

- RLS denies `anon` and `authenticated` all access.

### `008_event_platform.sql`

Purpose: Adds event platform database foundation.

Tables created:

- `webhook_config`
- `event_logs`

Tables altered:

- Adds nullable `delivery_sessions.event_secret`.

Constraints and relationships:

- `webhook_config.script_id` is unique and references `scripts(id)` with `ON DELETE CASCADE`.
- `webhook_config.creator_id` references `auth.users(id)` with `ON DELETE CASCADE`.
- `event_logs.script_id` references `scripts(id)` with `ON DELETE CASCADE`.
- `event_logs.session_id` references `delivery_sessions(id)` with `ON DELETE SET NULL`.

RLS changes:

- `webhook_config` has owner-scoped authenticated policies and service-role policy.
- `event_logs` denies `anon` and `authenticated`; service role has full access.

Operational notes:

- The migration creates storage only. API endpoints, workers, provider integrations, and queue processing are implemented in application code.

### `009_event_platform_hardening.sql`

Purpose: Adds queue claim lease support.

Tables altered:

- Adds `event_logs.claimed_at`.

Indexes:

- `idx_event_logs_pending_claim` supports worker polling of unclaimed or stale claimed events.

Operational notes:

- Application worker treats claims older than 15 minutes as recoverable.

### `010_internal_alerts.sql`

Purpose: Adds internal alert persistence for operations monitoring.

Tables created:

- `alert_events`

Constraints:

- `severity` is `low`, `medium`, `high`, or `critical`.
- `status` is `active` or `resolved`.
- `metadata` must be a JSON object.

Indexes:

- Alert type/status.
- Severity/status.
- Created-at and resolved-at history.

### `011_alert_events_rls.sql`

Purpose: Final hardening for alert events.

Tables affected:

- `alert_events`

Security boundary:

- Enables RLS and denies `anon` and `authenticated` all access.
- Service-role access is used by internal alert checks.

### `012_script_executions.sql`

Purpose: Adds canonical execution analytics and cached execution counters.

Tables altered:

- Adds `scripts.execute_count`.
- Adds `scripts.last_executed_at`.

Tables created:

- `script_executions`

Functions/triggers:

- `increment_script_execution_cache()` updates script counters after insert.
- `trg_increment_script_execution_cache` fires after each `script_executions` insert.

Security boundary:

- `script_executions` denies `anon` and `authenticated`; service role has full access.

### `013_license_schema_foundation.sql`

Purpose: Adds script access mode and license foundation tables.

Tables altered:

- Adds `scripts.access_mode` with default `public`.
- Adds `scripts_access_mode_check` for `public`, `key_required`, and `license_required`.
- Adds unique `(scripts.id, scripts.creator_id)` index for license ownership FK.

Tables created:

- `licenses`
- `license_assignments`

Constraints and relationships:

- `licenses.script_id` references `scripts(id)` with `ON DELETE CASCADE`.
- `licenses.creator_id` references `auth.users(id)` with `ON DELETE CASCADE`.
- `licenses_creator_owns_script` references `scripts(id, creator_id)` to bind license ownership to script ownership.
- `license_assignments.license_id` references `licenses(id)` with `ON DELETE CASCADE`.
- License key hashes and customer identifier hashes are constrained to SHA-256 hex format.

RLS changes:

- `licenses`: deny `anon`, service-role full access, authenticated owner CRUD by `creator_id`.
- `license_assignments`: deny `anon`, service-role full access, authenticated owner CRUD through parent license ownership.

Operational notes:

- Defaulting `scripts.access_mode` to `public` is production-safe because it preserves existing delivery behavior until scripts are explicitly changed.
- This migration is license schema foundation only; premium runtime hardening is deferred future license work and remains separate from completed Phase 7C runtime performance optimization.

## Deployment Checks

Before applying migrations:

- Confirm target environment and branch.
- Confirm database backup or point-in-time recovery availability.
- Confirm no application deploy depends on unapplied migrations unless deploying in the intended sequence.

After applying migrations:

- Verify tables exist and RLS is enabled.
- Verify expected indexes exist.
- Verify owner policies on `scripts`, `script_versions`, `webhook_config`, `licenses`, and `license_assignments`.
- Verify service-role-only tables are not readable with `anon` or ordinary authenticated access.
- Run application validation: `npm run lint` and `npm run build`.

## Schema Drift Checks

Recommended manual SQL checks:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

```sql
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

```sql
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

## Known Migration Boundaries

- No schema changes are part of Documentation P1.
- No ADRs are created in this phase.
- Phase 7B Key Monetization Platform documentation does not create migrations. Provider source, key type, max devices, device registrations, reset history, or analytics storage must be separately reviewed before implementation.
- Completed Phase 7C Production Runtime Performance work did not create migrations.
- Planned Phase 7D Database Scalability & Runtime Optimization is documentation-only at this stage; no Phase 7D migrations have been generated.
- Future Premium License System migration work must not be folded into completed Phase 7B backend work, completed Phase 7C runtime performance work, or planned Phase 7D scale evaluation without explicit design approval.
- License management should remain aligned with finalized loader integration requirements.
