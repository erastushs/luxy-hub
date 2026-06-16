# Phase 7 — Access Modes, Keys, and License Authorization

Phase 7 documentation source of truth:

../../architecture/PHASE7_LICENSE_ARCHITECTURE.md

Phase 7B planning documents:

- `PHASE_7B_DESIGN.md`
- `PHASE_7B_THREAT_MODEL.md`
- `PHASE7_KEY_MONETIZATION_MODEL.md`
- `../../roadmap/PHASE7_ROADMAP_REALIGNMENT_REPORT.md`

Current Status:
Phase 7A is complete / production ready. Production Stabilization is active. Phase 7B has been refined to Key Monetization Platform. Phase 7C owns Premium License System work, including runtime license enforcement and license hardening.

Phase 7B Status:

- Name: Key Monetization Platform
- Status: Deferred / Planning Refined
- Reason: Production Stabilization Window
- Implementation: Partially founded in MAIN by existing free key generation, Work.ink verification, key validation, key expiration, `access_mode`, and session-boundary key authorization
- Design: Refined
- Threat Model: Refined
- Documentation: Refined
- Current completion estimate: 35%

Phase 7C Status:

- Name: Premium License System
- Status: Deferred
- Reason: Starts after Phase 7B Key Monetization Platform is stable
- Implementation: Phase 7A foundation exists, but Phase 7C license hardening is not started under the new roadmap

Approved access modes:

- `public`
- `key_required`
- `license_required`

Implementation guardrails:

- `visibility` and `access_mode` are separate concerns.
- Authorization occurs only during `POST /api/delivery/session`.
- Existing Work.ink endpoints remain supported but must become one provider in a provider-agnostic key platform.
- Phase 7B may touch only key monetization planning and later key-specific implementation.
- Phase 7B must not implement premium licenses, license assignments, customer identifiers, HWID binding, device transfer workflows, license entitlements, license analytics, or license hardening.
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
- License hardening is deferred to Phase 7C.

### Assignments

- Create assignments with hashed customer identifiers and optional display names.
- Remove assignments through the dashboard/API.
- Assignment capacity enforcement, assignment lifecycle expansion, customer identifiers, HWID binding, and device transfer workflows are deferred to Phase 7C.

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

- Preserve and productize existing free key access.
- Make Work.ink one provider in a provider-agnostic access system.
- Support Linkvertise, LootLabs, and future providers through a common provider model.
- Support 24-hour free keys via ad providers.
- Support paid weekly, monthly, team, and custom-expiration keys.
- Add device-limited keys with `max_devices` behavior.
- Add administrative device reset workflows.
- Add dashboard key issuance.
- Make `key_required` script access usable end-to-end.
- Add loader key and fingerprint forwarding.
- Protect raw endpoints from bypassing key-required access.
- Add key analytics with provider source.

Deliverables:

- Provider-agnostic key provider model.
- Work.ink provider compatibility.
- Linkvertise provider planning.
- LootLabs provider planning.
- Future provider adapter guidance.
- Dashboard key issuance for 24-hour, weekly, monthly, team, and custom-expiration keys.
- Device-limited key model with example limits: free 1, weekly 1, monthly 3, team 5.
- Administrative device reset workflow.
- Dashboard/API/service planning for `key_required` script access.
- Loader key/fingerprint forwarding only to `POST /api/delivery/session`.
- Raw endpoint protection for `key_required` scripts.
- Key analytics for generated, validated, expired, denied, and provider source events.
- Production rollout checklist and monitoring plan.

Success criteria:

- Existing public scripts keep working unchanged.
- Existing Work.ink key flow remains compatible through a provider abstraction.
- Free provider keys expire after 24 hours by default.
- Paid keys support weekly, monthly, team, and custom expiration options.
- Device-limited keys enforce documented `max_devices` behavior.
- Admins can reset device registrations without extending key expiration by default.
- `key_required` scripts require a valid active unexpired key at session creation.
- Loader forwards keys and fingerprints only to the delivery session endpoint.
- Raw script delivery cannot bypass key-required access.
- Key analytics track key generated, validated, expired, denied, and provider source outcomes.
- No premium license work is required for Phase 7B release.

Risks:

- Raw endpoint bypass can undermine key monetization.
- Provider-specific assumptions can make Linkvertise, LootLabs, or future providers difficult to add.
- Loader key/fingerprint forwarding can leak credentials or device signals if errors or logs include raw values.
- Fingerprints are not perfect and can be spoofed or unstable.
- Device resets may be needed for legitimate users.
- Device-limited keys are not a full anti-sharing solution.
- Key analytics may require careful use of existing operational tables or later approved schema work.

## Phase 7C — Premium License System

Objectives:

- Harden premium license runtime enforcement after Phase 7B is stable.
- Complete license assignment lifecycle and capacity enforcement.
- Define and enforce customer identifiers and HWID binding.
- Define device transfer workflows for licenses.
- Define license entitlements.
- Add license lookup hash/verifier storage strategy if needed.
- Add license analytics and runtime license audit trail.
- Complete license hardening.

Dependencies:

- Phase 7B Key Monetization Platform complete and stable.
- Raw endpoint protection implemented for access modes.
- Loader key/fingerprint forwarding pattern validated before adding premium credentials or license HWID behavior.
- Premium request contract reviewed and frozen.
- Customer identifier, HWID binding, device transfer, and entitlement design approved before implementation.
- Atomic assignment capacity strategy selected.

Risks:

- Assignment races can allow license sharing.
- Customer identifier normalization changes can strand existing assignment records.
- HWID binding can block legitimate customers.
- Device transfer workflows can be abused without policy and audit controls.
- Premium license credentials can leak if forwarding/logging boundaries are not strict.
- License analytics can be misleading if counters are not atomic.
- Phase 7C may require migrations and must not be folded into Phase 7B.

## TODO Classification

| Item | Classification | Rationale |
|---|---|---|
| Free key generation | Completed | Existing key generation is implemented. |
| Work.ink flow | Completed | Existing Work.ink verification and token replay protection are implemented. |
| Key validation | Completed | Existing key validation is implemented. |
| Key expiration | Completed | Existing keys use `expires_at`. |
| Provider-agnostic access system | Phase 7B | Required to support Work.ink, Linkvertise, LootLabs, and future providers. |
| Linkvertise provider | Phase 7B | Required by refined Phase 7B scope. |
| LootLabs provider | Phase 7B | Required by refined Phase 7B scope. |
| Future provider model | Phase 7B | Required to avoid provider-specific assumptions. |
| 24-hour free provider keys | Phase 7B | Existing 24-hour Work.ink behavior is a foundation, but must be generalized. |
| Paid weekly keys | Phase 7B | Paid key issuance is key monetization, not premium licensing. |
| Paid monthly keys | Phase 7B | Paid key issuance is key monetization, not premium licensing. |
| Custom expiration keys | Phase 7B | Uses existing expiration concept but needs productized support. |
| Device-limited keys | Phase 7B | Required to reduce key sharing without full HWID licensing. |
| Administrative device reset | Phase 7B | Required support workflow for device-limited keys. |
| Dashboard key issuance | Phase 7B | Required for productized key monetization. |
| Key analytics | Phase 7B | Required for generated, validated, expired, denied, and provider source events. |
| `key_required` script access | Phase 7B | Existing foundation must be made usable by creators/loaders. |
| Loader key/fingerprint forwarding | Phase 7B | Required for key-required delivery and device-limited keys. |
| Raw endpoint protection | Phase 7B | Required to prevent bypass. |
| Premium licenses | Phase 7C | Deferred premium system scope. |
| License assignments | Phase 7C | Deferred premium system scope. |
| Customer identifiers | Phase 7C | Deferred premium/customer binding scope. |
| HWID binding | Phase 7C | Deferred premium/license hardening scope. |
| Device transfer workflows | Phase 7C | Deferred premium license support workflow. |
| License entitlements | Phase 7C | Deferred premium license model scope. |
| License analytics | Phase 7C | Deferred premium analytics scope. |
| License hardening | Phase 7C | Deferred premium hardening scope. |
| Runtime license enforcement | Phase 7C | Moved out of Phase 7B. |
| Assignment lifecycle | Phase 7C | Moved out of Phase 7B. |
| Assignment capacity enforcement | Phase 7C | Moved out of Phase 7B. |
| Production Stabilization | Operational/Ongoing | Active observation track. |
| Marketplace / creator economy | Remove | Not part of current roadmap. |
