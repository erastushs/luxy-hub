# Phase 7B Key Monetization Model

Status: Planning
Date: 2026-06-16

Scope: Product and architecture model for Phase 7B Key Monetization Platform. This document is documentation only. It does not implement code, create migrations, change runtime behavior, or add license features.

## 1. Product Model

Phase 7B is the Key Monetization Platform.

The platform supports keys as the monetization primitive for `access_mode = key_required` scripts.

Key products:

| Product | Source | Duration | Example Device Limit | Notes |
|---|---|---:|---:|---|
| Free Key | Ad provider | 24 hours | 1 | Ad-supported access through provider completion. |
| Weekly Key | Paid key issuance | 7 days | 1 | Paid key, not a premium license. |
| Monthly Key | Paid key issuance | 30 days | 3 | Paid key with larger device allowance. |
| Custom Key | Admin/dashboard issuance | Custom | Custom | Operational/support issuance. |
| Legacy Key | Pre-alignment issuance | Existing expiration | Existing behavior | Existing keys retained without inference. |

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

The model is conceptual. Any schema change must be separately reviewed during implementation planning.

## 2. Provider Model

Phase 7B must be provider-agnostic.

Supported provider direction:

- Work.ink.
- Linkvertise.
- LootLabs.
- Future providers.

Provider rules:

- Work.ink is one provider, not the platform assumption.
- Provider-specific token formats, callback shapes, URL structures, and validation APIs must stay inside provider adapters.
- Provider adapters normalize completion into one internal result.
- Provider source must be tracked for analytics.
- Provider failures should map to generic user-facing outcomes.
- Provider credentials and raw callback payloads must not reach loader/runtime code.

Conceptual flow:

```text
Provider completion
  -> provider adapter verification
  -> normalized provider result
  -> key issuance policy
  -> generated key with expires_at and max_devices
  -> analytics event with provider source
```

Provider adapter output should conceptually answer:

- Was provider completion valid?
- Which provider produced it?
- Has the completion/token already been used?
- Which key product should be issued?
- What analytics source should be recorded?

## 3. Free Key Model

Free keys are ad-supported keys.

Default policy:

- Duration: 24 hours.
- Device limit: 1 device.
- Source: ad provider.
- Access mode: `key_required`.

Initial provider compatibility:

- Existing Work.ink behavior remains supported.
- Linkvertise and LootLabs should be added through the same provider abstraction.
- Future providers should not require changes to key validation semantics.

## 4. Paid Key Model

Paid keys are still keys. They are not premium licenses.

Paid key products:

- Weekly keys.
- Monthly keys.
- Custom expiration keys.
- Team keys where needed.

Paid keys use:

- Key expiration.
- Key active/inactive state.
- Device limits.
- Key analytics.
- `key_required` access mode.

Paid keys do not use:

- Premium license assignments.
- Customer identifiers.
- License entitlements.
- License analytics.
- Runtime license hardening.

## 5. Device Limit Model

Device-limited keys reduce casual key sharing without implementing full HWID licensing.

Conceptual device registration model:

```text
Device Registration
|-- key_id
|-- fingerprint
|-- first_seen_at
|-- last_seen_at
```

Validation behavior:

1. Receive key and device fingerprint at delivery-session creation.
2. Validate key format, active state, and expiration.
3. Find device registrations for the key.
4. If the fingerprint is already registered, update `last_seen_at` and allow.
5. If the fingerprint is new and registration count is below `max_devices`, register it and allow.
6. If the fingerprint is new and `max_devices` is exhausted, deny.

Example device limits:

| Key Product | Max Devices |
|---|---:|
| Free | 1 |
| Weekly | 1 |
| Monthly | 3 |
| Team | 5 |
| Custom | Admin-selected |

Fingerprint guidance:

- Fingerprints are not perfect.
- Fingerprints may be spoofed or unstable.
- Fingerprints should be treated as sharing friction and support context, not full anti-tamper security.
- Raw fingerprints should not be exposed broadly in dashboards, logs, or analytics.

## 6. Device Reset Workflow

Device resets are administrative support actions.

Workflow:

1. Admin/creator opens a key detail view.
2. Admin reviews key status, expiration, provider source, key type, device count, and recent validation outcomes.
3. Admin selects one device registration or all registrations to reset.
4. System records a reset event.
5. Reset removes or invalidates selected device registration records.
6. Future validation from a new fingerprint can register if the key is active, unexpired, and below `max_devices`.

Reset policy:

- Reset does not extend `expires_at` by default.
- Reset does not change `max_devices` by default.
- Reset does not reactivate inactive keys by default.
- Reset should be auditable.
- Reset history should be visible to support/admin users.

Recommended reset reasons:

- New device.
- Executor/environment changed.
- False device collision.
- Support override.
- Abuse investigation.

## 7. Analytics Model

Required analytics events:

- Key generated.
- Key validated.
- Key expired.
- Key denied.
- Provider source.

Recommended event dimensions:

- Provider source: Work.ink, Linkvertise, LootLabs, paid, manual/admin, future provider.
- Key type: free, weekly, monthly, custom, legacy.
- Result: generated, validated, expired, denied.
- Denial reason category: invalid, inactive, expired, missing_key, provider_failed, replayed_provider_token, device_limit_exceeded.
- Device count at validation time.
- Reset count.
- Script/access-mode context where safe.

Data minimization rules:

- Do not store raw keys in analytics payloads.
- Do not store raw provider tokens in analytics payloads.
- Do not store raw fingerprints in analytics payloads.
- Prefer snippets, hashes, aggregate counters, and categorical outcomes.

## 8. Benefits

- Reduced provider dependency because Work.ink, Linkvertise, LootLabs, and future providers can use one normalized model.
- Reduced key sharing through device-limited keys.
- Simpler support model than HWID because administrative resets are explicit and narrow.
- Better monetization flexibility through free, weekly, monthly, custom, and legacy key classifications.
- Clearer roadmap boundary because paid keys stay separate from premium licenses.

## 9. Tradeoffs

- Fingerprints are not perfect.
- Fingerprints can be spoofed, copied, or unstable.
- Device resets may be needed for legitimate users.
- Device-limited keys are not a full anti-sharing solution.
- Provider abstraction adds planning and testing complexity.
- Rich provider analytics may require later approved schema work.

## 10. Deferred Phase 7C Scope

Phase 7C owns Premium License System work:

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

Phase 7C may require migrations or database functions. Those risks must not be introduced into Phase 7B documentation as implemented behavior.

## 11. Main Branch Readiness

Current Phase 7B completion estimate: 35%.

Already available in MAIN:

- Free key generation.
- Work.ink verification foundation.
- Key validation.
- Key expiration.
- Token replay protection.
- `access_mode` foundation.
- Session-boundary key authorization foundation.

Missing in MAIN:

- Provider abstraction.
- Linkvertise provider support.
- LootLabs provider support.
- Paid key issuance.
- Device-limited key model.
- Device registration storage.
- Administrative device reset workflow.
- Key analytics with provider source and device outcomes.
- Dashboard key issuance.
- Loader key/fingerprint forwarding.
- Raw endpoint protection.
