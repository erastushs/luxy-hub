# Phase 7 — Access Modes, Keys, and License Authorization

Phase 7 documentation source of truth:

../../architecture/PHASE7_LICENSE_ARCHITECTURE.md

Phase 7B planning documents:

- `PHASE_7B_DESIGN.md`
- `PHASE_7B_THREAT_MODEL.md`
- `../../roadmap/PHASE7_ROADMAP_REALIGNMENT_REPORT.md`

Current Status:
Phase 7A is complete / production ready. Production Stabilization is active. Phase 7B has been realigned to Key Monetization only. Phase 7C now owns Premium License System work, including runtime license enforcement and assignment hardening.

Phase 7B Status:

- Name: Key Monetization
- Status: Deferred / Planning Realigned
- Reason: Production Stabilization Window
- Implementation: Partially founded in MAIN by existing key, Work.ink, expiration, and access-mode systems
- Design: Realigned
- Threat Model: Realigned
- Documentation: Realigned
- Current completion estimate: 60%

Phase 7C Status:

- Name: Premium License System
- Status: Deferred
- Reason: Starts after Phase 7B Key Monetization is stable
- Implementation: Phase 7A foundation exists, but Phase 7C runtime hardening is not started under the new roadmap

Approved access modes:

- `public`
- `key_required`
- `license_required`

Implementation guardrails:

- `visibility` and `access_mode` are separate concerns.
- Authorization occurs only during `POST /api/delivery/session`.
- Existing Work.ink endpoints remain supported and map to `access_mode = key_required`.
- Phase 7B may touch only key monetization planning and later key-specific implementation.
- Phase 7B must not implement premium licenses, license assignment enforcement, customer identifiers, device binding, license lookup hashes, license verifier storage, premium analytics, or runtime license enforcement.
- Premium licenses use hashed license keys, nullable `expires_at`, and assignment foundations from Phase 7A, but all runtime hardening and lifecycle expansion belongs to Phase 7C.

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
- License runtime hardening is deferred to Phase 7C.

### Assignments

- Create assignments with hashed customer identifiers and optional display names.
- Remove assignments through the dashboard/API.
- Assignment capacity enforcement, assignment lifecycle expansion, and customer/device binding are deferred to Phase 7C.

### Access Modes

- `public`
- `key_required`
- `license_required`

### Dashboard

- License Management screen at `/dashboard/licenses`.
- License Analytics screen at `/dashboard/licenses/analytics`.
- Search, filters, sorting, bulk selection UI, confirmation dialogs, loading states, empty states, and mobile remediation are implemented.
- Dashboard key issuance is not implemented yet and belongs to Phase 7B.

## Phase 7B — Key Monetization

Objectives:

- Preserve and productize existing free key access.
- Keep Work.ink as the ad-supported free key flow.
- Support key expiration beyond the current fixed 24-hour flow.
- Add weekly, monthly, and custom-expiration key issuance.
- Add dashboard key issuance.
- Make `key_required` script access usable end-to-end.
- Add loader key forwarding.
- Protect raw endpoints from bypassing key-required access.
- Add key analytics.

Deliverables:

- Dashboard key issuance for 24-hour, weekly, monthly, and custom-expiration keys.
- Dashboard/API/service planning for `key_required` script access.
- Loader key forwarding only to `POST /api/delivery/session`.
- Raw endpoint protection for `key_required` scripts.
- Key analytics for generation, validation, expiration, denial, and key-authorized sessions.
- Production rollout checklist and monitoring plan.

Success criteria:

- Existing public scripts keep working unchanged.
- Existing Work.ink key flow remains compatible.
- Dashboard-issued keys support 24-hour, weekly, monthly, and custom expiration.
- `key_required` scripts require a valid active unexpired key at session creation.
- Loader forwards keys only to the delivery session endpoint.
- Raw script delivery cannot bypass key-required access.
- Key analytics support operational review of key monetization.
- No premium license work is required for Phase 7B release.

Risks:

- Raw endpoint bypass can undermine key monetization.
- Loader key forwarding can leak keys if errors or logs include raw credentials.
- Existing free keys are raw and globally scoped; this is accepted for Phase 7B but should not expand into premium enforcement.
- Key analytics may require careful use of existing operational tables to avoid new migrations.

## Phase 7C — Premium License System

Objectives:

- Harden premium license runtime enforcement after Phase 7B is stable.
- Complete assignment lifecycle and capacity enforcement.
- Define and enforce customer identifiers and device binding.
- Add license lookup hash/verifier storage strategy if needed.
- Add premium analytics and runtime license audit trail.

Dependencies:

- Phase 7B Key Monetization complete and stable.
- Raw endpoint protection implemented for access modes.
- Loader credential forwarding pattern validated with keys before adding premium credentials.
- Premium request contract reviewed and frozen.
- Customer/device binding design approved before implementation.
- Atomic assignment capacity strategy selected.

Risks:

- Assignment races can allow license sharing.
- Customer identifier normalization changes can strand existing assignment records.
- Device binding can block legitimate customers.
- Premium license credentials can leak if forwarding/logging boundaries are not strict.
- Premium analytics can be misleading if counters are not atomic.
- Phase 7C may require migrations and must not be folded into Phase 7B.

## TODO Classification

| Item | Classification | Rationale |
|---|---|---|
| Free key generation | Completed | Existing key generation is implemented. |
| Work.ink flow | Completed | Existing Work.ink verification and token replay protection are implemented. |
| Key validation | Completed | Existing key validation is implemented. |
| Key expiration | Completed | Existing keys use `expires_at`. |
| Weekly keys | Phase 7B | Requires configurable expiration issuance. |
| Monthly keys | Phase 7B | Requires configurable expiration issuance. |
| Custom expiration keys | Phase 7B | Uses existing expiration concept but needs dashboard/service support. |
| Dashboard key issuance | Phase 7B | Required for productized key monetization. |
| Key analytics | Phase 7B | Required for operational monetization visibility. |
| `key_required` script access | Phase 7B | Existing foundation must be made usable by creators/loaders. |
| Loader key forwarding | Phase 7B | Required for key-required delivery through production loader. |
| Raw endpoint protection | Phase 7B | Required to prevent bypass. |
| Premium licenses | Phase 7C | Deferred premium system scope. |
| License assignments | Phase 7C | Deferred premium system scope. |
| Customer identifiers | Phase 7C | Deferred premium/customer binding scope. |
| Device binding | Phase 7C | Deferred premium/device binding scope. |
| License lookup hashes | Phase 7C | Deferred premium verification scope. |
| License verifier storage | Phase 7C | Deferred premium verification scope. |
| Premium analytics | Phase 7C | Deferred premium analytics scope. |
| Runtime license enforcement | Phase 7C | Moved out of Phase 7B. |
| Assignment lifecycle | Phase 7C | Moved out of Phase 7B. |
| Assignment capacity enforcement | Phase 7C | Moved out of Phase 7B. |
| Production Stabilization | Operational/Ongoing | Active observation track. |
| Marketplace / creator economy | Remove | Not part of current roadmap. |
