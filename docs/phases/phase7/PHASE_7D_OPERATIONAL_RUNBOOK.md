# Phase 7D — Valkey Operational Runbook

Status: Active for Phase 7D production baseline and Phase 7E.1 production-verified observability
Date: 2026-06-24
Scope: Production operations runbook for current shadow-mode baseline and future canary stages
Related documents:

- `PHASE_7D_VALKEY_INTEGRATION_PLAN.md`
- `PHASE_7D_IMPLEMENTATION_SPEC.md`

This runbook describes how Phase 7D/7E.1 is operated in production. It is not an implementation guide and does not authorize code changes, package installation, migrations, schema changes, infrastructure changes, runtime behavior changes, Valkey authority, or production canary enablement.

Phase 7D operational posture is based on one rule: PostgreSQL remains authoritative for permanent application data and current rate-limit decisions. Valkey participates in rate-limit shadow comparison only in the current production baseline. Other temporary runtime state, locks, caches, nonces, and aggregation buffers remain future Valkey workloads unless separately implemented and approved.

## Current Production State

| Area | Current State |
|---|---|
| Runtime mode | `RATE_LIMIT_MODE=shadow` |
| PostgreSQL | Authoritative source of truth and rate-limit backend. |
| Valkey | Shadow comparison backend for rate limits. |
| Canary | Disabled; Phase 7E.2 planned for separately approved 1% production canary. |
| Rollback | Set `RATE_LIMIT_MODE=postgres` and restart the application process. |
| Schema/migrations | No Phase 7D/7E.1 schema changes. |
| Cleanup | Existing cleanup behavior unchanged. |
| Health | Healthy. |
| Backend failures | 0. |
| Comparison failures | 0. |
| Parity | 100%. |
| Mismatch rate | 0. |

Current operational architecture:

```text
Client
  ↓
Cloudflare
  ↓
Next.js API
  ↓
Rate-limit evaluation (`RATE_LIMIT_MODE=shadow`)
  ├─ PostgreSQL authoritative decision returned to caller
  └─ Valkey shadow comparison for parity and health metrics
```

Primary operational endpoints:

- `/api/health`: overall production health endpoint with `summary`, `postgres`, `valkey`, `rateLimit`, `rollout`, `performance`, `runtime`, and `notes`.
- `/api/internal/rate-limit-shadow`: admin-only shadow monitoring endpoint with parity, comparison metrics, rollout metrics, Valkey health, and runtime metadata.

## Cloudflare Deployment Requirements

Production deployments behind Cloudflare must preserve the real client IP at both the application and infrastructure layers.

Application client IP priority order:

1. `CF-Connecting-IP`
2. `X-Vercel-Forwarded-For`
3. `X-Forwarded-For`
4. `X-Real-IP`
5. `127.0.0.1` fallback

Application behavior requirements:

- Trim whitespace.
- Ignore empty values.
- Return only a single IP.
- For comma-separated forwarded headers, use the first non-empty trimmed IP.

Infrastructure requirements for nginx deployments behind Cloudflare:

- Enable `real_ip_header CF-Connecting-IP`.
- Enable `real_ip_recursive on`.
- Configure Cloudflare trusted proxy ranges with `set_real_ip_from`.

Incorrect Cloudflare Real IP configuration causes:

- Incorrect rate limiting.
- Incorrect analytics.
- Incorrect abuse detection.
- Incorrect audit logs.

Resolved production incident:

- Issue: production requests were bucketed by Cloudflare proxy IPs rather than the real client IP.
- Application root cause: `getClientIP()` did not prioritize `CF-Connecting-IP` and selected the last value from `X-Forwarded-For`.
- Infrastructure root cause: nginx did not restore Cloudflare Real IP.
- Resolution: application client IP priority was corrected and nginx Cloudflare Real IP support was enabled.
- Result: rate limiting now groups requests by real client IP, and production verification confirmed HTTP 429 after exceeding the configured request limit.

Current migration KPIs:

- Mismatch rate.
- Backend failures.
- Comparison failures.
- Fallback count.
- PostgreSQL authoritative writes.
- Valkey authoritative writes.
- PostgreSQL versus Valkey latency comparison.
- Valkey memory, reconnects, and evictions.

## 1. Operational Responsibilities

Every production deployment must have assigned owners before any Phase 7D workload becomes Valkey-authoritative.

| Area | Primary Responsibility | Operational Duties | Escalates To |
|---|---|---|---|
| Application | Own Next.js runtime behavior, feature flags, fallback paths, and API compatibility. | Validate deployments, verify flags, monitor runtime errors, review Valkey fallback/fail-closed metrics, confirm runtime/dashboard contracts. | Incident response lead and release manager. |
| Infrastructure | Own VPS or managed service environment, network access, host resources, process supervision, and service availability. | Maintain Valkey host/service, network rules, CPU/RAM/disk monitoring, restart procedures, and capacity signals. | Incident response lead. |
| Database | Own Supabase PostgreSQL health, permanent data integrity, storage growth, database egress, and legacy table drain visibility. | Monitor reads, writes, table growth, index growth, cleanup workload, backup posture, and durable analytics integrity. | Application owner and incident response lead. |
| Valkey | Own temporary data platform health, memory, latency, connection count, TTL behavior, key-family growth, and eviction response. | Monitor Valkey dashboards, investigate command failures, review memory/key counts, validate TTLs, coordinate restarts and upgrades. | Infrastructure owner and incident response lead. |
| Monitoring | Own dashboards, alerts, metric availability, alert routing, and operational reporting. | Confirm metrics are emitted, alerts are actionable, dashboards are accurate, and baseline comparisons are available. | Incident response lead. |
| Incident Response | Own incident coordination, severity assignment, communication, mitigation decisions, rollback decisions, and post-incident review. | Run playbooks, coordinate owners, preserve evidence, decide rollback, document timeline, track follow-ups. | Business/engineering leadership if severe. |
| Backups | Own PostgreSQL backup validation and any optional Valkey persistence/snapshot policy. | Verify PostgreSQL backup health, define whether Valkey persistence is enabled, ensure temporary snapshots do not contain prohibited data. | Database owner and security reviewer. |
| Maintenance | Own recurring health reviews, version reviews, security updates, capacity reviews, and runbook updates. | Schedule maintenance windows, review monthly metrics, validate rollback readiness, update documentation after changes. | Release manager. |
| Security | Own access control, secret handling, logging policy, environment isolation, sensitive data rules, and incident review. | Review Valkey exposure, credential rotation, redaction, key naming, hashing, cross-account cache isolation, and fail-closed behavior. | Incident response lead and application owner. |
| Release Management | Own production rollout sequence, stage gates, canary progression, and acceptance before proceeding. | Confirm deployment checklist, freeze conditions, rollback switches, post-deployment validation, and stage approval. | Incident response lead during incidents. |

Responsibility rules:

- One named person or rotation must be assigned for each area before production cutover.
- The incident response lead owns coordination, but subsystem owners own diagnosis and recovery of their domain.
- Rollback authority must be explicit before deployment begins.
- Security-sensitive rollback decisions must preserve fail-closed or PostgreSQL fallback behavior.
- Documentation updates are part of operational ownership, not optional cleanup.

## 2. Deployment Checklist

This checklist describes the production deployment sequence after Phase 7D is implemented and approved for release. It must be executed per migration stage and repeated when a workload moves from shadow to canary or canary to authoritative mode.

### Pre-Deployment Validation

- Confirm the target stage has approved implementation, tests, and review.
- Confirm Phase 7D baseline metrics exist for comparison.
- Confirm current production dashboards are healthy before change.
- Confirm no active incidents affect application, database, Valkey, workers, or networking.
- Confirm PostgreSQL backups are healthy for permanent data.
- Confirm Valkey is reachable only from approved application/worker contexts.
- Confirm Valkey authentication is active in production.
- Confirm production, preview/staging, and local namespaces are isolated.
- Confirm no raw secrets are present in planned key names, metric labels, logs, or values.
- Confirm all enabled key families have explicit TTLs.
- Confirm alert routing reaches the responsible operators.

### Baseline Metrics

Record current values before deployment:

- API error rate.
- API latency average, P95, and P99.
- Runtime delivery latency average, P95, and P99.
- PostgreSQL reads, writes, storage growth, and egress.
- `rate_limits` and `delivery_sessions` row growth if relevant to the stage.
- Cleanup duration and cleanup candidate count.
- Valkey memory usage, command latency, command failures, connection count, expirations, and evictions.
- Worker success/failure and lock contention.
- Fallback, fail-closed, and shadow mismatch counts.

### Feature Flag Verification

- Confirm `VALKEY_ENABLED` intended value.
- Confirm workload mode flags match the deployment stage.
- Confirm canary percentage is expected.
- Confirm write-back/fallback flags are safe for rollback.
- Confirm cache read/write flags are staged separately where applicable.
- Confirm counter flush flags are enabled only after counter increment behavior is validated.
- Confirm invalid flag combinations fail safe or are blocked before deploy.

### Health Verification

- Confirm application health endpoint is healthy.
- Confirm Valkey health check passes connectivity, authentication, latency, safe read/write/delete, and TTL verification.
- Confirm PostgreSQL health is normal.
- Confirm worker health is normal.
- Confirm dashboards are receiving fresh metrics.
- Confirm alerting is not muted unless explicitly approved for maintenance.

### Rollback Preparation

- Confirm rollback owner is present or on call.
- Confirm exact rollback flags for the workload.
- Confirm legacy PostgreSQL path is still available if required for the stage.
- Confirm PostgreSQL writes are still enabled when rollback requires newly created records to exist in PostgreSQL.
- Confirm final-flush procedure exists for counters if needed.
- Confirm rollback verification metrics are known.

### Deployment Execution

- Deploy application changes using the approved release process.
- Keep canary percentage at `0` until health checks pass.
- Enable shadow or dual-write mode before authoritative mode.
- Observe metrics for the approved stabilization window.
- Increase canary only after stage-specific acceptance criteria are met.
- Do not disable PostgreSQL writes until rollback has been validated.

### Post-Deployment Validation

- Confirm API and runtime error rates remain within thresholds.
- Confirm P95/P99 latency does not regress.
- Confirm Valkey command latency and errors remain healthy.
- Confirm memory usage is stable and below thresholds.
- Confirm evictions remain zero.
- Confirm shadow mismatch rate is acceptable before canary authority.
- Confirm PostgreSQL read/write reduction appears only when expected for the stage.
- Confirm runtime and dashboard contracts remain unchanged.
- Confirm logs contain no raw secrets or sensitive identifiers.

### Success Confirmation

- Record final stage metrics.
- Compare against pre-deployment values and Phase 7D baseline.
- Document any anomalies and accepted risks.
- Confirm rollback remains available until the stage is fully accepted.
- Obtain stage acceptance before proceeding to the next migration stage.

## 3. Startup Procedure

Expected startup order:

```text
PostgreSQL / Supabase Auth
  ↓
Valkey
  ↓
Application
  ↓
Workers / scheduled jobs
  ↓
Health checks and dashboards
  ↓
Traffic and workload authority
```

### PostgreSQL / Supabase Auth

PostgreSQL and Supabase Auth must be available first because they remain authoritative for permanent data, dashboard identity, ownership, durable analytics, audit history, scripts, builds, keys, licenses, and rollback paths.

Healthy startup expectations:

- Dashboard session validation works.
- Server-side database access works.
- Permanent data reads and writes are available.
- Existing fallback paths are available.

### Valkey

Valkey starts after PostgreSQL availability is known. Valkey holds temporary state and must be healthy before any Valkey-authoritative workload receives traffic.

Healthy startup expectations:

- Connectivity succeeds from application/worker hosts.
- Authentication succeeds.
- Health namespace read/write/delete succeeds.
- TTL verification succeeds.
- Memory is below warning threshold.
- Eviction count is zero or unchanged from previous reviewed state.
- Command latency is within the approved startup budget.

### Application

The application starts after dependencies are available or after flags are set to safe disabled/fallback modes.

Healthy startup expectations:

- Feature flags load correctly.
- Invalid flag combinations are rejected or fail safe.
- `VALKEY_ENABLED=false` keeps current PostgreSQL behavior.
- `VALKEY_ENABLED=true` with workload flags disabled does not change runtime behavior.
- Application health endpoint is healthy.

### Workers / Scheduled Jobs

Workers start after application and dependency health are verified because they may acquire Valkey locks, flush counters, invalidate caches, or drain legacy cleanup rows.

Healthy startup expectations:

- Workers report heartbeat or successful scheduled execution.
- Lock acquisition behavior is normal.
- Counter flushers do not run before counters are enabled.
- Cleanup workers do not remove data required for rollback.

### Health Checks And Dashboards

Health checks and dashboards must be verified before traffic is shifted or canary percentage increases.

Healthy startup expectations:

- Application, database, Valkey, worker, and infrastructure dashboards show fresh data.
- Alerts are enabled and routed.
- No unexplained critical or warning states exist.

### Traffic

Traffic should enter Valkey-authoritative paths only after dependencies, application, workers, and observability are healthy.

Why order matters:

- Starting application traffic before PostgreSQL risks permanent-data failures.
- Starting Valkey-authoritative workloads before Valkey health is known risks fail-closed spikes or runtime errors.
- Starting workers before locks and counters are healthy can cause duplicate processing or flush gaps.
- Increasing traffic before dashboards are live removes rollback confidence.

## 4. Shutdown Procedure

Graceful shutdown should preserve permanent data integrity, avoid duplicate worker execution, and keep rollback paths safe.

Expected shutdown order:

```text
Stop traffic or enter maintenance mode if required
  ↓
Disable canary / Valkey authority when needed
  ↓
Stop workers and scheduled jobs
  ↓
Drain or finish in-flight application requests
  ↓
Stop application processes
  ↓
Stop Valkey if maintenance requires it
  ↓
Keep PostgreSQL available unless database maintenance is the target
```

### Application

- Stop accepting new traffic when maintenance mode is required.
- Allow in-flight requests to finish when possible.
- Avoid terminating requests during delivery-session creation or payload fetch unless incident severity requires immediate shutdown.
- Confirm application processes reconnect cleanly during restart.

### Workers

- Stop scheduled jobs before stopping Valkey when workers depend on locks or counters.
- Let active counter flushes complete if safe.
- Do not start cleanup reduction tasks during rollback or shutdown unless explicitly approved.
- Confirm lock keys expire naturally if workers stop before releasing them.

### Valkey

- Do not stop Valkey while workloads are Valkey-authoritative unless failure behavior is approved and operators are ready for impact.
- Prefer disabling workload authority or entering fallback mode before planned Valkey maintenance.
- Expect cache loss and temporary-state loss depending on persistence mode.
- Verify health and key-family behavior after restart.

### Maintenance Mode

Maintenance mode should be used when planned work may affect user-visible behavior, runtime delivery, or protected security paths.

Maintenance mode expectations:

- Runtime and dashboard responses should remain safe and explicit.
- Protected paths must not silently fail open.
- Operators must know whether clients should retry or wait.

### Rollback Safety

- Before shutting down Valkey, set workload modes to PostgreSQL or disabled if the operation requires preserving behavior.
- Ensure `RATE_LIMIT_V2_WRITE_POSTGRES=true` before rate-limit rollback where PostgreSQL windows must continue.
- Ensure `DELIVERY_SESSION_V2_WRITE_POSTGRES=true` before delivery-session rollback where PostgreSQL sessions must exist for new sessions.
- Run final safe counter flush before disabling counters when possible.

## 5. Health Checks

Health checks must distinguish healthy, degraded, and unsafe states. `/api/health` is the primary operational health endpoint. Exact numeric thresholds must be defined from Phase 7D baseline and post-implementation production behavior; this runbook defines expected direction and response.

Current `/api/health` sections:

- `summary`: counts PostgreSQL, Valkey, RateLimit, and Application service states.
- `postgres`: reports configured/connected state without unnecessary database queries.
- `valkey`: reuses the existing Valkey health service.
- `rateLimit`: reports runtime mode, health, parity, mismatch rate, backend failures, comparison failures, and latency delta.
- `rollout`: reports mode, canary percentage, request counters, fallback count, and authoritative write counters.
- `performance`: reports latency difference, direction, and speedup when averages are available.
- `runtime`: reports phase `7`, milestone `7E.1`, release, start time, and uptime.
- `notes`: serializes informational current-state guidance.

| Health Check | Healthy State | Degraded State | Unsafe State |
|---|---|---|---|
| Application health | Health endpoint succeeds and routes respond normally. | Elevated latency or non-critical errors. | Health endpoint fails or critical endpoints fail. |
| PostgreSQL health | Auth, permanent reads/writes, and fallback paths work. | Elevated query latency or egress. | Database unavailable or permanent writes fail. |
| Valkey connectivity | Application can connect within approved timeout. | Intermittent timeout or reconnects. | Sustained unavailable state. |
| Valkey authentication | Auth succeeds from approved clients. | Credential warnings or rotation pending. | Auth failure prevents commands. |
| Valkey command latency | Average/P95/P99 within approved thresholds. | Sustained P95/P99 increase. | Timeouts or severe tail latency. |
| Valkey memory | Below warning threshold and stable. | Above warning/alert threshold or growing unexpectedly. | Critical threshold, rejected writes, or eviction risk. |
| Valkey evictions | Zero new evictions under normal load. | Any cache-only eviction requires review. | Any security-sensitive eviction or repeated eviction. |
| Valkey connections | Stable and within expected range. | Gradual growth or reconnect churn. | Connection storm or suspected leak. |
| TTL verification | Health keys expire as expected; no missing TTL anomalies. | TTL mismatch or delayed expiry investigation needed. | Temporary key family missing TTLs. |
| Rate limits | Decisions stable; allow/deny ratios explainable. | Parity mismatch in shadow or changed deny rate. | Protected paths fail open or abusive traffic bypasses limits. |
| Delivery sessions | Creation/consume/error metrics stable. | Retry or expired-session increase. | Runtime contract regression or widespread consume failures. |
| Cache | Hit/miss ratio normal; invalidation works. | Hit ratio drop or stale suspicion. | Cross-account leakage or corrupted sensitive cache. |
| Counters | Flushes succeed; backlog within buffer. | Flush retry/backlog increase. | Durable aggregate loss risk beyond tolerance. |
| Workers | Scheduled jobs run, locks acquired/released, skips explainable. | Increased contention or skipped runs. | Worker failures, stuck locks, or missed required processing. |

Operational health checks must use non-sensitive data. Valkey health keys must be namespaced to a safe health workload and must always expire.

## 6. Monitoring

Production operations require dashboards that show both system health and migration outcomes.

### Application Dashboard

Critical metrics:

- Request rate by endpoint group.
- Error rate by endpoint group.
- Latency average, P95, and P99.
- Runtime delivery session creation latency.
- Runtime payload fetch latency.
- Feature flag state and authority mode.
- Fallback count.
- PostgreSQL authoritative writes.
- Valkey authoritative writes.
- Fail-closed count.
- Shadow mismatch count.
- Latency direction and speedup from `/api/health.performance`.

### Valkey Dashboard

Critical metrics:

- Availability.
- Command latency average, P95, and P99.
- Command errors by workload.
- Timeouts.
- Memory used and memory growth rate.
- Memory fragmentation if available.
- Connection count.
- Expired keys.
- Evicted keys.
- Rejected writes.
- Key count by workload prefix where available.
- CPU and host memory for the Valkey host or service.

### Database Dashboard

Critical metrics:

- PostgreSQL reads.
- PostgreSQL writes.
- Database size.
- Table sizes for `rate_limits`, `delivery_sessions`, event/analytics tables, script/build tables.
- Index sizes for temporary-data indexes while they exist.
- Supabase egress.
- Query latency for temporary-data fallback paths.
- Durable analytics write success.
- Backup health.

### Cleanup Dashboard

Critical metrics:

- Cleanup duration.
- Rows deleted per run.
- Cleanup candidate backlog.
- Cleanup errors.
- Cleanup frequency.
- Cleanup egress.
- Legacy drain progress for migrated tables.

### Worker Dashboard

Critical metrics:

- Worker heartbeat or scheduled run success.
- Worker failures.
- Lock acquired count.
- Lock contention count.
- Lock expiry before release.
- Skipped runs due to lock.
- Counter flush attempts, successes, failures, and duration.
- Queue/backlog metrics where applicable.

### Infrastructure Dashboard

Critical metrics:

- VPS CPU.
- VPS RAM.
- VPS disk.
- Network throughput.
- PM2 process status and restarts.
- systemd timer status if applicable.
- Valkey host/service resource usage.
- Network errors between application and Valkey/PostgreSQL.

## 7. Alerting

Alerts must be actionable. Every alert must include severity, possible cause, immediate response, escalation path, and recovery verification.

| Alert | Severity | Possible Cause | Immediate Response | Escalation | Recovery |
|---|---|---|---|---|---|
| Application health endpoint failure | Critical | App crash, bad deploy, dependency outage, network issue. | Stop rollout, check app logs and dependency health, prepare rollback. | Application owner and incident lead. | Health endpoint succeeds and error rate returns to normal. |
| High application error rate | Critical for runtime/auth, high for dashboard-only | Bad deployment, Valkey failures, database failures, contract regression. | Freeze rollout, identify endpoint group, reduce canary or rollback workload flag. | Application owner. | Error rate returns to baseline. |
| High API P95/P99 latency | High | Valkey latency, PostgreSQL latency, connection pool pressure, app CPU. | Compare app, Valkey, DB, and infra dashboards; reduce canary if new. | Application and infrastructure owners. | Latency returns within threshold. |
| Valkey unavailable | Critical | Service down, network partition, auth issue, host failure. | Switch workloads to PostgreSQL/disabled where available; protected paths fail closed if no fallback. | Valkey owner, infrastructure owner, incident lead. | Health checks pass and fallback/fail-closed counts normalize. |
| Valkey command failures | High | Timeout, command error, serialization issue, auth, memory pressure. | Identify workload and error class; pause rollout; rollback affected workload if needed. | Valkey and application owners. | Command error rate returns to normal. |
| Valkey memory warning | Medium | Traffic growth, TTL too long, cache growth, counter cardinality. | Review key-family growth and TTLs; stop expanding rollout. | Valkey owner. | Memory stabilizes below warning. |
| Valkey memory critical | Critical | Memory leak, missing TTL, unexpected traffic, oversized values. | Disable non-critical caches/counters; rollback affected workloads if writes fail or eviction risk exists. | Valkey owner and incident lead. | Memory below alert threshold and no rejected writes. |
| Any Valkey eviction | High; critical for rate/session/nonce | Memory pressure or eviction policy reached. | Treat as incident, identify key family, disable non-critical workloads first. | Valkey, security, application owners. | Eviction count stops increasing and affected workload validated. |
| Rejected writes | Critical | OOM, policy failure, service instability. | Roll back affected writes or disable non-critical workloads. | Valkey and infrastructure owners. | Writes succeed and memory stable. |
| Connection count spike | High | Connection leak, reconnect storm, process loop. | Inspect app processes, recent deploy, Valkey logs, and network errors. | Application and infrastructure owners. | Connection count returns to expected range. |
| Missing TTL anomaly | High | Implementation defect or unsafe key family. | Disable affected workload; identify keys; follow safe cleanup runbook. | Application and Valkey owners. | No new missing TTL keys. |
| Shadow mismatch spike | High | Serialization bug, TTL mismatch, race, different semantics. | Pause canary progression; keep PostgreSQL authoritative. | Application owner. | Mismatch rate returns below accepted threshold. |
| Rate-limit decision anomaly | Critical for protected endpoints | Bucket bug, hashing bug, TTL error, Valkey outage. | Roll back rate limits to PostgreSQL or fail closed. | Application and security owners. | Allow/deny ratios normalize and parity validated. |
| Delivery-session error spike | Critical | Session TTL issue, consume bug, Valkey outage, runtime contract regression. | Reduce canary to 0 or switch to PostgreSQL mode. | Application owner and incident lead. | Session create/consume success returns to baseline. |
| Worker failure | High | Lock issue, job crash, dependency outage. | Stop duplicate workers if needed; inspect lock and worker logs. | Worker/application owner. | Worker completes successfully and backlog normalizes. |
| Counter flush failures | High | PostgreSQL issue, worker issue, serialization bug, Valkey issue. | Pause counter authority if loss risk exceeds tolerance; retry safe flush. | Application and database owners. | Flush succeeds and backlog drains. |
| Supabase egress spike | Medium or high | Cache disabled, fallback spike, query regression, traffic growth. | Compare traffic-normalized egress and fallback metrics. | Database and application owners. | Egress returns to expected range or cause documented. |
| Unexpected database growth | High | PostgreSQL temporary writes resumed, cleanup failure, traffic growth. | Check `rate_limits`, `delivery_sessions`, cleanup, and feature flags. | Database and application owners. | Growth stabilizes and source is addressed. |

## 8. Troubleshooting Guide

### Valkey Unavailable

Symptoms:

- Valkey health check fails.
- Command timeout or connection error alerts fire.
- Fallback count or fail-closed count spikes.
- Runtime/session/rate-limit errors may increase depending on workload authority.

Diagnosis:

- Check Valkey service status and host availability.
- Check network reachability from application/worker hosts.
- Check authentication and secret rotation status.
- Check recent infrastructure or deployment changes.
- Check whether outage affects all commands or one workload.

Resolution:

- Restore Valkey service or network path.
- If service cannot be restored quickly, set workload modes to PostgreSQL or disabled where fallback exists.
- For protected paths without fallback, keep fail-closed behavior.
- Keep cache and optional counter workloads disabled until stable.

Verification:

- Health checks pass.
- Command latency and error rate normalize.
- Fallback/fail-closed counts return to expected values.
- Runtime and dashboard error rates return to baseline.

Rollback:

- Set `VALKEY_ENABLED=false` for global rollback.
- Or set affected workload mode to PostgreSQL/disabled.

### Connection Timeout

Symptoms:

- Elevated Valkey command latency.
- Timeout errors in application logs.
- P95/P99 application latency increases.
- Reconnect count or connection count rises.

Diagnosis:

- Compare app latency, Valkey latency, host CPU/RAM, network throughput, and connection count.
- Check whether timeouts correlate with traffic spikes or a recent deploy.
- Check for slow commands or oversized values.

Resolution:

- Pause canary progression.
- Reduce Valkey-authoritative traffic if recent rollout caused the issue.
- Disable non-critical cache/counter workloads if resource pressure is high.
- Investigate host or network pressure through infrastructure process.

Verification:

- Timeout count returns to normal.
- Latency returns within threshold.
- Connection count stabilizes.

Rollback:

- Reduce `RATE_LIMIT_CANARY_PERCENT` to `0`.
- Switch affected workload mode to PostgreSQL/disabled.

### Memory Exhausted

Symptoms:

- Memory critical alert.
- Rejected writes.
- Evictions.
- Command failures increase.
- Cache hit ratio may drop unexpectedly.

Diagnosis:

- Identify key family growth by prefix where possible.
- Check TTL anomalies and missing TTL alerts.
- Check cache family expansion and counter cardinality.
- Check traffic growth against baseline.

Resolution:

- Disable non-critical cache families first.
- Disable optional counters if they are high-cardinality.
- Roll back rate/session workloads if security-sensitive keys are at risk.
- Shorten TTLs only when safe and approved.
- Plan capacity increase through separate infrastructure process if sustained legitimate growth exists.

Verification:

- Memory returns below alert threshold.
- Rejected writes stop.
- Eviction count stops increasing.
- Workload health metrics normalize.

Rollback:

- Disable `CACHE_V1`, `COUNTERS_V1`, or affected workload flags.
- Set `VALKEY_ENABLED=false` if global instability remains.

### Unexpected Eviction

Symptoms:

- Eviction alert fires.
- Security-sensitive sessions, rate-limit windows, or nonce behavior may become inconsistent.
- Cache misses increase.

Diagnosis:

- Identify whether eviction affected cache-only keys or protected workload keys.
- Check memory pressure and eviction policy.
- Check recent cache/counter rollout or TTL changes.
- Check key count growth.

Resolution:

- Treat protected key eviction as an incident.
- Disable non-critical caches/counters.
- Roll back protected workloads to PostgreSQL or fail closed if needed.
- Investigate and fix memory/TTL/cardinality issue before re-enabling.

Verification:

- Eviction count remains unchanged after mitigation.
- Protected workload metrics are healthy.
- Memory remains stable.

Rollback:

- Workload-specific rollback for affected key family.
- Global Valkey disable if cause is unclear.

### Worker Lock Stuck

Symptoms:

- Worker skipped runs increase.
- Lock contention alert fires.
- Required scheduled task does not complete.
- Lock key appears to outlive expected job duration.

Diagnosis:

- Check lock TTL and owner token behavior.
- Check whether worker crashed before release.
- Check whether job duration exceeds lock TTL or renewal failed.
- Check worker logs and Valkey command errors.

Resolution:

- If lock has TTL and task can wait, allow lock to expire naturally.
- If required processing is blocked and runbook permits, clear only the specific lock after confirming owner is dead.
- Tune TTL/renewal in a later approved implementation fix if repeated.
- Ensure worker idempotency before forcing re-run.

Verification:

- Worker runs successfully.
- Lock acquisition/release metrics normalize.
- No duplicate processing or missed processing occurred.

Rollback:

- Set `WORKER_LOCKS_V1=false` and return to prior worker coordination behavior.

### Cache Inconsistency

Symptoms:

- Dashboard or metadata shows stale values.
- Cache correctness checks fail.
- Users report cross-account or incorrect script/build metadata.
- Cache invalidation count is lower than expected after mutations.

Diagnosis:

- Identify cache family and key scope.
- Check last mutation and invalidation path.
- Compare cached value to PostgreSQL authoritative data.
- Check whether user/creator scope is included in key.
- Check logs for serialization/version errors.

Resolution:

- Disable cache reads for affected family.
- Invalidate affected keys where safe.
- Read from PostgreSQL/configuration until fixed.
- Treat cross-account leakage suspicion as a security incident.

Verification:

- Authoritative data is served correctly.
- Cache hit/miss and invalidation metrics are normal after re-enable.
- No further stale or cross-account reports.

Rollback:

- Set `CACHE_V1_READS=false`.
- Set `CACHE_V1=false` if broad issue.

### High Latency

Symptoms:

- Application P95/P99 latency alert.
- Runtime delivery latency increases.
- Valkey or PostgreSQL command/query latency increases.
- Connection counts or CPU usage may rise.

Diagnosis:

- Determine whether latency is application, Valkey, PostgreSQL, worker, or network bound.
- Compare current values to baseline and pre-deployment values.
- Check canary percentage and recent flag changes.
- Check cache hit ratio and fallback count.

Resolution:

- Pause rollout.
- Reduce canary or roll back recently enabled workload.
- Disable cache/counter families if they add latency without benefit.
- Escalate infrastructure or database issues to respective owners.

Verification:

- P95/P99 latency returns within threshold.
- Error rate remains normal.
- Fallback/fail-closed metrics are explainable.

Rollback:

- Workload-specific rollback based on the latency source.

### Unexpected PostgreSQL Writes

Symptoms:

- `rate_limits` or `delivery_sessions` rows continue growing after expected cutover.
- PostgreSQL write volume does not decrease after migration.
- Cleanup workload remains high.

Diagnosis:

- Check feature flags controlling PostgreSQL writes.
- Identify endpoint groups still in PostgreSQL or dual-write mode.
- Check rollback or fallback spikes.
- Check un-migrated traffic paths or workers.

Resolution:

- If writes are expected due to rollback/fallback, document and keep monitoring.
- If unexpected, pause stage acceptance and correct flag or code path in a later approved implementation fix.
- Do not remove tables while unexpected writes continue.

Verification:

- New row growth stops for migrated workloads.
- PostgreSQL write metrics decrease against baseline.
- Cleanup candidate backlog trends down.

Rollback:

- If writes are needed for safety, keep PostgreSQL mode intentionally.
- If inconsistent state exists, return workload to PostgreSQL until resolved.

### Unexpected Database Growth

Symptoms:

- Database size growth exceeds expected baseline-normalized trend.
- Temporary table or index size grows unexpectedly.
- Cleanup candidates increase.

Diagnosis:

- Check table-size breakdown.
- Check `rate_limits`, `delivery_sessions`, event logs, analytics tables, and indexes.
- Check cleanup duration and failures.
- Check traffic growth and fallback rates.

Resolution:

- Fix cleanup failure if legacy rows are not draining.
- Identify and stop unexpected PostgreSQL writes for migrated workloads.
- Review counter aggregation and durable event volume.
- Defer schema removal decisions until growth source is understood.

Verification:

- Growth rate stabilizes.
- Cleanup backlog decreases.
- Write source is documented.

Rollback:

- Roll back to known-safe PostgreSQL behavior if Valkey migration caused duplicate or excessive writes.

### High Supabase Egress

Symptoms:

- Supabase egress exceeds baseline-normalized expectations.
- Repeated metadata reads increase.
- Cleanup query response volume increases.
- Cache miss ratio increases.

Diagnosis:

- Check cache flags and hit/miss ratio.
- Check fallback activation count.
- Check query patterns for rate/session fallback.
- Check cleanup logs and database dashboard.

Resolution:

- Restore cache reads only if cache correctness is validated.
- Fix fallback cause if Valkey unavailable or disabled unexpectedly.
- Review query projections in later implementation if needed.
- Continue PostgreSQL authoritative behavior if correctness requires it.

Verification:

- Egress decreases or returns to expected range.
- Cache hit ratio or fallback rate explains remaining egress.

Rollback:

- Roll back only if Valkey migration caused excessive fallback/query behavior; otherwise keep correctness-first posture.

## 9. Disaster Recovery

Disaster recovery must protect permanent data first. Valkey data is temporary and may be lost according to documented workload behavior.

### VPS Reboot

Recovery expectations:

- Application and workers restart through existing supervision.
- Valkey may restart and lose temporary state depending on persistence.
- PostgreSQL permanent data remains authoritative.

Recovery procedure:

- Verify VPS host health.
- Verify PostgreSQL/Supabase connectivity.
- Verify Valkey health and memory state.
- Verify application health.
- Verify workers and scheduled jobs.
- Review fallback/fail-closed spikes during reboot window.

Data integrity expectations:

- Permanent records remain intact in PostgreSQL.
- Cache loss is acceptable.
- In-flight delivery sessions may require retry.
- Locks expire or are recreated.
- Counter buffers follow documented loss/flush behavior.

### Valkey Restart

Recovery expectations:

- Cache and temporary state may be lost.
- Protected workloads use fallback or fail closed during restart.
- Application reconnects within bounded timeouts.

Recovery procedure:

- Before planned restart, move workloads to PostgreSQL/disabled mode where needed.
- Restart Valkey through approved process.
- Verify health checks, command latency, memory, evictions, and TTL behavior.
- Re-enable workload authority gradually after validation.

Data integrity expectations:

- Permanent data is unaffected.
- Runtime clients may retry sessions.
- Counter loss is limited to approved non-critical tolerance or prevented by final flush.

### Database Outage

Recovery expectations:

- Permanent reads/writes fail or degrade.
- Valkey cannot replace PostgreSQL for authoritative data.
- Runtime and dashboard paths that require permanent data must fail safely.

Recovery procedure:

- Treat as critical incident.
- Stop rollout or canary changes.
- Preserve fail-closed behavior for protected paths.
- Restore PostgreSQL/Supabase service through database incident process.
- Validate durable data integrity and application recovery.

Data integrity expectations:

- No permanent data should be written only to Valkey during outage.
- Temporary counters must not be treated as durable replacement for failed PostgreSQL writes.

### Network Partition

Recovery expectations:

- Partition between application and Valkey causes fallback/fail-closed/degraded behavior.
- Partition between application and PostgreSQL causes permanent-data failures.

Recovery procedure:

- Identify partition direction and affected hosts.
- Use workload rollback for Valkey partition.
- Use database outage procedure for PostgreSQL partition.
- Verify reconnection and stale connection cleanup.

Data integrity expectations:

- Temporary Valkey state may diverge during partition and should expire.
- PostgreSQL remains authoritative after recovery.

### Application Restart

Recovery expectations:

- Valkey connections are recreated.
- In-flight requests may fail or retry.
- Worker locks protect singleton jobs if workers restart separately.

Recovery procedure:

- Verify app health and feature flag load.
- Verify Valkey connection count returns to expected range.
- Verify no connection leak or reconnect storm.
- Verify runtime and dashboard metrics normalize.

Data integrity expectations:

- Permanent data remains in PostgreSQL.
- Temporary Valkey keys remain until TTL unless Valkey also restarted.

### Unexpected Cache Loss

Recovery expectations:

- Cache misses increase.
- PostgreSQL reads may temporarily increase.
- Correctness is preserved through authoritative fallback.

Recovery procedure:

- Confirm no protected data was stored only in cache.
- Monitor PostgreSQL load.
- Let cache repopulate or keep cache disabled if corruption is suspected.

Data integrity expectations:

- No permanent data loss.
- Dashboard/runtime metadata remains correct from PostgreSQL/configuration.

### Corrupted Temporary State

Recovery expectations:

- Affected Valkey key family may produce incorrect temporary decisions.
- Permanent data remains safe if fallback is used.

Recovery procedure:

- Disable affected workload authority.
- Identify key family and scope.
- Delete only safe temporary keys through approved runbook if needed.
- Rebuild from PostgreSQL/configuration where cache-derived.
- Re-enable through shadow/canary only after validation.

Data integrity expectations:

- Permanent records are not reconstructed from corrupted Valkey state.
- Security-sensitive paths fail closed or use PostgreSQL fallback.

## 10. Maintenance

Regular maintenance keeps Phase 7D safe after rollout.

### Health Review

- Review application, Valkey, PostgreSQL, worker, cleanup, and infrastructure dashboards.
- Confirm health checks are fresh and alerting is active.
- Confirm fail-closed and fallback counts are explainable.

### Memory Review

- Review Valkey memory usage and growth trend.
- Review key count by workload prefix where available.
- Review expired and evicted key counts.
- Investigate any missing TTL anomaly.
- Review largest or fastest-growing key families.

### Metrics Review

- Compare current metrics against Phase 7D baseline and previous review.
- Check PostgreSQL reads, writes, storage growth, and egress.
- Check runtime latency average/P95/P99.
- Check cache hit/miss ratios.
- Check counter flush success and backlog.

### Log Review

- Review sampled error logs for Valkey command failures.
- Confirm logs do not include raw secrets or sensitive identifiers.
- Review shadow mismatch logs during rollout stages.
- Review worker failures and skipped runs.

### Version Review

- Track Valkey version and client library version after implementation.
- Review security advisories.
- Plan upgrades only with restart and rollback procedures.

### Security Updates

- Review network exposure and firewall posture.
- Review credential rotation status.
- Review log redaction.
- Review environment isolation.
- Review cache scoping and sensitive data rules.

### Capacity Review

- Review memory headroom.
- Review traffic growth.
- Review connection growth.
- Review key cardinality growth.
- Review whether cache/counter dimensions remain justified.

### Monthly Operational Review

- Summarize incidents, alerts, rollbacks, and anomalies.
- Compare PostgreSQL cost reductions against objectives.
- Confirm cleanup workload remains reduced.
- Confirm Valkey stability and no unexpected evictions.
- Update runbook with lessons learned.

## 11. Capacity Planning

Capacity planning must be metric-driven. This runbook does not recommend exact infrastructure sizing.

### Memory Growth

Plan memory using:

- Peak requests per minute.
- Distinct rate-limit bucket count per window.
- Concurrent delivery sessions during TTL windows.
- Cache key count and value size by cache family.
- Counter cardinality by metric and dimension.
- Nonce key count during replay windows.
- Operational headroom above normal peak.

Capacity response options:

- Reduce non-critical cache coverage.
- Reduce counter dimensions.
- Shorten safe TTLs where product behavior permits.
- Increase memory through approved infrastructure process.
- Split cache-heavy workloads from security-sensitive workloads in a future architecture review.

### Connection Growth

Plan connection capacity using:

- Application process count.
- Worker process count.
- Deployment topology.
- Reconnect behavior during restarts.
- Health check frequency.

Capacity response options:

- Review client reuse.
- Review process scaling.
- Review connection limits.
- Investigate leaks before increasing limits.

### Traffic Growth

Plan traffic capacity using:

- Request rate by endpoint group.
- Runtime delivery/session traffic.
- Event reporting traffic.
- Dashboard usage.
- Abuse/burst patterns.

Capacity response options:

- Revisit rate-limit windows and bucket cardinality.
- Review canary and rollout controls.
- Review Valkey latency and CPU under load.
- Review PostgreSQL fallback load during Valkey incidents.

### Key Count Growth

Plan key cardinality using:

- Workload prefix counts.
- TTL behavior.
- Cache invalidation patterns.
- Counter dimensions.
- Rate-limit identifier diversity.
- Runtime session concurrency.

Capacity response options:

- Find missing TTLs.
- Reduce dimensions or cache families.
- Reduce over-broad keys.
- Review traffic-normalized growth.

### Future Clustering

Future clustering may be considered only after production metrics justify it.

Planning considerations:

- Operational complexity.
- Key distribution.
- Failure behavior.
- Security posture.
- Monitoring changes.
- Rollback implications.

### Horizontal Scaling

Valkey can support future app horizontal scaling, but scaling the application changes connection counts, worker concurrency, lock contention, and rollout behavior. Any horizontal scaling plan must include updated capacity review and worker idempotency review.

### Managed Valkey

Managed Valkey may be considered in a future infrastructure review.

Planning considerations:

- Availability model.
- Network latency.
- Authentication and TLS.
- Persistence options.
- Monitoring access.
- Cost.
- Backup/snapshot handling.
- Incident response boundaries.

## 12. Incident Playbooks

### Memory Above Threshold

Detection:

- Memory warning, alert, or critical alert fires.
- Memory growth rate exceeds normal trend.
- Rejected writes or evictions may appear in severe cases.

Immediate actions:

- Freeze rollout and do not increase canary.
- Identify key family growth.
- Disable non-critical cache families if above alert threshold.
- Disable optional counters if cardinality is the cause.
- Roll back protected workloads if evictions or rejected writes affect them.

Verification:

- Memory stabilizes below threshold.
- No new evictions occur.
- Command errors normalize.

Recovery:

- Re-enable workloads gradually only after root cause is understood.
- Document TTL, cardinality, or traffic cause.

Escalation:

- Valkey owner, infrastructure owner, application owner, incident lead.

Rollback:

- Disable affected workload flags or set `VALKEY_ENABLED=false` if global instability persists.

### Valkey Unavailable

Detection:

- Valkey health failure.
- Command failures/timeouts.
- Fallback/fail-closed spike.

Immediate actions:

- Stop rollout.
- Switch cache/counter workloads off.
- Switch rate/session workloads to PostgreSQL where fallback exists.
- Keep protected paths fail closed where no fallback exists.

Verification:

- Application error rate stabilizes.
- PostgreSQL fallback handles traffic.
- Valkey health recovers before re-enable.

Recovery:

- Restore Valkey service/network/auth.
- Verify health, memory, latency, evictions, TTL behavior.
- Re-enter shadow or canary mode before full authority.

Escalation:

- Incident lead, Valkey owner, infrastructure owner, application owner.

Rollback:

- `VALKEY_ENABLED=false` or workload-specific PostgreSQL/disabled modes.

### Worker Failure

Detection:

- Worker failure alert.
- Missed scheduled job.
- Lock contention spike.
- Counter flush backlog.

Immediate actions:

- Identify failed worker and workload.
- Confirm whether a lock is held and whether it has TTL.
- Prevent duplicate processing if manual restart is needed.
- Pause dependent rollout stage.

Verification:

- Worker completes successfully.
- Backlog drains.
- Lock metrics normalize.
- No duplicate or missed durable writes.

Recovery:

- Restart worker if safe.
- Let stale locks expire or clear approved lock only after owner is confirmed dead.
- Resume scheduled processing.

Escalation:

- Worker/application owner and incident lead.

Rollback:

- Disable `WORKER_LOCKS_V1` or related counter/cache workload if worker cannot safely operate.

### Unexpected Restart

Detection:

- PM2 restart alert.
- Valkey restart alert.
- VPS reboot signal.
- Connection count reset or reconnect storm.

Immediate actions:

- Identify restarted component.
- Freeze rollout.
- Check permanent data dependencies first.
- Check Valkey temporary-state impact.

Verification:

- Application health is normal.
- Valkey health is normal.
- Worker health is normal.
- Runtime and dashboard error rates return to baseline.

Recovery:

- Reconnect application/workers.
- Let clients retry sessions as needed.
- Rebuild caches naturally from misses.
- Validate counters and flushers.

Escalation:

- Infrastructure owner and affected subsystem owner.

Rollback:

- Workload-specific rollback if restart caused sustained instability.

### Database Growth

Detection:

- Database growth alert.
- `rate_limits` or `delivery_sessions` growth after expected cutover.
- Cleanup backlog grows.

Immediate actions:

- Check feature flags and fallback mode.
- Identify growing tables and indexes.
- Check cleanup failures.
- Pause table-removal or cleanup-reduction decisions.

Verification:

- Source of growth identified.
- Temporary writes stop where expected.
- Cleanup drains legacy rows.

Recovery:

- Correct flags or affected implementation in a later approved change.
- Keep PostgreSQL path if rollback requires it.

Escalation:

- Database owner and application owner.

Rollback:

- Return to known-safe PostgreSQL behavior if duplicate writes or inconsistent migration state caused growth.

### Supabase Egress Spike

Detection:

- Egress alert or billing/cost anomaly.
- Database dashboard shows increased response volume.

Immediate actions:

- Compare egress to request volume.
- Check fallback count and cache hit ratio.
- Check cleanup and metadata query activity.

Verification:

- Egress source identified.
- Cache/fallback/cleanup metrics explain trend.

Recovery:

- Restore safe cache reads if validated.
- Fix Valkey instability causing fallback.
- Tune cleanup or query projections in future approved work if needed.

Escalation:

- Database owner and application owner.

Rollback:

- Roll back recent workload only if it caused excessive fallback or read amplification.

### High Latency

Detection:

- Application or runtime P95/P99 alert.
- Valkey or PostgreSQL latency alert.

Immediate actions:

- Freeze rollout.
- Identify latency source.
- Reduce canary if recently increased.
- Disable optional cache/counter workloads if they add pressure.

Verification:

- Latency returns within threshold.
- Error rate remains acceptable.
- Dependency latency normalizes.

Recovery:

- Re-enable slowly after source is resolved.
- Document whether issue was app, Valkey, DB, worker, or infrastructure.

Escalation:

- Application, Valkey, database, or infrastructure owner depending on source.

Rollback:

- Workload-specific rollback to PostgreSQL/disabled mode.

## 13. Operational Checklist

### Daily

- Check application health and error rate.
- Check runtime delivery latency and errors.
- Check Valkey availability, command latency, memory, connections, and evictions.
- Confirm eviction count has not increased.
- Check PostgreSQL reads, writes, storage, and egress for anomalies.
- Check worker failures and skipped runs.
- Check fallback and fail-closed counts.

### Weekly

- Review Valkey memory and key count trends.
- Review cache hit/miss ratios and invalidation metrics.
- Review counter flush success and backlog.
- Review cleanup duration and legacy drain progress.
- Review shadow mismatch metrics for active rollout stages.
- Review logs for redaction and sensitive data safety.
- Confirm alert routes and dashboard freshness.

### Monthly

- Compare current metrics against Phase 7D baseline.
- Review database storage growth and Supabase egress trend.
- Review capacity headroom for memory, connections, traffic, and key cardinality.
- Review Valkey/client version and security update needs.
- Review incidents and follow-up actions.
- Validate rollback procedures remain current.
- Update runbook and operational docs if behavior changed.

### Release Day

- Confirm no active incidents.
- Record pre-deployment metrics.
- Verify feature flags and rollback flags.
- Verify health checks and alerts.
- Confirm rollback owner availability.
- Deploy using approved sequence.
- Validate post-deployment metrics.
- Record stage acceptance or rollback decision.

### Incident Response

- Assign incident lead.
- Identify affected workload and severity.
- Freeze rollout and canary increases.
- Protect permanent data first.
- Use workload-specific rollback if needed.
- Preserve logs and metrics.
- Communicate status and owner actions.
- Document timeline and follow-ups.

### Recovery Validation

- Confirm application health.
- Confirm Valkey health.
- Confirm PostgreSQL health.
- Confirm worker health.
- Confirm runtime and dashboard error rates normalize.
- Confirm no new evictions or missing TTL anomalies.
- Confirm fallback/fail-closed counts return to expected levels.
- Confirm permanent data integrity.
- Confirm rollback flags are restored to intended post-incident state.

## 14. Post-Implementation Review

A post-implementation review is required after each migration phase and before proceeding to the next phase.

### Required Comparisons

Compare against the Phase 7D baseline and the immediately previous phase:

- API latency average, P95, and P99.
- Runtime delivery latency average, P95, and P99.
- PostgreSQL reads.
- PostgreSQL writes.
- PostgreSQL storage and table growth.
- Supabase egress.
- Cleanup duration and cleanup candidate count.
- Application error rate.
- Runtime error rate.
- Valkey command latency.
- Valkey command failures.
- Valkey memory and key count growth.
- Valkey evictions.
- Worker failures and lock contention.
- Cache hit/miss ratio.
- Counter flush success and backlog.
- Fallback and fail-closed counts.
- Rollback readiness.

### Review Questions

- Did the phase meet its functional acceptance criteria?
- Did PostgreSQL load decrease where expected?
- Did Supabase egress decrease where expected?
- Did cleanup workload decrease where expected?
- Did latency improve or remain stable?
- Did error rates remain stable?
- Were any evictions observed?
- Were any missing TTL anomalies observed?
- Were any cross-account, secret-handling, or logging concerns observed?
- Was rollback tested or kept ready for this phase?
- Are there unresolved incidents or risks that block the next phase?

### Acceptance Before Next Phase

Proceed to the next migration phase only when:

- Metrics are stable for the approved observation window.
- No critical alerts remain unresolved.
- No unexplained data growth or egress spike remains unresolved.
- Rollback remains available and documented.
- Stage acceptance is recorded by application, infrastructure/Valkey, database, monitoring, and incident/release owners as applicable.

## 15. Operational Definition Of Success

Phase 7D production operations are successful when the completed system can be operated safely without relying on undocumented architectural context.

Success indicators:

- Valkey memory is stable and below approved thresholds.
- Valkey command latency remains within approved average, P95, and P99 thresholds.
- Valkey command failures are rare, explainable, and actionable.
- Valkey evictions remain zero under normal production load.
- Every temporary key family has a documented TTL and no missing TTL anomalies.
- Application, Valkey, database, cleanup, worker, and infrastructure dashboards are healthy and current.
- Alerts are actionable, routed to owners, and tested through operational reviews.
- PostgreSQL writes are reduced for migrated temporary workloads.
- PostgreSQL reads are reduced for migrated lookup/cacheable workloads where applicable.
- Supabase egress is reduced against traffic-normalized baseline expectations.
- Cleanup workload is reduced to legacy drain or remaining permanent-data maintenance.
- Runtime and dashboard contracts remain stable.
- Permanent data remains authoritative in PostgreSQL.
- Security-sensitive paths fail closed or use approved PostgreSQL fallback during Valkey failures.
- Cache correctness is preserved and no cross-account leakage is observed.
- Counter flushing is stable and does not risk durable audit, license, purchase, or security data.
- Worker locks reduce contention without becoming the only correctness guarantee.
- Rollback procedures have been validated and remain documented.
- Post-implementation reviews are completed after each migration phase.
- New engineers can follow this runbook to deploy, monitor, troubleshoot, roll back, and recover Phase 7D production operations.

## Phase Boundary

This runbook is documentation only. It describes future production operations after Phase 7D implementation is complete. It does not implement Valkey, change runtime behavior, install packages, create migrations, modify schemas, or change infrastructure.
