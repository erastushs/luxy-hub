# Phase 7 Roadmap Realignment Report

Date: 2026-06-16

Branch reviewed: current MAIN branch only.

Scope: Documentation and roadmap realignment only. No application code, schema, migrations, runtime behavior, or license implementation were changed.

## Summary

Product direction has been refined:

- Phase 7B is now Key Monetization Platform.
- Phase 7C remains Premium License System.

The current MAIN branch already contains foundational work that supports part of Phase 7B:

- Free key generation.
- Work.ink flow.
- Key validation.
- Key expiration.
- Work.ink token replay protection.
- `scripts.access_mode` with `key_required`.
- Delivery-session authorization foundation for key-required access.

The refined Phase 7B scope is broader than the existing MAIN foundation because it adds provider abstraction, paid keys, device-limited keys, device reset, and provider-aware analytics.

The current MAIN branch also contains premium license foundation work from Phase 7A, but premium license hardening remains Phase 7C scope.

## Changes Made

Updated roadmap and planning documents to replace the old Phase 7B key-only/free-key wording with the refined Key Monetization Platform scope.

Updated files:

- `docs/roadmap/TODO.md`
- `docs/roadmap/RELEASE_V1.md`
- `docs/phases/phase7/README.md`
- `docs/phases/phase7/PHASE_7B_DESIGN.md`
- `docs/phases/phase7/PHASE_7B_THREAT_MODEL.md`
- `docs/phases/phase7/PHASE7_KEY_MONETIZATION_MODEL.md`
- `docs/architecture/PHASE7_LICENSE_ARCHITECTURE.md`
- `docs/architecture/ARCHITECTURE.md`
- `docs/PROJECT_STATUS.md`
- `docs/README.md`
- `docs/database/MIGRATIONS.md`

Updated this report:

- `docs/roadmap/PHASE7_ROADMAP_REALIGNMENT_REPORT.md`

## New Phase 7B Ownership

Phase 7B includes the Key Monetization Platform:

- Free keys.
- 24-hour keys via ad providers.
- Multi-provider access system.
- Work.ink.
- Linkvertise.
- LootLabs.
- Future providers.
- Paid keys.
- Weekly keys.
- Monthly keys.
- Custom expiration keys.
- Device-limited keys.
- Device reset workflow.
- Key analytics.
- Provider source tracking.
- `key_required` script access.
- Loader key/fingerprint forwarding.
- Raw endpoint protection.

Conceptual key model:

```text
Key
|-- expires_at
|-- max_devices
|-- is_active
+-- analytics
```

Conceptual device registration model:

```text
Device Registration
|-- key_id
|-- fingerprint
|-- first_seen_at
+-- last_seen_at
```

Example device limits:

| Key Product | Max Devices |
|---|---:|
| Free | 1 |
| Weekly | 1 |
| Monthly | 3 |
| Team | 5 |

## New Phase 7C Ownership

Phase 7C contains the Premium License System:

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
- `license_key` request contract alignment.
- License activity counters.
- Runtime license audit trail.

## Items Moved Or Confirmed Deferred To Phase 7C

| Item | Ownership | Rationale |
|---|---|---|
| Premium licenses | Phase 7C | Paid keys in Phase 7B are not premium licenses. |
| License assignments | Phase 7C | Assignment behavior belongs to premium license access. |
| Customer identifiers | Phase 7C | Customer identity belongs to premium license binding. |
| HWID binding | Phase 7C | Higher-assurance device binding is license hardening, not key sharing friction. |
| Device transfer workflows | Phase 7C | License device transfers are separate from administrative key device resets. |
| License entitlements | Phase 7C | Entitlement modeling belongs to premium licenses. |
| License analytics | Phase 7C | License activation/delivery/assignment analytics are premium license scope. |
| License hardening | Phase 7C | Runtime license security hardening must not block Phase 7B. |
| Runtime license enforcement | Phase 7C | Premium license runtime behavior is outside key monetization. |
| Assignment capacity enforcement | Phase 7C | Requires premium-license atomic enforcement semantics. |
| `license_key` delivery contract alignment | Phase 7C | Premium request contract should not block key monetization. |
| License activity counters | Phase 7C | Premium analytics/counters belong to the premium license system. |
| Runtime license audit trail | Phase 7C | Premium authorization audit behavior belongs to Phase 7C. |

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
| Provider-agnostic access system | Phase 7B | Required so providers do not leak assumptions into the platform. |
| Linkvertise provider | Phase 7B | Required by refined Phase 7B scope. |
| LootLabs provider | Phase 7B | Required by refined Phase 7B scope. |
| Future provider model | Phase 7B | Required for provider-agnostic architecture. |
| Free 24-hour provider keys | Phase 7B | Existing Work.ink flow is foundation; provider abstraction is missing. |
| Paid weekly keys | Phase 7B | Paid key issuance belongs to key monetization, not premium licenses. |
| Paid monthly keys | Phase 7B | Paid key issuance belongs to key monetization, not premium licenses. |
| Custom expiration keys | Phase 7B | Uses existing expiration concept but needs productized support. |
| Team keys | Phase 7B | Required example paid/custom tier with 5-device support. |
| Device-limited keys | Phase 7B | Required to reduce key sharing. |
| Device registrations | Phase 7B | Required conceptual model for key/fingerprint tracking. |
| Administrative device reset | Phase 7B | Required support workflow for legitimate device changes. |
| Dashboard key issuance | Phase 7B | Required for productized key monetization. |
| `key_required` script access controls | Phase 7B | Existing foundation is not yet productized for creators. |
| Loader key/fingerprint forwarding | Phase 7B | Required for key-required and device-limited authorization. |
| Raw endpoint protection | Phase 7B | Required to prevent key-required bypass. |
| Key analytics | Phase 7B | Required for generated, validated, expired, denied, provider source, and device outcomes. |
| Production Stabilization | Operational/Ongoing | Active observation track before new implementation work. |
| Analytics V2 | Operational/Ongoing | Roadmap track outside Phase 7B/7C ownership. |
| QA and test coverage expansion | Operational/Ongoing | Release-readiness track outside Phase 7B/7C ownership. |
| Operational hardening | Operational/Ongoing | Platform hardening track outside Phase 7B/7C ownership. |
| Security review | Operational/Ongoing | Required before release and should include provider, key, fingerprint, and raw endpoint review. |
| Premium licenses | Phase 7C | Premium system scope. |
| License assignments | Phase 7C | Premium system scope. |
| Customer identifiers | Phase 7C | Premium binding scope. |
| HWID binding | Phase 7C | Premium/license hardening scope. |
| Device transfer workflows | Phase 7C | Premium license support workflow. |
| License entitlements | Phase 7C | Premium license model scope. |
| License analytics | Phase 7C | Premium reporting scope. |
| License hardening | Phase 7C | Premium hardening scope. |
| Runtime license enforcement | Phase 7C | Premium authorization scope. |
| Assignment lifecycle | Phase 7C | Premium assignment scope. |
| Assignment capacity enforcement | Phase 7C | Premium assignment enforcement scope. |
| Marketplace / creator economy | Remove | Not part of current roadmap minimum scope. |

## Updated Completion Estimate

Current Phase 7B completion estimate based only on MAIN: 35%.

Completed foundation:

- Free key generation.
- Work.ink integration.
- Key validation.
- Key expiration.
- Work.ink token replay protection.
- `access_mode` schema foundation.
- Session-boundary key-required authorization foundation.

Remaining work:

- Provider-agnostic access system.
- Linkvertise provider support.
- LootLabs provider support.
- Future provider adapter contract.
- Free 24-hour key policy generalized across providers.
- Paid weekly key issuance.
- Paid monthly key issuance.
- Team/custom key issuance.
- Device-limited keys.
- Device registration storage/model.
- Administrative device reset workflow.
- Dashboard key issuance.
- Productized `key_required` script access controls.
- Loader key/fingerprint forwarding.
- Raw endpoint protection.
- Key analytics with provider source and device outcomes.
- Key monetization rollout checklist and tests.

Production blockers:

- The production loader does not currently forward keys or fingerprints to `POST /api/delivery/session`.
- Raw endpoints can undermine key monetization unless access-mode protection is enforced.
- Dashboard/script management does not yet productize `key_required` access or key issuance.
- Provider abstraction does not exist.
- Linkvertise and LootLabs support does not exist.
- Paid key issuance does not exist.
- Device registration and device reset workflows do not exist.

Nice-to-have items:

- Key hashing.
- Script-scoped keys.
- Revenue attribution.
- Rich funnel analytics from provider completion to key-authorized delivery.
- Self-service device reset with abuse controls.

Nice-to-have items are not required for the first Phase 7B platform release unless separately approved.

## Required Migrations

This documentation update creates no migrations.

The refined Phase 7B model likely needs storage planning before implementation because MAIN does not currently model:

- Provider source.
- Key type.
- `max_devices`.
- Device registrations.
- Device reset history.
- Provider-specific replay markers for Linkvertise, LootLabs, and future providers.
- Provider/device analytics dimensions.

Any schema change must be reviewed separately during implementation planning. No migration is introduced by this documentation update.

Phase 7C may require migrations or database functions for premium license hardening and must remain separate from Phase 7B.

## Benefits

- Reduced provider dependency because Work.ink, Linkvertise, LootLabs, and future providers can use one normalized model.
- Reduced key sharing through device-limited keys.
- Simpler support model than HWID because administrative key device reset is narrower than license HWID transfer.
- Better monetization flexibility through free, weekly, monthly, team, and custom key products.

## Tradeoffs

- Fingerprints are not perfect.
- Fingerprints can be spoofed, copied, or unstable.
- Device resets may be needed for legitimate users.
- Device-limited keys are not a full anti-sharing solution.
- Provider abstraction adds planning and testing complexity.
- Some refined Phase 7B storage concepts may require future migrations after separate review.

## Documentation Contradictions Found

Contradictions found during this update:

- Prior Phase 7B docs still framed the phase as mostly Work.ink/free-key-only rather than provider-agnostic.
- Prior Phase 7B completion estimate was 60%, which no longer matched the expanded provider/paid/device-limited scope.
- Prior docs used “device binding” in Phase 7C while Phase 7B now includes device-limited keys. This was clarified as Phase 7B device registrations/reset versus Phase 7C HWID binding/device transfer workflows.
- Prior analytics wording tracked key generation/validation generally, but did not consistently require provider source or device-limit outcomes.
- Prior migration wording implied minimum Phase 7B might avoid migrations entirely. This was clarified: this documentation update creates no migrations, but implementation planning must separately review storage needs for provider source, `max_devices`, device registrations, reset history, and analytics dimensions.

## Recommended Next Implementation Order

1. Complete Production Stabilization review before Phase 7B implementation starts.
2. Finalize provider-agnostic key provider interface and normalized completion model.
3. Review storage needs for provider source, key type, `max_devices`, device registrations, reset history, and analytics dimensions.
4. Confirm raw endpoint protection design for `key_required` scripts.
5. Productize `key_required` script access controls while keeping `license_required` deferred if needed.
6. Put existing Work.ink behavior behind the provider model.
7. Add Linkvertise and LootLabs provider support.
8. Add dashboard key issuance for free, weekly, monthly, team, and custom keys.
9. Add device registration and administrative reset workflow.
10. Add loader key/fingerprint forwarding only to `POST /api/delivery/session`.
11. Add key analytics for generated, validated, expired, denied, provider source, and device outcomes.
12. Add targeted tests for provider verification, missing key, invalid key, expired key, device limit exceeded, device reset, loader forwarding, and raw endpoint bypass prevention.
13. Run security review for provider spoofing, key leakage, fingerprint handling, rate limiting, raw endpoint bypass, and analytics data minimization.
14. Ship Phase 7B Key Monetization Platform.
15. Begin Phase 7C Premium License System design review only after Phase 7B is stable.

## Final Recommendation

Continue from MAIN.

MAIN remains the correct foundation because it already contains the free key, Work.ink, key validation, key expiration, access-mode, and session authorization foundations needed to start the Key Monetization Platform. The refined platform scope is larger than the current foundation, so the completion estimate is now 35%.

Minimum work required to ship Phase 7B:

1. Provider-agnostic key provider model.
2. Linkvertise/LootLabs/future provider support plan.
3. Paid weekly/monthly/custom/team key issuance.
4. Device-limited key model and administrative reset workflow.
5. Dashboard key issuance.
6. `key_required` script access management.
7. Loader key/fingerprint forwarding.
8. Raw endpoint protection.
9. Key analytics with provider source and device outcomes.
10. Focused tests and security review.
