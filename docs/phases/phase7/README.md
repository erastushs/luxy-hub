# Phase 7 — Access Modes, Keys, and License Authorization

This README is the primary navigation and current-status page for Phase 7 documentation. Older planning documents are preserved for history, but this page reflects the current production architecture and rollout state.

## Current Phase Status

| Phase | Status | Notes |
|---|---|---|
| Phase 7A | Complete | License/access foundation is production ready. |
| Phase 7B | Complete for backend infrastructure | Runtime popup validation remains separate planned runtime work. |
| Phase 7C | Complete | Production runtime performance optimization is production validated. |
| Phase 7D | Engineering Complete / Production Baseline | PostgreSQL remains authoritative; Valkey runs in shadow mode with monitoring and rollback. |
| Phase 7E.1 | Production Verified ✅ | Canary infrastructure, rollout metrics, `/api/health`, shadow comparison, and Cloudflare client IP resolution are production verified. |
| Phase 7E.2 | Planned | Production canary rollout: 1% -> 5% -> 10% -> 25% -> 50% -> 100%. |

Current milestone: **Phase 7E.2 — Production Canary (Planned)**.

## Document Navigation

Architecture source of truth:

../../architecture/PHASE7_LICENSE_ARCHITECTURE.md

Phase 7B planning documents:

- `PHASE_7B_RUNTIME_INTEGRATION_SPEC.md`
- `PHASE_7B_DESIGN.md`
- `PHASE_7B_THREAT_MODEL.md`
- `PHASE7_KEY_MONETIZATION_MODEL.md`
- `../../roadmap/PHASE7_ROADMAP_REALIGNMENT_REPORT.md`

Phase 7D planning documents:

- `PHASE_7D_VALKEY_INTEGRATION_PLAN.md`
- `PHASE_7D_IMPLEMENTATION_SPEC.md`
- `PHASE_7D_OPERATIONAL_RUNBOOK.md`
- `PHASE_7D_RC1_PRODUCTION_ROLLOUT_RUNBOOK.md`

Historical documents:

- `historical/PHASE7_SCRIPT_SIZE_LIMIT.md`
- `historical/PHASE7_PASSWORD_MANAGEMENT.md`

## Current Production Architecture

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

PostgreSQL remains authoritative for durable product state, ownership, auth-derived user context, scripts, builds, keys, licenses, analytics history, audit history, and current rate-limit decisions. Valkey is implemented as a temporary operational layer and currently participates in rate-limit shadow comparison only.

## Current Runtime State

| Area | Current State |
|---|---|
| Runtime mode | `RATE_LIMIT_MODE=shadow` |
| Authoritative backend | PostgreSQL |
| Shadow backend | Valkey |
| Health | Healthy |
| Backend failures | 0 |
| Comparison failures | 0 |
| Parity | 100% |
| Mismatch rate | 0 |
| Canary | Disabled |
| Rollback | Immediate configuration rollback to `RATE_LIMIT_MODE=postgres` |
| Production canary | Not enabled; Phase 7E.2 planned for 1% canary |

Production validation completed successfully for sequential rate-limit testing, parallel rate-limit testing, high-concurrency testing, shadow comparison verification, health endpoint verification, PostgreSQL authoritative verification, Valkey shadow verification, runtime health verification, Cloudflare deployment verification, client IP resolution verification, and production HTTP 429 behavior after exceeding the configured request limit.

## Client IP Resolution

Production is behind Cloudflare. Client IP resolution must return one trimmed, non-empty IP using this priority order:

1. `CF-Connecting-IP`
2. `X-Vercel-Forwarded-For`
3. `X-Forwarded-For`
4. `X-Real-IP`
5. `127.0.0.1` fallback

For comma-separated forwarded headers, the first non-empty trimmed IP is the client IP.

### Resolved Production Incident

Production requests were previously bucketed by Cloudflare proxy IPs rather than the real client IP.

Root cause:

- Application client IP resolution did not prioritize `CF-Connecting-IP`.
- Application parsing selected the last value from `X-Forwarded-For`.
- Infrastructure nginx did not restore Cloudflare Real IP.

Resolution:

- Application now supports `CF-Connecting-IP`.
- Application now parses `X-Vercel-Forwarded-For` and `X-Forwarded-For` using the first client IP.
- Infrastructure enabled Cloudflare Real IP support with `real_ip_header CF-Connecting-IP`, `real_ip_recursive on`, and Cloudflare `set_real_ip_from` trusted proxy ranges.

Result: rate limiting now groups requests using the real client IP, and production verification confirmed HTTP 429 after exceeding the configured request limit.

## Operational Endpoints

### `/api/health`

Purpose: primary operational production health endpoint.

Major sections:

- `status`: overall operational status: `healthy`, `degraded`, or `unhealthy`.
- `summary`: counts PostgreSQL, Valkey, RateLimit, and Application service states.
- `postgres`: PostgreSQL configured/connected status.
- `valkey`: Valkey enabled, connected, status, connection state, latency, memory, version, and uptime summary from the existing Valkey health service.
- `rateLimit`: runtime mode, health, backend failures, comparison failures, mismatch rate, parity, and latency delta.
- `rollout`: rollout mode, canary percentage, PostgreSQL/Valkey request counters, fallback count, and authoritative write counters.
- `performance`: human-readable latency comparison, direction, and speedup when latency averages are available.
- `runtime`: phase `7`, milestone `7E.1`, release, start time, and uptime.
- `notes`: informational current-state notes for operators.

### `/api/internal/rate-limit-shadow`

Purpose: admin-only shadow monitoring endpoint.

Major sections:

- Shadow parity and mismatch metrics.
- PostgreSQL and Valkey latency metrics.
- Backend and comparison failure counts.
- Rollout metrics, including canary percentage, request counters, fallback count, and authoritative write counters.
- Valkey health summary.
- Runtime metadata and operator summary.

## Rollout Progress

Current track: **Shadow**.

Completed:

- Shadow execution.
- Shadow monitoring.
- Primary health endpoint.
- Operational metrics.
- Rollback documentation.
- Canary infrastructure with deterministic routing support.

Next:

- Phase 7E.2: 1% production canary, subject to explicit rollout approval.

## Migration Progress

| Area | State |
|---|---|
| PostgreSQL | Authoritative |
| Valkey | Shadow |
| Shadow parity | 100% production observation target/state |
| Backend failures | 0 target/state before canary |
| Comparison failures | 0 target/state before canary |
| Canary | Not enabled |
| PostgreSQL removal | Not planned in Phase 7E.1 |

## Operational KPIs

Track these KPIs before any Phase 7E.2 canary progression:

- Mismatch rate.
- Backend failures.
- Comparison failures.
- Fallback count.
- PostgreSQL authoritative writes.
- Valkey authoritative writes.
- PostgreSQL average latency.
- Valkey average latency.
- Latency direction and speedup.
- Valkey connection state, memory usage, reconnects, and evictions.

## Health Response Summary

Current `/api/health` shape is additive and should remain backward-compatible at the endpoint level:

```json
{
  "status": "healthy",
  "timestamp": "...",
  "summary": { "healthyServices": 4, "degradedServices": 0, "unhealthyServices": 0, "overall": "healthy" },
  "postgres": { "status": "healthy", "connected": true },
  "valkey": { "enabled": true, "connected": true, "status": "healthy", "connectionState": "ready" },
  "rateLimit": { "runtimeMode": "shadow", "health": "healthy", "parity": 1 },
  "rollout": { "mode": "shadow", "canaryPercentage": 0, "postgresAuthoritativeWrites": 1000, "valkeyAuthoritativeWrites": 0 },
  "performance": { "latencyDifferenceMs": 69.8, "direction": "valkey_faster", "speedup": 63.0 },
  "runtime": { "phase": "7", "milestone": "7E.1", "release": "RC1", "startedAt": "...", "uptimeSeconds": 3600 },
  "notes": ["PostgreSQL remains authoritative by default."]
}
```

## Roadmap And Backlog

Current:

- Phase 7E.1: Production Verified ✅

Next:

- Phase 7E.2 Production Canary: 1% -> 5% -> 10% -> 25% -> 50% -> 100%

Future:

- Valkey authoritative runtime.
- PostgreSQL rate-limit retirement.
- Grafana.
- Prometheus.
- Alertmanager.
- Historical parity.
- Circuit breaker.
- Automatic rollback.

## Long-Term Backlog

### Observability V2

- Build metadata in `/api/health`.
- Git commit.
- Branch.
- Build timestamp.
- Release version.

### Operational Dashboard

- Unified `/api/internal/system` endpoint.
- Worker status.
- Cleanup status.
- Queue status.
- Storage status.
- PM2 status.

### Monitoring

- Grafana dashboard.
- Prometheus exporter.
- Alertmanager integration.
- Discord alerts.
- Historical latency metrics.
- Historical parity metrics.

### Valkey

- Persistent metrics.
- Automatic rollback.
- Adaptive canary rollout.
- Circuit breaker.
- Multi-node readiness.
- Sentinel/Cluster planning.

### Deployment

- Blue/Green deployment.
- Release manifest.
- Deployment history.
- Version compatibility matrix.

## ADR References

- ADR-010: Client IP Resolution Behind Reverse Proxies.

Future ADR topics must use the next available ADR number in `docs/architecture/decisions/` to avoid conflicts with existing ADR-001 through ADR-010.

Current Status:
Phase 7A is complete / production ready. Phase 7B backend monetization infrastructure is complete. Phase 7C production runtime performance optimization is complete. Phase 7D engineering is complete and forms the production baseline. Phase 7E.1 observability and canary infrastructure is production verified. Runtime popup validation remains planned because the Roblox runtime does not yet call `POST /api/validate` before main script execution. Premium license runtime enforcement and license hardening are deferred future license work, not completed Phase 7C work.

Phase 7B Status:

- Name: Backend Key Monetization Platform
- Status: Complete for backend infrastructure
- Runtime UX note: Runtime popup validation is not integrated into the Roblox runtime
- Implementation: Backend monetization infrastructure is complete. Device Limits, Premium Keys, and Free Keys are enforced through `POST /api/validate`. Runtime loader execution is not yet gated and delivered payloads currently execute directly.
- Design: Refined
- Threat Model: Refined
- Documentation: Refined
- Backend Infrastructure estimate: 100%
- Runtime popup validation estimate: 0%
- Backend platform completion estimate: 100%

Phase 7C Status:

- Name: Production Runtime Performance
- Status: Complete / Production Validated
- Implementation: Delivery session creation avoids unnecessary `payload_ciphertext` reads; ready build metadata projection is implemented; event write projections omit payload; cleanup batching is improved; safe expired delivery session cleanup preserves execution analytics references; runtime API behavior is preserved

Phase 7D Status:

- Name: Database Scalability & Runtime Optimization
- Status: Engineering Complete / Production Baseline (RC1)
- Scope: Valkey infrastructure, rate-limit shadow mode, internal monitoring, primary health endpoint reporting, production burn-in workflow, and post-optimization observability review
- RC1 constraints: PostgreSQL remains authoritative, Valkey remains shadow-only, canary remains disabled, no schema changes, no migrations, no cleanup changes, no middleware changes, and no production authority change by default

Approved access modes:

- `public`
- `key_required`
- `license_required`

Implementation guardrails:

- `visibility` and `access_mode` are separate concerns.
- Authorization occurs only during `POST /api/delivery/session`.
- Existing Work.ink endpoints remain supported but must become one provider in a provider-agnostic key platform.
- Phase 7B.6 runtime key integration must call `POST /api/validate` and must not change Delivery Session Architecture, Delivery Fetch Architecture, Runtime Payload Delivery, Event Platform, Analytics Pipeline, or Build System.
- Device Limits and Premium Keys remain enforced through `POST /api/validate`; no `DeviceLimitService` or Premium Key backend changes are required for Phase 7B.6.
- Phase 7B backend work must not be reopened for premium licenses, license assignments, customer identifiers, HWID binding, device transfer workflows, license entitlements, license analytics, or license hardening.
- Premium licenses use hashed license keys, nullable `expires_at`, and assignment foundations from Phase 7A, but all runtime hardening and lifecycle expansion is deferred future license work.

## Phase 7A Completion

Status: COMPLETE / PRODUCTION READY

Completed milestones:

- 7A.1 Schema Foundation
- 7A.2 Access Authorization Layer
- 7A.3 Key Validation Integration
- 7A.4 License Lifecycle Management
- 7A.4.5 Assignment System
- 7A.5 Runtime License Validation Foundation
- 7A.6 License Dashboard UI
- 7A.7 License Analytics UI
- 7A.8 License UX Polish
- 7A.9 UI Remediation

## Implemented Functionality

### Keys

- Existing free key generation.
- Existing Work.ink verification flow.
- Existing key validation.
- Existing key expiration through `expires_at`.
- Existing Work.ink token replay protection.
- Existing `key_required` authorization foundation at the delivery-session boundary.

### License Foundation

- Create license keys.
- Enable disabled licenses.
- Disable active licenses.
- Revoke eligible licenses.
- Raw license keys are displayed only immediately after creation.
- License hardening is deferred future license work.

### Assignments

- Create assignments with hashed customer identifiers and optional display names.
- Remove assignments through the dashboard/API.
- Assignment capacity enforcement, assignment lifecycle expansion, customer identifiers, HWID binding, and device transfer workflows are deferred future license work.

### Access Modes

- `public`
- `key_required`
- `license_required`

### Dashboard

- License Management screen at `/dashboard/licenses`.
- License Analytics screen at `/dashboard/licenses/analytics`.
- Search, filters, sorting, bulk selection UI, confirmation dialogs, loading states, empty states, and mobile remediation are implemented.
- Dashboard key issuance is not implemented yet and belongs to Phase 7B.

## Phase 7B — Key Monetization Platform

Objectives:

- Connect Roblox runtime to the completed backend key platform.
- Add runtime popup UI for Free Keys, Premium Keys, and Future Providers.
- Request key input, show validation status, show validation errors, and block execution until validation succeeds.
- Call `POST /api/validate` with `key`, `executor_identifier`, and `client_identifier`.
- Require `validation_success == true` before Main Script execution.
- Preserve existing delivery, event, analytics pipeline, and build-system architecture.

Deliverables:

- Phase 7B.6 Runtime Key Integration.
- Runtime popup UI.
- Runtime `POST /api/validate` request.
- Runtime validation success/failure handling.
- Runtime execution gate before Main Script execution.
- Phase 7B.7 Analytics Foundation with `KEY_VALIDATED`, `KEY_VALIDATION_FAILED`, `DEVICE_REGISTERED`, `DEVICE_REUSED`, and `DEVICE_LIMIT_DENIED`.
- Phase 7B.8 Device Analytics Dashboard.
- Phase 7B.9 Manual Device Reset.
- Phase 7B.10 Linkvertise and LootLabs Provider Expansion.
- Phase 7B.11 Unified Monetization Analytics.

Success criteria:

- Runtime popup requests key input.
- Runtime popup shows validation status and errors.
- Runtime calls `POST /api/validate` with `key`, `executor_identifier`, and `client_identifier`.
- Validation success response `{ "success": true }` allows Main Script execution.
- Validation failure response `{ "success": false, "message": "..." }` blocks Main Script execution.
- Free Keys, Premium Keys, and Device Limits are enforced exclusively through `POST /api/validate`.
- No Delivery Session Architecture, Delivery Fetch Architecture, Runtime Payload Delivery, Event Platform, Analytics Pipeline, or Build System changes are required.
- No premium license work is required for Phase 7B release.

Risks:

- Runtime loader currently executes delivered payloads directly.
- Popup validation can leak raw keys or identifiers if logs/errors are not sanitized.
- Duplicating device-limit logic in runtime can diverge from backend enforcement.
- Changing protected delivery, event, analytics pipeline, or build-system components would expand Phase 7B.6 beyond the intended blocker.
- Lifetime Keys are deferred until monetization requirements justify implementation.

## Phase 7C — Production Runtime Performance

Objectives:

- Reduce production database read payloads and write return sizes without changing runtime API behavior.
- Avoid loading `payload_ciphertext` during session creation and rebuild invalidation when metadata is sufficient.
- Optimize event write return projections.
- Improve cleanup batching.
- Safely prune expired delivery sessions that are not referenced by execution analytics.

Completed items:

- [x] Delivery session creation uses ready build metadata projection and no longer selects `payload_ciphertext`.
- [x] Ready build metadata projection implemented.
- [x] Rebuild invalidation uses metadata-only previous ready build lookup.
- [x] Event write return projections omit event `payload`.
- [x] Rate-limit cleanup batching improved.
- [x] Expired delivery session cleanup deletes only sessions without `script_executions` references.
- [x] Runtime API behavior preserved.
- [x] Production validation completed.
- [x] Performance audit completed.

Current caveats:

- Runtime fetch still intentionally reads `payload_ciphertext` server-side to generate `runtime_payload`.
- Sessions referenced by `script_executions` are retained; true delivery session TTL cleanup requires planned Phase 7D database decoupling.

## Phase 7D — Database Scalability & Runtime Optimization

Status: Engineering Complete (RC1).

Primary planning document:

- `PHASE_7D_VALKEY_INTEGRATION_PLAN.md`
- `PHASE_7D_IMPLEMENTATION_SPEC.md`
- `PHASE_7D_OPERATIONAL_RUNBOOK.md`

RC1 scope:

- Phase 7D.0 Production Baseline: production metrics and rollback criteria are documented for RC1 burn-in.
- Phase 7D.1 Infrastructure: Valkey connection, metrics, and health helpers are available without making Valkey authoritative.
- Phase 7D.2 Rate-limit shadow mode: PostgreSQL remains authoritative; Valkey executes only as the shadow comparison backend.
- Primary operational health endpoint: `/api/health` reports `summary`, `postgres`, `valkey`, `rateLimit`, `rollout`, `performance`, `runtime`, and `notes`.
- Internal monitoring endpoint: `/api/internal/rate-limit-shadow` is admin-protected and reports shadow health, parity, latency, rollout metrics, runtime metadata, Valkey health summary, and a concise operator summary.
- Health model: healthy requires zero backend failures, zero comparison failures, and mismatch rate at or below threshold; degraded means backend failures, comparison failures, or mismatch rate above threshold; unhealthy means authoritative PostgreSQL unavailable or internal monitoring failure.
- Latency model: latency is diagnostic only. The endpoint reports `metrics.latency.postgresAverageMs`, `metrics.latency.valkeyAverageMs`, and `metrics.latency.deltaAverageMs`, where delta is Valkey average minus PostgreSQL average. The legacy `metrics.averageLatencyDeltaMs` remains for compatibility.
- Runtime metadata: `/api/health` exposes `runtime.phase=7`, `runtime.milestone=7E.1`, `runtime.release`, `runtime.startedAt`, and `runtime.uptimeSeconds`; the internal shadow endpoint retains its Phase 7D RC1 runtime metadata.
- Valkey health summary: monitoring reuses the existing Valkey health service and serializes enabled/connected state, connection state, latency, memory usage, version, uptime, and check timestamp.
- Rollout metrics: canary percentage, request counters, fallback count, PostgreSQL authoritative writes, and Valkey authoritative writes are exposed for Phase 7E migration KPIs.
- Production burn-in observations: RC1 burn-in focuses on parity, backend failures, comparison failures, latency diagnostics, Valkey connection state, application health, and unchanged public behavior.

Post-Optimization Infrastructure Review is an evaluation milestone, not an implementation task.

Phase 7E.1 is production verified. Phase 7E.2 production canary is planned and must not be enabled without a separate rollout approval.

## Deferred Future License Work

Premium license hardening is deferred and not part of completed Phase 7C.

Deferred scope:

- Premium licenses.
- License assignments.
- Customer identifiers.
- HWID binding.
- Device transfer workflows.
- License entitlements.
- License analytics.
- License hardening.
- Runtime license enforcement.
- Assignment lifecycle.
- Assignment capacity enforcement.

## TODO Classification

| Item | Classification | Rationale |
|---|---|---|
| Free key generation | Completed | Existing key generation is implemented. |
| Work.ink flow | Completed | Existing Work.ink verification and token replay protection are implemented. |
| Key validation | Completed | Existing key validation is implemented. |
| Key expiration | Completed | Existing keys use `expires_at`. |
| Provider Foundation | Completed | Backend provider foundation is complete. |
| Premium Key Infrastructure | Completed | Premium Keys are enforced through `POST /api/validate`. |
| Access Mode Support | Completed | Access mode support is complete for the backend key platform. |
| Provider Hardening | Completed | Provider hardening is complete for the current backend scope. |
| Dashboard UX Refinement | Completed | Dashboard UX refinement is complete for the current backend scope. |
| Key Management Refinement | Completed | Key management refinement is complete for the current backend scope. |
| Key Type Alignment | Completed | Key type alignment is complete. |
| Device Limits V1 | Completed | Device Limits protect `POST /api/validate`. |
| Custom Device Limits | Completed | Custom device limits are complete for the current backend scope. |
| Runtime Key Integration | Phase 7B.6 | Critical blocker; popup validation must gate Roblox runtime execution. |
| Runtime validation events | Phase 7B.7 | Required after runtime validation is integrated. |
| Device analytics dashboard | Phase 7B.8 | Required for Active Devices, Registered Devices, and Device Limit Violations. |
| Manual device reset | Phase 7B.9 | Operational support tooling after device visibility. |
| Linkvertise provider | Phase 7B.10 | Provider expansion after runtime integration. |
| LootLabs provider | Phase 7B.10 | Provider expansion after runtime integration. |
| Monetization analytics | Phase 7B.11 | Unified analytics across Free Keys, Premium Keys, Providers, and Devices. |
| Premium licenses | Deferred Future License Work | Deferred premium system scope. |
| License assignments | Deferred Future License Work | Deferred premium system scope. |
| Customer identifiers | Deferred Future License Work | Deferred premium/customer binding scope. |
| HWID binding | Deferred Future License Work | Deferred premium/license hardening scope. |
| Device transfer workflows | Deferred Future License Work | Deferred premium license support workflow. |
| License entitlements | Deferred Future License Work | Deferred premium license model scope. |
| License analytics | Deferred Future License Work | Deferred premium analytics scope. |
| License hardening | Deferred Future License Work | Deferred premium hardening scope. |
| Runtime license enforcement | Deferred Future License Work | Moved out of completed Phase 7B backend and completed Phase 7C performance work. |
| Assignment lifecycle | Deferred Future License Work | Moved out of completed Phase 7B backend and completed Phase 7C performance work. |
| Assignment capacity enforcement | Deferred Future License Work | Moved out of completed Phase 7B backend and completed Phase 7C performance work. |
| Production Stabilization | Operational/Ongoing | Active observation track. |
| Marketplace / creator economy | Remove | Not part of current roadmap. |
