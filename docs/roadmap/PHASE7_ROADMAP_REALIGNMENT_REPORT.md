# Phase 7 Roadmap Realignment Report

Date: 2026-06-16

Branch reviewed: current MAIN branch only.

Scope: Documentation and roadmap realignment only. No application code, schema, migrations, or premium license implementation were changed.

## Summary

Product direction changed:

- Phase 7B is now Key Monetization.
- Phase 7C is now Premium License System.

The current MAIN branch already contains foundational work that supports Phase 7B:

- Free key generation.
- Work.ink flow.
- Key validation.
- Key expiration.
- Work.ink token replay protection.
- `scripts.access_mode` with `key_required`.
- Delivery-session authorization foundation for key-required access.

The current MAIN branch also contains premium license foundation work from Phase 7A, but premium runtime enforcement and hardening are no longer Phase 7B scope.

## Changes Made

Updated roadmap and planning documents to replace the old Phase 7B Runtime License Enforcement plan with the new Phase 7B Key Monetization plan.

Updated files:

- `docs/roadmap/TODO.md`
- `docs/roadmap/RELEASE_V1.md`
- `docs/phases/phase7/README.md`
- `docs/phases/phase7/PHASE_7B_DESIGN.md`
- `docs/phases/phase7/PHASE_7B_THREAT_MODEL.md`
- `docs/architecture/PHASE7_LICENSE_ARCHITECTURE.md`
- `docs/architecture/ARCHITECTURE.md`
- `docs/architecture/SCRIPT_RUNTIME_ARCHITECTURE.md`
- `docs/architecture/contracts/RUNTIME_METADATA_SCHEMA.md`
- `docs/architecture/decisions/ADR-009-license-authorization-model.md`
- `docs/PROJECT_STATUS.md`
- `docs/README.md`
- `docs/deployment/PRODUCTION_VALIDATION_REPORT.md`
- `docs/database/MIGRATIONS.md`
- `docs/operations/PRODUCTION_DEPLOYMENT.md`

Created this report:

- `docs/roadmap/PHASE7_ROADMAP_REALIGNMENT_REPORT.md`

## New Phase 7B Ownership

Phase 7B includes only Key Monetization work:

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

Phase 7B explicitly excludes:

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
- Marketplace, paid scripts, and creator economy work.

## New Phase 7C Ownership

Phase 7C contains the Premium License System:

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
- `license_key` request contract alignment.
- License activity counters.
- Runtime license audit trail.

## Items Moved From Phase 7B To Phase 7C

| Item | Previous Ownership | New Ownership | Rationale |
|---|---|---|---|
| Runtime license enforcement | Phase 7B | Phase 7C | Premium license runtime behavior is outside key monetization. |
| Assignment capacity enforcement | Phase 7B | Phase 7C | Requires premium-license atomic enforcement semantics. |
| `customer_identifier` handling and validation | Phase 7B | Phase 7C | Customer binding belongs to premium license access. |
| `license_key` delivery contract alignment | Phase 7B | Phase 7C | Premium license request contract should not block key monetization. |
| License activity counters | Phase 7B | Phase 7C | Premium analytics/counters belong to the premium license system. |
| Runtime license audit trail | Phase 7B | Phase 7C | Premium authorization audit behavior should be designed with Phase 7C. |
| Device/customer limits | Phase 7B | Phase 7C | Device/customer binding belongs to premium license access. |
| Disabled/revoked assignment runtime enforcement | Phase 7B | Phase 7C | Assignment status enforcement is premium license scope. |
| License assignments | Phase 7B-adjacent | Phase 7C | Assignment lifecycle expansion is not required for key monetization. |
| License lookup hashes | Phase 7B-adjacent | Phase 7C | Premium license verification hardening belongs to Phase 7C. |
| License verifier storage | Phase 7B-adjacent | Phase 7C | Premium verifier storage may require schema/design work. |
| Premium analytics | Phase 7B-adjacent | Phase 7C | Premium analytics depend on runtime premium enforcement semantics. |

## TODO Classification

| Item | Classification | Rationale |
|---|---|---|
| Free key generation | Completed | Existing key generation exists in MAIN. |
| Work.ink flow | Completed | Existing Work.ink verification and key flow exist in MAIN. |
| Key validation | Completed | Existing validation rejects invalid, inactive, and expired keys. |
| Key expiration | Completed | Existing keys store `expires_at`. |
| Work.ink replay protection | Completed | Existing token replay table/service exists. |
| `access_mode` schema foundation | Completed | `public`, `key_required`, and `license_required` exist in MAIN migration 013. |
| Key-required authorization foundation | Completed | Delivery authorization can validate a supplied key for `key_required`. |
| Dashboard key issuance | Phase 7B | Required for key monetization productization. |
| Weekly keys | Phase 7B | Can use existing expiration model, but issuance path is missing. |
| Monthly keys | Phase 7B | Can use existing expiration model, but issuance path is missing. |
| Custom expiration keys | Phase 7B | Can use existing `expires_at`, but dashboard/service support is missing. |
| Key analytics | Phase 7B | Required for key monetization monitoring. |
| `key_required` script access controls | Phase 7B | Existing foundation is not yet productized for creators. |
| Loader key forwarding | Phase 7B | Required for production loader compatibility with key-required scripts. |
| Raw endpoint protection | Phase 7B | Required to prevent key-required bypass. |
| Production Stabilization | Operational/Ongoing | Active observation track before new implementation work. |
| Analytics V2 | Operational/Ongoing | Roadmap track outside Phase 7B/7C ownership. |
| QA and test coverage expansion | Operational/Ongoing | Release-readiness track outside Phase 7B/7C ownership. |
| Operational hardening | Operational/Ongoing | Platform hardening track outside Phase 7B/7C ownership. |
| Security review | Operational/Ongoing | Required before release and should include Phase 7B review. |
| Premium licenses | Phase 7C | Premium system scope. |
| License assignments | Phase 7C | Premium system scope. |
| Customer identifiers | Phase 7C | Premium binding scope. |
| Device binding | Phase 7C | Premium binding scope. |
| License lookup hashes | Phase 7C | Premium verification scope. |
| License verifier storage | Phase 7C | Premium verification scope. |
| Premium analytics | Phase 7C | Premium reporting scope. |
| Runtime license enforcement | Phase 7C | Premium authorization scope. |
| Assignment lifecycle | Phase 7C | Premium assignment scope. |
| Assignment capacity enforcement | Phase 7C | Premium assignment enforcement scope. |
| Marketplace / creator economy | Remove | Explicitly deferred indefinitely and not needed for Phase 7B/7C minimum scope. |

## Updated Completion Estimate

Current Phase 7B completion estimate based only on MAIN: 60%.

Completed foundation:

- Free key generation.
- Work.ink integration.
- Key validation.
- Key expiration.
- Work.ink token replay protection.
- `access_mode` schema foundation.
- Session-boundary key-required authorization foundation.

Remaining work:

- Dashboard key issuance.
- Weekly key issuance.
- Monthly key issuance.
- Custom-expiration key issuance.
- Productized `key_required` script access controls.
- Loader key forwarding.
- Raw endpoint protection.
- Key analytics.
- Key monetization rollout checklist and tests.

Production blockers:

- The production loader does not currently forward keys to `POST /api/delivery/session`.
- Raw endpoints can undermine key monetization unless access-mode protection is enforced.
- Dashboard/script management does not yet productize `key_required` access or key issuance.

Nice-to-have items:

- Key hashing.
- Script-scoped keys.
- Creator-specific Work.ink campaigns.
- Revenue attribution.
- Rich funnel analytics from Work.ink completion to key-authorized delivery.

Nice-to-have items are not required for Phase 7B and may require future migrations or separate design review.

## Required Migrations

Minimum Phase 7B should require no new migrations.

Reasons:

- `keys.expires_at` already supports variable expiration.
- Work.ink token replay protection already exists.
- `scripts.access_mode` already supports `key_required`.
- Existing operational logging/event tables can support a minimal analytics implementation.

Potential future migrations should be deferred unless separately approved:

- Hashed free-key lookup.
- Script-scoped keys.
- Creator-owned key inventory.
- Creator-specific Work.ink campaigns.
- Revenue attribution.
- Dedicated key analytics tables.

Phase 7C may require migrations or database functions for premium license hardening and must remain separate from Phase 7B.

## Recommended Next Implementation Order

1. Complete Production Stabilization review before Phase 7B implementation starts.
2. Confirm raw endpoint protection design for `key_required` scripts.
3. Productize `key_required` script access controls while keeping `license_required` hidden/deferred if needed.
4. Add dashboard key issuance for 24-hour, weekly, monthly, and custom-expiration keys.
5. Add loader key forwarding only to `POST /api/delivery/session`.
6. Add key analytics for generation, validation, expiration, denial, and key-authorized sessions.
7. Add targeted tests for missing key, invalid key, expired key, valid key, loader forwarding, and raw endpoint bypass prevention.
8. Run key-specific security review for raw endpoint bypass, key leakage, rate limiting, and analytics credential exposure.
9. Ship Phase 7B Key Monetization.
10. Begin Phase 7C Premium License System design review only after Phase 7B is stable.

## Final Recommendation

Continue from MAIN.

MAIN is the correct foundation for the new Phase 7B because it already contains the free key, Work.ink, key validation, key expiration, access-mode, and session authorization foundations needed for key monetization. The premium license foundation present in MAIN should remain deferred and should not be expanded during Phase 7B.

Minimum work required to ship Phase 7B:

1. Dashboard key issuance.
2. Weekly/monthly/custom expiration support.
3. `key_required` script access management.
4. Loader key forwarding.
5. Raw endpoint protection.
6. Key analytics.
7. Focused tests and security review.
