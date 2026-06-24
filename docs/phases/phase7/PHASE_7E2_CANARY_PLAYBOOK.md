# Phase 7E.2 Canary Playbook

Status: Operational Readiness Prepared
Date: 2026-06-24
Scope: Documentation-only playbook for a separately approved production canary
Audience: Production operators approving, activating, monitoring, or rolling back the Phase 7E.2 Valkey rate-limit canary

This playbook prepares the project for a safe 1% production canary rollout. It does not enable canary, modify runtime behavior, change application code, change production environment variables, change schemas, or authorize Valkey as the default authoritative backend.

## Objective

Prepare a controlled, observable, and reversible Phase 7E.2 production canary that routes a small percentage of rate-limit decisions to Valkey while retaining an immediate configuration-only rollback path to PostgreSQL authority.

Production activation must require only approved environment configuration changes and a normal deployment. This playbook does not approve activation.

Primary objective:

- Begin with a 1% production canary only after separate rollout approval.

Secondary objectives:

- Preserve user-visible API behavior.
- Confirm Valkey can serve authoritative canary decisions without mismatches, backend failures, comparison failures, or fallbacks.
- Use quantitative gates before increasing canary exposure.
- Keep PostgreSQL rollback available through `RATE_LIMIT_MODE=postgres`.

## Scope

In scope:

- Operational readiness for Phase 7E.2.
- Baseline metric capture before activation.
- Manual canary activation procedure after separate approval.
- Monitoring checklist for 1%, 5%, 10%, 25%, 50%, and 100% stages.
- Quantitative rollout gates between stages.
- Manual rollback checklist.
- Rollout log template.

Out of scope:

- Enabling canary in this documentation change.
- Runtime behavior changes.
- Production environment variable changes.
- Application code changes.
- API contract changes.
- Database schema changes.
- Valkey authoritative default mode outside the approved canary percentage.
- PostgreSQL rate-limit retirement.
- Circuit breaker or automatic rollback implementation.

## Prerequisites

Do not start a canary unless every prerequisite is satisfied.

- Phase 7E.1 remains production verified.
- Production health endpoint reports `status=healthy`.
- PostgreSQL is healthy and remains available for rollback.
- Valkey is healthy, connected, and has no active memory, eviction, reconnect, or saturation incident.
- Current production is stable before activation.
- Canary remains disabled until a separate production rollout approval is recorded.
- Operators have access to deploy configuration changes through the approved production deployment path.
- Operators have access to `/api/health` and the admin-only `/api/internal/rate-limit-shadow` endpoint.
- Recent production deployment verification has passed.
- Current production baseline metrics have been recorded in the rollout log.
- Incident owner, rollout owner, and rollback owner are assigned.

## Current Readiness Assessment

The Phase 7E.2 canary implementation is operationally ready for a separately approved 1% activation based on the current code audit and production baseline.

Implementation readiness:

- `RATE_LIMIT_MODE=valkey_canary` is a recognized runtime mode.
- `RATE_LIMIT_CANARY_PERCENT` is parsed as an integer percentage from `0` through `100`; missing, invalid, or out-of-range values safely resolve to `0` through `100` bounds.
- Deterministic routing uses a SHA-256 hash of a stable rate-limit identifier and selects Valkey when the stable bucket is below the configured percentage.
- PostgreSQL remains authoritative for non-canary traffic.
- Valkey-authoritative canary traffic still runs PostgreSQL as the comparison backend.
- Fallback logic returns to PostgreSQL when Valkey-authoritative execution fails.
- Rollout counters expose PostgreSQL requests, Valkey requests, canary requests, fallback count, and authoritative write counters.
- Health reporting exposes runtime mode, canary percentage, parity, mismatch rate, backend failures, comparison failures, latency diagnostics, Valkey health, PostgreSQL health, runtime metadata, and operator notes.
- Rollback is configuration-only: set `RATE_LIMIT_MODE=postgres`, deploy normally, and verify health.

Current production baseline:

- PostgreSQL authoritative.
- Valkey shadow.
- Allow parity: `100%`.
- Deny parity: `100%`.
- Retry-after parity: `100%`.
- Mismatch rate: `0`.
- Backend failures: `0`.
- Comparison failures: `0`.
- Runtime health: `healthy`.
- Canary: disabled.

Operational readiness conclusion: no runtime, environment, nginx, schema, or API behavior change is required before a separately approved 1% canary activation.

## Exposed Operational Metrics

Use `/api/health` as the primary production health endpoint.

Current `/api/health` fields relevant to canary rollout:

- `status` and `summary`: overall health state.
- `postgres.status` and `postgres.connected`: PostgreSQL readiness and rollback backend availability.
- `valkey.enabled`, `valkey.connected`, `valkey.status`, `valkey.connectionState`, `valkey.latencyMs`, `valkey.memoryUsedBytes`, `valkey.version`, and `valkey.uptimeSeconds`: Valkey readiness.
- `rateLimit.runtimeMode`: effective rate-limit runtime mode.
- `rateLimit.health`: rate-limit health state.
- `rateLimit.backendFailures`: backend failure count.
- `rateLimit.comparisonFailures`: comparison failure count.
- `rateLimit.mismatchRate`: shadow/canary comparison mismatch rate.
- `rateLimit.parity`: total parity ratio.
- `rateLimit.averageLatencyDeltaMs`: shadow/canary latency delta where positive means the shadow backend is slower than the authoritative backend for the current comparison direction.
- `rollout.mode`: effective rollout mode.
- `rollout.canaryPercentage`: effective canary percentage.
- `rollout.canaryRequests`: Valkey-selected canary requests.
- `rollout.postgresRequests`: PostgreSQL-served requests, including fallback increments.
- `rollout.valkeyRequests`: Valkey-authoritative requests.
- `rollout.fallbackCount`: canary fallback count.
- `rollout.postgresAuthoritativeWrites`: current PostgreSQL authoritative write counter alias.
- `rollout.valkeyAuthoritativeWrites`: current Valkey authoritative write counter alias.
- `performance.latencyDifferenceMs`, `performance.direction`, and `performance.speedup`: human-readable latency diagnostics.
- `runtime.phase`, `runtime.milestone`, `runtime.release`, `runtime.startedAt`, and `runtime.uptimeSeconds`: runtime metadata.
- `notes`: operator-facing current-state notes.

Use `/api/internal/rate-limit-shadow` as the admin-only detailed rate-limit monitoring endpoint.

Current `/api/internal/rate-limit-shadow` fields relevant to canary rollout:

- `enabled`: whether shadow health mode is enabled for the current runtime mode.
- `runtimeMode`: effective rate-limit runtime mode.
- `runtime`: phase, release, runtime mode, start time, and uptime.
- `rollout`: same rollout metrics used by `/api/health`.
- `health.status`, `health.backendFailures`, and `health.comparisonFailures`: rate-limit health details.
- `metrics.totalComparisons`, `metrics.identical`, `metrics.mismatches`, and `metrics.mismatchRate`: comparison counts and mismatch rate.
- `metrics.latency.postgresAverageMs`, `metrics.latency.valkeyAverageMs`, and `metrics.latency.deltaAverageMs`: backend latency averages and Valkey-minus-PostgreSQL delta.
- `metrics.averageLatencyDeltaMs`: compatibility latency delta field.
- `decisionParity.allow`: allow decision parity totals and rate.
- `decisionParity.deny`: deny decision parity totals and rate.
- `retryAfterParity`: retry-after parity totals and rate.
- `valkey`: Valkey health details, including check timestamp.
- `lastUpdatedAt`: most recent comparison metric update.
- `operationalSummary`: concise operator-readable summary.

Metrics not required before a 1% canary:

- Separate canary allow rate and canary deny rate are not required for initial activation because allow parity, deny parity, total comparison counts, mismatch rate, and HTTP 429 behavior already cover the safety decision. They may become useful if operators need traffic-mix diagnostics after 1%.
- Persistent parity history is not required for initial activation because the rollout log records stage snapshots. It is valuable for later Grafana/Prometheus work and long burn-in analysis.
- Rollout start time and rollout duration are not required in runtime responses because this playbook records them in the rollout log. They may be useful later if rollout state becomes system-managed rather than operator-managed.

Recommended future metric additions, not required to unblock 1%:

- `fallbackReasons`: count fallback causes such as Valkey authoritative exception, missing Valkey result, or comparison execution failure. This would reduce incident triage time if `fallbackCount` becomes non-zero.
- `windowedRolloutRates`: short-window canary, PostgreSQL, Valkey, fallback, allow, and deny rates. This would make dashboarding easier but is not necessary for manual 1% activation.
- `parityHistory`: persisted rolling parity windows. This belongs with future monitoring infrastructure rather than the readiness phase.

## Baseline Metrics

Capture baseline metrics immediately before activation from `/api/health` and `/api/internal/rate-limit-shadow`.

Required metrics:

| Metric | Meaning | Required pre-rollout value |
|---|---|---|
| `parity` | Agreement ratio between PostgreSQL and Valkey decisions. | `1` or `100%` |
| `mismatchRate` | Rate of PostgreSQL/Valkey decision mismatches. | `0` |
| `backendFailures` | Backend execution failures in the rate-limit path. | `0` |
| `comparisonFailures` | Failures while comparing PostgreSQL and Valkey results. | `0` |
| `fallbackCount` | Count of canary requests that fell back instead of completing on intended authority. | `0` |
| `postgresRequests` | Requests served by PostgreSQL authority during the observation window. | Record current value and rate |
| `valkeyRequests` | Requests served by Valkey authority during the observation window. | `0` before canary, unless an approved canary is already active |
| `canaryRequests` | Requests selected for canary routing. | `0` before canary |
| `latencyDifferenceMs` | Absolute latency difference from `/api/health.performance`, with direction in `/api/health.performance.direction`. | Record value |
| `metrics.latency.deltaAverageMs` | Valkey average latency minus PostgreSQL average latency from `/api/internal/rate-limit-shadow`; negative values mean Valkey is faster. | Record value |
| `speedup` | Relative latency improvement when available. | Record value |

Baseline health fields:

- Overall system health: `healthy`.
- Rate-limit health: `healthy`.
- PostgreSQL status: `healthy`.
- Valkey status: `healthy`.
- Canary percentage: `0` before activation.

## Pre-Rollout Checklist

Complete before setting any canary percentage.

- [ ] Confirm this is an approved Phase 7E.2 operational rollout window.
- [ ] Confirm production is healthy.
- [ ] Confirm PostgreSQL is healthy.
- [ ] Confirm Valkey is healthy.
- [ ] Confirm allow parity is `100%`.
- [ ] Confirm deny parity is `100%`.
- [ ] Confirm retry-after parity is `100%`.
- [ ] Confirm mismatch count is `0`.
- [ ] Confirm `mismatchRate == 0`.
- [ ] Confirm `backendFailures == 0`.
- [ ] Confirm `comparisonFailures == 0`.
- [ ] Confirm `fallbackCount == 0`.
- [ ] Confirm no production incident is active.
- [ ] Confirm no unrelated deployment is in progress.
- [ ] Confirm current runtime behavior is unchanged from the Phase 7E.1 baseline.
- [ ] Confirm current mode is the approved pre-canary baseline.
- [ ] Confirm `/api/health` reports healthy system health.
- [ ] Confirm `/api/internal/rate-limit-shadow` is accessible to authorized operators.
- [ ] Record all required baseline metrics.
- [ ] Confirm Valkey memory, connection state, and latency are within expected baseline.
- [ ] Confirm PostgreSQL latency and availability are within expected baseline.
- [ ] Confirm deployment is complete before activation begins.
- [ ] Confirm rollback owner can change production configuration to `RATE_LIMIT_MODE=postgres` immediately.
- [ ] Confirm deployment verification procedure is ready.
- [ ] Confirm rollout log is open and being updated.

## Activation Procedure

Activation requires separate approval. This repository change does not activate canary.

1. Announce the approved rollout window and assigned operators.
2. Record pre-activation baseline metrics in the rollout log.
3. Confirm system health is `healthy` immediately before activation.
4. Apply the approved production configuration for 1% canary through the normal deployment path: `RATE_LIMIT_MODE=valkey_canary` and `RATE_LIMIT_CANARY_PERCENT=1`.
5. Deploy using the standard production deployment process.
6. Verify deployment completion.
7. Confirm `/api/health` reports the expected canary percentage.
8. Confirm `canaryRequests` begins increasing under production traffic.
9. Confirm user-visible API behavior remains unchanged.
10. Begin the monitoring checklist for the 1% stage.

Activation checklist:

- [ ] `RATE_LIMIT_MODE=valkey_canary` configured through the approved production path.
- [ ] `RATE_LIMIT_CANARY_PERCENT=1` configured through the approved production path.
- [ ] Normal deployment completed.
- [ ] `/api/health.rollout.mode` reports `valkey_canary`.
- [ ] `/api/health.rollout.canaryPercentage` reports `1`.
- [ ] `/api/internal/rate-limit-shadow.runtimeMode` reports `valkey_canary`.

Do not advance beyond 1% until the 1% stage satisfies all success criteria and rollout gates.

## Monitoring Checklist

Monitor continuously during each stage: 1%, 5%, 10%, 25%, 50%, and 100%.

Required observations:

- `parity` remains `1` or `100%`.
- Allow parity remains `100%`.
- Deny parity remains `100%`.
- Retry-after parity remains `100%`.
- `mismatchRate` remains `0`.
- `backendFailures` remains `0`.
- `comparisonFailures` remains `0`.
- `fallbackCount` remains `0`.
- `postgresRequests` continues to reflect expected non-canary traffic until 100%.
- `valkeyRequests` increases in proportion to canary percentage.
- `canaryRequests` increases and roughly tracks the configured canary percentage over a reasonable traffic window.
- `latencyDifferenceMs` remains understood and does not indicate a material regression.
- `speedup` remains understood and does not mask failure conditions.
- Overall system health remains `healthy`.
- Rate-limit health remains `healthy`.
- PostgreSQL remains healthy.
- Valkey remains healthy.
- No unexpected application errors appear in production logs.
- No user-visible error-rate increase is observed.
- No unexpected HTTP 429 behavior is observed beyond configured rate limits.

Verification checklist:

- [ ] Observe `/api/health` and `/api/internal/rate-limit-shadow` metrics.
- [ ] Observe `fallbackCount` remains `0`.
- [ ] Observe latency metrics and confirm no material regression.
- [ ] Observe allow, deny, retry-after, and total parity remain at `100%`.

Latency note: `latencyDifferenceMs` and `speedup` are diagnostic rollout signals, not override criteria. A faster Valkey result does not compensate for any mismatch, backend failure, comparison failure, fallback, or unhealthy system status.

## Success Criteria

A canary stage is successful only when all criteria are true for the agreed observation window.

- `mismatchRate == 0`.
- `backendFailures == 0`.
- `comparisonFailures == 0`.
- `fallbackCount == 0`.
- System health is `healthy`.
- Rate-limit health is `healthy`.
- PostgreSQL health is `healthy`.
- Valkey health is `healthy`.
- `canaryRequests` confirms real production traffic reached the canary path.
- `valkeyRequests` confirms Valkey served the canary path.
- No user-visible runtime behavior regression is observed.
- No unexplained production error-rate increase is observed.
- Rollout owner records approval to advance.

## Failure Criteria

Trigger rollback immediately if any failure criterion is met.

- `mismatchRate > 0`.
- `backendFailures > 0`.
- `comparisonFailures > 0`.
- `fallbackCount > 0`.
- System health is not `healthy`.
- Rate-limit health is not `healthy`.
- PostgreSQL health is not `healthy`.
- Valkey health is not `healthy`.
- Canary traffic causes unexpected HTTP 429 behavior.
- User-visible API behavior changes unexpectedly.
- Production error rate increases and cannot be explained by unrelated incidents.
- Operators cannot confidently read canary metrics.
- Deployment verification fails after a canary change.

## Quantitative Rollout Gates

Each gate requires explicit approval and a completed rollout log entry. Do not skip stages.

| Gate | Required conditions before advancing |
|---|---|
| 1% -> 5% | `mismatchRate == 0`; `backendFailures == 0`; `comparisonFailures == 0`; `fallbackCount == 0`; system health == `healthy`; canary traffic observed; deployment verification passed. |
| 5% -> 10% | `mismatchRate == 0`; `backendFailures == 0`; `comparisonFailures == 0`; `fallbackCount == 0`; system health == `healthy`; canary traffic observed; deployment verification passed. |
| 10% -> 25% | `mismatchRate == 0`; `backendFailures == 0`; `comparisonFailures == 0`; `fallbackCount == 0`; system health == `healthy`; canary traffic observed; deployment verification passed. |
| 25% -> 50% | `mismatchRate == 0`; `backendFailures == 0`; `comparisonFailures == 0`; `fallbackCount == 0`; system health == `healthy`; canary traffic observed; deployment verification passed. |
| 50% -> 100% | `mismatchRate == 0`; `backendFailures == 0`; `comparisonFailures == 0`; `fallbackCount == 0`; system health == `healthy`; canary traffic observed; deployment verification passed. |

Hold criteria:

- Hold the current percentage if metrics are healthy but traffic volume is too low to validate the stage.
- Hold the current percentage if latency metrics are ambiguous but all failure criteria remain false.
- Do not advance during an unrelated active incident.

## Rollback Procedure

Rollback must require only `RATE_LIMIT_MODE=postgres` plus deployment verification.

1. Set production configuration to `RATE_LIMIT_MODE=postgres` through the approved deployment path.
2. Leave `RATE_LIMIT_CANARY_PERCENT` unchanged or remove it according to normal configuration hygiene; it is ignored when `RATE_LIMIT_MODE=postgres` is active.
3. Deploy or restart using the standard production process required for the configuration change to take effect.
4. Verify deployment completion.
5. Confirm `/api/health.rateLimit.runtimeMode` reports `postgres`.
6. Confirm `/api/health.rollout.mode` reports `postgres`.
7. Confirm `/api/internal/rate-limit-shadow.runtimeMode` reports `postgres`.
8. Confirm canary authority is no longer active.
9. Confirm system health is `healthy` or returns to the known PostgreSQL baseline.
10. Confirm user-visible behavior has returned to the PostgreSQL authoritative baseline.
11. Record rollback time, owner, reason, and post-rollback metrics in the rollout log.

Rollback checklist:

- [ ] `RATE_LIMIT_MODE=postgres` configured through the approved production path.
- [ ] Normal deployment completed.
- [ ] `/api/health` reports PostgreSQL authority.
- [ ] `/api/internal/rate-limit-shadow` reports `runtimeMode=postgres`.
- [ ] Health verified after rollback.
- [ ] Rollback recorded in the rollout log.

Rollback completion criteria:

- `RATE_LIMIT_MODE=postgres` is active in production.
- Deployment verification passed.
- PostgreSQL authoritative behavior is confirmed.
- Canary authority is no longer active.

## Post-Rollout Validation

Complete after each successful stage and after rollback if rollback occurs.

- Record final metrics for the stage.
- Confirm system health remains `healthy`.
- Confirm `mismatchRate == 0`.
- Confirm `backendFailures == 0`.
- Confirm `comparisonFailures == 0`.
- Confirm `fallbackCount == 0`.
- Confirm request counters match expected stage behavior.
- Confirm latency metrics are recorded and understood.
- Confirm no user-visible runtime behavior changed.
- Confirm logs show no unexpected application errors.
- Confirm rollout owner signed off on the stage outcome.
- If at 100%, document whether Phase 7E.2 is complete or whether additional burn-in is required before any future Valkey authoritative runtime work.

## Rollout Log Template

Copy this template for each rollout stage.

```text
Phase 7E.2 Canary Rollout Log

Stage percentage:
Gate:
Date:
Rollout window:
Rollout owner:
Incident owner:
Rollback owner:
Approval reference:

Pre-stage state:
- RATE_LIMIT_MODE:
- Configured canary percentage:
- System health:
- Rate-limit health:
- PostgreSQL health:
- Valkey health:

Baseline metrics:
- parity:
- allow parity:
- deny parity:
- retry-after parity:
- mismatchRate:
- mismatch count:
- backendFailures:
- comparisonFailures:
- fallbackCount:
- postgresRequests:
- valkeyRequests:
- canaryRequests:
- latencyDifferenceMs:
- metrics.latency.deltaAverageMs:
- speedup:

Activation details:
- Change applied at:
- Deployment completed at:
- Deployment verification result:
- /api/health verification result:
- /api/internal/rate-limit-shadow verification result:

Monitoring observations:
- Observation window:
- parity:
- allow parity:
- deny parity:
- retry-after parity:
- mismatchRate:
- mismatch count:
- backendFailures:
- comparisonFailures:
- fallbackCount:
- postgresRequests:
- valkeyRequests:
- canaryRequests:
- latencyDifferenceMs:
- metrics.latency.deltaAverageMs:
- speedup:
- System health:
- Notes:

Gate decision:
- Advance / Hold / Rollback:
- Decision time:
- Decision owner:
- Reason:

Rollback record, if used:
- RATE_LIMIT_MODE=postgres set at:
- Deployment verification completed at:
- PostgreSQL authority confirmed:
- Canary authority stopped:
- Post-rollback health:
- Post-rollback notes:

Post-stage validation:
- User-visible behavior unchanged:
- Logs reviewed:
- Final approval:
- Follow-up actions:
```
