# Row Level Security Policies

Status: Current through `migrations/016_license_hash_hardening.sql`.

This document summarizes RLS behavior and security boundaries. It is not a substitute for reviewing the SQL migrations before production changes.

## Default Pattern

Most operational tables follow this pattern:

- RLS enabled.
- `anon` denied for all commands.
- `authenticated` denied for all commands.
- Application code uses the Supabase service role from server-only contexts.

Some owner-managed tables add authenticated owner policies while retaining service-role operational access.

## Service-Role-Only Tables

The following tables deny direct `anon` and `authenticated` access and are expected to be accessed only by trusted server code using `supabaseAdmin`:

- `keys`
- `used_workink_tokens`
- `rate_limits`
- `verification_logs`
- `key_usage`
- `script_downloads`
- `profiles`
- `audit_logs`
- `delivery_builds`
- `delivery_sessions`
- `event_logs`
- `alert_events`
- `script_executions`

Migration 014 also adds service-role-only runtime RPCs for license assignment authorization and delivery-count increments. Migration 015/016 add hashed key/license lookup columns without changing browser access policies.

Security expectations:

- Client components must not use direct Supabase access for these tables.
- Dashboard pages should call server services/repositories directly.
- API routes and server actions must derive ownership from session or trusted server state.
- Secrets, hashes, encrypted payloads, queue state, and alert internals remain inaccessible to clients.

## Owner-Scoped Tables

### `scripts`

Policies:

- `scripts_deny_all`: denies `anon` and `authenticated` unless a later permissive owner policy applies.
- `scripts_select_own`: authenticated users may select rows where `creator_id = auth.uid()`.
- `scripts_insert_own`: authenticated users may insert rows where `creator_id = auth.uid()`.
- `scripts_update_own`: authenticated users may update rows where existing and new `creator_id = auth.uid()`.
- `scripts_delete_own`: authenticated users may delete rows where `creator_id = auth.uid()`.

Security boundary:

- Creator ownership is `scripts.creator_id`.
- Server actions still derive `creator_id` from `requireAuth()` and must not trust client-provided owner IDs.

### `script_versions`

Policies:

- `script_versions_deny_all`: denies `anon` and `authenticated` unless owner policy applies.
- `script_versions_select_own`: authenticated users may select versions whose parent script has `creator_id = auth.uid()`.
- `script_versions_insert_own`: authenticated users may insert versions only for scripts they own.

Security boundary:

- Ownership is inherited from `scripts`.
- Updates/deletes are not owner-enabled by migration 004; version history is intended to be immutable.

### `webhook_config`

Policies:

- `webhook_config_owner_select`: authenticated users may select rows where `creator_id = auth.uid()` and parent script is owned by `auth.uid()`.
- `webhook_config_owner_insert`: authenticated users may insert rows only for their own scripts and with matching `creator_id`.
- `webhook_config_owner_update`: authenticated users may update rows only when both the row and resulting row remain tied to their own script.
- `webhook_config_owner_delete`: authenticated users may delete rows tied to their own scripts.
- `webhook_config_service_access`: service role has full access.

Security boundary:

- Provider credentials remain server-side.
- Runtime scripts never receive webhook URLs.
- Worker access is service-role based.

### `licenses`

Policies:

- `licenses_deny_anon`: denies all `anon` access.
- `licenses_service_access`: service role has full access.
- `licenses_select_own`: authenticated users may select rows where `creator_id = auth.uid()`.
- `licenses_insert_own`: authenticated users may insert rows where `creator_id = auth.uid()`.
- `licenses_update_own`: authenticated users may update rows where existing and new `creator_id = auth.uid()`.
- `licenses_delete_own`: authenticated users may delete rows where `creator_id = auth.uid()`.

Security boundary:

- Raw license keys are not stored.
- License ownership is direct via `creator_id` and structurally bound to script ownership by `licenses_creator_owns_script`.
- License validation uses service code and key hashes.

### `license_assignments`

Policies:

- `license_assignments_deny_anon`: denies all `anon` access.
- `license_assignments_service_access`: service role has full access.
- `license_assignments_select_own`: authenticated users may select assignments only if parent license belongs to `auth.uid()`.
- `license_assignments_insert_own`: authenticated users may insert assignments only under licenses they own.
- `license_assignments_update_own`: authenticated users may update assignments only under licenses they own.
- `license_assignments_delete_own`: authenticated users may delete assignments only under licenses they own.

Security boundary:

- Customer identifiers are stored as hashes.
- Assignment ownership is inherited from parent `licenses.creator_id`.

## Explicit Service Policies

Some tables define explicit service-role policies in addition to deny policies:

- `webhook_config_service_access`
- `event_logs_service_access`
- `script_executions_service_access`
- `licenses_service_access`
- `license_assignments_service_access`

Operational implication:

- Server code using service role can bypass creator-scoped restrictions where required for runtime processing.
- Application services must enforce ownership before returning creator-facing data.

## Deny-Only Operational Tables

### Delivery

- `delivery_builds_deny_all`: encrypted payload artifacts are not directly accessible to browser/authenticated users.
- `delivery_sessions_deny_all`: session hashes and event secrets are not directly accessible to browser/authenticated users.

Runtime access is mediated by `/api/delivery/session` and `/api/delivery/fetch`.

### Events and Alerts

- `event_logs_deny_all`: event queue data is not directly accessible to browser/authenticated users.
- `alert_events_deny_all`: internal alert state is not directly accessible to browser/authenticated users.

Runtime access is mediated by `/api/events/report`; worker access is mediated by `/api/internal/event-worker` with `CRON_SECRET`.

### Execution Analytics

- `script_executions_deny_all`: execution events are runtime analytics records, not direct client data.

Insert happens during delivery session creation and updates cached counters through trigger.

### Key System

- `keys_deny_all`
- `used_workink_tokens_deny_all`
- `rate_limits_deny_all`
- `verification_logs_deny_all`
- `key_usage_deny_all`

These protect key material, replay data, rate-limit state, and operational logs from direct client access.

### Creator Identity and Audit

- `profiles_deny_all`
- `audit_logs_deny_all`

Profiles are provisioned and read through server auth helpers. Audit logs are internal compliance records.

## Application-Level Boundaries

RLS is one layer. The application also enforces:

- `getCurrentUser()` for dashboard session resolution and profile provisioning.
- `requireAuth()` for mutations that must fail without a session.
- `assertScriptOwner()` and `getOwnedScript()` for per-script isolation.
- License APIs validate ownership before listing, mutating, or assigning licenses.
- Delivery APIs do not accept `creator_id` from clients.
- Event APIs authenticate using delivery session token hash plus HMAC event signature.

## Verification Queries

Use these checks when validating an environment:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'scripts', 'script_versions', 'delivery_sessions', 'delivery_builds',
    'event_logs', 'alert_events', 'script_executions', 'licenses',
    'license_assignments', 'profiles', 'audit_logs', 'keys', 'key_usage'
  )
ORDER BY tablename;
```

```sql
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Expected result:

- All listed tables have `rowsecurity = true`.
- Owner policies exist only where intended.
- Runtime/operational tables do not expose creator-authenticated direct access.
