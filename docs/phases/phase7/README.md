# Phase 7 — Access Modes, Keys, and License Authorization

Phase 7 documentation source of truth:

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

Current Status:
Phase 7A is complete / production ready. Phase 7B backend monetization infrastructure is complete. Phase 7C production runtime performance optimization is complete. Production Stabilization is active. Runtime popup validation remains planned because the Roblox runtime does not yet call `POST /api/validate` before main script execution. Premium license runtime enforcement and license hardening are deferred future license work, not completed Phase 7C work.

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
- Status: Engineering Complete (RC1)
- Scope: Valkey infrastructure, rate-limit shadow mode, internal monitoring, production burn-in workflow, and post-optimization observability review
- RC1 constraints: PostgreSQL remains authoritative, Valkey remains shadow-only, no schema changes, no migrations, no cleanup changes, no middleware changes, no public endpoint changes, and no production behavior changes

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
- Internal monitoring endpoint: `/api/internal/rate-limit-shadow` is admin-protected and reports shadow health, parity, latency, runtime metadata, Valkey health summary, and a concise operator summary.
- Health model: healthy requires zero backend failures, zero comparison failures, and mismatch rate at or below threshold; degraded means backend failures, comparison failures, or mismatch rate above threshold; unhealthy means authoritative PostgreSQL unavailable or internal monitoring failure.
- Latency model: latency is diagnostic only. The endpoint reports `metrics.latency.postgresAverageMs`, `metrics.latency.valkeyAverageMs`, and `metrics.latency.deltaAverageMs`, where delta is Valkey average minus PostgreSQL average. The legacy `metrics.averageLatencyDeltaMs` remains for compatibility.
- Runtime metadata: `runtime.phase`, `runtime.release`, `runtime.runtimeMode`, `runtime.startedAt`, and `runtime.uptimeSeconds` are exposed without persistence.
- Valkey health summary: monitoring reuses the existing Valkey health service and serializes enabled/connected state, connection state, latency, memory usage, version, uptime, and check timestamp.
- Production burn-in observations: RC1 burn-in focuses on parity, backend failures, comparison failures, latency diagnostics, Valkey connection state, application health, and unchanged public behavior.

Post-Optimization Infrastructure Review is an evaluation milestone, not an implementation task.

Phase 7E has not been started.

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
