# Phase 7D — Valkey Integration Architecture RFC

Status: Planned / Not Implemented
Date: 2026-06-20
Scope: Documentation and architecture planning only

This Architecture RFC defines the planned Phase 7D migration from PostgreSQL-backed temporary data to Valkey-backed temporary data. It is intentionally implementation-ready but does not authorize or perform implementation, migrations, package installation, production changes, schema changes, or roadmap changes outside Phase 7D.

## 1. Objective

Phase 7D introduces Valkey as LuxyHub's temporary data platform while preserving Supabase PostgreSQL as the source of truth for permanent application data.

The primary goal is to reduce PostgreSQL storage growth, write amplification, cleanup workload, and database egress caused by short-lived runtime state.

Target outcomes:

- Move `rate_limits` out of PostgreSQL.
- Move `delivery_sessions` out of PostgreSQL after analytics and event dependencies are decoupled.
- Use Valkey for short-lived locks, caches, nonces, runtime counters, and other disposable data.
- Keep users, scripts, builds, keys, licenses, analytics records, purchases, audit records, and durable operational history in PostgreSQL.
- Preserve Supabase Auth and current ownership/session boundaries.

Non-goals:

- No production changes in this planning phase.
- No code changes in this planning phase.
- No PostgreSQL migrations in this planning phase.
- No package installation in this planning phase.
- No replacement of Supabase Auth.
- No replacement of PostgreSQL for permanent data.
- No marketplace, paid script, or creator economy expansion.

## 2. Design Principles

Phase 7D implementation must follow these principles:

| Principle | Meaning |
|---|---|
| PostgreSQL stores permanent business data. | Users, ownership, scripts, versions, builds, keys, licenses, purchases, audit records, durable analytics, and durable event history remain in PostgreSQL. |
| Valkey stores temporary operational state. | Rate limits, delivery sessions, nonces, worker locks, cache entries, and temporary counters belong in Valkey when their loss or expiry is acceptable by design. |
| Temporary data should expire naturally through TTL whenever possible. | Expiration should be a property of the data model rather than a cleanup job that deletes old PostgreSQL rows. |
| Permanent data must never depend solely on Valkey. | Valkey loss, restart, eviction, or failover must not destroy authoritative product, ownership, financial, audit, or license state. |
| Valkey is an optimization layer, not a source of truth. | Valkey may speed up validation, coordination, caching, and aggregation, but PostgreSQL and Supabase Auth remain authoritative for durable state and identity. |
| Every migration phase must support rollback without downtime. | Legacy PostgreSQL paths, feature flags, dual-write, shadow mode, or documented fallback must remain available until each phase has passed validation. |
| Security-sensitive workloads must define explicit failure behavior. | Each protected workload must state whether Valkey failure means fail closed, PostgreSQL fallback, or another explicitly approved degraded behavior. |
| Runtime and dashboard contracts must remain stable. | Moving temporary state must not break existing clients, dashboard flows, runtime response contracts, or ownership checks. |
| Operational visibility is required before authority changes. | Baseline metrics, parity checks, Valkey health metrics, and rollback validation must exist before Valkey becomes authoritative for a workload. |

## 3. Architecture Overview

### 3.1 Future System Boundary

Valkey becomes the disposable runtime state layer between the Next.js application and PostgreSQL. PostgreSQL remains authoritative for permanent state.

```text
Client
  ↓
Next.js API
  ↓
Supabase Auth
  ↓
Valkey
  ↓
PostgreSQL
```

This vertical view is a responsibility chain, not a requirement that every request touches every layer. Authenticated dashboard requests must validate identity through Supabase Auth. Runtime delivery and event requests may not have a Supabase user session, but still enter through Next.js API routes and use server-side authorization, rate limits, session validation, and ownership-derived permanent records.

### 3.2 Request Flow With Responsibilities

```text
┌────────────────────────────────────────────────────────────┐
│ Client                                                     │
│ - Browser dashboard                                       │
│ - Runtime loader                                          │
│ - Internal scheduler / worker calls                       │
└──────────────────────────────┬─────────────────────────────┘
                               │ HTTPS through Cloudflare
                               v
┌────────────────────────────────────────────────────────────┐
│ Next.js API                                                 │
│ - Request validation                                       │
│ - Server Actions for dashboard mutations                   │
│ - Runtime delivery/session/event endpoints                 │
│ - Service-role database access                             │
│ - Valkey client boundary                                   │
│ - Feature flags and fallback behavior                      │
└───────────────┬──────────────────────────────┬─────────────┘
                │                              │
                v                              v
┌──────────────────────────────┐   ┌─────────────────────────┐
│ Supabase Auth                 │   │ Valkey                  │
│ - User identity               │   │ - Rate limits           │
│ - Session validation          │   │ - Delivery sessions     │
│ - Authenticated user context  │   │ - Nonces                │
│ - Profile provisioning input  │   │ - Worker locks          │
└──────────────────────────────┘   │ - Short-lived tokens     │
                                   │ - Cache entries          │
                                   │ - Temporary counters     │
                                   └────────────┬────────────┘
                                                │ durable reads/writes only
                                                v
                                   ┌─────────────────────────┐
                                   │ PostgreSQL              │
                                   │ - Permanent data         │
                                   │ - Analytics history      │
                                   │ - Audit history          │
                                   │ - Ownership records      │
                                   │ - Durable queue history  │
                                   └─────────────────────────┘
```

### 3.3 Component Responsibilities

| Component | Responsibility | Not Responsible For |
|---|---|---|
| Client | Send dashboard, runtime, and worker requests over HTTPS. Hold only tokens or runtime material already allowed by existing contracts. | Direct database access, direct Valkey access, service-role credentials, provider credentials. |
| Cloudflare | Edge TLS, DNS, basic request protection, caching where already appropriate. | Application-level authorization, delivery-session validation, permanent data storage. |
| Next.js API | Own all application logic, validation, authorization, rate-limit checks, Valkey access, PostgreSQL access, and response contracts. | Trusting client-provided ownership fields, exposing Valkey directly, bypassing Supabase Auth for dashboard users. |
| Supabase Auth | Authenticate dashboard users and provide canonical user identity through existing session mechanisms. | Temporary runtime state, delivery-session storage, rate-limit counters. |
| Valkey | Store short-lived and disposable data with TTLs, atomic counters, lock primitives, caches, nonces, and temporary aggregation buffers. | Permanent records, authoritative ownership, billing/purchases, long-term analytics history, durable audit logs. |
| PostgreSQL | Store permanent application data, durable analytics, audit history, scripts, versions, builds, keys, licenses, purchases, profiles, and ownership relations. | High-churn temporary counters, per-request rate-limit rows, expired delivery sessions after Phase 7D migration. |
| PM2 / VPS | Run application and worker processes according to the existing deployment model. | Database semantics, Valkey data classification, auth decisions. |
| systemd timers | Invoke scheduled cleanup and worker tasks where still needed. | High-frequency temporary-state cleanup after Valkey TTLs replace PostgreSQL cleanup. |

### 3.4 Data Flow Patterns

Permanent-write flow:

```text
Client
  ↓
Next.js API validates request and auth
  ↓
Valkey optional rate limit / cache / lock check
  ↓
PostgreSQL durable write
  ↓
Valkey optional cache invalidation
  ↓
Client response
```

Temporary-runtime flow:

```text
Runtime Client
  ↓
Next.js API validates request
  ↓
Valkey rate-limit/session/nonce checks with TTL
  ↓
PostgreSQL metadata lookup only when permanent state is required
  ↓
Client response
```

Analytics-counter flow:

```text
Runtime / API Event
  ↓
Next.js API validates request
  ↓
Valkey increments short-lived counters
  ↓
Scheduled flush aggregates counters into PostgreSQL
  ↓
Counters expire or are checkpointed
```

## 4. Why Valkey

Valkey is a better fit than PostgreSQL for short-lived, high-churn operational data because it provides in-memory primitives with native TTLs and atomic operations.

### 4.1 Reasons for Redis-Compatible Valkey

Valkey was selected for the temporary data layer because:

- It is Redis-compatible, which gives access to a mature command model and ecosystem without choosing Redis licensing constraints.
- It supports native key expiry, which matches short-lived runtime data such as delivery sessions, rate limits, nonces, locks, and temporary counters.
- It supports atomic increments and conditional writes, which are a natural fit for rate limiting and lock acquisition.
- It avoids creating one PostgreSQL row per request for high-frequency counters.
- It reduces the need for cleanup jobs because keys expire automatically.
- It can run on the existing VPS deployment model before any future managed-cache decision is required.
- It can be introduced behind a narrow application connection layer and migrated phase by phase.

### 4.2 Benefits Over PostgreSQL For Temporary Data

| Temporary workload | PostgreSQL cost today | Valkey fit |
|---|---|---|
| Rate limits | Inserts rows for requests, then counts rows by endpoint/window and later deletes expired rows. | Atomic counters or sorted windows with expiry. No durable row growth required. |
| Delivery sessions | Inserts short-lived token-hash records with expiry and indexes, then depends on cleanup and FK constraints. | Token-hash keyed records with natural TTL. Expired sessions disappear automatically. |
| Event nonces | Durable replay-tracking lookups can add pressure if moved into PostgreSQL at high volume. | `SET NX`-style replay keys with expiry. |
| Worker locks | Database lease rows or update races add write pressure and contention. | Atomic lock keys with short TTL and owner tokens. |
| Caches | PostgreSQL repeats metadata reads for dashboard/runtime data. | Short TTL cache entries reduce read traffic and response latency. |
| Temporary counters | Durable writes per event grow tables quickly. | Increment in memory, flush aggregated summaries periodically. |

### 4.3 Why Supabase Remains

Supabase remains in the architecture because it provides:

- Supabase Auth for dashboard identity and session validation.
- PostgreSQL as the authoritative permanent application database.
- Existing RLS posture and service-role controlled server access.
- Durable relations for users, profiles, scripts, versions, builds, keys, licenses, analytics history, purchases, audit logs, and operational records.
- Existing production maturity and backup/recovery workflows for permanent data.

Valkey must not become a source of truth for permanent product state. Loss of Valkey data should at worst reset temporary windows, expire sessions, drop caches, release locks, or require counter reconciliation according to documented phase behavior.

### 4.4 Expected Resource Reductions

Expected storage reduction:

- `delivery_sessions` should stop growing after delivery sessions are migrated and the PostgreSQL table is drained/removed in a later implementation phase.
- `rate_limits` should stop growing after rate limiting is migrated and the PostgreSQL table is drained/removed in a later implementation phase.
- Index storage tied to those high-churn tables should disappear after table removal.
- Cleanup history and dead temporary rows should no longer accumulate between cleanup runs.

Expected write reduction:

- Rate-limit checks should no longer insert one PostgreSQL row per checked request.
- Delivery-session creation/fetch should no longer require PostgreSQL insert/update for transient runtime state after decoupling.
- Worker locks should avoid database lock/lease writes.
- Analytics counters can be aggregated before durable writes instead of writing every temporary counter update.

Expected database egress reduction:

- PostgreSQL responses for rate-limit counts and session lookups should be replaced by Valkey operations.
- Dashboard and runtime metadata caches should reduce repeated PostgreSQL reads.
- Cleanup queries returning counts, scanned candidates, or deleted row metadata should be reduced as TTLs replace cleanup work.
- Aggregated analytics flushes should transfer less data than per-event counter writes.

## 5. Current Problems

Phase 7C reduced PostgreSQL payload size and cleanup pressure, but temporary data remains a major source of database growth and write traffic.

### 5.1 `delivery_sessions` Growth

Current behavior:

- Each secure runtime payload delivery creates a `delivery_sessions` row.
- Rows include `session_token_hash`, `script_id`, `build_id`, `expires_at`, `consumed_at`, `event_secret`, and timestamps.
- Sessions are intentionally short-lived, currently around the runtime delivery window.
- `script_executions.session_id` has a unique FK dependency on `delivery_sessions`.
- `event_logs.session_id` may reference `delivery_sessions` with `ON DELETE SET NULL`.
- Safe cleanup currently preserves sessions that remain referenced by execution analytics.

Technical debt:

- Temporary sessions are stored in the permanent database.
- Delivery session cleanup is constrained by analytics/event references.
- Session rows can outlive their runtime usefulness because permanent analytics depend on them.
- Token-hash lookup and expiry indexes consume storage for disposable data.
- High runtime traffic creates high write amplification in PostgreSQL.

### 5.2 `rate_limits` Growth

Current behavior:

- General API rate limits insert a `rate_limits` row, then count matching rows in the active time window.
- Login failure checks use the same table pattern for IP and hashed email buckets.
- Event reporting rate limits use the same table with session-derived endpoint keys.
- Cleanup later deletes stale rows.

Technical debt:

- Every rate-limited request can generate a PostgreSQL write.
- Count queries increase read load and egress.
- Cleanup is required to prevent table growth.
- `idx_rate_limits_ip_endpoint_created_at` exists only to support temporary-window lookups.
- The table stores request-window state that does not need durable retention.

### 5.3 Cleanup Dependency

Current cleanup work exists because temporary state is stored durably.

Problems:

- Cleanup must scan and delete rows that should have expired naturally.
- Cleanup jobs compete with application traffic for database resources.
- Cleanup failure or delay directly increases storage pressure.
- Delivery session cleanup is more complex because of permanent FK dependencies.
- Operational confidence depends on timers and batch limits rather than native TTL semantics.

### 5.4 Storage Pressure

Temporary tables increase Supabase database size through:

- Active rows.
- Expired rows awaiting cleanup.
- Indexes on token hashes, expiry timestamps, build IDs, endpoint buckets, and creation timestamps.
- Vacuum and table bloat effects after frequent inserts/deletes.
- Retained delivery sessions that cannot be deleted while analytics still reference them.

### 5.5 Unnecessary Writes And Indexes

The following write/index patterns are unnecessary for disposable state in the target architecture:

- Rate-limit row insert per request.
- Rate-limit count query per request.
- Rate-limit cleanup deletes.
- Delivery-session row insert per runtime session.
- Delivery-session consume update per successful payload fetch.
- Delivery-session cleanup deletes.
- Indexes whose only purpose is temporary lookup or cleanup.

These should be replaced with Valkey TTL, counter, and atomic-key operations in future implementation phases.

## 6. Migration Strategy

Phase 7D must be implemented incrementally. Each phase should be independently deployable, observable, and reversible.

Global migration principles:

- PostgreSQL remains authoritative until a specific temporary workload has been migrated, validated, and cleanup/removal is explicitly approved.
- Each phase should be feature-flagged or otherwise switchable without deployment rollback.
- Initial rollout should support shadow reads/writes or comparison metrics where practical.
- Rollback must preserve current behavior and avoid downtime.
- Removal of PostgreSQL tables must be the last step, after a stable observation period and explicit migration approval.
- All Valkey keys must have explicit TTLs unless they represent intentionally persistent cache metadata with documented invalidation.
- No permanent data may depend solely on Valkey.

### 6.1 Phase 7D.0 — Production Baseline

Goal: Capture production metrics before any Valkey implementation begins so every later migration phase can be measured against a known baseline.

This phase is measurement and documentation only. It does not deploy Valkey, alter code, install packages, modify infrastructure, or change production behavior.

Required database metrics:

| Metric | Purpose |
|---|---|
| Database size | Establish total Supabase PostgreSQL storage baseline. |
| Table sizes | Identify current storage concentration, especially `delivery_sessions`, `rate_limits`, `event_logs`, analytics tables, and script/build tables. |
| Index sizes | Quantify storage consumed by temporary-data indexes such as rate-limit and delivery-session indexes. |
| Daily database growth | Measure how quickly storage increases under current production traffic. |
| Database egress | Establish read/response volume before Valkey offload. |
| Database writes | Quantify write load from rate limits, delivery sessions, events, analytics, and cleanup side effects. |
| Database reads | Quantify repeated reads from session lookup, rate-limit counts, dashboard metadata, and runtime metadata. |
| High-churn table row counts | Track `delivery_sessions` and `rate_limits` growth before migration. |
| Query latency for temporary-data paths | Measure current PostgreSQL cost of session lookup, rate-limit checks, cleanup, and metadata reads. |

Required application metrics:

| Metric | Purpose |
|---|---|
| API latency average | Baseline general user-perceived application latency. |
| API latency P95 | Baseline tail latency for normal operational monitoring. |
| API latency P99 | Baseline worst-case behavior for high-volume and runtime paths. |
| Runtime delivery latency average | Baseline delivery-session creation and fetch performance. |
| Runtime delivery latency P95 | Detect whether Valkey improves high-percentile runtime delivery. |
| Runtime delivery latency P99 | Detect tail improvements or regressions after migration. |
| Requests per minute | Normalize database and Valkey load against traffic volume. |
| Error rate by endpoint | Confirm migrations do not hide reliability regressions behind aggregate latency improvements. |
| Rate-limit allow/deny counts | Compare PostgreSQL and future Valkey decisions. |

Required cleanup metrics:

| Metric | Purpose |
|---|---|
| Cleanup duration | Measure current operational cost of deleting expired temporary rows. |
| Rows deleted per cleanup run | Estimate temporary-data churn and backlog. |
| Cleanup frequency | Establish how often cleanup must run to control storage. |
| Remaining cleanup candidates | Identify whether cleanup keeps pace with traffic. |
| Cleanup errors | Identify operational fragility before changing data ownership. |
| Cleanup database egress | Quantify overhead from cleanup query responses and logs. |

Required infrastructure metrics:

| Metric | Purpose |
|---|---|
| VPS CPU | Baseline application and worker compute usage before adding Valkey client activity. |
| VPS RAM | Baseline memory pressure before introducing a memory-backed service or client buffers. |
| VPS disk usage | Baseline disk headroom for logs, process data, and optional Valkey persistence if selected later. |
| Network throughput | Baseline traffic between application, Supabase, users, and future Valkey placement. |
| PM2 process restarts | Detect whether stability changes after adding Valkey. |
| systemd timer success/failure | Baseline scheduled task reliability. |

Baseline output requirements:

- Store a dated Phase 7D baseline report before Phase 7D.1 begins.
- Record the measurement window, traffic assumptions, and known anomalies.
- Preserve baseline values for comparison after every migration phase.
- Avoid claiming success for any migration without comparing against this baseline.

### 6.2 Phase 7D.1 — Infrastructure

Goal: Introduce Valkey as an operational dependency without moving production workloads yet.

Planned scope:

- Deploy Valkey in the target VPS environment or selected managed environment.
- Define network binding, firewall rules, authentication, and TLS or private-network access expectations.
- Add an application connection layer that centralizes client creation, command timeouts, error handling, metrics, and shutdown behavior.
- Add health checks for connectivity, latency, memory, command failures, and TTL behavior.
- Add operational dashboards or logs for Valkey availability and memory usage.
- Define environment variable names, secret handling, and rotation expectations.
- Define backup/persistence policy appropriate for temporary data.

Readiness criteria:

- Valkey can be reached only by intended application/worker processes.
- Health checks can identify unavailable, slow, or memory-constrained Valkey.
- Application can start and operate with current PostgreSQL behavior while Valkey integration is disabled.
- Failure behavior is documented per future workload.

Not included:

- Migrating rate limits.
- Migrating delivery sessions.
- Removing PostgreSQL tables.
- Changing runtime API contracts.

### 6.3 Phase 7D.2 — Rate Limit Migration

Goal: Move rate limiting from PostgreSQL `rate_limits` rows to Valkey counters/windows.

Planned scope:

- Replace per-request PostgreSQL inserts/counts with Valkey-backed rate-limit windows.
- Preserve endpoint-specific limits and retry-after behavior.
- Preserve login failure rate-limit behavior using hashed email identifiers, never raw email addresses.
- Preserve fail-closed behavior where required for abuse-sensitive endpoints.
- Define separate behavior for dashboard, runtime delivery, event reporting, and login failure buckets.
- Add metrics comparing allowed/denied rates before and after migration.
- Keep PostgreSQL `rate_limits` table available during rollout.

Recommended rollout:

- Add Valkey rate-limit checks in shadow mode while PostgreSQL remains authoritative.
- Compare PostgreSQL decisions to Valkey decisions for representative traffic.
- Switch selected low-risk endpoints to Valkey authoritative mode.
- Expand to runtime and auth-sensitive endpoints after observation.
- Stop writing new PostgreSQL `rate_limits` rows only after decision parity is acceptable.
- Drain old rows through existing cleanup before any later table removal decision.

Post-migration target:

- `rate_limits` no longer receives new rows.
- Rate-limit cleanup workload is reduced or eliminated.
- `rate_limits` table removal is deferred to a separate approved migration after production validation.

### 6.4 Phase 7D.3 — Delivery Session Migration

Goal: Move short-lived delivery session state from PostgreSQL `delivery_sessions` to Valkey.

Prerequisite: Decouple permanent analytics from `delivery_sessions`.

Required design decisions before implementation:

- `script_executions` must stop requiring a FK to `delivery_sessions` for permanent analytics.
- Permanent execution analytics must store durable identifiers directly, such as `script_id`, `build_id`, timestamps, status, and any non-sensitive correlation IDs needed for reporting.
- `event_logs.session_id` dependency must be replaced or made compatible with session expiry without retaining temporary session rows.
- Runtime event HMAC validation must retrieve event secret material from Valkey during the session TTL window.
- Replay prevention must be independent of durable `delivery_sessions` rows.

Planned scope:

- Store delivery session token hashes in Valkey with explicit TTL.
- Store session metadata required for fetch validation, such as script ID, build ID, expiration, consumed state, and event secret.
- Use atomic consume semantics so payload fetch remains one-time.
- Preserve current runtime delivery response contracts.
- Preserve event reporting behavior during the session TTL window.
- Ensure expired sessions disappear without PostgreSQL cleanup.
- Keep PostgreSQL fallback during initial rollout.

Recommended rollout:

- Add dual-write mode: create delivery sessions in both PostgreSQL and Valkey while PostgreSQL remains authoritative.
- Add shadow-read checks: confirm Valkey session data matches PostgreSQL session data for active sessions.
- Switch fetch validation to Valkey authoritative mode for a small traffic slice.
- Keep PostgreSQL session creation as fallback until production stability is proven.
- Stop creating PostgreSQL delivery sessions after no-downtime rollback is validated.
- Drain expired and unreferenced PostgreSQL sessions.
- Remove or archive `delivery_sessions` only after a separate approved schema migration.

Post-migration target:

- Runtime session lookup and consumption use Valkey.
- PostgreSQL stores only permanent delivery/execution/analytics facts.
- No permanent table requires `delivery_sessions` rows to preserve analytics.
- Delivery session cleanup workload is eliminated or reduced to legacy draining only.

### 6.5 Phase 7D.4 — Worker Locks

Goal: Use Valkey for distributed locks around workers and scheduled operations.

Planned scope:

- Define lock keys for cleanup, event workers, analytics flushers, cache refreshers, and other scheduled tasks.
- Use owner tokens and TTLs so locks self-release if a process exits.
- Ensure unlock operations only release locks owned by the releasing process.
- Add metrics for lock acquisition, contention, expiration, and worker skip events.
- Preserve existing idempotency in workers; locks must reduce contention but not be the only correctness guarantee.

Target behavior:

- Multiple PM2 or scheduled invocations should not concurrently process the same singleton workload.
- Worker restarts should not leave permanent stuck locks.
- If Valkey is unavailable, each worker must follow its documented fail mode.

### 6.6 Phase 7D.5 — Cache Layer

Goal: Use Valkey as a short-lived cache for read-heavy server-side data.

Candidate caches:

- Dashboard summary cache.
- Script metadata cache.
- Ready build metadata cache.
- Configuration cache.
- Feature flag/config snapshot cache.
- Rate-limit configuration cache if limits become dynamic.

Cache rules:

- Cache entries must be derivable from PostgreSQL or configuration.
- Cache misses must fall back to authoritative data.
- Cache invalidation must be tied to Server Actions, mutations, rebuilds, and relevant admin operations.
- Sensitive data must not be cached unless encrypted or explicitly approved for server-side temporary storage.
- Runtime payload ciphertext should not be cached unless a separate secure-delivery design approves it.

Target behavior:

- Reduce repeated PostgreSQL reads for high-traffic metadata.
- Preserve correctness by invalidating or expiring cache entries quickly.
- Avoid exposing user-specific or creator-owned data across accounts.

### 6.7 Phase 7D.6 — Analytics Counters

Goal: Buffer temporary counters in Valkey and periodically flush aggregated values into PostgreSQL.

Planned scope:

- Identify counters safe to aggregate, such as executions, validation attempts, delivery attempts, rate-limit denies, cache hits/misses, and provider delivery metrics.
- Define aggregation dimensions, such as script ID, creator ID, event type, endpoint, provider, day, and hour.
- Define flush interval and idempotency strategy.
- Store durable aggregate rows in PostgreSQL.
- Preserve raw audit/event records where required for security, troubleshooting, or product reporting.

Constraints:

- Do not move permanent audit logs exclusively to Valkey.
- Do not rely on Valkey-only counters for billing, purchases, licenses, enforcement history, or user-visible financial records.
- Counter loss during a Valkey outage must be acceptable for the specific metric or mitigated through durable write-ahead records.

Target behavior:

- Reduce per-event PostgreSQL writes.
- Keep dashboard analytics responsive.
- Preserve durable reporting by flushing aggregates into PostgreSQL.

## 7. Data Classification

### 7.1 Storage Classes

| Storage class | Definition | Storage target |
|---|---|---|
| Permanent data | Authoritative product, ownership, audit, financial, license, and reporting data that must survive process restarts, cache loss, and Valkey eviction. | PostgreSQL |
| Temporary data | Operational data that is short-lived, reconstructable, naturally expiring, or safe to lose/reset within documented behavior. | Valkey |
| Derived cache data | Data copied from PostgreSQL or configuration to reduce reads, always reconstructable from the source of truth. | Valkey |
| Aggregation buffer | Temporary counters or buckets awaiting periodic durable flush. Loss tolerance must be documented per counter. | Valkey, then PostgreSQL aggregate rows |

### 7.2 Permanent Data

| Data | Examples | Primary store | Notes |
|---|---|---|---|
| Users and profiles | Supabase auth users, profiles, creator records | Supabase Auth / PostgreSQL | Supabase Auth remains canonical for identity. |
| Scripts | Script metadata, ownership, visibility, access mode | PostgreSQL | Creator ownership must remain durable. |
| Script versions | Source/version history, build lineage | PostgreSQL | Version history is permanent product data. |
| Delivery builds | Ready build metadata, build status, encrypted payload metadata | PostgreSQL | Runtime payload storage rules remain unchanged by this document. |
| Keys | Free keys, premium keys, provider data, expiration | PostgreSQL | Enforcement can use cache, but keys remain durable. |
| Licenses | License keys, states, assignments, future entitlements | PostgreSQL | Valkey may cache validation results later, not own license state. |
| Analytics | Durable daily/weekly/monthly aggregates, required execution history | PostgreSQL | Temporary counters may flush into these records. |
| Purchases | Payment/provider records, purchase history | PostgreSQL | Financial state must never be Valkey-only. |
| Audit logs | Security/admin/audit history | PostgreSQL | Must survive Valkey loss. |
| Webhook/event history | Durable event logs, delivery status, dead-letter records | PostgreSQL | Queue acceleration may use locks/caches, but history stays durable. |

### 7.3 Temporary Data

| Data | Examples | Target store | TTL / lifecycle expectation |
|---|---|---|---|
| Rate limits | Endpoint request buckets, login failure buckets, event rate buckets | Valkey | TTL equals rate-limit window plus small buffer. |
| Delivery sessions | Session token hash, script/build metadata, consumed flag, event secret | Valkey | TTL equals runtime session validity plus small buffer. |
| Cache | Dashboard summaries, script metadata, configuration snapshots | Valkey | Short TTL and mutation-driven invalidation. |
| Worker locks | Event worker lock, cleanup lock, analytics flush lock | Valkey | Short TTL renewed or reacquired per worker run. |
| Temporary counters | Runtime execution counters, validation attempts, cache hits/misses | Valkey | Flushed periodically, then expired. |
| Nonce / replay keys | Event signature nonce keys, one-time operation guards | Valkey | TTL equals replay window plus clock-skew allowance. |
| Short-lived tokens | Passwordless flow helpers only if approved, runtime temporary tokens | Valkey | Minimal TTL; never stores raw long-lived secrets. |

### 7.4 Do Not Store In Valkey As Authoritative Data

The following must not be Valkey-only:

- User identity.
- Script ownership.
- Script source/version history.
- Build state required for delivery correctness.
- License and key records.
- Purchases or financial records.
- Durable analytics history.
- Audit logs.
- Security incident history.
- Provider credentials.
- Raw passwords, raw license keys after creation, service-role keys, or Supabase secrets.

## 8. Key Design Guidelines

This section is planning guidance only and does not define implementation code.

### 8.1 Namespacing

Valkey keys should be namespaced by environment and workload. The namespace must make ownership of operational state obvious during monitoring and incident response without exposing secrets or personal data.

Recommended logical pattern:

```text
luxyhub:{environment}:{workload}:{identifier}
```

Recommended workload prefixes:

| Prefix | Intended workload | Example pattern |
|---|---|---|
| `luxyhub:prod:rate:` | Rate-limit windows and counters | `luxyhub:prod:rate:{endpoint}:{hashed_identifier}` |
| `luxyhub:prod:session:` | Delivery session metadata keyed by token hash or generated session ID | `luxyhub:prod:session:{session_hash}` |
| `luxyhub:prod:nonce:` | Replay-prevention keys | `luxyhub:prod:nonce:{session_hash}:{nonce_hash}` |
| `luxyhub:prod:cache:` | Dashboard, script metadata, build metadata, and configuration cache entries | `luxyhub:prod:cache:{scope}:{hashed_identifier}` |
| `luxyhub:prod:lock:` | Worker and scheduler locks | `luxyhub:prod:lock:{worker_name}` |
| `luxyhub:prod:counter:` | Temporary analytics counters awaiting flush | `luxyhub:prod:counter:{metric}:{bucket}` |

Environment examples:

| Environment | Prefix root |
|---|---|
| Production | `luxyhub:prod:` |
| Preview / staging | `luxyhub:preview:` or `luxyhub:staging:` |
| Local development | `luxyhub:local:` |

Consistent naming rules:

- Use lowercase workload names.
- Use colon-separated segments.
- Start every key with `luxyhub:{environment}:`.
- Never share prefixes between production, preview, staging, and local environments.
- Keep key names stable enough for metrics grouping and incident investigation.
- Keep values compact; do not encode large payloads into key names.
- Use hashed identifiers for IP addresses, emails, session tokens, license keys, client identifiers, executor identifiers, and any user-derived sensitive value.
- Prefer server-generated IDs or existing hashes over raw client input.
- Do not include raw emails, raw IP addresses, raw session tokens, raw license keys, event secrets, service-role keys, provider credentials, or access tokens in keys.
- Include creator/script/build identifiers only when they are already non-sensitive and required for observability or invalidation.
- Document any key family that intentionally has no TTL; this should be rare and reviewed as an exception.

Recommended key-family registry before implementation:

| Key family | Owner | Data class | TTL required | Failure behavior |
|---|---|---|---|---|
| Rate limit keys | API/platform | Temporary | Yes | Fail closed or PostgreSQL fallback, depending on endpoint. |
| Delivery session keys | Runtime/platform | Temporary | Yes | Fail closed or PostgreSQL fallback during rollout. |
| Nonce keys | Runtime/security | Temporary | Yes | Fail closed for signed event validation. |
| Cache keys | Dashboard/runtime | Derived cache | Yes | Degrade gracefully to PostgreSQL/config. |
| Worker lock keys | Operations/platform | Temporary coordination | Yes | Worker-specific degraded behavior. |
| Counter keys | Analytics/platform | Aggregation buffer | Yes | Counter-specific loss or flush behavior. |

Requirements:

- Production, preview, and local environments must not share keys.
- User-supplied identifiers must be normalized or hashed before use in keys when sensitive.
- Raw session tokens, raw license keys, raw emails, provider secrets, and service credentials must not appear in key names.

### 8.2 TTL Strategy

Every temporary key must have a documented TTL.

Recommended TTL policy:

| Workload | TTL rule |
|---|---|
| Rate limit | Window length plus small buffer for retry-after consistency. |
| Delivery session | Runtime validity window plus small buffer for clock skew/event validation. |
| Event nonce | Maximum timestamp skew plus session validity window. |
| Worker lock | Expected job duration plus safety margin; renew for long jobs if needed. |
| Cache | Short TTL based on staleness tolerance; invalidate on mutations. |
| Counter buffer | Flush interval plus recovery buffer. |

Keys without TTLs should be treated as defects unless explicitly approved as durable cache indexes with documented cleanup.

### 8.3 Failure Modes

Each migrated workload must declare one of these behaviors:

| Behavior | Meaning | Appropriate for |
|---|---|---|
| Fail closed | Reject or delay the request if Valkey is unavailable. | Auth-sensitive rate limits, abuse controls, delivery-session validation. |
| Fail open | Allow the request if Valkey is unavailable. | Low-risk cache-only checks where security is unaffected. |
| Fallback to PostgreSQL | Use legacy PostgreSQL path while it remains available. | Migration rollout for rate limits and delivery sessions. |
| Degrade gracefully | Skip optional optimization but preserve correctness. | Dashboard cache, metadata cache, non-critical counters. |

Security-sensitive paths should default to fail closed unless a documented PostgreSQL fallback exists.

## 9. Memory Budget Planning

Valkey memory must be planned before implementation because Phase 7D intentionally moves high-churn temporary state into an in-memory system.

### 9.1 Initial Allocation

The initial memory allocation should be selected only after Phase 7D.0 baseline metrics quantify request volume, session volume, rate-limit bucket cardinality, cache candidates, and counter cardinality.

Initial allocation planning inputs:

- Peak requests per minute by endpoint.
- Concurrent active delivery sessions within the TTL window.
- Number of distinct rate-limit identifiers per window.
- Expected cache key count by cache family.
- Expected counter bucket cardinality by flush interval.
- Average value size for session metadata, cache entries, and counters.
- Memory overhead per key/value pair and operational headroom.

No exact production memory value is specified in this RFC because current production baseline metrics must be collected first.

### 9.2 Thresholds

Alert thresholds should be defined as percentages of the approved memory limit rather than absolute values until production sizing is complete.

| Threshold | Planning meaning | Required response |
|---|---|---|
| Warning | Memory usage is approaching the planned steady-state budget. | Review key cardinality, TTL behavior, cache growth, and traffic changes. |
| Alert | Memory usage is high enough to threaten eviction or write failures if growth continues. | Reduce non-critical cache/counter usage, shorten safe TTLs, and prepare scaling action. |
| Critical | Memory usage is near the configured limit or eviction/write failures are imminent or occurring. | Disable non-critical key families first, preserve security-sensitive workloads, and execute the incident runbook. |

Recommended threshold policy:

- Define warning, alert, and critical percentages before enabling production writes to Valkey.
- Alert on sustained memory growth, not only instantaneous peaks.
- Alert on eviction count greater than zero for normal operations.
- Alert on rejected writes, command timeouts, or high command latency.
- Track memory by workload prefix where tooling permits.

### 9.3 Eviction Policy

Expected eviction policy:

- Prefer a policy compatible with TTL-based temporary data.
- Avoid relying on eviction as normal cleanup; TTLs should expire keys before memory pressure does.
- Treat eviction of security-sensitive keys as an operational incident unless explicitly accepted for the workload.
- Ensure cache keys are the first acceptable candidates for memory reduction if pressure occurs.
- Never allow eviction policy to make Valkey the only place where permanent data can disappear.

Eviction count under normal load should be zero. Any non-zero eviction should be investigated by key family, memory limit, TTL behavior, and traffic volume.

### 9.4 Future Scaling Considerations

Future scaling options should be evaluated only after baseline and post-migration metrics show need.

Potential scaling paths:

- Increase memory on the existing Valkey host.
- Split high-cardinality caches from security-sensitive rate/session keys.
- Move to managed Valkey.
- Add high availability or replica topology.
- Revisit TTLs and cache coverage.
- Reduce counter dimensions or flush more frequently.

Scaling decisions must preserve the design principle that Valkey owns temporary operational state only.

## 10. Operations Guide

This section defines operational planning requirements for Valkey. It does not deploy, configure, install, or modify any infrastructure.

### 10.1 Deployment

Deployment planning must define:

- Whether Valkey runs on the existing VPS, a private service, or a managed provider.
- Network exposure and firewall rules.
- Authentication requirements.
- TLS or private-network requirements.
- Environment separation for production, preview/staging, and local development.
- Process ownership and restart supervision model.
- Log destination and retention expectations.
- Capacity assumptions from Phase 7D.0 baseline metrics.

Deployment must not proceed until security, monitoring, rollback, and ownership requirements are accepted.

### 10.2 Monitoring

Required monitoring categories:

- Availability.
- Command latency.
- Command error rate.
- Connection count.
- Memory usage.
- Key count by workload prefix where possible.
- Expired key count.
- Evicted key count.
- Rejected writes.
- CPU usage on the Valkey host.
- Disk usage if persistence is enabled.
- Replication/failover health if a future topology includes replicas.

Application-level monitoring must also track:

- Valkey command timeouts.
- Fallback activation count.
- Fail-closed request count.
- Cache hit/miss ratio.
- Rate-limit decision count and parity during shadow mode.
- Delivery-session validation success/failure by backend authority.
- Worker lock acquisition, contention, and expiration.

### 10.3 Restart Procedure

The future restart procedure should document:

- Expected impact by workload during restart.
- Whether application requests fail closed, fall back, or degrade gracefully while Valkey is unavailable.
- How PM2 application processes reconnect after restart.
- How to verify health after restart.
- How to confirm locks, sessions, rate limits, and caches recover safely.
- How to detect counter loss or unflushed buffers.

Restart planning assumptions:

- Cache loss is acceptable.
- Delivery sessions may require clients to retry.
- Worker locks must expire naturally and not remain stuck.
- Security-sensitive workloads must not silently fail open unless explicitly approved.

### 10.4 Upgrade Procedure

The future upgrade procedure should document:

- Version compatibility requirements.
- Maintenance window expectations if any.
- Pre-upgrade health checks.
- Backup or persistence snapshot expectations if persistence is enabled.
- Application fallback or traffic-drain expectations.
- Post-upgrade validation metrics.
- Rollback criteria for the upgrade itself.

No upgrade should proceed without a tested restart procedure and documented failure behavior.

### 10.5 Persistence Strategy

Persistence strategy must be selected by workload tolerance:

| Option | Planning implication |
|---|---|
| No persistence | Fast and simple, but all Valkey state is lost on restart. Acceptable only if every key family tolerates loss or fallback. |
| RDB snapshot | Provides point-in-time recovery for operational convenience, but recent temporary state may be lost. |
| AOF | Reduces temporary-state loss window but adds disk usage and restart/rewrite complexity. |
| Managed provider persistence | Operational burden shifts to provider, but failure behavior and data classification rules still apply. |

Persistence must not be used to justify storing permanent state in Valkey.

### 10.6 Backup Expectations

Backup planning position:

- PostgreSQL backups remain the authoritative backup for permanent data.
- Valkey backups are optional operational convenience for temporary state, not business-data recovery.
- If persistence snapshots are retained, retention should be short and access-controlled.
- Backups must not contain raw secrets, raw tokens, or unapproved sensitive payloads.
- Backup/restore testing should verify application safety, not permanent-data recovery.

### 10.7 Disaster Recovery Expectations

Disaster recovery planning must define behavior for:

- Complete Valkey data loss.
- Valkey process unavailable.
- Valkey host unavailable.
- Memory exhaustion and eviction.
- Network partition between application and Valkey.
- Corrupted persistence file if persistence is enabled.

Expected recovery posture:

- Permanent data is recovered from PostgreSQL/Supabase processes, not Valkey.
- Cache and lock data can be discarded.
- Rate-limit windows can reset or fall back according to endpoint policy.
- Delivery sessions can be recreated by clients through existing runtime flows.
- Counter buffers may need documented reconciliation or accepted undercount for non-critical metrics.

### 10.8 Memory Monitoring

Memory monitoring must include:

- Current memory usage.
- Peak memory usage.
- Memory fragmentation indicator if available.
- Configured memory limit.
- Key count and estimated memory by prefix where available.
- Evictions.
- Expirations.
- Largest key/value families.
- Growth rate after each migration phase.

Memory reviews should occur after each workload migration and before expanding cache coverage or analytics counter dimensions.

### 10.9 Alert Thresholds

Required alerts before production authority moves to Valkey:

| Alert | Trigger concept |
|---|---|
| Valkey unavailable | Health check fails or connection cannot be established. |
| High command latency | Sustained latency exceeds approved threshold. |
| Command errors | Error rate exceeds approved threshold. |
| Memory warning/alert/critical | Memory crosses approved percentage thresholds. |
| Evictions detected | Eviction count increases under normal operation. |
| Rejected writes | Valkey refuses writes or reports OOM-like behavior. |
| Missing TTL anomaly | Key-family audit finds unexpected keys without expiry. |
| Fallback spike | Application falls back to PostgreSQL more than expected. |
| Fail-closed spike | Security-sensitive requests are rejected due to Valkey unavailability. |
| Worker lock contention spike | Lock contention exceeds normal scheduling expectations. |

Exact numeric thresholds should be defined after Phase 7D.0 baseline and Phase 7D.1 infrastructure validation.

### 10.10 Health Checks

Health checks should cover:

- Connectivity.
- Authentication.
- Basic read/write/delete capability in a non-production-impacting health namespace.
- TTL assignment and expiry behavior.
- Latency budget.
- Memory usage.
- Eviction status.
- Persistence status if enabled.
- Replication/failover status if applicable in the future.

Health checks must avoid storing sensitive data and must use keys that expire automatically.

### 10.11 Operational Ownership

Operational ownership must be assigned before implementation.

Required ownership areas:

- Valkey service owner.
- Application integration owner.
- Security reviewer.
- Incident responder/on-call owner.
- Metrics and dashboard owner.
- Backup/persistence owner if persistence is enabled.
- Release manager for phase cutovers.

Ownership responsibilities:

- Maintain runbooks.
- Review memory and key-family growth.
- Approve workload failure behavior.
- Validate rollback before cutover.
- Review incidents involving Valkey availability, memory, eviction, or security.

## 11. Risks

### 11.1 Memory Usage

Risk:

- Valkey is memory-backed and can evict keys or fail writes if memory is exhausted.

Mitigations:

- Set memory limits and alert thresholds.
- Track key counts, memory per workload, expired keys, evicted keys, and command latency.
- Use TTLs on all temporary keys.
- Avoid storing large payloads.
- Prefer compact values for counters and session metadata.
- Define emergency controls to disable non-critical caches/counters first.

### 11.2 Persistence Options

Risk:

- Valkey data may be lost on restart depending on persistence settings.

Planning position:

- Temporary data should tolerate loss according to workload-specific behavior.
- Persistence can be enabled for operational resilience, but permanent correctness must not depend on it.
- If AOF/RDB persistence is enabled, disk usage and restart recovery time must be monitored.

Workload implications:

- Cache loss is acceptable.
- Rate-limit reset may be acceptable for low-risk endpoints but not ideal during abuse events.
- Delivery-session loss invalidates in-flight runtime sessions and should return safe retry/error behavior.
- Counter buffer loss may undercount unless paired with durable event records or flush acknowledgements.

### 11.3 Failover Behavior

Risk:

- A single Valkey instance can become a new availability dependency.

Mitigations:

- Document whether Phase 7D starts with a single-node VPS deployment or managed failover.
- Monitor latency and availability.
- Keep PostgreSQL fallback paths during migration phases.
- Use short timeouts so Valkey failure does not hang Next.js requests.
- Define degraded modes per endpoint.

### 11.4 Server Restart

Risk:

- PM2 app restarts or Valkey restarts can interrupt in-flight temporary state.

Mitigations:

- Use connection retry with bounded timeouts.
- Ensure delivery sessions are short-lived and clients can retry session creation.
- Ensure locks have TTL and ownership tokens.
- Ensure cache misses fall back to PostgreSQL.
- Ensure workers are idempotent across restarts.

### 11.5 TTL Strategy Errors

Risk:

- TTLs that are too short can break valid runtime flows.
- TTLs that are too long can increase memory pressure and weaken replay protection assumptions.
- Missing TTLs can create memory leaks.

Mitigations:

- Define TTLs per workload before implementation.
- Add tests and metrics that detect missing TTLs.
- Alert on keys without expiry if supported by operational tooling.
- Review TTLs after production traffic measurement.

### 11.6 Security Considerations

Risks:

- Valkey exposed to the public network.
- Secrets or raw tokens stored in keys/values/logs.
- Cross-environment key collisions.
- Cross-account cache leakage.
- Inconsistent fail-open behavior on protected endpoints.
- Lock misuse causing duplicate or skipped worker processing.

Mitigations:

- Bind Valkey to private interfaces or restrict by firewall/security group.
- Require authentication and secret rotation.
- Do not expose Valkey to browsers or runtime clients.
- Never log raw tokens, event secrets, license keys, service-role keys, or provider credentials.
- Hash sensitive identifiers before use as key names.
- Namespace by environment.
- Keep ownership checks in PostgreSQL-backed server logic.
- Use fail-closed or PostgreSQL fallback for security-sensitive paths.
- Treat Valkey as service-role-only infrastructure.

## 12. Rollback Plan

Rollback must be possible for each migration phase without downtime.

### 12.1 Global Rollback Requirements

- Keep legacy PostgreSQL paths available until each phase has passed production validation.
- Use configuration switches or feature flags to select Valkey, PostgreSQL, dual-write, or shadow mode.
- Do not remove PostgreSQL tables until after the rollback window closes.
- Keep response contracts unchanged during migration.
- Preserve idempotency and duplicate-write safety during dual-write periods.
- Record enough metrics to identify mismatches before switching authority.

### 12.2 Phase 7D.0 Rollback — Production Baseline

Rollback action:

- No runtime rollback is required because Phase 7D.0 only collects metrics.
- If baseline data is incomplete or invalid, repeat the measurement window before implementation begins.

Expected impact:

- No user-visible behavior change.
- Later phases must not proceed until the baseline is trusted.

### 12.3 Phase 7D.1 Rollback — Infrastructure

Rollback action:

- Disable Valkey usage in application configuration.
- Leave current PostgreSQL behavior unchanged.
- Stop or isolate Valkey if needed.

Expected impact:

- No user-visible behavior change because no workload has migrated yet.

### 12.4 Phase 7D.2 Rollback — Rate Limits

Rollback action:

- Switch rate-limit authority back to PostgreSQL.
- Resume PostgreSQL `rate_limits` writes if they were disabled.
- Keep Valkey keys until TTL expiration; no manual cleanup required for correctness.

Expected impact:

- Rate-limit windows may reset or differ briefly during cutback.
- Security-sensitive endpoints remain protected by PostgreSQL fail-closed behavior.
- No downtime required.

### 12.5 Phase 7D.3 Rollback — Delivery Sessions

Rollback action:

- Switch session creation and fetch validation back to PostgreSQL while the PostgreSQL path remains present.
- During dual-write rollout, continue using existing PostgreSQL rows for active sessions.
- If PostgreSQL writes had been stopped but table still exists, re-enable PostgreSQL session creation.
- Allow Valkey session keys to expire naturally.

Expected impact:

- In-flight Valkey-only sessions may need to retry session creation depending on the exact cutover point.
- Runtime API contracts remain unchanged.
- No downtime required if fallback is retained until validation completes.

Critical restriction:

- Do not drop or alter `delivery_sessions` until rollback is no longer required and a separate migration is approved.

### 12.6 Phase 7D.4 Rollback — Worker Locks

Rollback action:

- Disable Valkey lock acquisition and return workers to their prior scheduling/lease behavior.
- Allow existing lock keys to expire.

Expected impact:

- Increased risk of duplicate worker execution returns to pre-Valkey behavior.
- Workers must remain idempotent, so correctness should not depend exclusively on Valkey locks.

### 12.7 Phase 7D.5 Rollback — Cache Layer

Rollback action:

- Disable cache reads and writes.
- Read directly from PostgreSQL/configuration.
- Allow existing cache keys to expire.

Expected impact:

- Increased PostgreSQL read load and possible slower dashboard/runtime metadata responses.
- No data loss because caches are derived.

### 12.8 Phase 7D.6 Rollback — Analytics Counters

Rollback action:

- Stop using Valkey aggregation buffers.
- Resume direct PostgreSQL analytics writes or the previous durable event path.
- Flush remaining counters if safe and idempotent; otherwise allow counters to expire and document possible undercount.

Expected impact:

- Temporary analytics undercount risk for non-critical counters if unflushed buffers are discarded.
- Durable audit/event records must remain intact.
- No financial, license, purchase, or security audit data may be lost.

## 13. Success Criteria And Operational Metrics

Phase 7D is successful only when measurable outcomes show PostgreSQL is no longer carrying high-churn temporary workloads.

Required success criteria:

- `rate_limits` receives no new production writes after Valkey rate limiting is fully enabled.
- `rate_limits` table is drained and eligible for removal through a separately approved migration.
- `delivery_sessions` receives no new production writes after Valkey delivery sessions are fully enabled.
- `delivery_sessions` table is drained and eligible for removal through a separately approved migration after analytics/event dependencies are decoupled.
- Delivery-session cleanup workload is eliminated or reduced to legacy draining only.
- Rate-limit cleanup workload is eliminated or reduced to legacy draining only.
- PostgreSQL write volume decreases for runtime delivery, validation, event, and dashboard rate-limited endpoints.
- PostgreSQL egress decreases for rate-limit counts, delivery-session lookups, and repeated metadata reads.
- Supabase storage growth stabilizes after temporary data is migrated.
- Valkey memory usage remains within defined thresholds under normal and peak load.
- Valkey key TTL metrics confirm temporary keys expire as expected.
- No cross-account data leakage is observed in cache or session paths.
- Runtime API behavior remains compatible with existing clients.
- Dashboard behavior remains compatible with existing users.
- Rollback switches are validated before PostgreSQL table removal.
- Phase 7D.0 baseline metrics exist and are used for every post-phase comparison.
- Valkey monitoring, health checks, and alerting are active before Valkey becomes authoritative for a workload.
- Worker lock contention is visible and remains within expected scheduling behavior.
- Cache hit ratios are measured for every cache family introduced.
- Valkey memory utilization remains below approved warning/alert/critical thresholds.
- Valkey eviction count remains zero under normal production load.
- Rollback has been tested for every migrated workload before legacy PostgreSQL paths are removed.

Suggested measurements:

| Metric | Baseline source | Expected direction |
|---|---|---|
| PostgreSQL database size growth | Phase 7D.0 database baseline | Decrease / stabilize after temporary tables stop growing. |
| PostgreSQL storage used by `delivery_sessions` | Phase 7D.0 table-size baseline | Stop increasing, then drain after migration and approved cleanup. |
| PostgreSQL storage used by `rate_limits` | Phase 7D.0 table-size baseline | Stop increasing, then drain after migration and approved cleanup. |
| PostgreSQL index storage for temporary tables | Phase 7D.0 index-size baseline | Stop increasing, then become removable after approved table removal. |
| PostgreSQL write requests per day | Phase 7D.0 database-write baseline | Decrease after rate limits, sessions, locks, and counters move. |
| PostgreSQL read requests per day | Phase 7D.0 database-read baseline | Decrease after session/rate/caching migrations. |
| PostgreSQL database egress | Phase 7D.0 egress baseline | Decrease after fewer count/session/cache-miss reads. |
| Cleanup rows deleted per run | Phase 7D.0 cleanup baseline | Decrease sharply. |
| Cleanup execution time | Phase 7D.0 cleanup baseline | Decrease. |
| Cleanup frequency requirement | Phase 7D.0 cleanup baseline | Decrease or become legacy-only. |
| Average API latency | Phase 7D.0 application baseline | Same or improved. |
| API latency P95 | Phase 7D.0 application baseline | Same or improved. |
| API latency P99 | Phase 7D.0 application baseline | Same or improved; no tail regression accepted without explicit risk sign-off. |
| Runtime delivery latency average | Phase 7D.0 runtime baseline | Same or improved. |
| Runtime delivery latency P95/P99 | Phase 7D.0 runtime baseline | Same or improved. |
| Rate-limit decision latency | Phase 7D.0 application baseline | Improved or same. |
| Requests per minute normalized database cost | Phase 7D.0 traffic baseline | Decrease database work per request. |
| Valkey cache hit ratio | Phase-specific cache metrics | High enough to justify cache family; exact target defined per cache. |
| Valkey memory utilization | Phase 7D.1 memory budget | Stable below approved thresholds. |
| Valkey evictions | Phase 7D.1 operations metrics | Zero under normal load. |
| Valkey command error rate | Phase 7D.1 operations metrics | Near zero; any sustained errors trigger investigation. |
| Valkey command latency | Phase 7D.1 operations metrics | Within approved latency budget. |
| Worker lock contention | Phase 7D.4 worker metrics | Low and explainable by scheduled overlap or expected concurrency. |
| Worker skipped runs due to lock | Phase 7D.4 worker metrics | Expected only during intentional overlap; no missed required processing. |
| Fallback activation count | Phase-specific rollout metrics | Low during healthy operation; spikes investigated. |
| Fail-closed count due to Valkey failure | Security-sensitive endpoint metrics | Zero during healthy operation; any spike treated as availability incident. |
| Rollback validation | Phase-specific release checklist | Completed before legacy PostgreSQL paths are removed. |

Measurement requirements:

- Compare each phase against the Phase 7D.0 baseline and the immediately previous phase.
- Normalize database reductions against request volume so traffic changes do not hide regressions.
- Track both averages and tail latency.
- Track Valkey health independently from application latency.
- Treat improved latency without reduced PostgreSQL write/storage pressure as incomplete success.
- Treat reduced PostgreSQL load with Valkey instability as incomplete success.

## 14. Architecture Decision Record Recommendation

Before implementation begins, create a dedicated ADR to capture the permanent architecture decision for Valkey temporary data.

Recommended filename:

```text
docs/architecture/adr/ADR-001-Valkey-Temporary-Data.md
```

The ADR should capture:

- Why Valkey was chosen for temporary operational state.
- Why PostgreSQL should no longer store high-churn temporary data.
- Why Valkey is limited to temporary data only.
- Why Supabase Auth remains the identity provider.
- Why PostgreSQL remains the permanent application database.
- Migration philosophy: baseline first, infrastructure second, workload-by-workload migration, rollback before removal.
- Operational model: monitoring, memory budget, TTL governance, health checks, ownership, restart/upgrade procedures, and disaster recovery.
- Long-term maintenance strategy: key-family registry, TTL review, memory review, cache invalidation review, and rollback-path retirement criteria.
- Explicit non-goals: replacing Supabase Auth, replacing PostgreSQL for permanent data, introducing marketplace functionality, or changing production infrastructure outside reviewed phases.

The ADR is recommended before implementation but is not created by this refinement pass.

## 15. Future Architecture

Long-term ownership model:

| Platform | Long-term role |
|---|---|
| Supabase Auth | Authentication, user session validation, user identity foundation. |
| PostgreSQL | Permanent application database for durable product, ownership, analytics, audit, license, key, purchase, script, and version data. |
| Valkey | Temporary data platform for rate limits, delivery sessions, nonces, worker locks, caches, temporary counters, and short-lived coordination. |

Future high-level architecture:

```text
┌────────────────────────────────────────────────────────────┐
│ Supabase Auth                                               │
│ Authentication, sessions, user identity                     │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ PostgreSQL                                                  │
│ Permanent application database                              │
│ - users/profiles                                            │
│ - scripts and script_versions                               │
│ - delivery_builds                                           │
│ - keys and licenses                                         │
│ - purchases                                                 │
│ - durable analytics                                         │
│ - audit and event history                                   │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ Valkey                                                      │
│ Temporary data platform                                     │
│ - rate limits                                               │
│ - delivery sessions                                         │
│ - cache                                                     │
│ - worker locks                                              │
│ - nonces and replay windows                                 │
│ - temporary analytics counters                              │
└────────────────────────────────────────────────────────────┘
```

In this future state, PostgreSQL growth should reflect permanent product usage rather than temporary request volume. Valkey absorbs short-lived operational churn, and cleanup jobs become less central to database health.

## 16. Implementation Readiness Checklist

Before any code or production work begins, the following decisions should be reviewed and accepted:

- Confirm Phase 7D.0 baseline report exists and covers database, application, cleanup, and infrastructure metrics.
- Confirm Valkey deployment model: VPS-local, private service, or managed provider.
- Confirm authentication, network isolation, firewall, and secret rotation requirements.
- Confirm Valkey persistence mode and restart expectations.
- Confirm memory limit, eviction policy, and alert thresholds.
- Confirm operations guide ownership, restart procedure, upgrade procedure, and disaster recovery expectations.
- Confirm workload failure modes: fail closed, fail open, PostgreSQL fallback, or graceful degradation.
- Confirm TTLs for rate limits, sessions, nonces, locks, caches, and counters.
- Confirm key namespace format, key-family registry, and sensitive identifier hashing rules.
- Confirm rollout flags or configuration switches for each migration phase.
- Confirm metrics needed for parity validation and rollback confidence.
- Confirm delivery-session analytics decoupling design before `delivery_sessions` migration.
- Confirm that PostgreSQL table removal will be handled by separate reviewed migrations after production validation.
- Confirm ADR recommendation has been accepted or explicitly deferred.

## 17. Future Considerations Outside Phase 7D

The following topics are intentionally outside Phase 7D. They may become future architecture discussions, but they are not current roadmap items and must not be treated as implementation requirements for this phase.

| Future consideration | Why it is outside Phase 7D |
|---|---|
| Self-hosted PostgreSQL | Phase 7D keeps Supabase PostgreSQL as the permanent database and focuses only on temporary-data offload. |
| Database independence | Abstracting away PostgreSQL/Supabase would be a broader platform redesign beyond Valkey temporary state. |
| Multi-node Valkey | Phase 7D may document failover considerations, but multi-node topology is a separate infrastructure decision. |
| Managed Valkey | A managed provider may be considered during deployment planning, but the RFC does not select or provision one. |
| Cross-region replication | Runtime and dashboard architecture are not being redesigned for multi-region operation in Phase 7D. |
| Read replicas | PostgreSQL read-scaling is separate from removing temporary writes and cleanup pressure. |
| Horizontal application scaling | Valkey can support future scale-out, but Phase 7D does not redesign PM2/VPS topology. |
| Queue platform replacement | Worker locks and counters may improve coordination, but Phase 7D does not replace durable event/queue history. |
| Runtime payload cache | Caching encrypted or decrypted runtime payloads requires a separate secure-delivery review. |
| License/payment enforcement redesign | License, purchase, and financial state remain permanent PostgreSQL data and are not redesigned here. |

Any future consideration must receive its own design document, risk review, and rollout plan before implementation.

## 18. Phase Boundary

This document completes Phase 7D planning scope only. It does not implement Valkey, install dependencies, alter schemas, change runtime behavior, modify production infrastructure, or remove any PostgreSQL tables.
