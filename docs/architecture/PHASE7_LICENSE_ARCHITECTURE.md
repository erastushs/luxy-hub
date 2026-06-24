# Phase 7 — Access Modes, Keys, and License Authorization Architecture

Status: Phase 7A Complete / Production Ready; Phase 7B Backend Key Monetization Complete; Phase 7C Production Runtime Performance Complete; Phase 7D Engineering Complete; Phase 7E.1 Production Verified
Date: 2026-06-24
Scope: Current MAIN architecture and roadmap ownership for access modes, provider-backed keys, device-limited key monetization, premium license foundations, and completed runtime performance optimization. Phase 7B backend key monetization is complete. Phase 7C is now the completed production runtime performance optimization phase. Premium licenses, license assignments, customer identifiers, HWID binding, license entitlements, license analytics, and license hardening are deferred future license work.

## 1. Approved Direction

Phase 7 introduces script access authorization above the existing Secure Delivery architecture. The platform supports three access models:

| Access Mode | Purpose | Authorization |
|---|---|---|
| `public` | Open access | No authorization required |
| `key_required` | Free and paid key access | Provider-backed and dashboard-issued keys; Phase 7B productization |
| `license_required` | Premium license access | Creator-generated premium license foundation; future license hardening deferred |

Important separation of concerns:

- `visibility` controls script discoverability and public slug availability: `public`, `unlisted`, `private`.
- `access_mode` controls delivery authorization: `public`, `key_required`, `license_required`.
- Secure Delivery remains unchanged. Phase 7 only decides whether a delivery session may be created.
- Phase 7B must remain key-platform-only and must not introduce premium license runtime enforcement, license assignments, license entitlements, or HWID binding.

## 2. Current Platform Status

| Area | Status |
|---|---|
| Phase 4 | Complete |
| Phase 5 Secure Delivery | Complete |
| Phase 6 Loader Integration / Analytics V1 | Complete |
| Phase 8 Event Platform | Complete, production verified, Roblox verified |
| Phase 7A | Complete, production ready |
| Production Stabilization Program | Active |
| Phase 7B | Backend Key Monetization Platform complete |
| Runtime popup validation | Planned / not implemented |
| Phase 7C | Production Runtime Performance complete |
| Phase 7D | Engineering complete / production baseline |
| Phase 7E.1 | Production verified; PostgreSQL authoritative, Valkey shadow, canary disabled |
| Phase 7E.2 | Planned production canary |

Analytics V1 is complete and uses `script_executions` as the canonical execution event table for secure delivery sessions. Future key analytics should add key monetization visibility for generated, validated, expired, denied, provider source, and device-limit outcomes without redefining execution-count semantics. Future premium license work should add license analytics only after premium runtime enforcement is designed.

## 2.1 Current Implementation Summary

### Implemented in MAIN

- `scripts.access_mode` schema foundation with supported values `public`, `key_required`, and `license_required`.
- Existing Work.ink key generation, token verification, key validation, key expiration, and token replay protection.
- Delivery authorization abstraction integrated at the delivery session boundary.
- Existing key validation integration for `key_required` authorization foundation.
- License schema for hashed license keys, lifecycle status, nullable expiry, activity counters, and assignment limits.
- License assignment schema with hashed customer identifiers, display names, lifecycle status, and timestamps.
- License lifecycle management for create, enable, disable, and revoke operations.
- Assignment management for create and remove operations.
- Runtime license validation foundation using existing license data and assignment records.
- License Management dashboard at `/dashboard/licenses`.
- License Analytics dashboard at `/dashboard/licenses/analytics`.
- License dashboard UX polish: search, filters, sorting, selection UI, confirmation dialogs, loading states, empty states, responsive remediation, and breadcrumb integration.

### Phase 7B Completed Backend Infrastructure

- Provider Foundation.
- Premium Key Infrastructure.
- Access Mode Support.
- Provider Hardening.
- Dashboard UX Refinement.
- Key Management Refinement.
- Key Type Alignment.
- Device Limits V1.
- Custom Device Limits.

### Planned Runtime/Key Work

- Phase 7B.6 Runtime Key Integration.
- Phase 7B.7 Analytics Foundation.
- Phase 7B.8 Device Analytics Dashboard.
- Phase 7B.9 Device Reset.
- Phase 7B.10 Provider Expansion.
- Phase 7B.11 Monetization Analytics.

### Deferred Future License Work

- Premium licenses beyond existing foundation.
- Runtime license enforcement hardening.
- License assignments and assignment lifecycle expansion.
- Atomic assignment capacity enforcement.
- Customer identifiers and normalization.
- HWID binding.
- Device transfer workflows for licenses.
- License entitlements.
- License lookup hashes.
- License verifier storage.
- License analytics.
- License hardening.
- `license_key` request contract alignment.
- License counter updates during runtime authorization.
- Runtime audit trail for license authorization decisions.

### Phase 7D/7E.1 Runtime Baseline

- PostgreSQL remains authoritative for rate limits and permanent application data.
- Valkey runs as the rate-limit shadow comparison backend.
- Production runtime mode is `RATE_LIMIT_MODE=shadow`.
- Canary is disabled until Phase 7E.2 receives separate rollout approval.
- Production health is healthy with backend failures `0`, comparison failures `0`, parity `100%`, and mismatch rate `0`.
- Client IP resolution behind Cloudflare prioritizes `CF-Connecting-IP`, `X-Vercel-Forwarded-For`, `X-Forwarded-For`, and `X-Real-IP`.

### Remaining Database Scalability & Runtime Optimization

- Database decoupling: decouple `script_executions` from `delivery_sessions`, allow true delivery session TTL cleanup, and preserve analytics without FK dependency.
- Analytics aggregation: daily, weekly, and monthly script execution statistics to reduce long-term raw row growth.
- Valkey authoritative runtime: move rate-limit authority out of PostgreSQL after canary progression and production approval.
- PostgreSQL rate-limit retirement: remove PostgreSQL rate-limit authority only after Valkey authoritative runtime is production accepted.
- Internal monitoring dashboard: database, cleanup, runtime, bandwidth, execution, storage growth, and operational health metrics.
- Post-optimization infrastructure review: measure production impact, compare Supabase usage before and after optimization, and decide whether PostgreSQL migration is still justified.

No Phase 7D/7E.1 schema changes or migrations were introduced. Database decoupling, analytics aggregation, Valkey authoritative runtime, PostgreSQL rate-limit retirement, and external monitoring stack expansion remain future work.

### Future Work Outside Current Phase 7 Minimum Scope

- Analytics V2.
- QA and test coverage expansion.
- Operational hardening.
- Security review.
- Final security audit.
- Marketplace, paid scripts, and creator economy remain removed/deferred from the current roadmap.

## 3. Relationship to Existing System

```text
                 Phase 7 Authorization Layer
       +------------------------------------------+
       | access_mode = public                     |
       | access_mode = key_required               |
       | access_mode = license_required           |
       +----------------------|-------------------+
                              | gates only session creation
                              v
Phase 5-6 Secure Delivery +--------------------------+
                          | delivery_sessions         |
                          | delivery_builds           |
                          | runtime payload delivery  |
                          | loader bootstrap/runtime  |
                          +--------------------------+
```

Current rate-limit runtime path:

```text
Cloudflare
  |
  v
Next.js API
  |
  v
Client IP resolution
  |-- CF-Connecting-IP
  |-- X-Vercel-Forwarded-For
  |-- X-Forwarded-For
  |-- X-Real-IP
  v
Rate-limit shadow mode
  |-- PostgreSQL authoritative decision
  `-- Valkey shadow comparison
```

Authorization occurs only during:

```text
POST /api/delivery/session
```

Authorization must not occur during:

- `POST /api/delivery/fetch`
- Payload delivery
- Runtime execution
- Event reporting

## 4. Access Mode Design

### 4.1 `public`

Definition:

- No key or license required.
- Delivery session is created immediately when the script is deliverable and a ready build exists.

Flow:

```text
Loader
  -> POST /api/delivery/session { slug }
  -> create session
  -> success
```

### 4.2 `key_required`

Definition:

- Uses the provider-backed key platform.
- Intended for free ad-provider keys, paid keys, and device-limited keys.
- Existing Work.ink endpoints remain supported as the first provider path:
  - `/get-key`
  - `/api/generate-key`
  - `/api/validate`
  - `/api/verify-workink`

Current MAIN foundation:

- Existing key generation and validation are implemented.
- Existing key expiration is implemented.
- Work.ink token replay protection is implemented.
- Delivery-session authorization can validate a supplied key.

Phase 7B target flow:

```text
User obtains free provider key or paid key
  -> Loader receives key and device fingerprint
  -> POST /api/delivery/session { slug, key, fingerprint }
  -> validate key, expiration, provider source, and device limit
  -> create session
  -> success
```

The current Work.ink key system is not being removed. It becomes one provider in the provider-agnostic `access_mode = key_required` platform. Phase 7B adds provider abstraction, paid keys, device-limited keys, dashboard issuance, configurable expiration, loader key/fingerprint forwarding, raw endpoint protection, and key analytics.

### 4.3 `license_required`

Definition:

- Uses the premium license system.
- Intended for premium license access, not paid keys.
- Creator-generated license keys.
- Assignment/customer/device limits belong to Phase 7C.

Phase 7C target flow:

```text
Loader
  -> POST /api/delivery/session { slug, license_key, customer_identifier, hwid? }
  -> validate license
  -> check or create assignment
  -> enforce capacity/customer/HWID policy
  -> create session
  -> success
```

The existing license foundation in MAIN remains documented, but premium runtime hardening, HWID binding, device transfer workflows, license entitlements, and license analytics are not Phase 7B work.

## 5. Current Schema Foundation

### 5.1 `scripts.access_mode`

Implemented column:

```sql
access_mode text not null default 'public'
  check (access_mode in ('public', 'key_required', 'license_required'))
```

Defaulting existing rows to `public` preserves current delivery behavior.

### 5.2 Key System Tables

Existing key tables support the original free-key foundation, but the refined Phase 7B platform may need separately reviewed storage changes during implementation planning:

- `keys`
  - Stores generated free keys.
  - Stores `expires_at`.
  - Stores `is_active`.
- `used_workink_tokens`
  - Prevents Work.ink token replay.
- `verification_logs`
  - Existing operational logging surface.
- `key_usage`
  - Existing analytics placeholder.

Current limitation:

- Free keys are stored raw and globally scoped.
- Provider source, key type, `max_devices`, device registrations, and reset history are not currently modeled in the documented base schema.
- Key hashing, script-scoped keys, revenue attribution, and self-service reset are not required for first Phase 7B planning unless separately approved.

### 5.3 `licenses`

Implemented license assignment foundation:

| Column | Purpose |
|---|---|
| `id` | Primary key |
| `script_id` | Licensed script |
| `creator_id` | Owning creator; derived from server session in creator APIs |
| `key_hash` | Hash of generated license key; raw premium key is never stored |
| `max_assignments` | Assignment capacity foundation |
| `status` | `active`, `disabled`, `revoked` |
| `activation_count` | Count foundation for future premium analytics |
| `delivery_count` | Count foundation for future premium analytics |
| `last_activation_at` | Last new assignment activation timestamp foundation |
| `last_delivery_at` | Last premium delivery timestamp foundation |
| `expires_at` | Nullable expiry timestamp; `NULL` means permanent license |
| `created_at` | Creation timestamp |
| `updated_at` | Update timestamp |

License statuses:

- `active`
- `disabled`
- `revoked`

Do not use a separate `expired` status. Expiry is derived from `expires_at`.

### 5.4 `license_assignments`

Implemented foundation for Phase 7C:

| Column | Purpose |
|---|---|
| `id` | Primary key |
| `license_id` | Parent license |
| `customer_identifier_hash` | Hashed normalized generic customer/device identifier foundation |
| `display_name` | Optional creator-facing label |
| `status` | Assignment lifecycle state |
| `created_at` | Creation timestamp |
| `updated_at` | Update timestamp |

Assignment capacity enforcement, customer identifier semantics, HWID binding, device transfer workflows, license entitlements, and assignment lifecycle expansion are deferred future license work.

## 6. Phase 7B Key Monetization Platform Architecture

Objectives:

- Preserve free key access and 24-hour ad-provider keys.
- Treat Work.ink as one provider in a provider-agnostic system.
- Support Linkvertise, LootLabs, and future providers through adapters.
- Preserve key expiration and expand issuance durations.
- Productize paid weekly, monthly, team, and custom-expiration keys.
- Add device-limited keys with `max_devices`.
- Add administrative device reset workflow.
- Add dashboard key issuance.
- Productize `key_required` script access.
- Add loader key and fingerprint forwarding.
- Protect raw endpoints from key-required bypass.
- Add key analytics with provider source and device outcomes.

Deliverables:

- Provider-agnostic access model for Work.ink, Linkvertise, LootLabs, and future providers.
- Dashboard key issuance for 24-hour, weekly, monthly, team, and custom-expiration keys.
- Device registration and administrative reset workflow.
- Creator/admin controls for key-required access.
- Loader key/fingerprint forwarding only to the session endpoint.
- Raw endpoint protection for key-required scripts.
- Analytics for key generated, key validated, key expired, key denied, provider source, and device-limit outcomes.

Success criteria:

- Existing public scripts continue working unchanged.
- Existing Work.ink flow remains compatible through a provider abstraction.
- Linkvertise, LootLabs, and future providers fit the same provider model.
- Free ad-provider keys expire after 24 hours by default.
- Paid keys support weekly, monthly, team, and custom durations.
- Device-limited keys enforce documented `max_devices` behavior.
- Administrative reset can clear device registrations without extending expiration by default.
- `key_required` scripts require a valid active unexpired key at session creation.
- Raw endpoints cannot bypass key-required access.
- Key analytics support operational review by provider, key type, result, denial category, and device outcome.
- No premium license work is needed to ship Phase 7B.

Risks:

- Raw endpoint bypass undermines monetization.
- Provider-specific assumptions can keep the platform dependent on Work.ink.
- Loader forwarding can leak keys or fingerprints if raw values are logged or exposed.
- Existing raw/global key storage is acceptable for Phase 7B but not a premium-license model.
- Fingerprints are not perfect and device resets may be needed.
- Device-limited keys reduce sharing but are not a full anti-sharing solution.
- Rich key attribution, device registration, or script scoping may require storage changes and must not be added implicitly.

## 7. Deferred Future Premium License System Architecture

Objectives:

- Harden premium runtime license enforcement.
- Enforce assignment lifecycle and assignment capacity.
- Define customer identifiers and HWID binding.
- Define license device transfer workflows.
- Define license entitlements.
- Decide whether license verifier storage is required.
- Preserve hashed license lookup behavior.
- Add license analytics and runtime audit trail.

Dependencies:

- Phase 7B backend key monetization is complete and stable.
- Raw endpoint access-mode protection exists.
- Loader key/fingerprint forwarding pattern is validated before adding license/customer/HWID forwarding.
- Premium request contract is reviewed and frozen.
- Customer identifier, HWID binding, device transfer, and entitlement design is approved before implementation.
- Atomic assignment capacity strategy is selected.

Risks:

- Non-atomic assignment checks can allow license sharing.
- Customer identifier normalization can break existing assignments.
- HWID binding can deny legitimate users.
- Device transfer workflows can be abused without policy and audit controls.
- Premium credentials can leak through loader/runtime/error surfaces.
- License analytics can become inaccurate without atomic counter updates.
- Phase 7C may require migrations and must remain separate from Phase 7B.

## 8. Delivery Authorization Boundary

The only authorization boundary is `POST /api/delivery/session`.

Recommended internal abstraction:

```ts
authorizeDeliveryAccess({
  script,
  key,
  licenseKey,
  customerIdentifier,
})
```

Expected outcomes:

```text
public
  -> allow

key_required
  -> require key
  -> validate through provider-backed key service
  -> enforce expiration and device limit
  -> allow or deny

license_required
  -> future premium license validation and assignment/customer/HWID enforcement
  -> allow or deny
```

`/api/delivery/fetch` remains a session-token validation and one-time consumption endpoint. It should not re-check access mode, provider keys, license keys, assignments, or runtime entitlement.

Event reporting uses the existing per-session `event_secret`. It should not perform key/license authorization.

## 9. Provider Integration Strategy

The existing Work.ink system remains supported, but Phase 7B must be provider-agnostic.

Preserved behavior:

- `/get-key` continues to direct users through Work.ink.
- `/api/generate-key` continues to generate a key after Work.ink token verification.
- `/api/validate` continues to validate existing keys.
- `/api/verify-workink` continues to verify Work.ink tokens and generate keys.
- `used_workink_tokens` continues to protect against Work.ink token replay.

Provider direction:

- Work.ink.
- Linkvertise.
- LootLabs.
- Future providers.

Provider abstraction rules:

- Provider-specific token names, callback payloads, replay behavior, and verification APIs stay inside provider adapters.
- Provider adapters normalize successful completion into a common key issuance decision.
- Provider source is recorded for analytics.
- Provider failures map to generic user-facing outcomes.
- Provider credentials and raw callback payloads do not reach loader/runtime code.

## 10. Analytics and Audit

### Phase 7B Key Analytics

Phase 7B should track:

- Key generated.
- Key validated.
- Key expired.
- Key denied.
- Provider source.
- Device registration count and device-limit denials.
- Administrative device reset events.

Raw keys, raw provider tokens, and raw fingerprints must not be logged in analytics payloads.

### Deferred Premium License Analytics

Future premium license work should track:

- License activation.
- License delivery authorization.
- Assignment creation and status transitions.
- Capacity exhaustion.
- Expired/disabled/revoked license denials.
- Runtime license audit outcomes.

Premium counters should be updated atomically with authorization decisions where required.

## 11. Roadmap

### Phase 7A.1 — Schema Foundation — Complete

- `scripts.access_mode`
- `licenses`
- `license_assignments`
- Constraints, indexes, ownership model, and RLS design

### Phase 7A.2 — Authorization Abstraction — Complete

- `authorizeDeliveryAccess()`
- Delivery session request contract foundation
- Tests for access-mode branches at the implemented foundation level

### Phase 7A.3 — Key Required Mode Foundation — Complete

- Integrate existing Work.ink key validation into delivery session creation.
- Map `access_mode = key_required` to the existing key ecosystem.
- Preserve `/get-key`, `/api/generate-key`, `/api/validate`, and `/api/verify-workink`.

### Phase 7A.4 — License Services — Complete

- Generate license.
- Revoke/disable/enable license.
- Assignment management foundation.
- Hash premium license keys before storage.

### Phase 7A.4.5 — Assignment System — Complete

- Assignment create/list/remove workflow.
- Creator-facing display names.
- Hashed customer identifier storage foundation.

### Phase 7A.5 — Runtime License Validation Foundation — Complete

- Validate license hash, status, and `expires_at` foundation.
- Existing assignment and new assignment creation foundation.
- Deeper enforcement hardening is deferred future license work.

### Phase 7A.6 — License Dashboard UI — Complete

- License management UI.
- Assignment management UI.

### Phase 7A.7 — License Analytics UI — Complete

- Total/active/disabled/revoked license cards.
- Status distribution.
- Recent license activity table.
- Recent assignments table.

### Phase 7A.8 — License UX Polish — Complete

- Advanced search.
- Status and assignment filters.
- Sorting controls.
- Bulk selection UI.
- Confirmation dialogs.
- Loading, empty, and responsive states.

### Phase 7A.9 — UI Remediation — Complete

- License breadcrumbs.
- Race protection for dashboard fetches.
- Accurate bulk action reporting.
- Assignment metadata loading/error states.
- Analytics initial loading and stale refresh protection.

### Phase 7B — Backend Key Monetization Platform — Complete

- Backend monetization infrastructure complete.
- Free Keys enforced through `POST /api/validate`.
- Premium Keys enforced through `POST /api/validate`.
- Device Limits enforced through `POST /api/validate`.

Planned runtime/key expansion outside completed backend scope:

- Phase 7B.6 Runtime Key Integration.
- Runtime popup UI.
- Runtime key input and validation status/error states.
- Runtime execution gate requiring `validation_success == true`.
- Phase 7B.7 Analytics Foundation.
- Phase 7B.8 Device Analytics Dashboard.
- Phase 7B.9 Device Reset.
- Phase 7B.10 Provider Expansion.
- Phase 7B.11 Monetization Analytics.

### Deferred Future Premium License System

- Premium licenses.
- License assignments.
- Customer identifiers.
- HWID binding.
- Device transfer workflows.
- License entitlements.
- License lookup hashes.
- License verifier storage.
- License analytics.
- License hardening.
- Runtime license enforcement.
- Assignment lifecycle.
- Assignment capacity enforcement.

## 12. Migration Strategy

This documentation update does not create migrations. Phase 7B.6 runtime integration must use the existing `POST /api/validate` backend boundary and must not require schema changes.

MAIN already has:

- `keys.expires_at` for variable expiration.
- Work.ink token replay tables.
- `scripts.access_mode` with `key_required`.
- Operational logging/event tables that can support minimal analytics.

Storage concepts for later Phase 7B operational tooling and analytics may need explicit future review before implementation:

- Provider source.
- Key type.
- `max_devices`.
- Device registrations.
- Device reset history.
- Provider-specific replay markers for Linkvertise, LootLabs, and future providers.

Phase 7B.6 should avoid accidental migrations. Any later schema work for provider source, device limits, device registrations, or analytics must be separately reviewed and approved during implementation planning.

Future premium license hardening may require migrations or database functions, especially atomic assignment capacity enforcement, customer identifiers, HWID binding, verifier storage, license entitlements, and license analytics. This is not part of completed Phase 7C runtime performance work and must remain separate from Phase 7D unless explicitly approved.

Backward compatibility requirements:

- Existing scripts remain `public` unless explicitly changed.
- Existing Work.ink endpoints remain valid or are compatibility-wrapped by the provider abstraction.
- Existing secure delivery session/fetch architecture remains unchanged.
- No authorization logic moves into fetch, payload delivery, runtime execution, or event reporting.

## 13. Security Review

Primary controls:

- Gate access before a delivery session exists.
- Store delivery session token hashes only.
- Preserve rate limiting on `POST /api/delivery/session`.
- Use generic denial responses for invalid credentials where practical.
- Enforce creator ownership for script and license management operations.
- Use service-role-only delivery authorization server-side; no direct anonymous database access.

Phase 7B key-specific controls:

- Avoid raw key logging.
- Enforce expiration at validation time.
- Preserve provider replay protection.
- Protect raw endpoints for key-required scripts.
- Keep key and fingerprint forwarding limited to the delivery-session endpoint.
- Avoid raw fingerprint logging or analytics exposure.
- Keep administrative device resets explicit and auditable.

Future premium-license-specific controls:

- Store premium license key hashes only.
- Enforce assignment status and capacity atomically.
- Normalize and hash customer/HWID identifiers according to an approved design.
- Avoid logging raw premium credentials or raw customer identifiers.

Known limits:

- A valid user can still share keys or dump memory after runtime execution.
- Device fingerprints, HWIDs, and customer identifiers can be spoofed depending on loader/executor environment.
- License enforcement is an access-control layer, not a tamper-proof DRM system.

Accepted approach:

- Secure Delivery remains the payload protection layer.
- Phase 7 backend validation remains centralized in `POST /api/validate` for keys/devices.
- Runtime key integration gates execution after delivery/bootstrap without redesigning delivery fetch, payload delivery, events, analytics pipeline, or build system.

## 14. Implementation Readiness

Phase 7B Backend Key Monetization Platform readiness: 100% for backend infrastructure.

Runtime popup validation readiness: 0%.

Ready foundation:

- Free key generation.
- Work.ink flow.
- Key validation.
- Key expiration.
- Token replay protection.
- `access_mode` schema foundation.
- Session-boundary key authorization foundation.
- Provider Foundation.
- Premium Key Infrastructure.
- Access Mode Support.
- Provider Hardening.
- Dashboard UX Refinement.
- Key Management Refinement.
- Key Type Alignment.
- Device Limits V1.
- Custom Device Limits.

Not ready / blockers:

- Runtime popup validation is not integrated into the Roblox runtime.
- The runtime loader currently executes delivered payloads directly.
- Main Script execution is not yet gated by `validation_success == true`.

Phase 7C Production Runtime Performance readiness: complete.

Future premium license hardening readiness: foundation exists, but runtime hardening is deferred and should not start until a future license design is approved.
