# Phase 7 — Access Modes, Keys, and License Authorization Architecture

Status: Phase 7A Complete / Production Ready; Phase 7B Key Monetization Realigned; Phase 7C Premium License System Deferred
Date: 2026-06-16
Scope: Current MAIN architecture and roadmap ownership for access modes, Work.ink-backed keys, and premium license foundations. Phase 7B is Key Monetization only. Phase 7C owns premium license runtime enforcement and assignment/customer/device hardening.

## 1. Approved Direction

Phase 7 introduces script access authorization above the existing Secure Delivery architecture. The platform supports three access models:

| Access Mode | Purpose | Authorization |
|---|---|---|
| `public` | Open access | No authorization required |
| `key_required` | Monetized free access | Existing Work.ink key system; Phase 7B productization |
| `license_required` | Paid/premium access | Creator-generated premium licenses; Phase 7C hardening |

Important separation of concerns:

- `visibility` controls script discoverability and public slug availability: `public`, `unlisted`, `private`.
- `access_mode` controls delivery authorization: `public`, `key_required`, `license_required`.
- Secure Delivery remains unchanged. Phase 7 only decides whether a delivery session may be created.
- Phase 7B must remain key-only and must not introduce premium license runtime enforcement.

## 2. Current Platform Status

| Area | Status |
|---|---|
| Phase 4 | Complete |
| Phase 5 Secure Delivery | Complete |
| Phase 6 Loader Integration / Analytics V1 | Complete |
| Phase 8 Event Platform | Complete, production verified, Roblox verified |
| Phase 7A | Complete, production ready |
| Production Stabilization Program | Active |
| Phase 7B | Key Monetization, deferred / planning realigned, estimated 60% foundation complete |
| Phase 7C | Premium License System, deferred / not started under new roadmap |

Analytics V1 is complete and uses `script_executions` as the canonical execution event table for secure delivery sessions. Phase 7B should add key monetization visibility without redefining execution-count semantics. Phase 7C should add premium license analytics after premium runtime enforcement is designed.

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

### Phase 7B Remaining Work

- Dashboard key issuance.
- Weekly, monthly, and custom-expiration keys.
- Productized `key_required` script access controls.
- Loader key forwarding to `POST /api/delivery/session` only.
- Raw endpoint protection for key-required scripts.
- Key analytics for generation, validation, expiration, denial, and key-authorized sessions.
- Production rollout checklist and key-specific tests.

### Phase 7C Deferred Work

- Premium licenses beyond existing foundation.
- Runtime license enforcement hardening.
- License assignments and assignment lifecycle expansion.
- Atomic assignment capacity enforcement.
- Customer identifiers and normalization.
- Device binding.
- License lookup hashes.
- License verifier storage.
- Premium analytics.
- `license_key` request contract alignment.
- License counter updates during runtime authorization.
- Runtime audit trail for license authorization decisions.

### Future Work Outside Phase 7B/7C Minimum Scope

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

- Uses the existing Work.ink-backed key system.
- Intended for monetized free access.
- Existing endpoints remain supported:
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
User obtains Work.ink/free key
  -> Loader receives key
  -> POST /api/delivery/session { slug, key }
  -> validate existing key system
  -> create session
  -> success
```

The current Work.ink key system is not being replaced. It becomes the implementation of `access_mode = key_required`. Phase 7B adds dashboard issuance, configurable expiration, loader key forwarding, raw endpoint protection, and key analytics.

### 4.3 `license_required`

Definition:

- Uses the premium license system.
- Intended for paid/premium access.
- Creator-generated license keys.
- Assignment/customer/device limits belong to Phase 7C.

Phase 7C target flow:

```text
Loader
  -> POST /api/delivery/session { slug, license_key, customer_identifier, device_identifier? }
  -> validate license
  -> check or create assignment
  -> enforce capacity/customer/device policy
  -> create session
  -> success
```

The existing license foundation in MAIN remains documented, but premium runtime hardening is not Phase 7B work.

## 5. Current Schema Foundation

### 5.1 `scripts.access_mode`

Implemented column:

```sql
access_mode text not null default 'public'
  check (access_mode in ('public', 'key_required', 'license_required'))
```

Defaulting existing rows to `public` preserves current delivery behavior.

### 5.2 Key System Tables

Existing key tables support Phase 7B without a required migration for the minimum release:

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
- Key hashing, script-scoped keys, creator-specific Work.ink campaigns, and revenue attribution are not required for Phase 7B.

### 5.3 `licenses`

Implemented foundation for Phase 7C:

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

Assignment capacity enforcement, customer identifier semantics, device binding, and assignment lifecycle expansion are Phase 7C.

## 6. Phase 7B Key Monetization Architecture

Objectives:

- Preserve free key access.
- Preserve Work.ink flow.
- Preserve key expiration and expand issuance durations.
- Productize weekly, monthly, and custom-expiration keys.
- Add dashboard key issuance.
- Productize `key_required` script access.
- Add loader key forwarding.
- Protect raw endpoints from key-required bypass.
- Add key analytics.

Deliverables:

- Dashboard key issuance for 24-hour, weekly, monthly, and custom-expiration keys.
- Creator/admin controls for key-required access.
- Loader key forwarding only to the session endpoint.
- Raw endpoint protection for key-required scripts.
- Analytics for key generation, validation, expiration, denial, and key-authorized sessions.

Success criteria:

- Existing public scripts continue working unchanged.
- Existing Work.ink flow remains compatible.
- Dashboard-issued keys support all Phase 7B durations.
- `key_required` scripts require a valid active unexpired key at session creation.
- Raw endpoints cannot bypass key-required access.
- Key analytics support operational review.
- No premium license work is needed to ship Phase 7B.

Risks:

- Raw endpoint bypass undermines monetization.
- Loader forwarding can leak keys if raw keys are logged or exposed.
- Existing raw/global key storage is acceptable for Phase 7B but not a premium-license model.
- Rich key attribution or script scoping may require migrations and must not be added implicitly.

## 7. Phase 7C Premium License System Architecture

Objectives:

- Harden premium runtime license enforcement.
- Enforce assignment lifecycle and assignment capacity.
- Define customer identifiers and device binding.
- Decide whether license verifier storage is required.
- Preserve hashed license lookup behavior.
- Add premium analytics and runtime audit trail.

Dependencies:

- Phase 7B Key Monetization is complete and stable.
- Raw endpoint access-mode protection exists.
- Loader key forwarding pattern is validated before adding license/customer/device forwarding.
- Premium request contract is reviewed and frozen.
- Customer/device binding design is approved before implementation.
- Atomic assignment capacity strategy is selected.

Risks:

- Non-atomic assignment checks can allow license sharing.
- Customer identifier normalization can break existing assignments.
- Device binding can deny legitimate users.
- Premium credentials can leak through loader/runtime/error surfaces.
- Premium analytics can become inaccurate without atomic counter updates.
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
  -> validate through existing Work.ink key service
  -> allow or deny

license_required
  -> Phase 7C premium license validation and assignment/customer/device enforcement
  -> allow or deny
```

`/api/delivery/fetch` remains a session-token validation and one-time consumption endpoint. It should not re-check access mode, Work.ink keys, license keys, assignments, or runtime entitlement.

Event reporting uses the existing per-session `event_secret`. It should not perform key/license authorization.

## 9. Work.ink Integration Strategy

The existing Work.ink system remains supported and becomes the foundation of `key_required`.

Preserved behavior:

- `/get-key` continues to direct users through Work.ink.
- `/api/generate-key` continues to generate a key after Work.ink token verification.
- `/api/validate` continues to validate existing keys.
- `/api/verify-workink` continues to verify Work.ink tokens and generate keys.
- `used_workink_tokens` continues to protect against Work.ink token replay.

Phase 7B should not replace this system. Future hardening may add key hashing, script scoping, or creator-specific Work.ink campaigns, but compatibility with existing behavior must be preserved and those additions are not required for Phase 7B.

## 10. Analytics and Audit

### Phase 7B Key Analytics

Phase 7B should track:

- Key generation.
- Work.ink completion to key issuance.
- Key validation success/failure.
- Expired key attempts.
- Missing/invalid key denials.
- Key-authorized delivery sessions.

Raw keys and raw Work.ink tokens must not be logged in analytics payloads.

### Phase 7C Premium Analytics

Phase 7C should track:

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
- Deeper enforcement hardening moved to Phase 7C.

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

### Phase 7B — Key Monetization — Deferred / Planning Realigned

- Free key access.
- Work.ink flow.
- Key expiration.
- Weekly keys.
- Monthly keys.
- Custom expiration keys.
- Dashboard key issuance.
- Key analytics.
- `key_required` script access.
- Loader key forwarding.
- Raw endpoint protection.

### Phase 7C — Premium License System — Deferred

- Premium licenses.
- License assignments.
- Customer identifiers.
- Device binding.
- License lookup hashes.
- License verifier storage.
- Premium analytics.
- Runtime license enforcement.
- Assignment lifecycle.
- Assignment capacity enforcement.

## 12. Migration Strategy

Phase 7B minimum release should not require new migrations because MAIN already has:

- `keys.expires_at` for variable expiration.
- Work.ink token replay tables.
- `scripts.access_mode` with `key_required`.
- Operational logging/event tables that can support minimal analytics.

Phase 7B should avoid migrations unless a separately approved hardening track requires script-scoped keys, hashed free-key lookup, creator-specific campaign attribution, or revenue reconciliation.

Phase 7C may require migrations or database functions for premium license hardening, especially atomic assignment capacity enforcement, customer/device binding, verifier storage, and premium analytics.

Backward compatibility requirements:

- Existing scripts remain `public` unless explicitly changed.
- Existing Work.ink endpoints remain valid.
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
- Preserve Work.ink token replay protection.
- Protect raw endpoints for key-required scripts.
- Keep key forwarding limited to the delivery-session endpoint.

Phase 7C premium-specific controls:

- Store premium license key hashes only.
- Enforce assignment status and capacity atomically.
- Normalize and hash customer/device identifiers according to an approved design.
- Avoid logging raw premium credentials or raw customer identifiers.

Known limits:

- A valid user can still share keys or dump memory after runtime execution.
- HWIDs and customer identifiers can be spoofed depending on loader/executor environment.
- License enforcement is an access-control layer, not a tamper-proof DRM system.

Accepted approach:

- Secure Delivery remains the payload protection layer.
- Phase 7 controls who can create sessions.
- Runtime and event layers remain separate from authorization decisions.

## 14. Implementation Readiness

Phase 7B Key Monetization readiness based on MAIN: 60%.

Ready foundation:

- Free key generation.
- Work.ink flow.
- Key validation.
- Key expiration.
- Token replay protection.
- `access_mode` schema foundation.
- Session-boundary key authorization foundation.

Not ready / blockers:

- Dashboard key issuance.
- Weekly/monthly/custom expiration issuance UI/service path.
- Productized `key_required` access-mode controls.
- Loader key forwarding.
- Raw endpoint protection.
- Key analytics.

Phase 7C Premium License System readiness: foundation exists, but runtime hardening is deferred and should not start until Phase 7B is stable.
