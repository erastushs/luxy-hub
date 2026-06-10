# Phase 8B.1 — Event Platform Database Foundation

Status: Implemented
Date: 2026-06-09
Scope: Database foundation only

## Scope Boundary

Implemented:

- `migrations/008_event_platform.sql`
- `migrations/008_event_platform_rollback.sql`
- `webhook_config` table
- `event_logs` table
- nullable `delivery_sessions.event_secret`
- `event_logs.claimed_at` queue lease column via `migrations/009_event_platform_hardening.sql`
- database indexes recommended by Phase 8A
- repository selectors/CRUD for future phases
- repository and migration tests

Not implemented in this phase:

- `/api/events/report`
- worker processes
- Discord integration
- Telegram integration
- Slack integration
- dashboard pages
- webhook delivery
- queue processing

## Schema Summary

### `webhook_config`

Purpose: one provider configuration per script.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `script_id uuid not null unique references scripts(id) on delete cascade`
- `creator_id uuid not null references auth.users(id) on delete cascade`
- `provider text not null check (provider in ('discord', 'telegram', 'slack'))`
- `config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object')`
- `enabled boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `event_logs`

Purpose: validated event storage and delivery audit state for future event delivery phases.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `script_id uuid not null references scripts(id) on delete cascade`
- `session_id uuid references delivery_sessions(id) on delete set null`
- `event_type text not null`
- `payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object')`
- `delivery_status text not null default 'pending'`
- `retry_count integer not null default 0 check (retry_count >= 0 and retry_count <= 5)`
- `timestamp timestamptz not null`
- `received_at timestamptz not null default now()`
- `nonce text not null`
- `last_retry_at timestamptz`
- `delivered_at timestamptz`
- `error_message text`
- `claimed_at timestamptz` (hardening lease column)
- `created_at timestamptz not null default now()`

Allowed `event_type` values:

- `execute`
- `purchase`
- `error`
- `ban`
- `key_redeem`
- `heartbeat`
- `license_activate`
- `license_revoke`

Allowed `delivery_status` values:

- `pending`
- `delivered`
- `dead_letter`

### `delivery_sessions` extension

Adds:

- `event_secret text`

Compatibility:

- nullable by default
- no new `NOT NULL` constraint
- existing session creation remains valid without an `event_secret`
- no delivery route response changes in this phase

## Migration Summary

`migrations/008_event_platform.sql`:

1. Creates `webhook_config` with one row per script and provider/config/enabled state.
2. Creates the three Phase 8A `webhook_config` indexes.
3. Enables RLS on `webhook_config`.
4. Creates owner-aware authenticated policies and service-role access policy.
5. Creates `event_logs` with event allowlist, JSON payload, delivery status, retry count, timestamps, nonce, and error state.
6. Creates the six Phase 8A `event_logs` indexes.
7. Enables RLS on `event_logs`.
8. Creates deny-all policies for `anon`/`authenticated` and service-role access policy.
9. Adds nullable `delivery_sessions.event_secret`.

`migrations/008_event_platform_rollback.sql`:

1. Drops `event_logs` policies and table.
2. Drops `webhook_config` policies and table.
3. Drops `delivery_sessions.event_secret`.

`migrations/009_event_platform_hardening.sql`:

1. Adds nullable `event_logs.claimed_at` for queue claim leases.
2. Adds `idx_event_logs_pending_claim` for pending queue lease recovery.

`migrations/009_event_platform_hardening_rollback.sql` removes the claim index and column.

## RLS Review

### `webhook_config`

RLS is enabled.

Authenticated owner policies exist for:

- select
- insert
- update
- delete

Each owner policy requires both:

- `webhook_config.creator_id = auth.uid()`
- parent `scripts.creator_id = auth.uid()` for the referenced `script_id`

This keeps the model owner-aware and prevents a creator from attaching a config to another creator's script by supplying mismatched IDs.

Service-role compatibility:

- `webhook_config_service_access` allows `service_role` full access with `USING (true)` and `WITH CHECK (true)`.
- Supabase service role still bypasses RLS; the explicit policy documents and preserves intended compatibility.

### `event_logs`

RLS is enabled.

Policies:

- `event_logs_deny_all` denies all `anon` and `authenticated` operations.
- `event_logs_service_access` allows service-role operations.

Browser/dashboard users do not access `event_logs` directly. Future APIs must use service-role repository functions and enforce ownership at the service/API boundary.

## Index Review

Only Phase 8A recommended indexes were added.

### `webhook_config`

- `idx_webhook_config_script_id` on `(script_id)`
  - Purpose: lookup config by script during future event validation/config resolution.
- `idx_webhook_config_creator_id` on `(creator_id)`
  - Purpose: creator-owned dashboard/API listing.
- `idx_webhook_config_enabled_provider` on `(enabled, provider) where enabled = true`
  - Purpose: future worker/provider scans over enabled configs.

### `event_logs`

- `idx_event_logs_pending_delivery` on `(received_at asc) where delivery_status = 'pending'`
  - Purpose: FIFO selection of pending events for future delivery processing.
- `idx_event_logs_session_nonce` on `(session_id, nonce)`
  - Purpose: nonce replay lookup scoped to a delivery session.
- `idx_event_logs_script_event_time` on `(script_id, event_type, received_at desc)`
  - Purpose: script event history filtered by event type.
- `idx_event_logs_dead_letter` on `(script_id, received_at desc) where delivery_status = 'dead_letter'`
  - Purpose: dead-letter review per script.
- `idx_event_logs_delivered_latency` on `(script_id, received_at) where delivery_status = 'delivered'`
  - Purpose: later delivery latency analytics.
- `idx_event_logs_delivered_created` on `(created_at) where delivery_status = 'delivered'`
  - Purpose: cleanup of old delivered events.
- `idx_event_logs_pending_claim` on `(claimed_at, received_at asc) where delivery_status = 'pending'`
  - Purpose: worker claim lease lookup and stale claim recovery.

No speculative indexes were added.

## Compatibility Review

Delivery/session compatibility after hardening:

- Existing session token validation and consume-once behavior remains unchanged.
- `createDeliverySession()` now generates a per-session `event_secret` and stores it with the session.
- `POST /api/delivery/session` and `POST /api/delivery/fetch` return `event_secret` to the runtime for HMAC signing.
- `session_token_hash` remains server-only and is never returned.
- Queue hardening adds `claimed_at` without changing the public event report schema.
