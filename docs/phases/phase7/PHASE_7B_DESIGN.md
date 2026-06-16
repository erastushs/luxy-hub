# Phase 7B Design — Key Monetization Platform

Status: Deferred / Planning Refined
Date: 2026-06-16

Reason: Product direction was refined. Phase 7B is now the Key Monetization Platform. Phase 7C remains the deferred Premium License System.

Implementation: Partially founded in MAIN by existing free key generation, Work.ink verification, key validation, key expiration, `access_mode`, and session-boundary key authorization. No feature implementation is part of this documentation update.

Design: Refined

Threat Model: Refined

Documentation: Refined

This document describes intended Phase 7B scope only. It is not an implementation record. Phase 7B must not implement premium licenses, license assignments, customer identifiers, HWID binding, device transfer workflows, license entitlements, license analytics, runtime license hardening, or license assignment capacity enforcement. Those items belong to Phase 7C.

## 1. Objective

Phase 7B should evolve the existing key system into a provider-agnostic Key Monetization Platform.

The platform supports:

- Free 24-hour keys issued through ad providers.
- Multiple provider sources, starting with Work.ink and designed for Linkvertise, LootLabs, and future providers.
- Paid keys with weekly, monthly, and custom expiration durations.
- Device-limited keys with a simpler support model than full HWID licensing.
- Administrative device reset workflows.
- Key analytics that distinguish generated, validated, expired, denied, and provider-sourced activity.

## 2. Current MAIN Foundation

Already present in MAIN:

- Free key generation.
- Work.ink token verification flow.
- Work.ink token replay protection.
- Key validation.
- Key expiration through `keys.expires_at`.
- `access_mode` with `public`, `key_required`, and `license_required` values.
- Delivery-session authorization branch for `key_required` that delegates to existing key validation.
- Operational logging/analytics tables that can support a minimal analytics view.

Known gaps in MAIN for the refined Phase 7B scope:

- Provider abstraction is not implemented; current behavior is Work.ink-specific.
- Linkvertise, LootLabs, and future provider contracts are not designed in code.
- Paid key issuance is not implemented.
- Weekly, monthly, and custom-expiration issuance paths are not implemented.
- Key records do not currently model `provider`, `source`, `key_type`, or `max_devices`.
- Device registration storage is not implemented.
- Device reset workflow is not implemented.
- Dashboard key issuance is not implemented.
- Dashboard script management does not yet expose `key_required` as a productized creator control.
- The production loader does not currently forward a key or device fingerprint to `POST /api/delivery/session`.
- Raw script delivery must be protected so it cannot bypass `key_required` access.
- Key analytics are incomplete for provider source, paid/free key type, denial reason, and device limit outcomes.

## 3. Phase 7B Scope

Phase 7B includes:

- Free keys.
- 24-hour keys via ad providers.
- Multi-provider access system.
- Work.ink provider support.
- Linkvertise provider support.
- LootLabs provider support.
- Future provider abstraction.
- Paid keys.
- Weekly keys.
- Monthly keys.
- Custom expiration keys.
- Device-limited keys.
- Administrative device reset workflow.
- Key analytics.
- Provider source tracking.
- `key_required` script access.
- Loader key forwarding.
- Raw endpoint protection.

Phase 7B excludes:

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
- Marketplace, paid scripts, and creator economy features.

## 4. Product Model

Conceptual key model:

```text
Key
|-- expires_at
|-- max_devices
|-- is_active
|-- provider_source
|-- key_type
|-- analytics
```

Conceptual device registration model:

```text
Device Registration
|-- key_id
|-- fingerprint
|-- first_seen_at
|-- last_seen_at
```

Key types:

| Key Type | Source | Duration | Example Device Limit |
|---|---|---:|---:|
| Free | Ad provider | 24 hours | 1 device |
| Weekly | Paid key issuance | 7 days | 1 device |
| Monthly | Paid key issuance | 30 days | 3 devices |
| Team | Paid/custom key issuance | Custom | 5 devices |
| Custom | Dashboard/admin issuance | Custom | Custom |

The table is product guidance, not a schema migration. Any eventual schema changes must be reviewed separately during implementation planning.

## 5. Provider Model

Goal:
Make key acquisition provider-agnostic.

Supported provider direction:

- Work.ink.
- Linkvertise.
- LootLabs.
- Future providers.

Provider abstraction requirements:

- The key platform should not assume Work.ink-specific token naming, callback shape, URL structure, completion semantics, or replay strategy outside a provider adapter.
- Provider adapters should normalize completions into one internal key issuance decision.
- Provider source should be recorded for analytics.
- Provider-specific verification failures should be mapped to generic user-facing denial states.
- Provider credentials, secrets, and raw callback payloads must not leak to loader/runtime code.

Conceptual provider flow:

```text
Provider completion/callback
  -> provider adapter verifies completion
  -> normalized provider result
  -> key issuance policy selects key type, expiration, max_devices
  -> key generated
  -> analytics records provider source and generated outcome
```

## 6. Free Keys

Goal:
Support ad-provider-funded 24-hour keys.

Current State:
MAIN already supports a Work.ink-backed free key flow with fixed 24-hour expiration.

Target State:
Free keys are issued through a provider-agnostic ad-provider layer. Work.ink is one provider, not the platform assumption. Linkvertise, LootLabs, and future providers should fit the same adapter model.

Default policy:

- Duration: 24 hours.
- Device limit: 1 device.
- Source: ad provider.

Risks:
Changing the existing Work.ink flow can break current users. Provider-specific assumptions can make future providers expensive to add.

## 7. Paid Keys

Goal:
Support paid key issuance without using the Premium License System.

Paid key types:

- Weekly keys.
- Monthly keys.
- Custom expiration keys.

Paid keys are still keys, not licenses. They should use the key monetization model, key validation path, device limit model, and key analytics. They should not introduce license assignments, customer identifiers, license entitlements, or premium license analytics.

Target policy examples:

- Weekly: 7 days, 1 device.
- Monthly: 30 days, 3 devices.
- Team/custom: custom expiration, 5 or custom devices.

Risks:
Paid keys can be confused with premium licenses. The dashboard and docs must keep paid keys separate from Phase 7C Premium License System concepts.

## 8. Device-Limited Keys

Goal:
Reduce casual key sharing without implementing full HWID/license binding.

Conceptual behavior:

1. User submits a key and device fingerprint during session creation.
2. Server validates the key is active and unexpired.
3. Server looks up device registrations for the key.
4. If the fingerprint is already registered, update `last_seen_at` and allow.
5. If the fingerprint is new and active registration count is below `max_devices`, register it and allow.
6. If the fingerprint is new and the limit is exhausted, deny.

Example limits:

| Key Tier | Max Devices |
|---|---:|
| Free | 1 |
| Weekly | 1 |
| Monthly | 3 |
| Team | 5 |

Device fingerprints are not perfect. They should be treated as sharing friction and support tooling, not as anti-tamper DRM or a full HWID license system.

## 9. Device Reset Workflow

Goal:
Provide an administrative support workflow for legitimate device changes.

Administrative reset workflow:

1. Admin/creator opens key detail view.
2. Admin reviews key status, expiration, provider source, device registrations, and recent validation outcomes.
3. Admin selects a device registration or all registrations to reset.
4. System records a reset audit/analytics event.
5. The next validation from a new fingerprint can register if the key is active, unexpired, and under `max_devices`.

Reset policy guidance:

- Resets should be explicit administrative actions.
- Resets should not extend key expiration by default.
- Resets should not change `max_devices` unless the admin separately edits/reissues the key.
- Reset events should be visible in key analytics or support history.

## 10. `key_required` Script Access

Goal:
Make `access_mode = key_required` the platform access mode for free, paid, provider-backed, and device-limited keys.

Current State:
The database and delivery authorization foundation support `key_required`, but script management does not yet productize creator-facing access-mode changes.

Target State:
Creators can configure eligible scripts as `public` or `key_required`. `license_required` remains Phase 7C.

Risks:
Confusing `visibility` with `access_mode` can accidentally expose or block scripts. Confusing paid keys with premium licenses can cause support and entitlement mistakes.

## 11. Loader Key Forwarding

Goal:
Allow the production loader to satisfy key-required session authorization while preserving secure delivery boundaries.

Current State:
The loader posts only `slug` to `/api/delivery/session`.

Target State:
The loader forwards key and device fingerprint values only to `POST /api/delivery/session`. It must not forward keys or fingerprints to delivery fetch, payload delivery, event reporting, or unrelated runtime surfaces.

Risks:
Credential forwarding can leak keys or fingerprints through logs, errors, generated Lua, analytics, or support screenshots if boundaries are not explicit.

## 12. Raw Endpoint Protection

Goal:
Prevent raw script delivery from bypassing key monetization.

Current State:
Raw delivery remains available for public/unlisted scripts. `access_mode` protection must be accounted for before Phase 7B release.

Target State:
If a script is `key_required`, raw script/source endpoints must not provide a bypass around delivery-session key authorization.

Risks:
If raw delivery remains open for key-required scripts, Phase 7B monetization can be bypassed entirely.

## 13. Key Analytics

Goal:
Provide operational visibility into key monetization.

Required events:

- Key generated.
- Key validated.
- Key expired.
- Key denied.
- Provider source.

Recommended analytics dimensions:

- Provider source: Work.ink, Linkvertise, LootLabs, manual/admin, paid, future provider.
- Key type: free, weekly, monthly, team, custom.
- Denial reason category: invalid, expired, inactive, device_limit_exceeded, provider_failed, missing_key.
- Device registration count.
- Reset count.
- Script/access-mode context where safe.

Risks:
Analytics that overcollect raw keys, provider tokens, or raw fingerprints can leak credentials or sensitive device data. Analytics should use snippets, hashes, categories, and aggregate counters where possible.

## 14. Benefits

- Reduced provider dependency because Work.ink, Linkvertise, LootLabs, and future providers can share one normalized model.
- Reduced key sharing through device-limited keys.
- Simpler support model than full HWID licensing.
- Better monetization flexibility through free, weekly, monthly, team, and custom keys.
- Cleaner Phase 7C boundary because paid keys do not require premium license assignments or entitlements.

## 15. Tradeoffs

- Fingerprints are not perfect and can be spoofed or unstable.
- Device resets may be needed for legitimate users.
- Device-limited keys are not a full anti-sharing or anti-tamper solution.
- Provider abstraction adds planning complexity compared with a Work.ink-only flow.
- Paid keys must be carefully documented so they are not mistaken for premium licenses.

## 16. Progress Assessment

Current Phase 7B completion estimate based only on MAIN: 35%.

Completed foundation:

- Free key generation.
- Work.ink integration.
- Key validation.
- Key expiration.
- Token replay protection.
- `access_mode` schema foundation.
- Session-boundary `key_required` authorization foundation.

Remaining work:

- Provider-agnostic access design and implementation.
- Linkvertise provider support.
- LootLabs provider support.
- Future provider adapter contract.
- Paid key issuance.
- Weekly/monthly/custom expiration controls.
- Device limit model.
- Device registration model.
- Administrative device reset workflow.
- Dashboard key issuance.
- Productized `key_required` script access controls.
- Loader key and fingerprint forwarding.
- Raw endpoint protection.
- Key analytics with provider source and device outcomes.
- Rollout checklist and tests.

Production blockers:

- Production loader does not forward keys or device fingerprints.
- Raw endpoint bypass must be resolved before key-required monetization can be trusted.
- Dashboard does not yet expose key issuance or key-required access-mode management.
- Provider abstraction and paid key issuance are not implemented.
- Device registration and reset workflow are not implemented.

Nice-to-have items:

- Key hashing.
- Script-scoped keys.
- Revenue attribution.
- Rich funnel analytics from provider completion to key-authorized delivery.
- Self-service user device reset with abuse controls.

Nice-to-have items are not required for the first Phase 7B platform release unless separately approved.

## 17. Recommended Implementation Order

1. Finalize provider-agnostic key monetization model.
2. Confirm production stabilization entry criteria.
3. Design storage/API requirements for key types, provider source, max devices, and device registrations.
4. Add raw endpoint access-mode protection before monetized rollout.
5. Productize `key_required` script access configuration.
6. Add provider adapter contract and migrate Work.ink behind it.
7. Add Linkvertise and LootLabs provider adapters.
8. Add dashboard key issuance for free, weekly, monthly, team, and custom keys.
9. Add device registration and administrative reset workflow.
10. Add loader key/fingerprint forwarding only to the delivery-session endpoint.
11. Add key analytics for generated, validated, expired, denied, provider source, and device outcomes.
12. Run security review focused on provider spoofing, key leakage, fingerprint handling, raw endpoint bypass, and analytics data minimization.

## 18. Phase 7C Boundary

All premium-license work is Phase 7C:

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
- License counters and runtime audit trail.
- `license_key` contract alignment.

Phase 7C may require migrations or database functions. Those risks must not be introduced into Phase 7B documentation as implemented behavior.
