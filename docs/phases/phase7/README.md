# Phase 7 — Access Modes, Keys, and License Authorization

Phase 7 documentation source of truth:

../../architecture/PHASE7_LICENSE_ARCHITECTURE.md

Phase 7B planning documents:

- `PHASE_7B_RUNTIME_INTEGRATION_SPEC.md`
- `PHASE_7B_DESIGN.md`
- `PHASE_7B_THREAT_MODEL.md`
- `PHASE7_KEY_MONETIZATION_MODEL.md`
- `../../roadmap/PHASE7_ROADMAP_REALIGNMENT_REPORT.md`

Current Status:
Phase 7A is complete / production ready. Production Stabilization is active. Phase 7B has been refined to Key Monetization Platform, and backend monetization infrastructure is complete. Phase 7B is now blocked by Roblox runtime integration: popup validation must call `POST /api/validate` and gate main script execution. Phase 7C owns Premium License System work, including runtime license enforcement and license hardening.

Phase 7B Status:

- Name: Key Monetization Platform
- Status: Runtime Integration Blocked
- Reason: Runtime popup validation is not integrated into the Roblox runtime
- Implementation: Backend monetization infrastructure is complete. Device Limits, Premium Keys, and Free Keys are enforced through `POST /api/validate`. Runtime loader execution is not yet gated and delivered payloads currently execute directly.
- Design: Refined
- Threat Model: Refined
- Documentation: Refined
- Backend Infrastructure estimate: 100%
- Runtime Integration estimate: 0%
- Current overall completion estimate: 85-90%

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
- Phase 7B.6 runtime key integration must call `POST /api/validate` and must not change Delivery Session Architecture, Delivery Fetch Architecture, Runtime Payload Delivery, Event Platform, Analytics Pipeline, or Build System.
- Device Limits and Premium Keys remain enforced through `POST /api/validate`; no `DeviceLimitService` or Premium Key backend changes are required for Phase 7B.6.
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
