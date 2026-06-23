# Phase 7D RC1 — Valkey Shadow Mode Production Rollout Runbook

Status: Engineering Complete (RC1)  
Date: 2026-06-23  
Scope: Documentation-only operator procedure for deploying Phase 7D Valkey shadow mode  
Audience: Production operators deploying LuxyHub

Current consolidation note: Phase 7D engineering is complete, Phase 7E.1 operational health and canary infrastructure is complete, and the production baseline is `RATE_LIMIT_MODE=shadow` with PostgreSQL authoritative and Valkey shadow-only. This RC1 runbook is preserved as the rollout and rollback procedure. Pre-activation steps that set `RATE_LIMIT_MODE=postgres` describe rollout sequencing and rollback, not the current runtime state.

This runbook assumes Phase 7D engineering is complete through Phase 7D.2.6. It does not authorize application code changes, runtime changes, API changes, middleware changes, database schema changes, canary rollout, Valkey authority, or PostgreSQL removal.

Production rule: PostgreSQL remains authoritative. Valkey is shadow-only. User-visible responses must not change.

Current operational endpoints:

- `/api/health`: primary operational health endpoint with `summary`, `postgres`, `valkey`, `rateLimit`, `rollout`, `performance`, `runtime`, and `notes`.
- `/api/internal/rate-limit-shadow`: admin-only shadow monitoring endpoint with parity, comparison metrics, rollout metrics, Valkey health, runtime metadata, and operator summary.

Current migration state:

| Area | State |
|---|---|
| PostgreSQL | Authoritative |
| Valkey | Shadow |
| Shadow parity | 100% target/state before canary |
| Backend failures | 0 target/state before canary |
| Comparison failures | 0 target/state before canary |
| Canary | Disabled |
| Next milestone | Phase 7E.2 planned 1% canary |

## Operating Model

Shadow mode executes PostgreSQL and Valkey rate-limit adapters for every rate-limit evaluation, compares the results, records internal parity metrics, and returns only the PostgreSQL decision.

```text
Request
  -> PostgreSQL rate-limit adapter
  -> PostgreSQL decision returned to user
  -> Valkey shadow adapter execution
  -> Internal comparison
  -> In-memory metrics and internal health snapshot
```

Rollback is a configuration-only operation: restore `RATE_LIMIT_MODE=postgres` and restart the PM2 application process.

## Required Operator Inputs

Set these values before running commands:

```bash
export APP_NAME="luxyhub"
export APP_DIR="/var/www/luxy-hub"
export PUBLIC_ORIGIN="https://www.luxyhub.space"
export VALKEY_HOST="127.0.0.1"
export VALKEY_PORT="6379"
export SUPABASE_DB_HOST="<supabase-db-host>"
export SUPABASE_DB_PORT="5432"
```

If production uses a different PM2 application name, directory, domain, Valkey endpoint, or database endpoint, replace the values before executing the runbook.

## Phase 1 — Pre-Deployment Checklist

Do not deploy until every item in this section is complete.

### 1.1 PM2 Healthy

Command:

```bash
pm2 status "$APP_NAME"
```

Expected output:

```text
status: online
restart count: stable or understood
memory: within normal baseline
cpu: within normal baseline
```

Additional checks:

```bash
pm2 logs "$APP_NAME" --lines 100 --nostream
pm2 describe "$APP_NAME"
```

Expected result:

- No crash loop.
- No recent unexplained restarts.
- No repeated uncaught exceptions.
- Environment path points to the production deployment.

Rollback point: if PM2 is unhealthy before deployment, stop the rollout. Do not deploy shadow mode into an unstable application process.

### 1.2 Valkey Healthy

Command without password:

```bash
redis-cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" PING
```

Command with password:

```bash
redis-cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" --no-auth-warning PING
```

Expected output:

```text
PONG
```

Memory and reconnect baseline:

```bash
redis-cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" INFO memory
redis-cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" INFO stats
redis-cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" INFO clients
```

Expected result:

- `used_memory` is below the production warning threshold.
- `evicted_keys` is `0` or unchanged from a reviewed baseline.
- `rejected_connections` is `0` or unchanged from a reviewed baseline.
- Client count is within expected capacity.
- No authentication or network errors.

Rollback point: if Valkey is unhealthy, keep `RATE_LIMIT_MODE=postgres`. Do not enable shadow mode.

### 1.3 PostgreSQL Healthy

Use the production database console or `psql` from an approved operator host.

Command:

```bash
psql "postgresql://$SUPABASE_DB_USER:$SUPABASE_DB_PASSWORD@$SUPABASE_DB_HOST:$SUPABASE_DB_PORT/postgres" -c "SELECT now();"
```

Expected output:

```text
              now
-------------------------------
 <current timestamp>
```

Rate-limit table sanity check:

```sql
SELECT COUNT(*) AS rate_limit_rows FROM public.rate_limits;
```

Expected result:

- Query completes normally.
- No active database incident.
- No abnormal connection saturation.
- No unexpected high latency on simple reads.

Rollback point: if PostgreSQL is unhealthy, stop rollout. PostgreSQL is authoritative and must be stable before any deployment.

### 1.4 Cleanup Healthy

Verify existing cleanup remains healthy before changing runtime configuration.

Command:

```bash
curl -i -X POST "$PUBLIC_ORIGIN/api/cleanup" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected output:

```text
HTTP/2 200
```

Current response expectations:

- `status` is `healthy` or otherwise explainable during an incident.
- `summary`, `postgres`, `valkey`, `rateLimit`, `rollout`, `performance`, `runtime`, and `notes` are present.
- `runtime.phase` is `7` and `runtime.milestone` is `7E.1` on the current baseline.
- `rollout.canaryPercentage` is `0` unless a separately approved Phase 7E.2 canary is active.

Expected result:

- Cleanup returns success.
- Cleanup duration is within baseline.
- No cleanup errors in PM2 logs.
- `rate_limits` cleanup behavior is unchanged.

Rollback point: if cleanup is unhealthy, stop rollout. Do not mix cleanup instability with rate-limit shadow rollout.

### 1.5 Backup Complete

Confirm backup status before deployment.

Minimum requirement:

- Latest Supabase/PostgreSQL backup completed successfully.
- Backup timestamp is recorded in the deployment notes.
- Restore procedure is known and owned.
- No schema migration is planned for this rollout.

Suggested verification query:

```sql
SELECT now() AS backup_verification_time;
```

Record:

```text
Backup provider:
Backup completed at:
Verified by:
Restore owner:
```

Rollback point: if a backup is missing or unverified, stop rollout.

### 1.6 Environment Variables Correct

Verify production environment variables before deployment.

Required for normal application operation:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `ADMIN_API_KEY`
- `ANALYTICS_PEPPER`

Required or expected for Valkey shadow readiness:

- `VALKEY_ENABLED=true`
- `VALKEY_HOST=<production Valkey host>`
- `VALKEY_PORT=<production Valkey port>`
- `VALKEY_PASSWORD=<production Valkey password if enabled>`
- `VALKEY_DB=<production Valkey database number>`
- `VALKEY_TLS=<true|false according to deployment>`
- `VALKEY_NAMESPACE_ENV=prod`
- `RATE_LIMIT_MODE=postgres` before shadow activation

Command:

```bash
pm2 env "$APP_NAME"
```

Expected result:

- `RATE_LIMIT_MODE` is `postgres` before Phase 3.
- Valkey variables point to production Valkey, not staging or local.
- No secret values are copied into deployment notes.
- Namespace is production-scoped.

Rollback point: if variables are ambiguous or point to the wrong environment, stop rollout.

## Phase 2 — Deployment Procedure

This phase deploys the completed RC1 build while keeping `RATE_LIMIT_MODE=postgres`.

### 2.1 Enter Maintenance Watch

No public maintenance page is required because user-visible behavior should not change. Operators must actively watch logs and metrics.

Command:

```bash
pm2 logs "$APP_NAME" --lines 50
```

Expected output:

```text
Application serving requests normally.
No repeated uncaught exceptions.
No rate-limit shadow mismatch flood.
```

Rollback point: if errors are already active, stop deployment.

### 2.2 Pull Or Install Approved Release

Use the project’s approved deployment mechanism. Example PM2/VPS sequence:

```bash
cd "$APP_DIR"
git fetch --all --prune
git status --short
git rev-parse --short HEAD
```

Expected output:

```text
git status --short returns no unexpected local modifications.
current commit matches the approved release or previous production commit.
```

Deploy approved revision:

```bash
git checkout <approved-release-commit-or-tag>
npm ci
npm run build
```

Expected output:

```text
added/audited packages successfully
Next.js build completes without errors
```

Rollback point: if dependency installation or build fails, do not restart PM2. Restore the previous release directory or previous commit according to the standard deployment process.

### 2.3 Restart Application In PostgreSQL Mode

Confirm `RATE_LIMIT_MODE=postgres` before restart.

Command:

```bash
grep '^RATE_LIMIT_MODE=' .env.production || true
```

Expected output:

```text
RATE_LIMIT_MODE=postgres
```

Restart:

```bash
pm2 restart "$APP_NAME" --update-env
```

Expected output:

```text
[PM2] Applying action restartProcessId on app [luxyhub]
[PM2] [luxyhub] restarted
status: online
```

Rollback point: if PM2 fails to restart, restore the previous production release and restart PM2.

### 2.4 Validate After Deployment

Health endpoint:

```bash
curl -i "$PUBLIC_ORIGIN/api/health"
```

Expected output:

```text
HTTP/2 200
```

Current response expectations:

- `status` is `healthy` for normal operation.
- `rateLimit.runtimeMode` is `shadow`.
- `rollout.canaryPercentage` is `0`.
- `rollout.postgresAuthoritativeWrites` and `rollout.valkeyAuthoritativeWrites` are present for Phase 7E migration KPIs.
- `performance` reports latency direction and speedup when PostgreSQL and Valkey latency averages are available.

PM2 status:

```bash
pm2 status "$APP_NAME"
```

Expected output:

```text
status: online
restart count: not increasing
```

Application logs:

```bash
pm2 logs "$APP_NAME" --lines 100 --nostream
```

Expected result:

- No new 5xx spike.
- No environment parsing errors.
- No Valkey authority messages.
- No canary or authority switch is active.
- Public route behavior is unchanged.

Rollback point: if health or API behavior regresses after deployment in `postgres` mode, roll back the deployment before enabling shadow mode.

## Phase 3 — Enable Shadow Mode

Shadow mode is enabled only after Phase 2 succeeds.

### 3.1 Set Runtime Mode

Edit the production environment file or PM2-managed environment using the approved production method.

Set:

```text
RATE_LIMIT_MODE=shadow
```

Do not change:

- API routes.
- Middleware.
- Cleanup configuration.
- Database schema.
- Canary percentage.
- Authority mode.

### 3.2 Restart Application

Command:

```bash
pm2 restart "$APP_NAME" --update-env
```

Expected output:

```text
[PM2] [luxyhub] restarted
status: online
```

### 3.3 Verify Health

Public health:

```bash
curl -i "$PUBLIC_ORIGIN/api/health"
```

Expected output:

```text
HTTP/2 200
```

PM2:

```bash
pm2 status "$APP_NAME"
```

Expected output:

```text
status: online
restart count: stable
```

Valkey:

```bash
redis-cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" PING
```

Expected output:

```text
PONG
```

### 3.4 Verify Internal Metrics

Use the admin-protected internal monitoring endpoint:

```bash
curl -sS -H "Cookie: <admin-session-cookie>" "$PUBLIC_ORIGIN/api/internal/rate-limit-shadow"
```

The endpoint is not public. It requires an authenticated admin session and does not expose individual comparisons, raw identifiers, tokens, sessions, buckets, or raw keys.

The same underlying helpers remain available to the application process and tests:

```ts
getRateLimitShadowHealth()
getRateLimitShadowMetrics()
getRateLimitShadowParityReport()
getRateLimitShadowOperationalSnapshot()
```

Expected initial health:

```json
{
  "enabled": true,
  "runtimeMode": "shadow",
  "runtime": {
    "phase": "7D",
    "release": "RC1",
    "runtimeMode": "shadow",
    "startedAt": "2026-06-23T00:00:00.000Z",
    "uptimeSeconds": 120
  },
  "totalComparisons": 0,
  "mismatchRate": 0,
  "backendFailures": 0,
  "comparisonFailures": 0,
  "status": "healthy"
}
```

Expected after traffic:

```json
{
  "runtimeMode": "shadow",
  "health": {
    "status": "healthy",
    "backendFailures": 0,
    "comparisonFailures": 0
  },
  "metrics": {
    "totalComparisons": 154203,
    "identical": 154202,
    "mismatches": 1,
    "mismatchRate": 0.000006,
    "latency": {
      "postgresAverageMs": 7.12,
      "valkeyAverageMs": 7.3,
      "deltaAverageMs": 0.18
    },
    "averageLatencyDeltaMs": 0.18
  },
  "valkey": {
    "enabled": true,
    "connected": true,
    "status": "healthy",
    "connectionState": "ready",
    "latencyMs": 4,
    "memoryUsedBytes": 12345678,
    "version": "7.2.5",
    "uptimeSeconds": 3600,
    "checkedAt": "2026-06-23T00:00:00.000Z"
  },
  "operationalSummary": "Runtime Mode: shadow | Parity: 99.9994% | Backend Failures: 0 | Comparison Failures: 0 | Latency: Postgres 7.12 ms, Valkey 7.30 ms, Delta 0.18 ms | Valkey: ready | Uptime: 120s | Status: healthy"
}
```

Latency calculation: `metrics.latency.deltaAverageMs` and the compatibility field `metrics.averageLatencyDeltaMs` are Valkey average latency minus PostgreSQL average latency across shadow comparisons. Negative values mean Valkey was faster on average. If PostgreSQL timing is unavailable, `postgresAverageMs` is `null` while the compatibility delta remains present.

Health model:

- Healthy: `backendFailures == 0`, `comparisonFailures == 0`, and `mismatchRate` is at or below the configured threshold.
- Degraded: backend failures, comparison failures, or mismatch rate above the configured threshold.
- Unhealthy: authoritative PostgreSQL unavailable, shadow metrics unavailable, or internal monitoring failure.
- Latency difference alone is diagnostic and must not make the shadow health status degraded.

### 3.5 Verify Parity And Backend Failures

After normal traffic reaches rate-limited routes, confirm:

- `totalComparisons` increases.
- `runtimeMode` is `shadow`.
- `mismatchRate` is within acceptable threshold.
- `backendFailures` is `0`.
- `comparisonFailures` is `0`.
- Public responses remain unchanged.
- Logs do not contain raw IPs, emails, tokens, session identifiers, or raw keys.

Immediate rollback point: if backend failures increase, comparison failures increase, PM2 restarts repeatedly, public health fails, or user-visible rate-limit behavior changes, execute Phase 6 emergency rollback.

## Phase 4 — Burn-In Observation

Recommended duration: 7 days.

Observe continuously across normal traffic patterns, peak traffic, cleanup windows, deployments, and Valkey restarts if any occur naturally. Do not intentionally create instability during burn-in.

### 4.1 Metrics To Monitor

Rate-limit shadow metrics:

- Total comparisons.
- Mismatch rate.
- Backend failures.
- Comparison failures.
- PostgreSQL average latency.
- Valkey average latency.
- Average latency delta, calculated as Valkey average minus PostgreSQL average.
- Allow parity.
- Deny parity.
- Retry-after parity.
- Last update timestamp.
- Runtime phase, release, runtime mode, started-at time, and uptime seconds.
- Concise operational summary.

Valkey metrics:

- Connected flag and connection state.
- Memory used.
- Health check latency.
- Version.
- Uptime.
- Memory fragmentation if available.
- Evicted keys.
- Expired keys.
- Reconnect count.
- Rejected connections.
- Command latency.
- Connected clients.

Application and platform metrics:

- PM2 restart count.
- CPU.
- Memory/RSS.
- Event loop or request latency if available.
- Application 4xx/5xx rates.
- API P95/P99 latency.
- Cleanup success and duration.
- PostgreSQL latency and connection saturation.

### 4.2 Acceptable Thresholds

Use these RC1 thresholds unless a stricter production SLO exists.

| Metric | Acceptable For Burn-In | Warning | No-Go / Rollback Candidate |
|---|---:|---:|---:|
| Total comparisons | Increasing during traffic | Flat during known traffic | Flat for > 30 minutes during active traffic |
| Mismatch rate | <= 0.001% sustained | > 0.001% for 15 minutes | > 0.01% sustained or unexplained |
| Backend failures | 0 | 1 isolated failure | Any repeated failure or increasing counter |
| Comparison failures | 0 | 1 isolated failure | Any repeated failure or increasing counter |
| Average latency delta | <= 25 ms absolute | > 25 ms for 15 minutes | > 100 ms sustained |
| Valkey memory | < 70% budget | 70% to 85% budget | > 85% budget or evictions |
| Valkey reconnect count | 0 new unexplained | 1 explained reconnect | Repeated reconnects |
| Valkey evictions | 0 | Any non-zero new value | Any eviction affecting shadow confidence |
| CPU | Within baseline | > 75% sustained | > 90% sustained or causing latency |
| PM2 restarts | 0 new unexplained | 1 explained restart | Repeated restarts |
| Application 5xx | Within baseline | Above baseline for 5 minutes | Sustained increase or user reports |

Mismatch threshold explanation: Valkey is not authoritative in shadow mode, but mismatches block canary readiness because they indicate semantic drift.

Latency threshold explanation: latency deltas are operator diagnostics and burn-in quality signals. A large latency delta can justify investigation or pause decisions, but latency difference alone does not make `/api/internal/rate-limit-shadow` health degraded.

Production burn-in observation for RC1: production can show `backendFailures = 0`, `comparisonFailures = 0`, `mismatches = 0`, and parity at `100%` while Valkey is substantially faster than PostgreSQL. That state is healthy; the negative latency delta means Valkey average latency is lower than PostgreSQL average latency.

### 4.3 Daily Burn-In Notes

Record once per day:

```text
Date:
Operator:
Runtime mode:
Total comparisons:
Mismatch rate:
Backend failures:
Comparison failures:
Average latency delta:
Allow parity:
Deny parity:
Retry-after parity:
Valkey used memory:
Valkey reconnect count:
Valkey evictions:
PM2 restart count:
Application error rate:
Cleanup status:
Notes / anomalies:
Decision: continue burn-in / rollback / pause rollout
```

## Phase 5 — Go / No-Go Decision

Make the decision only after the 7-day burn-in, unless an emergency rollback condition occurs earlier.

### 5.1 Criteria For Proceeding To Canary Planning

All must be true:

- `RATE_LIMIT_MODE=shadow` was active for the full burn-in window.
- PostgreSQL remained authoritative for the full window.
- No public API behavior changed.
- Total comparisons are high enough to represent normal production traffic.
- Mismatch rate is <= 0.001% sustained and every mismatch is explained or accepted.
- Backend failures are `0`, or any isolated failure is fully explained and not recurring.
- Comparison failures are `0`.
- Average latency delta is within threshold.
- Valkey memory remains below warning threshold.
- Valkey reconnects are `0` or fully explained.
- Valkey evictions are `0`.
- PM2 restarts are not elevated.
- Application error rate is not elevated.
- Cleanup remains healthy.
- PostgreSQL health remains normal.
- Rollback procedure has been tested operationally in staging or a dry run.

### 5.2 Criteria For Delaying Rollout

Delay canary planning if any are true:

- Insufficient comparison volume.
- Any unexplained mismatch pattern.
- Mismatch rate above threshold.
- Backend failures occur more than once.
- Any comparison failure remains unexplained.
- Average latency delta exceeds threshold during normal traffic.
- Valkey memory trends upward without stabilizing.
- Valkey reconnects occur without explanation.
- PM2 restart count increases.
- Cleanup becomes slow or unreliable.
- Operators cannot access internal metrics reliably.

### 5.3 Criteria For Rollback

Rollback immediately if any are true:

- Public health endpoint fails after shadow activation.
- User-visible rate-limit decisions differ from expected PostgreSQL behavior.
- PM2 enters a restart loop.
- Application 5xx rate increases materially after shadow activation.
- Backend failures increase repeatedly.
- Comparison failures increase repeatedly.
- Valkey causes resource exhaustion on the application host.
- Sensitive identifiers appear in logs.
- Operators lose confidence in observability during active rollout.

## Phase 6 — Emergency Rollback

Target completion time: under one minute.

Goal: restore PostgreSQL-only runtime mode and confirm Valkey is no longer part of the rate-limit execution path.

### 6.1 Restore PostgreSQL Mode

Edit production environment using the approved method.

Set:

```text
RATE_LIMIT_MODE=postgres
```

Do not change database, routes, middleware, cleanup, or Valkey infrastructure during emergency rollback.

### 6.2 Restart PM2

Command:

```bash
pm2 restart "$APP_NAME" --update-env
```

Expected output:

```text
[PM2] [luxyhub] restarted
status: online
```

### 6.3 Verify Health

Command:

```bash
curl -i "$PUBLIC_ORIGIN/api/health"
pm2 status "$APP_NAME"
pm2 logs "$APP_NAME" --lines 50 --nostream
```

Expected result:

- `GET /api/health` returns `200`.
- PM2 status is `online`.
- Restart count stops increasing.
- No new shadow mismatch logs appear after rollback.

### 6.4 Confirm PostgreSQL Authoritative

Confirm environment:

```bash
pm2 env "$APP_NAME" | grep RATE_LIMIT_MODE
```

Expected output:

```text
RATE_LIMIT_MODE: postgres
```

Confirm internal report if available:

```ts
getRateLimitShadowHealth()
```

Expected shape:

```json
{
  "enabled": false,
  "runtimeMode": "postgres",
  "status": "disabled"
}
```

### 6.5 Verify Parity Disabled

Expected result after rollback:

- `totalComparisons` stops increasing.
- Shadow health reports `enabled: false`.
- Runtime mode reports `postgres`.
- Valkey command activity from rate-limit shadow traffic stops or returns to baseline.
- PostgreSQL continues serving rate-limit decisions.

If parity counters still increase after rollback, verify PM2 environment reload, process count, and whether multiple PM2 processes or old workers are still running.

## Phase 7 — Post-Rollback Validation

Complete this section after any emergency rollback or planned rollback.

### 7.1 Verify No User Impact

Check:

- Public health endpoint returns `200`.
- Login still works.
- Key validation still works.
- Delivery session creation still works.
- Delivery fetch still works.
- Dashboard authenticated pages still work.
- Rate-limited endpoints return expected PostgreSQL behavior.

### 7.2 Verify No API Regressions

Run smoke checks against production-safe endpoints:

```bash
curl -i "$PUBLIC_ORIGIN/api/health"
```

Expected output:

```text
HTTP/2 200
```

Review application logs:

```bash
pm2 logs "$APP_NAME" --lines 200 --nostream
```

Expected result:

- No new route errors.
- No middleware errors.
- No cleanup errors.
- No unexpected Valkey dependency failures.

### 7.3 Verify No Elevated Error Rate

Compare against pre-rollout baseline:

- 5xx rate.
- API latency.
- PM2 restart count.
- CPU.
- Memory.
- PostgreSQL latency.
- Cleanup duration.

Expected result:

- Metrics return to baseline or remain within normal variance.

### 7.4 Verify No Valkey Dependency Remaining

Confirm:

- `RATE_LIMIT_MODE=postgres`.
- Shadow health is disabled.
- Shadow comparisons stop increasing.
- Valkey can be temporarily unavailable without changing user-visible rate-limit behavior.
- PostgreSQL remains the only rate-limit authority.

Do not shut down Valkey as part of emergency rollback unless Valkey itself is causing host-level resource exhaustion. The rollback control is the runtime mode.

## Phase 8 — Canary Readiness Checklist

This section is documentation only. Do not implement canary during RC1.

Canary planning can begin only when all items are checked:

- [ ] 7-day shadow burn-in completed.
- [ ] PostgreSQL remained authoritative throughout burn-in.
- [ ] Total comparisons are representative of production traffic.
- [ ] Mismatch rate stayed within threshold.
- [ ] Every mismatch has a documented explanation.
- [ ] Backend failures are zero or fully explained and non-recurring.
- [ ] Comparison failures are zero.
- [ ] Average latency delta stayed within threshold.
- [ ] Valkey memory stayed below warning threshold.
- [ ] Valkey evictions stayed zero.
- [ ] Valkey reconnects are zero or explained.
- [ ] PM2 restart count did not increase unexpectedly.
- [ ] Application error rate did not increase.
- [ ] Cleanup remained healthy.
- [ ] PostgreSQL remained healthy.
- [ ] Rollback procedure is documented, understood, and executable in under one minute.
- [ ] Operators have reliable access to internal shadow metrics.
- [ ] Security review confirms logs do not contain sensitive identifiers.
- [ ] Product/engineering owner explicitly approves canary planning.

Canary remains out of scope for this runbook.

## Operator Checklist

Use this condensed checklist during rollout.

Pre-deployment:

- [ ] PM2 status is `online` and stable.
- [ ] Valkey returns `PONG`.
- [ ] Valkey memory, clients, reconnects, and evictions are acceptable.
- [ ] PostgreSQL simple query succeeds.
- [ ] Cleanup endpoint succeeds.
- [ ] PostgreSQL backup is complete and recorded.
- [ ] Environment variables are verified.
- [ ] `RATE_LIMIT_MODE=postgres` before deployment.
- [ ] Rollback owner is present or on call.

Deployment:

- [ ] Approved release is deployed.
- [ ] Build succeeds.
- [ ] PM2 restarts successfully in `postgres` mode.
- [ ] `/api/health` returns `200`.
- [ ] Logs show no new errors.

Shadow enablement:

- [ ] `RATE_LIMIT_MODE=shadow` is set.
- [ ] PM2 restarts with updated environment.
- [ ] `/api/health` returns `200`.
- [ ] Internal shadow health reports `enabled: true`.
- [ ] Runtime mode reports `shadow`.
- [ ] Comparisons increase after traffic.
- [ ] Backend failures remain `0`.
- [ ] Comparison failures remain `0`.

Burn-in:

- [ ] Daily metrics are recorded for 7 days.
- [ ] Mismatch rate remains within threshold.
- [ ] Latency delta remains within threshold.
- [ ] Valkey health remains stable.
- [ ] PM2 and application errors remain stable.
- [ ] Cleanup remains healthy.

## Rollback Checklist

Target: complete in under one minute.

- [ ] Set `RATE_LIMIT_MODE=postgres`.
- [ ] Run `pm2 restart "$APP_NAME" --update-env`.
- [ ] Confirm PM2 status is `online`.
- [ ] Confirm `/api/health` returns `200`.
- [ ] Confirm PM2 environment shows `RATE_LIMIT_MODE=postgres`.
- [ ] Confirm shadow health reports disabled if internal helper is available.
- [ ] Confirm shadow comparisons stop increasing.
- [ ] Confirm PostgreSQL rate-limit behavior continues.
- [ ] Record rollback time, trigger, operator, and validation results.

## Success Criteria

RC1 shadow rollout is successful when:

- Shadow mode runs for 7 days without user-visible behavior changes.
- PostgreSQL remains authoritative for all rate-limit decisions.
- Public API behavior remains unchanged.
- Routes, middleware, cleanup, and database schema remain unchanged.
- Total comparisons are representative of production traffic.
- Mismatch rate is at or below threshold.
- Backend failures are zero or fully explained and non-recurring.
- Comparison failures are zero.
- Average latency delta remains within threshold.
- Valkey memory and reconnect behavior remain stable.
- PM2 restarts and application errors do not increase.
- Cleanup remains healthy.
- Operators can produce an operational snapshot on demand.
- Emergency rollback remains available and can complete in under one minute.

## Risk Assessment

| Risk | Impact | Likelihood In Shadow Mode | Mitigation | Rollback Trigger |
|---|---|---:|---|---|
| Valkey unavailable | Shadow metrics show backend failures; user response should remain PostgreSQL-driven. | Medium | Keep PostgreSQL authoritative, monitor backend failures, suppress non-mismatch production impact. | Repeated backend failures or host instability. |
| Semantic mismatch | Blocks canary readiness. | Medium | Monitor mismatch rate, inspect mismatch reasons, keep canary disabled. | Mismatch rate exceeds threshold or unexplained pattern appears. |
| Latency overhead | Request processing may spend extra time executing Valkey shadow work. | Low to Medium | Monitor average latency delta and API P95/P99. | Sustained latency regression or CPU saturation. |
| Metrics blind spot | Operators cannot make rollout decisions. | Medium | Verify internal report helpers and daily observation notes. | Loss of observability during rollout. |
| Sensitive logging | Security exposure. | Low | Mismatch logs must not include raw IPs, emails, tokens, session IDs, or raw keys. | Any sensitive identifier appears in logs. |
| PM2 environment drift | Wrong mode after restart. | Medium | Verify `pm2 env` after every restart. | Mode differs from intended value. |
| Valkey memory pressure | Host resource pressure or evictions. | Medium | Monitor memory and evictions. | Memory > 85% budget or any unexplained eviction. |
| PostgreSQL incident during rollout | Authoritative path affected. | Low to Medium | Validate PostgreSQL before rollout; keep backup complete. | PostgreSQL health degradation. |

## Operational Recommendations

- Treat RC1 as observation only. Do not enable canary traffic.
- Keep `RATE_LIMIT_MODE=postgres` as the immediate rollback value.
- Keep rollback commands prepared in the operator shell before enabling shadow mode.
- Record daily burn-in metrics in a shared incident/release note.
- Investigate mismatches by reason first: decision mismatch, retry-after mismatch, error state mismatch, comparison failure.
- Prioritize backend failures and comparison failures over small latency deltas because they indicate reliability or instrumentation risk.
- Do not tune Valkey memory or eviction policy during burn-in unless required for stability; operational changes invalidate parts of the observation window.
- Do not add public metrics endpoints during rollout.
- Do not remove PostgreSQL rate-limit tables or cleanup jobs.
- Do not proceed to canary without a separate canary design and approval.

## Final RC1 Boundary

Allowed in RC1:

- Deploy completed Phase 7D code.
- Enable `RATE_LIMIT_MODE=shadow`.
- Observe internal metrics.
- Roll back to `RATE_LIMIT_MODE=postgres`.

Not allowed in RC1:

- Canary rollout.
- Authority switch.
- Dual write rollout.
- Metrics persistence.
- Public observability endpoints.
- Database schema changes.
- Cleanup migration.
- PostgreSQL removal.
