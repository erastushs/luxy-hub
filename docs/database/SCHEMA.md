# Database Schema

Status: Current schema documented through `migrations/013_license_schema_foundation.sql`.

Scope: This document covers operational tables required by secure delivery, event processing, license foundation, creator ownership, audit logging, and key validation. It does not introduce schema changes.

## Security Model

- Supabase service role is the only direct database actor for runtime delivery, event queue, alerting, analytics, cleanup, key validation, and operational records.
- Creator-facing access is enforced in application services using `getCurrentUser()`, `requireAuth()`, `assertScriptOwner()`, and owner-aware repository/service queries.
- RLS is enabled on application and operational tables. Most operational tables deny `anon` and `authenticated` entirely and rely on `service_role` access.
- Owner-scoped RLS exists for creator-managed tables where direct authenticated access is allowed by policy, including `scripts`, `script_versions`, `webhook_config`, `licenses`, and `license_assignments`.
- Raw secrets are not stored for delivery session tokens or license keys. Delivery sessions store SHA-256 token hashes; licenses store SHA-256 key hashes; license assignments store hashed customer identifiers.

## Core Script Tables

### `scripts`

Purpose: Canonical script metadata, ownership, publication visibility, execution counters, and access mode.

Key columns:

- `id`: primary key.
- `slug`: unique public identifier used by delivery/session APIs and dashboard routes.
- `name`, `description`: creator-facing metadata.
- `visibility`: `public`, `private`, or `unlisted`.
- `creator_id`: owner user id, references `auth.users(id)` via migration 004.
- `current_version_id`: current immutable version, references `script_versions(id)` with `ON DELETE SET NULL`.
- `execute_count`, `last_executed_at`: cached analytics maintained by `script_executions` trigger.
- `access_mode`: `public`, `key_required`, or `license_required` added by migration 013.
- `created_at`, `updated_at`: lifecycle timestamps.

Relationships:

- One script has many `script_versions`.
- One script has many `delivery_builds`, `delivery_sessions`, `event_logs`, `script_executions`, `licenses`, `audit_logs` references by resource metadata, and historical `script_downloads`.
- One script has zero or one current version through `current_version_id`.
- One script may have one `webhook_config` record.

Ownership:

- `creator_id` is the ownership boundary.
- Server-side mutations derive `creator_id` from session, not client input.
- License rows additionally enforce `(script_id, creator_id)` consistency with `licenses_creator_owns_script`.

Indexes:

- `idx_scripts_slug` for slug lookup.
- `idx_scripts_visibility` for public/unlisted filtering.
- `idx_scripts_creator_id` for dashboard owner queries.
- `idx_scripts_execute_count` and `idx_scripts_last_executed_at` for analytics sorting.
- `idx_scripts_access_mode` for access mode filtering.
- `idx_scripts_id_creator_id` unique composite index supporting license ownership FK.

Security boundaries:

- Initial RLS denies `anon` and `authenticated` all access.
- Owner policies allow authenticated creators to select, insert, update, and delete only rows with `creator_id = auth.uid()`.
- Delivery runtime only serves scripts whose visibility is `public` or `unlisted` and which have a ready build.

### `script_versions`

Purpose: Immutable source version history for scripts.

Key columns:

- `id`: primary key.
- `script_id`: parent script, `ON DELETE CASCADE`.
- `version`: version label unique per script.
- `content`: source content used by build generation.
- `changelog`: optional version note.
- `created_at`: version creation timestamp.

Relationships:

- Belongs to `scripts`.
- Referenced by `scripts.current_version_id`.
- Referenced by `delivery_builds.version_id`.
- Referenced by historical `script_downloads.version_id` with `ON DELETE SET NULL`.

Ownership:

- Ownership is inherited from the parent `scripts.creator_id`.

Indexes:

- `idx_script_versions_script_id` for version listing.
- `idx_script_versions_script_version` plus unique `(script_id, version)` for version lookup and uniqueness.

Security boundaries:

- Initial RLS denies all `anon` and `authenticated` access.
- Owner policies allow authenticated users to select and insert only versions attached to their own scripts.
- Source content remains server-side and is not returned by build dashboard summary queries.

## Secure Delivery Tables

### `delivery_builds`

Purpose: Pre-built encrypted runtime payload artifacts for script versions.

Key columns:

- `id`: primary key.
- `script_id`: parent script, `ON DELETE CASCADE`.
- `version_id`: source version, `ON DELETE CASCADE`.
- `build_status`: `pending`, `building`, `ready`, `failed`, or `invalidated`.
- `payload_storage_kind`: currently only `inline_encrypted`.
- `payload_ciphertext`: encrypted payload JSON when ready.
- `payload_content_type`: payload media type.
- `payload_byte_size`: ciphertext byte size.
- `source_sha256`: SHA-256 of normalized source.
- `payload_sha256`: SHA-256 of encrypted payload.
- `build_version`: current implementation version, `delivery-build-v1`.
- `payload_format_version`: current payload format, `inline-json-v1`.
- `encryption_scheme`: `aes-256-gcm:v1`.
- `encryption_key_id`: non-secret identifier for the effective payload key generation.
- `invalidated_reason`, `build_error_code`, `build_error_message`: operational state.
- `metadata`: sanitized build metadata.
- `built_at`, `invalidated_at`, `created_at`, `updated_at`: lifecycle timestamps.

Relationships:

- Belongs to `scripts` and `script_versions`.
- Referenced by `delivery_sessions.build_id`.

Ownership:

- Ownership is inherited through `script_id`.
- Dashboard operations verify script ownership before exposing build summaries or triggering rebuilds.

Indexes:

- `idx_delivery_builds_version_status` for ready build lookup by version.
- `idx_delivery_builds_script_status` for script build dashboards.
- `idx_delivery_builds_compatibility` for build/runtime compatibility filtering.
- `idx_delivery_builds_payload_sha256` for integrity lookup.
- `idx_delivery_builds_created_at` for operational sorting.

Security boundaries:

- RLS denies `anon` and `authenticated` all access.
- Runtime access uses service role only.
- Ready builds must satisfy `delivery_builds_ready_payload_required`: ready builds require ciphertext, payload hash, and `built_at`.
- Build dashboard select lists intentionally omit `payload_ciphertext`.

### `delivery_sessions`

Purpose: Short-lived one-time access sessions for secure payload fetches and event reporting.

Key columns:

- `id`: primary key.
- `script_id`: delivered script, `ON DELETE CASCADE`.
- `build_id`: delivered build, `ON DELETE CASCADE`.
- `session_token_hash`: SHA-256 hash of the raw session token, unique.
- `expires_at`: expiration timestamp, currently 60 seconds after creation.
- `consumed_at`: set when payload fetch succeeds.
- `event_secret`: HMAC secret returned to runtime for signed event reports.
- `created_at`: creation timestamp.

Relationships:

- Belongs to `scripts` and `delivery_builds`.
- Referenced by `event_logs.session_id` with `ON DELETE SET NULL`.
- Referenced by `script_executions.session_id` with `ON DELETE CASCADE` and unique constraint.

Ownership:

- Runtime session is tied to the delivered script and build.
- Creator access is indirect through script ownership and operational dashboards.

Indexes:

- `idx_delivery_sessions_token_hash` for session validation lookup.
- `idx_delivery_sessions_expires_at` for cleanup and expiration checks.
- `idx_delivery_sessions_build_id` for build/session correlation.

Security boundaries:

- RLS denies `anon` and `authenticated` all access.
- Raw session tokens are never stored.
- Payload fetch consumes the session exactly once by updating only rows with `consumed_at IS NULL` and `expires_at > now`.
- Event reporting may use the session token during TTL but does not consume payload access.

## Event Platform Tables

### `event_logs`

Purpose: Validated runtime event storage, queue state, delivery audit trail, and event analytics source.

Key columns:

- `id`: primary key.
- `script_id`: script that emitted the event, `ON DELETE CASCADE`.
- `session_id`: delivery session, nullable, `ON DELETE SET NULL`.
- `event_type`: allowlisted event name: `execute`, `purchase`, `error`, `ban`, `key_redeem`, `heartbeat`, `license_activate`, `license_revoke`.
- `payload`: JSON object, max accepted runtime payload is enforced in application code.
- `delivery_status`: `pending`, `delivered`, or `dead_letter`.
- `retry_count`: retry attempts, constrained between 0 and 5.
- `timestamp`: client event timestamp after skew validation.
- `received_at`: server receipt timestamp.
- `nonce`: per-session replay prevention value.
- `claimed_at`: queue worker lease marker.
- `last_retry_at`, `delivered_at`, `error_message`: delivery lifecycle state.
- `created_at`: row creation timestamp.

Relationships:

- Belongs to `scripts`.
- Optionally references `delivery_sessions`.
- Uses `webhook_config` at processing time to resolve provider delivery settings.

Ownership:

- Ownership is inherited through `script_id`.
- Creator dashboard/event operations must check script ownership before displaying per-script events.

Indexes:

- `idx_event_logs_pending_delivery` for FIFO pending queue polling.
- `idx_event_logs_pending_claim` for claim lease recovery.
- `idx_event_logs_session_nonce` for replay detection.
- `idx_event_logs_script_event_time` for per-script event analytics.
- `idx_event_logs_dead_letter` for dead-letter review.
- `idx_event_logs_delivered_latency` for delivery latency analytics.
- `idx_event_logs_delivered_created` for delivered event cleanup.

Security boundaries:

- RLS denies `anon` and `authenticated`; service role policy allows worker/API access.
- Event report API validates session token hash, event secret HMAC signature, nonce format, timestamp skew, event type, payload size, and rate limit before insert.
- Queue worker uses claim leases to avoid concurrent processing of the same event.

### `alert_events`

Purpose: Internal operational alert records for queue, webhook, and event security monitoring.

Key columns:

- `id`: primary key.
- `alert_type`: internal alert identifier.
- `severity`: `low`, `medium`, `high`, or `critical`.
- `status`: `active` or `resolved`.
- `current_value`, `threshold_value`: numeric threshold state at trigger time.
- `message`: human-readable alert summary.
- `metadata`: JSON object for additional operational context.
- `created_at`, `resolved_at`: lifecycle timestamps.

Relationships:

- No hard FK to event tables. Alert type and metadata correlate alert records with queue/security metrics.

Ownership:

- Internal operations only. No creator ownership boundary.

Indexes:

- `idx_alert_events_type_status` for active alert deduplication and resolution.
- `idx_alert_events_severity_status` for operations dashboard filtering.
- `idx_alert_events_created_at` for recent alert review.
- `idx_alert_events_resolved_at` for resolved alert history.

Security boundaries:

- RLS denies `anon` and `authenticated` all access.
- Alert creation/resolution uses service role in internal worker/check routes.
- High and critical alerts may notify `INTERNAL_ALERT_DISCORD_WEBHOOK` if configured.

### `webhook_config`

Purpose: Creator-managed provider configuration for event delivery.

Key columns:

- `id`: primary key.
- `script_id`: unique script association, `ON DELETE CASCADE`.
- `creator_id`: owner user id, `ON DELETE CASCADE`.
- `provider`: `discord`, `telegram`, or `slack` at schema level; current worker resolves Discord only.
- `config`: provider configuration JSON object, including server-side webhook URL when enabled.
- `enabled`: queue delivery switch.
- `created_at`, `updated_at`: lifecycle timestamps.

Relationships:

- Belongs to `scripts` and `auth.users`.
- Read by event queue worker when processing `event_logs`.

Ownership:

- `creator_id` and parent `scripts.creator_id` must both match `auth.uid()` under owner RLS policies.

Indexes:

- `idx_webhook_config_script_id` for event worker lookup.
- `idx_webhook_config_creator_id` for dashboard listing.
- `idx_webhook_config_enabled_provider` for enabled provider filtering.

Security boundaries:

- Owner-scoped RLS for authenticated creator CRUD.
- Service role policy for worker/runtime access.
- Provider URLs are stored server-side and are never shipped to runtime scripts.

## Execution Analytics

### `script_executions`

Purpose: Canonical execution event table used to maintain cached script execution metrics.

Key columns:

- `id`: primary key.
- `script_id`: executed script, `ON DELETE CASCADE`.
- `session_id`: unique delivery session, `ON DELETE CASCADE`.
- `created_at`: execution timestamp.

Relationships:

- Belongs to `scripts`.
- One-to-one with `delivery_sessions` through unique `session_id`.
- Insert trigger `trg_increment_script_execution_cache` calls `increment_script_execution_cache()` to increment `scripts.execute_count` and update `scripts.last_executed_at`.

Ownership:

- Ownership is inherited through `script_id`.
- Insert happens during successful session creation, not from client input.

Indexes:

- `idx_script_executions_script_id` for per-script lookups.
- `idx_script_executions_created_at` for time-range analytics.
- `idx_script_executions_script_time` for per-script recent execution history.

Security boundaries:

- RLS denies `anon` and `authenticated` all access.
- Service role policy permits runtime insert and analytics queries.

## License Foundation Tables

### `licenses`

Purpose: License key records for future `license_required` access mode and current dashboard/license APIs.

Key columns:

- `id`: primary key.
- `script_id`: licensed script, `ON DELETE CASCADE`.
- `creator_id`: owner, `ON DELETE CASCADE`.
- `key_hash`: SHA-256 hash of raw license key.
- `max_assignments`: assignment capacity.
- `status`: `active`, `disabled`, or `revoked`.
- `activation_count`, `delivery_count`: counters reserved for license activity metrics.
- `last_activation_at`, `last_delivery_at`: activity timestamps.
- `expires_at`: optional expiration.
- `created_at`, `updated_at`: lifecycle timestamps.

Relationships:

- Belongs to `scripts` and `auth.users`.
- Has many `license_assignments`.
- Composite FK `(script_id, creator_id)` references `scripts(id, creator_id)` to enforce owner/script consistency.

Ownership:

- `creator_id` is the direct ownership boundary.
- The composite FK prevents a creator from creating a license for a script owned by another creator.

Indexes:

- `idx_licenses_script_id` for script license listing.
- `idx_licenses_creator_id` for owner queries.
- `idx_licenses_script_key_hash` unique for license validation by script and key hash.
- `idx_licenses_status` for lifecycle filtering.
- `idx_licenses_expires_at` partial index for expiring licenses.

Security boundaries:

- `anon` denied.
- `service_role` has full access.
- Authenticated creators can select, insert, update, and delete only rows where `creator_id = auth.uid()`.
- Raw license keys are returned only at creation time by application service and are not persisted.

### `license_assignments`

Purpose: Hashed customer identifier assignments for individual licenses.

Key columns:

- `id`: primary key.
- `license_id`: parent license, `ON DELETE CASCADE`.
- `customer_identifier_hash`: SHA-256 hash of customer identifier.
- `display_name`: optional dashboard label.
- `status`: `active`, `disabled`, or `revoked`.
- `created_at`, `updated_at`: lifecycle timestamps.

Relationships:

- Belongs to `licenses`.

Ownership:

- Ownership is inherited through parent `licenses.creator_id`.

Indexes:

- `idx_license_assignments_license_id` for license detail lookup.
- `idx_license_assignments_license_customer` unique for duplicate prevention per license.
- `idx_license_assignments_customer_hash` for customer hash lookup.
- `idx_license_assignments_status` for lifecycle filtering.

Security boundaries:

- `anon` denied.
- `service_role` has full access.
- Authenticated creator policies use an `EXISTS` lookup against `licenses` to require parent ownership for select, insert, update, and delete.

## Creator Identity and Audit Tables

### `profiles`

Purpose: Creator profile record linked one-to-one with Supabase Auth users.

Key columns:

- `id`: primary key and FK to `auth.users(id)` with `ON DELETE CASCADE`.
- `username`: optional unique handle.
- `display_name`: required display name.
- `avatar_url`: optional avatar.
- `role`: `creator` or `admin`.
- `created_at`, `updated_at`: lifecycle timestamps.

Relationships:

- One-to-one with `auth.users`.
- Used by session auth to derive authenticated dashboard user profile.

Ownership:

- Profile identity is the same as `auth.users.id`.

Indexes:

- `idx_profiles_role` for role/admin queries.

Security boundaries:

- RLS denies `anon` and `authenticated` all access.
- Profile auto-provisioning and reads use service-side session auth helpers.

### `audit_logs`

Purpose: Immutable-style audit trail for creator and admin actions.

Key columns:

- `id`: primary key.
- `actor_id`: user performing the action.
- `actor_role`: `creator` or `admin`.
- `action`: event/action name.
- `resource_type`: affected resource category.
- `resource_id`: optional resource UUID.
- `resource_slug`: optional resource slug.
- `metadata`: JSON object.
- `created_at`: event timestamp.

Relationships:

- Logical relationship to users and resources; no hard FK is defined for `actor_id` or `resource_id`.

Ownership:

- Internal compliance/operations table, not directly creator-owned.

Indexes:

- `idx_audit_logs_actor_id` for actor history.
- `idx_audit_logs_created_at` for recent audit review.
- `idx_audit_logs_resource` for resource timeline queries.

Security boundaries:

- RLS denies `anon` and `authenticated` all access.
- Service-side actions write audit entries.

## Key System Tables

### `keys`

Purpose: Legacy/current key validation records for key-based access.

Key columns:

- `id`: primary key.
- `key`: unique generated key.
- `created_at`: creation timestamp.
- `expires_at`: required expiration timestamp.
- `is_active`: active flag.

Relationships:

- Used by key validation and generation flows.
- Not linked to `licenses`; license foundation is separate.

Ownership:

- Operational key pool, not creator-owned.

Indexes:

- Unique constraint on `key` supports validation lookup.

Security boundaries:

- RLS denies `anon` and `authenticated` all access.
- Validation/generation APIs use service role and rate limiting.

### `key_usage`

Purpose: Historical analytics placeholder for key usage.

Key columns:

- `id`: primary key.
- `key`: key string associated with usage.
- `used_at`: usage timestamp.

Relationships:

- Logical relationship to `keys.key`; no FK is defined.

Ownership:

- Internal analytics table, not creator-owned.

Indexes:

- No explicit index in the base schema beyond primary key.

Security boundaries:

- RLS denies `anon` and `authenticated` all access.
- Marked as future analytics in migration 001.

## Supporting Operational Tables

### `verification_logs`

Purpose: Operational counters and key/event/security logging.

Security boundary: RLS denies non-service access. Internal monitoring uses these rows for event security and webhook counters.

### `rate_limits`

Purpose: Database-backed rate limiting for serverless functions.

Security boundary: RLS denies non-service access. Cleanup removes stale rows.

### `used_workink_tokens`

Purpose: Work.ink token replay protection.

Security boundary: RLS denies non-service access.

### `script_downloads`

Purpose: Historical CDN/download analytics with hashed IP and user-agent identifiers.

Security boundary: RLS denies non-service access. Ownership is inherited through `script_id` for any service-level dashboard query.
