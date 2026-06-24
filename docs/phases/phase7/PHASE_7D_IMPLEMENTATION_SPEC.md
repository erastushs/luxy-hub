# Phase 7D — Valkey Implementation Specification

Status: Historical specification; Phase 7D engineering complete, Phase 7E.1 production verified
Date: 2026-06-24
Scope: Original implementation specification, retained for design and rollout history
Source RFC: `PHASE_7D_VALKEY_INTEGRATION_PLAN.md`

This document defined how Phase 7D should be implemented. It is now retained as the historical implementation specification. Current production state is PostgreSQL authoritative, Valkey shadow mode, deterministic canary infrastructure present but disabled, `/api/health` operating as the primary operational health endpoint, `/api/internal/rate-limit-shadow` providing admin-only shadow monitoring, and Cloudflare-aware client IP resolution verified in production.

## Current Implementation Status

| Area | Current State |
|---|---|
| PostgreSQL | Authoritative for rate limits and permanent data. |
| Valkey | Implemented for shadow comparison and operational health visibility. |
| Runtime mode | `RATE_LIMIT_MODE=shadow`. |
| Canary controls | `RATE_LIMIT_MODE=valkey_canary` and `RATE_LIMIT_CANARY_PERCENT` infrastructure exists; production canary is not enabled. |
| Operational health | `/api/health` reports `summary`, `postgres`, `valkey`, `rateLimit`, `rollout`, `performance`, `runtime`, and `notes`. |
| Shadow monitoring | `/api/internal/rate-limit-shadow` reports parity, comparison metrics, rollout metrics, and Valkey health for admins. |
| Production health | Healthy; backend failures `0`; comparison failures `0`; parity `100%`; mismatch rate `0`. |
| Client IP resolution | `CF-Connecting-IP`, `X-Vercel-Forwarded-For`, `X-Forwarded-For`, `X-Real-IP`, localhost fallback. |
| Rollback | Set `RATE_LIMIT_MODE=postgres`. |

Current rate-limit architecture:

```text
Client
  ↓
Next.js API
  ↓
PostgreSQL authoritative decision
  ↓
Valkey shadow comparison
  ↓
Metrics and health reporting
```

Phase 7D must be implemented as an incremental, feature-flagged migration from PostgreSQL-backed temporary state to Valkey-backed temporary state. PostgreSQL remains authoritative for permanent application data throughout the migration and after Phase 7D is complete.

## 1. Implementation Goals

Phase 7D implementation has the following objectives:

- Introduce Valkey with zero planned downtime.
- Preserve all existing dashboard, runtime, API, Server Action, and worker contracts.
- Keep PostgreSQL authoritative until each workload is migrated, validated, and explicitly cut over.
- Move only temporary operational state to Valkey.
- Avoid changing Supabase Auth, ownership checks, authorization semantics, or permanent data ownership.
- Preserve rollback at every implementation stage through flags, fallback paths, dual-write mode, shadow mode, or controlled disablement.
- Eliminate new PostgreSQL writes for migrated high-churn temporary workloads after validation.
- Reduce PostgreSQL reads, writes, storage growth, cleanup duration, and Supabase egress.
- Improve or preserve API and runtime latency, including P95 and P99 behavior.
- Keep existing runtime compatibility for delivery session creation, payload fetch, event validation, and response formats.
- Ensure all Valkey keys have documented namespaces, TTLs, ownership, metrics, and failure behavior.
- Prevent raw secrets, raw tokens, raw license keys, raw emails, raw IP addresses, service-role credentials, provider credentials, and sensitive payloads from being stored in Valkey or exposed through logs.
- Ensure observability is live before any workload uses Valkey as the authoritative path.
- Validate rollback before legacy PostgreSQL paths are removed or disabled.

Implementation must be small-step and reversible. PostgreSQL table removal, schema changes, and infrastructure changes require separate approval and are not authorized by this specification.

## 2. Repository Layout

Current implementation note: Valkey support now exists under `app/lib/valkey/`; rate-limit runtime, shadow, canary infrastructure, and metrics live under `app/lib/rate-limit/`. The original proposed layout below remains useful as a long-term module map but is no longer a statement that no Valkey files exist.

The current repository uses `app/lib/` rather than `src/lib/`. The future Valkey integration should therefore use `app/lib/valkey/` to match existing conventions.

Original proposed future layout:

```text
app/lib/valkey/
  connection.ts
  health.ts
  namespace.ts
  metrics.ts
  feature-flags.ts
  serialization.ts
  errors.ts
  rate-limit.ts
  delivery-session.ts
  locks.ts
  cache.ts
  counter.ts
  nonce.ts
  shadow.ts
  rollout.ts
  ttl.ts
  key-registry.ts
```

Module responsibilities:

| Module | Responsibility | Must Not Do |
|---|---|---|
| `connection.ts` | Centralize Valkey client creation, reuse, connection timeouts, command timeouts, reconnect behavior, process shutdown handling, and disabled-state behavior. | Expose raw client construction throughout the app, store secrets in code, or implement workload semantics. |
| `health.ts` | Provide Valkey health checks for connectivity, authentication, latency, read/write/delete in a safe health namespace, TTL behavior, memory state, and command failures. | Perform user-visible mutations or use production workload keys for health checks. |
| `namespace.ts` | Build environment-aware key prefixes such as `luxyhub:{environment}:{workload}:...` and enforce production, preview, staging, and local separation. | Accept raw sensitive identifiers without hashing or allow cross-environment key reuse. |
| `metrics.ts` | Emit application-level Valkey metrics, including command latency, errors, fallbacks, hit/miss ratio, decisions, sessions, lock contention, cache invalidation, counter flushes, and rollback indicators. | Replace durable analytics or log sensitive values. |
| `feature-flags.ts` | Read and normalize Phase 7D flags, define default-off behavior, expose mode selection, and prevent invalid combinations. | Dynamically mutate production behavior outside explicit configuration. |
| `serialization.ts` | Define compact, versioned, JSON-safe serialization rules for session metadata, cache values, lock tokens, counter metadata, and shadow comparison payloads. | Serialize raw secrets or large payloads without explicit approval. |
| `errors.ts` | Normalize Valkey errors into application decisions such as fallback, fail closed, degrade gracefully, or retry. | Hide security-sensitive failures or silently fail open on protected paths. |
| `rate-limit.ts` | Implement Valkey-backed rate-limit counters/windows, retry-after calculations, shadow comparisons, and endpoint-specific fail behavior. | Change public API response contracts or store raw IP/email identifiers. |
| `delivery-session.ts` | Implement Valkey-backed delivery session metadata, token-hash lookup, atomic consume semantics, event secret lookup during TTL, and shadow comparison with PostgreSQL. | Store raw session tokens, alter runtime response contracts, or make permanent analytics depend on Valkey. |
| `locks.ts` | Implement worker lock acquire/renew/release using owner tokens and TTLs; report contention and skipped runs. | Make locks the only correctness guarantee for non-idempotent workers. |
| `cache.ts` | Implement short-lived, server-side cache helpers for approved dashboard, script metadata, ready build metadata, and configuration cache families. | Cache unauthorized cross-account data, raw secrets, or runtime payload ciphertext without separate approval. |
| `counter.ts` | Implement temporary analytics counters, aggregation buckets, flush checkpoints, idempotency metadata, and flush metrics. | Store billing, purchase, license, or security audit history only in Valkey. |
| `nonce.ts` | Implement replay-prevention keys for event signatures and one-time operations with strict TTLs and fail-closed behavior where required. | Store raw event secrets or allow missing nonce checks to fail open. |
| `shadow.ts` | Centralize dual-write, shadow-read, parity comparison, mismatch recording, sampling, and authority reporting. | Change authoritative behavior without the related rollout flag. |
| `rollout.ts` | Define traffic-slice selection, endpoint allowlists, stage gates, canary controls, and cutover percentage handling. | Use unstable client-provided values for rollout decisions when that could affect ownership or security. |
| `ttl.ts` | Store approved TTL constants or readers for rate windows, session validity, nonce windows, lock duration, cache families, and counter buffers. | Allow temporary keys without documented TTLs. |
| `key-registry.ts` | Maintain the key-family registry: prefix, owner, data class, TTL requirement, failure behavior, metrics, and rollback notes. | Become a runtime source of truth for permanent product data. |

Expected integration touchpoints later:

- `app/lib/rate-limiter.ts` and `app/lib/repositories/rate-limit-repository.ts` for rate-limit migration.
- `app/lib/services/delivery-session-service.ts` and `app/lib/repositories/delivery-session-repository.ts` for delivery-session migration.
- Existing event, analytics, cleanup, and worker services for locks, counters, and cleanup reduction.
- Server Components, Server Actions, and service functions for approved cache reads and mutation-driven invalidation.

This specification itself did not create files, but later Phase 7D/7E.1 implementation work added the current Valkey and rate-limit modules.

## 3. Feature Flags

All flags default to disabled unless explicitly stated otherwise. Disabling a flag must restore the prior PostgreSQL-backed or no-cache behavior without a deployment rollback whenever the legacy path still exists.

Original recommended flag model is retained for historical context. Current implemented rate-limit runtime uses `RATE_LIMIT_MODE` with `postgres`, `shadow`, `dual_write`, `valkey_canary`, and `valkey` recognized as modes, plus `RATE_LIMIT_CANARY_PERCENT` for deterministic future canary selection. Production remains `RATE_LIMIT_MODE=shadow` and canary disabled. Historical flag names in the table below are not the implemented rate-limit runtime contract unless explicitly mapped to `RATE_LIMIT_MODE` or `RATE_LIMIT_CANARY_PERCENT`.

| Flag | Default | Purpose | Rollback Behavior |
|---|---|---|---|
| `VALKEY_ENABLED` | `false` | Global kill switch for any Valkey client usage. When false, workload-specific Valkey flags must behave as disabled. | Disable all Valkey reads/writes and use existing PostgreSQL/config behavior. Existing Valkey keys expire naturally. |
| `VALKEY_HEALTH_ENABLED` | `false` | Enables Valkey health checks after infrastructure exists. | Disable health probes and remove Valkey from readiness decisions. |
| `VALKEY_METRICS_ENABLED` | `false` | Enables application-level Valkey metric emission. | Stop emitting Valkey metrics; runtime behavior unchanged. |
| `VALKEY_SHADOW_MODE` | `false` | Enables dual-write/shadow-read comparison while PostgreSQL remains authoritative. | Stop shadow work and keep PostgreSQL authoritative. |
| `RATE_LIMIT_V2` | `false` | Enables Valkey rate-limit implementation in configured mode. | Switch rate-limit authority back to PostgreSQL and resume PostgreSQL writes if they were disabled. |
| `RATE_LIMIT_V2_MODE` | `postgres` | Selects rate-limit authority: `postgres`, `shadow`, `dual_write`, `valkey_canary`, or `valkey`. | Set to `postgres`. Valkey keys expire naturally. |
| `RATE_LIMIT_V2_WRITE_POSTGRES` | `true` | Controls whether PostgreSQL rate-limit rows continue during rollout. | Set to `true` before or during rollback to preserve legacy behavior. |
| `DELIVERY_SESSION_V2` | `false` | Enables Valkey delivery-session implementation in configured mode. | Switch session creation/fetch validation back to PostgreSQL while the legacy path exists. |
| `DELIVERY_SESSION_V2_MODE` | `postgres` | Selects delivery-session authority: `postgres`, `dual_write`, `shadow_read`, `valkey_canary`, or `valkey`. | Set to `postgres` or `dual_write` depending on cutover point. |
| `DELIVERY_SESSION_V2_WRITE_POSTGRES` | `true` | Controls whether PostgreSQL delivery session rows continue during rollout. | Set to `true` before rollback so newly created sessions are available to the PostgreSQL path. |
| `EVENT_NONCE_V1` | `false` | Enables Valkey-backed replay-prevention keys for signed runtime events. | Return to existing replay behavior or fail closed, depending on endpoint policy. |
| `WORKER_LOCKS_V1` | `false` | Enables Valkey distributed locks for workers and scheduled tasks. | Disable lock acquisition and return to prior scheduling/lease behavior. Existing locks expire by TTL. |
| `CACHE_V1` | `false` | Enables approved Valkey cache families. | Disable cache reads/writes and read directly from PostgreSQL/configuration. Cache keys expire naturally. |
| `CACHE_V1_READS` | `false` | Allows serving from cache after cache writes and invalidation have been validated. | Disable reads first; optional writes may remain for warmup or be disabled. |
| `CACHE_V1_WRITES` | `false` | Allows cache population and mutation-driven invalidation. | Disable writes; reads should also be disabled unless stale values are impossible. |
| `COUNTERS_V1` | `false` | Enables temporary Valkey analytics counter buffers. | Stop incrementing Valkey counters and resume direct PostgreSQL analytics writes or previous durable event path. |
| `COUNTERS_V1_FLUSH` | `false` | Enables scheduled flushing of Valkey counters into PostgreSQL aggregates. | Disable flush if it is unsafe; otherwise run final idempotent flush before rollback where possible. |
| Historical Valkey canary percent flag | `0` | Historical proposed canary variable. Current implemented rate-limit runtime uses `RATE_LIMIT_CANARY_PERCENT`. | Set current `RATE_LIMIT_CANARY_PERCENT` to `0` to stop rate-limit canary authority. |
| `VALKEY_FAIL_CLOSED_ENABLED` | `true` for protected paths | Enforces fail-closed behavior when protected workloads cannot use Valkey and have no approved fallback. | For rollback, prefer PostgreSQL fallback over disabling fail-closed protection. |
| `VALKEY_LOG_SAMPLE_RATE` | minimal safe value | Controls safe diagnostic log sampling for shadow mismatches and operational errors. | Set to `0` to suppress optional diagnostics during incident response. |

Feature flag requirements:

- Workload flags must never override `VALKEY_ENABLED=false`.
- Default behavior for a fresh deployment must be current PostgreSQL-backed behavior.
- Mode flags must be validated at process startup and during config reads.
- Invalid flag combinations must fail safe. For example, `DELIVERY_SESSION_V2_MODE=valkey` with `VALKEY_ENABLED=false` must behave as PostgreSQL or fail deployment validation, not partially execute.
- Protected endpoints must use fail-closed behavior when neither Valkey nor an approved PostgreSQL fallback is available.
- Cache and optional counter workloads may degrade gracefully when disabled.
- Flags must be observable in deployment metadata without exposing secrets.

## 4. Migration Order

Phase 7D implementation must follow this order. Later stages may not become authoritative before all earlier required gates are complete.

### Stage 0 — Production Baseline

Objective:

- Capture baseline database, application, runtime, cleanup, and infrastructure metrics before any Valkey implementation begins.

Prerequisites:

- Approved Phase 7D Architecture RFC.
- This implementation specification accepted.
- Production metric sources identified.

Deliverables:

- Dated baseline report covering PostgreSQL size, table/index sizes, high-churn row counts, reads, writes, egress, API latency, runtime delivery latency, cleanup duration, cleanup row counts, request volume, error rates, VPS CPU/RAM/disk/network, PM2 restarts, and timer success/failure.
- Measurement window, traffic assumptions, anomalies, and known limitations.

Validation:

- Baseline values are reproducible or explainable.
- Metrics are normalized by request volume.
- Temporary tables `rate_limits` and `delivery_sessions` are explicitly measured.

Rollback:

- No runtime rollback required.
- If baseline is incomplete, repeat measurement before Stage 1.

Exit Criteria:

- Baseline report exists and is approved for later comparisons.

### Stage 1 — Infrastructure

Objective:

- Provision or prepare Valkey as an operational dependency without moving workloads.

Prerequisites:

- Stage 0 complete.
- Deployment model selected in a separate infrastructure approval process.
- Security requirements reviewed.

Deliverables:

- Valkey service deployment plan or deployment completion record, depending on the separately approved infrastructure task.
- Network binding, firewall, authentication, TLS/private-network posture, persistence mode, restart supervision, log destination, and capacity assumptions.
- Environment variables documented but not hard-coded.
- Operational owner and incident owner assigned.

Validation:

- Valkey is reachable only from intended application/worker contexts.
- Authentication works.
- Public access is blocked.
- Memory and eviction policy are known.
- Existing application behavior remains unchanged with `VALKEY_ENABLED=false`.

Rollback:

- Disable Valkey use with `VALKEY_ENABLED=false`.
- Stop or isolate Valkey service if needed.
- PostgreSQL behavior remains unchanged.

Exit Criteria:

- Valkey exists as an available dependency, but no production workload depends on it.

### Stage 2 — Connection Layer

Objective:

- Add the application connection boundary and shared primitives without enabling workload migration.

Prerequisites:

- Stage 1 complete.
- Package/dependency decision approved separately if a client library is required.
- Feature flag defaults accepted.

Deliverables:

- Future implementation of `app/lib/valkey/connection.ts`, `feature-flags.ts`, `errors.ts`, `serialization.ts`, `namespace.ts`, `ttl.ts`, and `key-registry.ts`.
- Startup validation for safe flag combinations.
- Bounded command timeout policy.
- Safe disabled-state behavior.

Validation:

- Application starts with Valkey disabled.
- Application starts with Valkey enabled and no workload flags active.
- Connection failures do not hang requests.
- Key namespace generation rejects unsafe sensitive raw identifiers by design.

Rollback:

- Set `VALKEY_ENABLED=false`.
- Keep all workload flags disabled.
- Existing PostgreSQL behavior remains authoritative.

Exit Criteria:

- Connection layer is present, tested, and unused for authoritative workload behavior.

### Stage 3 — Health Checks And Observability Foundation

Objective:

- Enable health checks and metrics before shadow mode or authority cutover.

Prerequisites:

- Stage 2 complete.
- Metrics destination selected.
- Alert ownership assigned.

Deliverables:

- `health.ts` health probes for connectivity, authentication, safe read/write/delete, TTL expiry, latency, memory, and command errors.
- `metrics.ts` instrumentation for command latency, command failures, fallback count, fail-closed count, memory status, connection count, and key-family events.
- Alert thresholds for unavailable Valkey, high latency, command errors, memory warning/alert/critical, evictions, rejected writes, missing TTL anomalies, fallback spikes, and fail-closed spikes.

Validation:

- Health checks use non-sensitive expiring keys.
- Alerts can detect unavailable Valkey without changing runtime behavior.
- Metrics distinguish disabled, fallback, shadow, canary, and authoritative modes.

Rollback:

- Set `VALKEY_HEALTH_ENABLED=false` or `VALKEY_METRICS_ENABLED=false`.
- Existing workload behavior remains unchanged.

Exit Criteria:

- Observability is active and trusted before any production workload enters shadow mode.

### Stage 4 — Shadow Mode Framework

Objective:

- Add reusable dual-write, shadow-read, comparison, mismatch reporting, and rollout primitives.

Prerequisites:

- Stage 3 complete.
- Workload-specific comparison fields defined.

Deliverables:

- `shadow.ts` support for PostgreSQL-authoritative comparison.
- `rollout.ts` support for canary selection and traffic percentages.
- Mismatch metric taxonomy: missing key, TTL mismatch, value mismatch, decision mismatch, stale cache, atomicity mismatch, timeout, and serialization error.
- Safe diagnostic logging with redaction and sampling.

Validation:

- Shadow comparisons cannot affect user-visible decisions while PostgreSQL is authoritative.
- Mismatch logs do not contain raw secrets or sensitive identifiers.
- Shadow overhead stays within agreed latency budget.

Rollback:

- Set `VALKEY_SHADOW_MODE=false`.
- Disable workload shadow flags.

Exit Criteria:

- Shadow framework can be reused by rate limits and delivery sessions.

### Stage 5 — Rate Limits

Objective:

- Migrate rate limiting from PostgreSQL `rate_limits` rows to Valkey counters/windows.

Prerequisites:

- Stage 4 complete.
- Existing rate-limit endpoints and buckets inventoried.
- Endpoint-specific fail behavior approved.

Deliverables:

- Valkey-backed rate-limit windows with explicit TTLs.
- Hashed identifiers for IP addresses, emails, client identifiers, session-derived keys, and other sensitive bucket inputs.
- Retry-after behavior preserved.
- Shadow mode comparing PostgreSQL decisions and Valkey decisions.
- Canary rollout controls by endpoint class.
- Metrics for allow, deny, retry-after, parity, fallback, fail-closed, and command latency.

Validation:

- Unit tests verify window semantics, TTLs, hashed identifiers, and retry-after calculations.
- Integration tests verify behavior for dashboard, runtime, event, and login failure limits.
- Shadow tests show acceptable decision parity.
- Canary tests show no error-rate or latency regression.
- PostgreSQL remains authoritative until parity is accepted.

Rollback:

- Set `RATE_LIMIT_V2_MODE=postgres`.
- Set `RATE_LIMIT_V2_WRITE_POSTGRES=true` if writes had been stopped.
- Allow Valkey keys to expire naturally.

Exit Criteria:

- Valkey rate limits are authoritative for approved endpoint groups.
- No new PostgreSQL `rate_limits` rows are written for migrated endpoint groups.
- Existing PostgreSQL cleanup only drains legacy rows.
- Rollback to PostgreSQL has been tested.

### Stage 6 — Delivery Sessions

Objective:

- Move short-lived delivery-session state to Valkey while preserving runtime contracts.

Prerequisites:

- Stage 5 complete or explicitly deferred with approval.
- Delivery-session analytics decoupling design approved.
- Event and execution analytics dependencies on `delivery_sessions` identified.
- Runtime response compatibility requirements documented.

Deliverables:

- Valkey delivery session metadata keyed by hashed token or generated session ID.
- Explicit TTL matching runtime validity plus skew buffer.
- Atomic consume semantics for one-time payload fetch.
- Event secret lookup during valid session TTL.
- Replay prevention compatibility through `nonce.ts` if event nonces are included in this stage.
- Dual-write mode creating PostgreSQL and Valkey sessions while PostgreSQL remains authoritative.
- Shadow-read comparison for active sessions.
- Canary authority for a small traffic slice after parity.

Validation:

- Unit tests verify serialization, TTL, consumed-state transitions, atomic consume behavior, and redaction.
- Integration tests verify session creation, payload fetch, already-consumed behavior, expired-session behavior, invalid-token behavior, and event validation.
- Shadow tests verify Valkey metadata matches PostgreSQL metadata for active sessions.
- Canary tests verify runtime clients receive unchanged response formats.
- Analytics tests verify permanent records do not require Valkey-only temporary data.

Rollback:

- Set `DELIVERY_SESSION_V2_MODE=postgres` or `dual_write` depending on cutover point.
- Set `DELIVERY_SESSION_V2_WRITE_POSTGRES=true` before rollback if it had been disabled.
- Allow Valkey session keys to expire naturally.
- In-flight Valkey-only sessions may require clients to create new sessions; response contracts remain unchanged.

Exit Criteria:

- Future Valkey delivery-session authority is approved for the selected traffic slice.
- No new PostgreSQL `delivery_sessions` rows are written for migrated traffic after rollback validation.
- Runtime behavior and event validation remain compatible.
- Permanent analytics no longer require retaining temporary delivery-session rows for migrated traffic.

### Stage 7 — Worker Locks

Objective:

- Use Valkey locks to coordinate scheduled tasks and workers.

Prerequisites:

- Stage 3 complete.
- Worker inventory and idempotency review complete.
- Lock ownership and TTL policy approved.

Deliverables:

- Valkey lock keys for cleanup, analytics flushers, event workers, cache refreshers, and other singleton jobs.
- Owner tokens for safe release.
- TTLs and renewal policy for long-running jobs.
- Metrics for acquisition, contention, expiration, renewal, release, skipped run, and forced fallback.

Validation:

- Unit tests verify acquire, renew, release, ownership mismatch, TTL expiry, and contention semantics.
- Integration tests verify concurrent worker invocations do not process singleton work simultaneously.
- Restart tests verify locks expire and do not remain stuck.
- Worker correctness does not depend solely on Valkey locks.

Rollback:

- Set `WORKER_LOCKS_V1=false`.
- Return to previous scheduling/lease behavior.
- Existing locks expire naturally.

Exit Criteria:

- Worker contention is visible.
- Duplicate worker execution risk is reduced without weakening idempotency.
- Rollback has been validated.

### Stage 8 — Cache Layer

Objective:

- Add short-lived server-side caches for approved derived data.

Prerequisites:

- Stage 3 complete.
- Cache candidate inventory approved.
- Cross-account data isolation review complete.
- Mutation invalidation points identified.

Deliverables:

- Cache families for approved dashboard summaries, script metadata, ready build metadata, configuration snapshots, and feature/config snapshots.
- Explicit TTL per cache family.
- Mutation-driven invalidation from Server Actions, service writes, rebuilds, and admin operations.
- Metrics for hit ratio, miss ratio, set, invalidation, stale-read prevention, fallback, and command latency.

Validation:

- Unit tests verify key names, TTLs, serialization, invalidation, and user/creator scoping.
- Integration tests verify cache misses fall back to PostgreSQL/configuration.
- Security tests verify no cross-account cache leakage.
- Load tests verify reduced repeated PostgreSQL reads.

Rollback:

- Set `CACHE_V1_READS=false` first.
- Set `CACHE_V1_WRITES=false` if needed.
- Set `CACHE_V1=false` to fully disable.
- Existing cache keys expire naturally.

Exit Criteria:

- Approved cache families show useful hit ratios without correctness regressions.
- PostgreSQL reads decrease for cached paths.
- Cache invalidation is observable and tested.

### Stage 9 — Analytics Counters

Objective:

- Buffer approved temporary counters in Valkey and flush durable aggregates into PostgreSQL.

Prerequisites:

- Stage 3 complete.
- Counter inventory approved.
- Loss tolerance or reconciliation strategy documented per counter.
- Durable aggregate destination and idempotency rules approved.

Deliverables:

- Counter key families and dimensions for executions, validations, delivery attempts, rate-limit denies, cache hits/misses, and provider metrics where approved.
- Flush interval and checkpointing strategy.
- Idempotent flush semantics or documented acceptable undercount behavior.
- Metrics for increments, flush attempts, flush duration, flushed buckets, failures, retries, stale buckets, and discarded counters.

Validation:

- Unit tests verify bucket naming, TTLs, increments, serialization, and flush idempotency.
- Integration tests verify aggregate rows are durable after flush.
- Restart tests verify behavior for unflushed counters.
- Regression tests verify security/audit/financial/license records are not Valkey-only.

Rollback:

- Set `COUNTERS_V1=false` to stop new increments.
- Run final safe flush if idempotent and healthy.
- Resume previous direct PostgreSQL analytics writes or durable event path.
- Document any accepted non-critical undercount.

Exit Criteria:

- Approved counter writes reduce PostgreSQL write volume.
- Durable aggregate data remains correct within approved tolerance.
- Rollback and final-flush behavior are validated.

### Stage 10 — Cleanup Reduction And Legacy Drain

Objective:

- Reduce cleanup workload after temporary data no longer receives new PostgreSQL writes.

Prerequisites:

- Stage 5 complete for `rate_limits` cleanup reduction.
- Stage 6 complete for `delivery_sessions` cleanup reduction.
- No new PostgreSQL rows are being written for migrated workloads.

Deliverables:

- Cleanup jobs adjusted only after separate implementation approval.
- Legacy row drain plan for `rate_limits` and `delivery_sessions`.
- Documentation of which cleanup tasks remain for permanent or legacy data.

Validation:

- Cleanup duration decreases against Stage 0 baseline.
- Cleanup candidate count trends down.
- No permanent analytics or event records are lost.
- No schema removal occurs in this stage unless separately approved.

Rollback:

- Re-enable prior cleanup schedule/behavior if cleanup reduction causes backlog or missed legacy handling.
- Re-enable PostgreSQL writes for rolled-back workloads through workload flags.

Exit Criteria:

- Cleanup jobs are reduced to legacy draining or still-required permanent-data maintenance.
- Temporary-state cleanup is no longer central to database health for migrated workloads.

### Stage 11 — Infrastructure Review

Objective:

- Compare post-migration production behavior against baseline and decide whether further infrastructure work is justified.

Prerequisites:

- Stages 5 through 10 completed for approved workloads.
- Stable observation window completed.

Deliverables:

- Post-optimization report comparing database size growth, PostgreSQL reads, writes, egress, cleanup duration, API latency, runtime latency, Valkey memory, Valkey latency, evictions, errors, and rollback readiness.
- Recommendation for no further action, memory adjustment, managed Valkey evaluation, topology review, or deferred PostgreSQL schema removal.

Validation:

- Improvements are normalized by request volume.
- Valkey evictions are zero under normal load.
- Memory remains within thresholds.
- Error rates and tail latency do not regress.

Rollback:

- Infrastructure review itself has no runtime rollback.
- Workload-specific rollback remains available until approved legacy path retirement.

Exit Criteria:

- Phase 7D outcomes are measured and accepted.
- Follow-up infrastructure decisions are documented separately.

## 5. Shadow Mode Strategy

Shadow mode lets PostgreSQL and Valkey operate simultaneously while PostgreSQL remains authoritative.

### Dual Write

Dual write applies where Valkey must contain future-authoritative data while the PostgreSQL path remains the decision maker.

Required dual-write workloads:

- Rate-limit windows during initial decision parity checks, if PostgreSQL writes remain authoritative.
- Delivery sessions during rollout, where sessions are created in both PostgreSQL and Valkey.
- Analytics counters only if durable direct writes remain active until counter flushing is validated.

Dual-write rules:

- PostgreSQL errors remain authoritative while PostgreSQL mode is active.
- Valkey write failures are recorded as shadow/fallback metrics and must not change user-visible behavior during PostgreSQL-authoritative mode.
- Duplicate writes must be idempotent or harmless.
- Dual-write payloads must not include raw secrets.
- Write ordering must be defined per workload so rollback can choose the safe source.

### Shadow Read

Shadow read compares Valkey state to PostgreSQL state without using Valkey to decide the response.

Required shadow-read workloads:

- Rate-limit decision parity.
- Delivery-session metadata parity.
- Delivery-session consumed-state parity where safe.
- Cache correctness checks for selected cache families before reads are enabled.

Shadow-read rules:

- User-visible responses use the authoritative PostgreSQL path until cutover.
- Shadow mismatch metrics must include workload, endpoint group, mismatch class, and rollout stage.
- Shadow logs must use hashed identifiers and redacted values.
- Shadow reads must be sampled if full comparison causes excessive latency or cost.

### Comparison Metrics

Minimum comparison metrics:

- `valkey_shadow_compared_total`
- `valkey_shadow_match_total`
- `valkey_shadow_mismatch_total`
- `valkey_shadow_mismatch_by_reason`
- `valkey_shadow_missing_key_total`
- `valkey_shadow_extra_key_total`
- `valkey_shadow_decision_mismatch_total`
- `valkey_shadow_ttl_mismatch_total`
- `valkey_shadow_latency_ms`

Comparison dimensions:

- Workload.
- Endpoint group.
- Environment.
- Authority mode.
- Canary percentage.
- Error class.

### Authority Switching

Authority may switch from PostgreSQL to Valkey only after:

- Stage-specific prerequisites are complete.
- Shadow parity has been accepted.
- Metrics and alerts are active.
- Rollback has been tested.
- Security review confirms failure behavior.
- Canary traffic has completed without unacceptable mismatch, latency, or error-rate regression.

Authority switch sequence:

1. PostgreSQL authoritative, Valkey disabled.
2. PostgreSQL authoritative, Valkey dual-write/shadow-read.
3. PostgreSQL authoritative, Valkey canary decision calculated but not enforced.
4. Valkey authoritative for a small eligible traffic slice.
5. Valkey authoritative for expanded endpoint groups.
6. Valkey authoritative for all approved traffic.
7. PostgreSQL writes disabled only after rollback validation.
8. Legacy rows drained.
9. Table removal considered only through a separate approved migration.

### Traffic Rollout

Traffic rollout should use stable, non-sensitive selection inputs, such as server-side generated request grouping or hashed stable identifiers. Rollout must not trust client-provided ownership claims.

Recommended canary progression:

- 0%: shadow only.
- 1%: low-risk traffic.
- 5%: low-risk traffic plus selected runtime paths.
- 25%: broader endpoint coverage.
- 50%: production validation under meaningful load.
- 100%: full approved workload authority.

Each increase requires metrics review.

### Rollback Triggers

Rollback must be triggered or strongly considered when any of the following occur:

- Valkey unavailable beyond the approved incident threshold.
- Command timeout rate exceeds the approved threshold.
- Memory reaches critical threshold.
- Any eviction occurs for security-sensitive key families.
- Rate-limit deny/allow mismatch exceeds accepted tolerance.
- Runtime session creation or consumption errors increase above accepted tolerance.
- Runtime response contract regression is detected.
- Cross-account cache leakage is suspected.
- Raw secret exposure is suspected.
- PostgreSQL fallback spikes unexpectedly.
- P95 or P99 latency regresses beyond accepted threshold.
- Counter flush failures risk unacceptable analytics loss.

## 6. Testing Strategy

Testing must be staged and workload-specific. No stage can be considered complete without tests appropriate to its authority level.

### Unit Tests

Unit tests must verify:

- Namespace generation and environment isolation.
- Sensitive identifier hashing rules.
- TTL selection and required TTL enforcement.
- Serialization and version handling.
- Feature flag parsing and invalid-combination handling.
- Error classification into fallback, fail closed, fail open, or degrade gracefully.
- Rate-limit counter/window behavior.
- Delivery-session token-hash lookup and atomic consume semantics.
- Lock acquire, renew, release, owner mismatch, and expiry behavior.
- Cache key scoping, invalidation helpers, and stale prevention.
- Counter bucket naming, increments, flush idempotency, and expiry.
- Redaction utilities for logs and metrics labels.

### Integration Tests

Integration tests must verify:

- Application startup with Valkey disabled.
- Application startup with Valkey enabled but workloads disabled.
- Valkey connection failure handling.
- Health check read/write/delete/TTL behavior.
- Rate-limit decisions across dashboard, runtime, event, and login failure buckets.
- Delivery session creation, fetch, consume, expiry, invalid token, duplicate consume, and event validation.
- Worker lock behavior under concurrent invocations.
- Cache miss fallback to PostgreSQL/configuration.
- Cache invalidation after Server Actions, service mutations, rebuilds, and admin operations.
- Counter flush into durable PostgreSQL aggregates.
- Legacy PostgreSQL fallback remains functional during rollout.

### Load Tests

Load tests must verify:

- Valkey command latency under expected and peak request volume.
- PostgreSQL write reduction for migrated workloads.
- PostgreSQL read reduction for cached or Valkey-authoritative paths.
- Memory usage and key cardinality at expected TTLs.
- No evictions under normal expected load.
- Rate-limit behavior remains stable under abuse-like bursts.
- Delivery-session creation and consumption P95/P99 latency do not regress.
- Worker lock contention remains within expected scheduling patterns.
- Counter flush duration and backlog remain within approved limits.

### Shadow Tests

Shadow tests must verify:

- PostgreSQL remains authoritative while shadow mode is active.
- Valkey shadow writes do not change responses.
- Comparison metrics are emitted correctly.
- Mismatches are classified accurately.
- Sensitive values are not logged.
- Shadow overhead remains within the approved latency budget.
- Shadow parity is high enough for canary authority.

### Canary Tests

Canary tests must verify:

- Traffic selection is stable and safe.
- Only eligible traffic uses Valkey authority.
- Error rate, latency, and decision metrics remain acceptable.
- Rollback to PostgreSQL can be completed without deployment rollback.
- In-flight sessions have documented behavior during rollback.
- Alerts fire for injected or observed failures.

### Production Validation

Production validation must verify:

- Metrics compare favorably against Stage 0 baseline.
- No runtime or dashboard contract regressions are observed.
- PostgreSQL writes stop for migrated temporary workloads.
- Cleanup backlog decreases after legacy drain.
- Valkey memory remains below warning/alert thresholds.
- Evictions remain zero under normal production load.
- Fallback and fail-closed counts are normal and explainable.
- Security logging remains redacted.
- Rollback remains available until legacy path retirement is separately approved.

### Regression Tests

Regression tests must verify:

- Supabase Auth remains canonical for dashboard identity.
- `creator_id` and ownership remain server-derived.
- Runtime API response formats are unchanged.
- Existing key validation and device limit behavior remains compatible.
- No permanent product, license, purchase, audit, or durable analytics state becomes Valkey-only.
- Existing cleanup, event, and analytics behavior remains correct for non-migrated paths.

## 7. Observability

Observability must be implemented before any Valkey authority cutover.

Required infrastructure metrics:

| Metric | Purpose |
|---|---|
| Valkey availability | Detect unavailable service or failed health checks. |
| Valkey command latency average/P95/P99 | Detect slow commands and tail latency regressions. |
| Valkey command failures | Detect errors, rejected writes, timeouts, auth failures, and serialization failures. |
| Valkey memory used | Track capacity and growth. |
| Valkey memory fragmentation | Detect memory inefficiency and restart/scaling needs. |
| Valkey configured memory limit | Compare usage against thresholds. |
| Valkey evictions | Must remain zero under normal operation. |
| Valkey expirations | Confirm TTL-driven lifecycle. |
| Valkey connection count | Detect leaks, reconnect storms, and unexpected client growth. |
| Valkey rejected writes | Detect OOM or policy failures. |
| Valkey CPU and host memory | Track infrastructure pressure. |
| Valkey persistence status | Required if RDB/AOF is enabled later. |

Required application metrics:

| Metric | Purpose |
|---|---|
| `valkey_command_latency_ms` | Command latency by workload and command group. |
| `valkey_command_error_total` | Command failures by workload and error class. |
| `valkey_fallback_total` | PostgreSQL fallback activation count. |
| `valkey_fail_closed_total` | Protected requests rejected because no safe backend was available. |
| `valkey_shadow_mismatch_total` | Shadow parity tracking. |
| `valkey_ttl_missing_total` | Detect keys unexpectedly missing TTL. |
| `rate_limit_decision_total` | Allow/deny decisions by backend authority. |
| `rate_limit_retry_after_ms` | Retry-after behavior and parity. |
| `delivery_session_created_total` | Session creation by backend authority. |
| `delivery_session_consumed_total` | Successful one-time consumption by backend authority. |
| `delivery_session_consume_rejected_total` | Expired, invalid, duplicate, or mismatched consume attempts. |
| `event_nonce_accepted_total` | Event replay-prevention accepted nonce count. |
| `event_nonce_rejected_total` | Replay or invalid nonce rejection count. |
| `cache_hit_total` | Cache hits by cache family. |
| `cache_miss_total` | Cache misses by cache family. |
| `cache_set_total` | Cache writes by cache family. |
| `cache_invalidation_total` | Invalidation count and source. |
| `counter_increment_total` | Counter increments by metric family. |
| `counter_flush_total` | Successful flush count. |
| `counter_flush_failed_total` | Failed flush count. |
| `counter_flush_duration_ms` | Flush duration and backlog pressure. |
| `worker_lock_acquired_total` | Successful worker lock acquisition. |
| `worker_lock_contention_total` | Lock contention events. |
| `worker_lock_expired_total` | Locks that expired before release or renewal. |
| `worker_lock_release_failed_total` | Failed release attempts, including owner mismatch. |

Required dashboards or reporting views:

- Valkey health overview.
- Valkey memory and eviction overview.
- Command latency and error overview.
- Workload authority mode overview.
- Rate-limit parity and decision overview.
- Delivery-session creation/consume overview.
- Cache hit/miss and invalidation overview.
- Worker lock contention overview.
- Counter flush and backlog overview.
- PostgreSQL read/write/storage/egress comparison against Stage 0 baseline.

Required alerts:

- Valkey unavailable.
- Sustained high command latency.
- Sustained command error rate.
- Memory warning, alert, and critical thresholds.
- Any eviction under normal operation.
- Rejected writes.
- Missing TTL anomaly.
- Fallback spike.
- Fail-closed spike.
- Shadow mismatch spike.
- Runtime session error spike.
- Counter flush backlog or repeated failure.
- Worker lock contention spike.

## 8. Failure Matrix

Each subsystem must define expected behavior, recovery, and rollback before authority cutover.

### Global Valkey

| Failure | Expected Behavior | Recovery | Rollback |
|---|---|---|---|
| Valkey unavailable | Protected paths fail closed or use approved PostgreSQL fallback; cache paths degrade to PostgreSQL/configuration; optional counters pause or use durable path. | Restore Valkey service, verify health, inspect fallback/fail-closed metrics. | Set `VALKEY_ENABLED=false` and workload modes to PostgreSQL/disabled. |
| Network timeout | Requests use bounded timeout and then follow workload failure mode. | Investigate network, host load, client timeout, and command latency. | Disable Valkey or reduce canary percentage to `0`. |
| Authentication failure | Valkey commands fail; protected paths fail closed or fall back. | Rotate/fix credentials through approved secret process; verify no credential leak. | Set `VALKEY_ENABLED=false`. |
| Memory exhausted | Writes may fail or evictions may occur; non-critical caches/counters disabled first. | Reduce cache/counter coverage, shorten safe TTLs, increase memory through approved infra process. | Disable `CACHE_V1`, `COUNTERS_V1`, then workload flags as needed. |
| Unexpected eviction | Treat as incident, especially for rate/session/nonce keys. | Identify key family, memory pressure, TTL defects, and eviction policy. | Roll back affected workloads to PostgreSQL or fail closed. |
| Restart | Cache and temporary state may be lost; sessions may need retry; locks expire; counters follow documented loss/flush behavior. | Verify health, reconnects, memory, errors, and workload metrics. | Disable affected workload flags if recovery is unstable. |
| Connection leak | Connection count grows unexpectedly; latency or resource use may degrade. | Inspect client lifecycle and process behavior; restart app only if necessary. | Disable Valkey use until leak is fixed. |
| Corrupted persistence | If persistence is enabled later, loaded state may be unsafe. | Start from clean temporary state if approved; validate all workloads. | Disable Valkey, discard temporary state, fall back to PostgreSQL where available. |
| Missing TTL defect | Keys may accumulate and cause memory growth. | Identify key family, fix TTL assignment, delete safe temporary keys if approved. | Disable affected workload flag. |

### Rate Limits

| Failure | Expected Behavior | Recovery | Rollback |
|---|---|---|---|
| Valkey unavailable | Auth/abuse-sensitive endpoints fail closed or use PostgreSQL fallback; low-risk endpoints follow approved policy. | Restore Valkey and verify decision metrics. | Set `RATE_LIMIT_V2_MODE=postgres`. |
| Decision mismatch | PostgreSQL remains authoritative in shadow; canary rollout pauses if Valkey authoritative. | Inspect window semantics, TTL, identifier hashing, and clock behavior. | Return canary to `0` and set mode to `postgres`. |
| TTL too short | Requests may be under-limited or windows reset early. | Correct TTL and monitor parity. | PostgreSQL mode. |
| TTL too long | Users may be over-limited and memory grows. | Correct TTL and allow bad keys to expire or delete safe keys through runbook. | PostgreSQL mode. |
| Identifier hashing bug | Buckets may collide or split incorrectly. | Fix hashing and invalidate affected keys if safe. | PostgreSQL mode. |

### Delivery Sessions

| Failure | Expected Behavior | Recovery | Rollback |
|---|---|---|---|
| Valkey unavailable | Session creation/fetch uses PostgreSQL fallback during rollout or fails safely after fallback retirement. | Restore Valkey; verify session creation and consume metrics. | Set `DELIVERY_SESSION_V2_MODE=postgres` and `DELIVERY_SESSION_V2_WRITE_POSTGRES=true`. |
| Atomic consume failure | Duplicate consume could be incorrectly accepted or valid consume rejected. | Stop canary, inspect command semantics and tests. | PostgreSQL mode. |
| Session TTL too short | Runtime clients may see expired sessions and retry. | Adjust TTL and validate runtime latency/skew assumptions. | PostgreSQL mode. |
| Session TTL too long | Memory grows and replay window may be wider than intended. | Shorten TTL and monitor memory/security metrics. | PostgreSQL mode. |
| Event secret missing | Runtime event validation fails safely. | Inspect session creation, serialization, and TTL. | PostgreSQL event/session path if available; otherwise fail closed. |
| In-flight Valkey-only state lost | Affected clients retry session creation; permanent data remains safe. | Restore service; validate retry behavior. | PostgreSQL mode for new sessions. |

### Worker Locks

| Failure | Expected Behavior | Recovery | Rollback |
|---|---|---|---|
| Lock acquisition timeout | Worker skips or follows approved degraded behavior. | Inspect Valkey latency and worker schedule. | Set `WORKER_LOCKS_V1=false`. |
| Lock expires during job | Another worker may acquire; idempotency must prevent corruption. | Tune TTL/renewal; inspect long-running job behavior. | Disable locks and use prior behavior. |
| Owner mismatch on release | Lock is not released by non-owner and expires naturally. | Inspect owner token lifecycle. | Disable locks if repeated. |
| Valkey restart | Locks disappear; workers may run next scheduled cycle. | Verify idempotency and schedule health. | Disable locks. |

### Cache

| Failure | Expected Behavior | Recovery | Rollback |
|---|---|---|---|
| Cache unavailable | Read PostgreSQL/configuration directly. | Restore Valkey; cache repopulates on misses. | Set `CACHE_V1=false`. |
| Corrupted cache value | Treat as miss, delete bad key if safe, and read authoritative source. | Fix serialization or invalidation defect. | Disable cache reads with `CACHE_V1_READS=false`. |
| Stale cache | Invalidate and reduce TTL if needed. | Fix mutation invalidation source. | Disable reads. |
| Cross-account cache leakage suspected | Treat as security incident; immediately disable cache reads. | Investigate key scoping, authorization, logs, and affected data. | Set `CACHE_V1_READS=false` and possibly `CACHE_V1=false`. |
| Unexpected eviction | Cache miss rate increases; correctness preserved. | Review memory and cache size. | Disable non-critical cache families. |

### Counters

| Failure | Expected Behavior | Recovery | Rollback |
|---|---|---|---|
| Counter increment fails | Use durable path if configured or record accepted non-critical loss. | Restore Valkey; inspect command errors. | Set `COUNTERS_V1=false`. |
| Flush fails | Counters remain until TTL if possible; retry within recovery buffer. | Fix PostgreSQL/worker issue and retry idempotent flush. | Resume direct PostgreSQL writes; final flush if safe. |
| Flush duplicates | Idempotency must prevent double-counted durable aggregates. | Inspect checkpoint and aggregate constraints. | Disable flush and use durable direct path. |
| Valkey restart loses unflushed counters | Loss follows per-counter tolerance; durable audit/event records remain intact. | Document undercount if accepted; restore direct writes if unacceptable. | Set `COUNTERS_V1=false`. |

## 9. Security Requirements

### Authentication

- Valkey must require authentication in all non-local environments.
- Valkey credentials must be provided through approved environment/secret handling, never hard-coded.
- Credential rotation must be documented before production authority cutover.
- Health checks must validate authentication without exposing credentials.

### Authorization

- Browsers, Roblox runtime clients, external clients, and third-party providers must never connect directly to Valkey.
- All Valkey access must occur server-side through the application or approved worker context.
- Supabase Auth remains canonical for dashboard user identity.
- `creator_id` and ownership remain server-derived from existing session/ownership logic.
- Valkey cache reads must never bypass PostgreSQL-backed ownership checks unless the cached value is already scoped by an authorized server-derived identity.

### Key Naming

- Key names must follow `luxyhub:{environment}:{workload}:{identifier}`.
- Production, preview/staging, and local keys must never share prefixes.
- Workload names must be lowercase and stable.
- Key names must not include raw emails, raw IP addresses, raw session tokens, raw license keys, raw event secrets, raw provider IDs if sensitive, access tokens, service-role keys, or provider credentials.
- Key names must use hashed or server-generated identifiers for sensitive values.
- Key names must be compact and must not include large payloads.

### Hashing

- Sensitive identifiers must be normalized before hashing.
- Hashing must use an approved server-side secret or approved one-way strategy where needed to prevent offline enumeration.
- Hash outputs used in keys must be deterministic for the required TTL/window.
- Raw values must not be logged before or after hashing.
- Hashing rules must be unit-tested for stability and redaction.

### Secret Handling

- No raw secrets may be stored inside Valkey.
- Raw session tokens must not be stored; only token hashes or server-generated opaque IDs are allowed.
- Raw license keys must not be stored.
- Event secrets must not appear in key names or logs; if temporary event validation material is stored in values, it must be minimized, TTL-bound, and protected by server-only Valkey access.
- Supabase service-role keys, provider credentials, webhook secrets, and access tokens must never be stored in Valkey.
- Runtime payload ciphertext must not be cached unless a separate secure-delivery design approves it.

### Logging Policy

- Logs must use redacted values and hashed identifiers.
- Shadow mismatch logs must be sampled and must not include raw values.
- Valkey command errors must not dump command arguments if they can contain sensitive data.
- Security-sensitive failures must include enough metadata for incident response without exposing secrets.
- Access to logs containing hashed operational identifiers must follow existing production log access controls.

### Environment Isolation

- Production, preview/staging, and local environments must use separate namespaces.
- Production Valkey must not be reachable from local development or public networks.
- Preview/staging must not reuse production credentials or production key prefixes.
- Local development must default to Valkey disabled unless explicitly configured.

### Sensitive Data Rules

- Permanent data must not be Valkey-only.
- Financial, purchase, license, audit, ownership, script source, and durable analytics data remain PostgreSQL-backed.
- Cache values must be scoped by creator/user/script where needed to prevent cross-account leakage.
- All temporary keys require TTLs unless an exception is explicitly documented and reviewed.
- Fail-closed behavior is required for protected paths when no approved fallback exists.

## 10. Performance Expectations

Expected PostgreSQL write reductions:

- No new `rate_limits` rows after rate-limit migration is fully enabled.
- No new `delivery_sessions` rows after delivery-session migration is fully enabled and rollback has been validated.
- Fewer worker lease/lock writes if prior coordination used PostgreSQL.
- Fewer per-event counter writes after approved counters are buffered and flushed as aggregates.

Expected PostgreSQL read reductions:

- Fewer rate-limit count queries.
- Fewer delivery-session token lookups and consume reads.
- Fewer repeated dashboard summary reads after cache adoption.
- Fewer repeated script metadata and ready build metadata reads where cache families are approved.

Expected Supabase egress reductions:

- Lower response volume from count and lookup queries.
- Lower cleanup query result volume.
- Lower repeated metadata read volume.
- Lower per-event analytics write/read amplification after counter aggregation.

Expected cleanup improvements:

- Rate-limit cleanup becomes legacy drain only after `rate_limits` receives no new rows.
- Delivery-session cleanup becomes legacy drain only after `delivery_sessions` receives no new rows and permanent analytics are decoupled.
- Cleanup duration and cleanup candidate count decrease against Stage 0 baseline.
- Database health depends less on scheduled deletion of expired temporary rows.

Expected storage improvements:

- `rate_limits` table growth stops after full rate-limit cutover.
- `delivery_sessions` table growth stops after full delivery-session cutover.
- Temporary-data index growth stops after new writes stop.
- Overall Supabase storage growth better reflects permanent product data rather than request volume.

Expected latency improvements:

- Rate-limit decisions should be same or faster, especially at P95/P99.
- Delivery-session validation should be same or faster after Valkey authority, excluding network outliers.
- Cacheable dashboard/runtime metadata reads should improve when cache hit ratio is meaningful.
- Tail latency must not regress beyond approved thresholds.

Measurement requirements:

- Compare every stage against Stage 0 baseline and the immediately previous stage.
- Normalize by request volume.
- Track average, P95, and P99.
- Treat lower PostgreSQL load with unstable Valkey metrics as incomplete success.
- Treat improved latency without reduced PostgreSQL storage/write pressure as incomplete success for Phase 7D.

## 11. Acceptance Criteria

Each stage must satisfy functional, performance, operational, security, and rollback success before advancing.

| Stage | Functional Success | Performance Success | Operational Success | Security Success | Rollback Success |
|---|---|---|---|---|---|
| Stage 0 — Baseline | Baseline report captures required metrics. | Baseline includes normalized latency and DB cost. | Metrics sources and owners identified. | No sensitive data added to reports. | Re-measurement plan exists if data is invalid. |
| Stage 1 — Infrastructure | Valkey dependency exists or is prepared without workload migration. | No application latency change from disabled dependency. | Access, memory, persistence, logs, and owners documented. | Public access blocked; auth required. | `VALKEY_ENABLED=false` preserves current behavior. |
| Stage 2 — Connection Layer | App can initialize Valkey boundary safely. | Bounded timeouts prevent request hangs. | Invalid config is detected. | Secrets are environment-based and not logged. | Disabling global flag returns to current behavior. |
| Stage 3 — Health/Observability | Health and metrics report Valkey state. | Health probes stay within latency budget. | Alerts and dashboards exist. | Health keys are non-sensitive and expiring. | Health/metrics can be disabled independently. |
| Stage 4 — Shadow Framework | Shadow comparisons do not affect responses. | Shadow overhead is acceptable. | Mismatch taxonomy is observable. | Logs are redacted and sampled. | Shadow mode can be disabled immediately. |
| Stage 5 — Rate Limits | Valkey decisions preserve limits and retry-after behavior. | PostgreSQL rate-limit writes/count reads decrease after cutover. | Allow/deny/fallback/fail-closed metrics are stable. | Sensitive bucket identifiers are hashed. | PostgreSQL authority can be restored. |
| Stage 6 — Delivery Sessions | Runtime session create/fetch/event behavior remains compatible. | Session lookup/consume latency is same or improved. | Creation/consume/error metrics are stable. | Raw tokens are not stored; protected failures are safe. | PostgreSQL session path can be restored while retained. |
| Stage 7 — Worker Locks | Workers coordinate with TTL owner-token locks. | Duplicate work and lock contention are reduced or visible. | Lock metrics and skip behavior are understood. | Lock keys expose no sensitive data. | Prior worker behavior can be restored. |
| Stage 8 — Cache | Approved cache families return correct authorized data. | PostgreSQL reads decrease on cached paths. | Hit/miss/invalidation metrics justify cache use. | No cross-account leakage or secret caching. | Cache reads/writes can be disabled. |
| Stage 9 — Counters | Approved counters flush durable aggregates correctly. | PostgreSQL per-event writes decrease. | Flush backlog and failures are observable. | No audit/financial/license data is Valkey-only. | Direct durable writes can resume. |
| Stage 10 — Cleanup Reduction | Legacy cleanup drains remaining temporary rows safely. | Cleanup duration and candidates decrease. | Remaining cleanup duties are documented. | Permanent analytics/events are preserved. | Prior cleanup behavior can be restored. |
| Stage 11 — Infrastructure Review | Post-migration report is complete. | Improvements are proven against baseline. | Follow-up recommendations are documented. | Security incidents or gaps are resolved. | Workload rollback remains available until retirement approval. |

## 12. Definition Of Done

Original full-migration definition of done is broader than the current Phase 7D production baseline. Current Phase 7D/7E.1 completion means Valkey infrastructure, shadow comparison, monitoring, health reporting, rollback, and canary infrastructure are complete while PostgreSQL remains authoritative. The checklist below remains a long-term target for future workload cutovers and PostgreSQL temporary-table removal.

Full temporary-data migration is complete only when all of the following are true:

- Phase 7D.0 baseline report exists and was used for every post-stage comparison.
- Valkey connection layer, health checks, metrics, namespacing, TTL governance, and key-family registry are implemented and validated in a later approved implementation phase.
- All enabled Valkey workloads are behind documented feature flags with default-safe behavior.
- Rollback has been validated for every migrated workload.
- No new PostgreSQL `rate_limits` rows are written for fully migrated rate-limit traffic.
- No new PostgreSQL `delivery_sessions` rows are written for fully migrated delivery-session traffic after rollback validation.
- PostgreSQL remains authoritative for users, profiles, ownership, scripts, versions, builds, keys, licenses, purchases, durable analytics, audit logs, and permanent event history.
- Runtime API contracts remain compatible with existing clients.
- Dashboard behavior remains compatible with existing users.
- Supabase Auth remains canonical for dashboard identity.
- No raw secrets, raw tokens, raw license keys, raw emails, raw IP addresses, service-role credentials, provider credentials, or sensitive payloads are stored in Valkey or exposed in logs.
- Every temporary Valkey key family has an explicit TTL.
- Production, preview/staging, and local environments use isolated namespaces and credentials.
- Valkey memory remains within approved thresholds during a stable production observation window.
- Valkey eviction count remains zero under normal production load.
- Valkey command latency and error rates remain within approved thresholds.
- PostgreSQL writes decrease for migrated temporary workloads.
- PostgreSQL reads decrease for migrated lookup/cacheable workloads where applicable.
- Supabase egress decreases for migrated count, lookup, cleanup, and repeated metadata paths where applicable.
- Cleanup duration and cleanup candidate counts decrease for migrated temporary workloads.
- Counter flush behavior is stable, idempotent where required, and does not risk permanent audit, financial, license, or security data.
- Cache hit ratios and invalidation behavior are measured for every cache family introduced.
- Worker lock contention, skipped runs, and lock expiry are observable.
- Regression testing confirms no ownership, auth, runtime, key validation, device limit, analytics, or cleanup regressions.
- Documentation is updated with final rollout behavior, runbooks, metrics, flags, key registry, TTL policy, rollback procedures, and any accepted residual risks.
- Any PostgreSQL schema removal or table removal is deferred to a separate approved migration after Phase 7D production validation.
- Post-Optimization Infrastructure Review is complete and documents whether further Valkey, Supabase, or infrastructure work is justified.

## Phase Boundary

This specification was documentation only at creation time. Current Phase 7D/7E.1 implementation completed the production baseline and observability/canary infrastructure without schema changes, migrations, cleanup changes, PostgreSQL authority removal, or production canary enablement. Further authority changes require Phase 7E.2 rollout approval.
