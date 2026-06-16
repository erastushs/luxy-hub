# ADR-009: License Authorization Model

## Status

Accepted / Roadmap Realigned

## Date

2026-06-11

## Context

Phase 7A introduced the license foundation:

- `scripts.access_mode`
- `licenses`
- `license_assignments`
- License lifecycle APIs
- License management dashboard
- License analytics dashboard

Roadmap update: Phase 7B is now Key Monetization Platform. Runtime license enforcement and premium license hardening have moved to Phase 7C. The current architectural boundary remains delivery session creation.

## Problem

LuxyHub needs a clear authorization model for script delivery that separates discoverability from access requirements and records the current implementation state before Phase 7B Key Monetization Platform and Phase 7C Premium License System work begins.

The system must support free/public scripts, Work.ink key-gated scripts, and premium license-gated scripts without moving authorization into untrusted loader/runtime code.

## Decision

LuxyHub accepts `scripts.access_mode` as the delivery authorization model.

Access modes:

- `public`: delivery session may be created when script visibility/build state permits delivery.
- `key_required`: delivery session requires a valid key through the existing key ecosystem. Productization belongs to Phase 7B.
- `license_required`: delivery session requires license validation through license foundation services. Runtime hardening belongs to Phase 7C.

Implemented behavior in current Phase 7A state:

- `scripts.access_mode` exists with default `public`.
- `licenses` store hashed license keys, status, optional expiration, counters, max assignments, and owner/script binding.
- `license_assignments` store hashed customer identifiers and assignment status.
- License rows are owner-scoped and structurally bound to script ownership.
- Delivery session creation calls delivery authorization service before issuing a session.
- Runtime payload fetch remains session-token based and does not accept license credentials.
- License dashboard/API supports management workflows for creators.

Known limitations before Phase 7B Key Monetization Platform:

- Dashboard key issuance is not productized.
- Weekly, monthly, and custom-expiration key issuance paths are not productized.
- `key_required` script access controls are not productized for creators.
- Loader key forwarding is not implemented by this ADR.
- Raw endpoint protection for key-required scripts must be reviewed before Phase 7B release.
- Key monetization analytics are not complete.

Known limitations before Phase 7C Premium License System:

- Runtime license enforcement requires additional hardening against assignment capacity bypass.
- `customer_identifier` normalization and required semantics need to be frozen.
- License assignment creation and capacity enforcement need atomic semantics.
- License counters and runtime audit trail semantics need final implementation review.
- Request contract naming for documented `license_key` behavior must be reconciled before changing runtime clients.

Planned Phase 7B Key Monetization Platform work:

- Dashboard key issuance.
- Weekly, monthly, and custom-expiration keys.
- `key_required` script access.
- Loader key forwarding only to the delivery session endpoint.
- Raw endpoint protection.
- Key analytics.

Planned Phase 7C Premium License System work:

- Harden license-required delivery session authorization.
- Enforce `max_assignments` consistently for runtime and creator assignment paths.
- Require and normalize customer identifiers for license-required runtime access.
- Align runtime request contract around documented license credential fields.
- Forward premium credentials through loader only to the delivery session endpoint.
- Update license activation/delivery counters safely.
- Add sanitized runtime license audit trail behavior.

Threat model references:

- License sharing.
- Assignment bypass.
- Unlimited assignment creation.
- Replay attacks.
- Loader tampering.
- Credential leakage.
- Brute force attempts.

## Consequences

Positive consequences:

- Authorization requirement is explicit per script and independent of visibility.
- Existing public delivery behavior remains stable through default `public`.
- Key-required and license-required scripts share the same session boundary.
- License ownership is enforced at schema and service layers.
- Phase 7B has a clear key-monetization target without redesigning delivery fetch.
- Phase 7C has a clear premium-license hardening target without blocking Phase 7B.

Negative consequences:

- Current Phase 7A state is foundation, not final key monetization or premium runtime enforcement hardening.
- License-required behavior is sensitive to loader request contract and identifier handling decisions.
- Assignment capacity requires careful concurrency handling.
- Mistakes in enforcement can block legitimate users or allow unauthorized access.

Security implications:

- Authorization must remain server-side at session creation.
- Runtime/loader clients are untrusted.
- Raw license keys must not be stored or logged.
- Customer identifiers must be stored as hashes for enforcement.
- Fetch and event reporting must not become license-validation surfaces.

## Alternatives Considered

### Use `visibility` as Authorization

Rejected because discoverability and access requirements are separate concerns. A public script can still require a key or license.

### Authorize During Payload Fetch

Rejected because fetch should only validate an already-authorized one-time session and should not receive raw credentials.

### Authorize Inside Runtime Payload

Rejected because loader/runtime code is untrusted and can be tampered with.

### Create Separate Delivery APIs for Each Access Mode

Rejected because it would duplicate session/build logic and increase attack surface. A unified session endpoint with access-mode branching is simpler and safer.

## Related Documents

- `docs/phases/phase7/PHASE_7B_DESIGN.md`
- `docs/phases/phase7/PHASE_7B_THREAT_MODEL.md`
- `docs/architecture/PHASE7_LICENSE_ARCHITECTURE.md`
- `docs/runtime/SECURE_DELIVERY.md`
- `docs/database/SCHEMA.md`
- `docs/database/RLS_POLICIES.md`
- `docs/architecture/ARCHITECTURE.md`
