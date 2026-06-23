# Phase 7B Threat Model — Key Monetization Platform

Status: Backend Complete / Runtime Integration Planned
Date: 2026-06-17

Current roadmap note (updated 2026-06-23): Phase 7B backend key monetization infrastructure is complete. Phase 7C refers to completed Production Runtime Performance optimization. Phase 7D engineering is complete and Phase 7E.1 operational health/canary infrastructure is complete; PostgreSQL remains authoritative and Valkey is shadow-only. Premium-license threats and controls in this document are deferred future license work, not completed Phase 7C work.

Reason: Backend monetization infrastructure is complete, but popup validation has not yet been integrated into the Roblox runtime. Premium License System threats and controls remain deferred future license work.

Implementation boundary: This threat model does not implement controls. Phase 7B.6 must integrate runtime popup validation with `POST /api/validate` before Main Script execution.

Design: Refined

Threat Model: Refined

Documentation: Refined

This document records the intended threat model for Phase 7B Key Monetization Platform. It does not implement controls. It must not be used to start premium license, customer identifier, HWID binding, device transfer workflow, license entitlement, license analytics, or license hardening work. Those concerns are deferred future license work.

## Threat: Runtime Validation Bypass

Description:
The runtime loader currently executes delivered payloads directly. If popup validation is not inserted before Main Script execution, users can run Free Key, Premium Key, or Device Limit protected scripts without a successful `POST /api/validate` response.

Impact:
Backend monetization controls exist but are not applied to runtime execution, allowing key and device-limit bypass.

Mitigation Strategy:
Implement Phase 7B.6 Runtime Key Integration. The runtime must show popup validation, request key input, call `POST /api/validate`, show validation status/errors, and require `validation_success == true` before Main Script execution.

## Threat: Runtime Validation Scope Creep

Description:
Runtime integration may attempt to reimplement device-limit, premium-key, delivery-session, analytics-pipeline, or build-system logic instead of using the completed backend validation boundary.

Impact:
Duplicate validation logic can diverge from backend enforcement, leak credentials, or destabilize protected delivery/event/build components.

Mitigation Strategy:
Keep Device Limits, Premium Keys, and Free Keys enforced exclusively through `POST /api/validate`. Do not change `DeviceLimitService`, Premium Key backend enforcement, Delivery Session Architecture, Delivery Fetch Architecture, Runtime Payload Delivery, Event Platform, Analytics Pipeline, or Build System for Phase 7B.6.

## Threat: Provider Lock-In

Description:
The platform may hard-code Work.ink-specific token names, callback shapes, completion semantics, or replay behavior.

Impact:
Adding Linkvertise, LootLabs, or future providers becomes expensive and risky. Provider outages or policy changes can block monetization.

Mitigation Strategy:
Use a provider-agnostic adapter model. Normalize provider completions into a common internal result. Keep provider-specific verification and replay behavior behind provider adapters.

## Threat: Provider Spoofing

Description:
Attackers may forge provider completion payloads, replay provider tokens, or call issuance endpoints directly.

Impact:
Keys may be generated without completing the intended ad-provider or paid-key flow.

Mitigation Strategy:
Verify provider completions server-side. Store provider replay markers where required. Reject client-only proof. Record provider source and denial categories for monitoring.

## Threat: Raw Endpoint Bypass

Description:
A script configured for `key_required` access may still be retrievable through a raw script/source endpoint that does not enforce `access_mode`.

Impact:
Attackers can bypass provider flows, paid keys, device limits, and key authorization entirely.

Mitigation Strategy:
Before Phase 7B release, raw delivery must respect key-required access or be disabled for key-required scripts. Authorization remains server-side and must not rely on client behavior.

## Threat: Missing Runtime Key Or Identifier Submission

Description:
The server can validate keys and device identifiers through `POST /api/validate`, but the Roblox runtime may not submit `key`, `executor_identifier`, and `client_identifier`.

Impact:
Legitimate users with valid keys cannot complete validation through the runtime popup, causing false denials and support burden.

Mitigation Strategy:
Add runtime submission to `POST /api/validate`. Do not forward raw keys or identifiers to delivery fetch, runtime payload delivery, event reporting, unrelated runtime APIs, or logs.

## Threat: Key Leakage

Description:
Free or paid keys may leak through logs, dashboard screens, generated loader snippets, browser output, errors, analytics payloads, or support screenshots.

Impact:
Leaked keys can be reused until expiration and device limits are exhausted.

Mitigation Strategy:
Avoid logging raw keys. Use snippets only when operationally necessary. Keep key display one-time where practical. Return generic authorization errors. Do not include raw keys in analytics payloads.

## Threat: Fingerprint Leakage

Description:
Device fingerprints may leak through logs, analytics, dashboard tables, errors, or support exports.

Impact:
Fingerprints can become privacy-sensitive identifiers and can be copied to bypass device limits.

Mitigation Strategy:
Store hashed or minimized fingerprint representations where possible. Avoid exposing raw fingerprints in dashboard UI. Display safe labels, snippets, or derived metadata for support workflows.

## Threat: Device Limit Bypass

Description:
Users may spoof, rotate, or copy device fingerprints to bypass `max_devices` limits.

Impact:
Device-limited keys can still be shared beyond intended limits.

Mitigation Strategy:
Treat fingerprints as sharing friction, not full DRM. Enforce server-side device registration counts. Track suspicious reset and validation patterns. Keep higher assurance HWID binding deferred to future license work if needed.

## Threat: Device False Denial

Description:
Fingerprints may change because of legitimate device, executor, browser, or environment changes.

Impact:
Valid users may be denied access when their key has reached `max_devices`.

Mitigation Strategy:
Provide administrative device reset workflows. Track first/last seen timestamps. Keep reset actions explicit, auditable, and separate from expiration or device limit changes.

## Threat: Expiration Bypass

Description:
Expired keys may continue to authorize access because expiration is not checked consistently, cleanup fails, or time handling is incorrect.

Impact:
Users retain access beyond the intended free, weekly, monthly, or custom key duration.

Mitigation Strategy:
Validate `expires_at` during every key authorization. Treat cleanup as operational hygiene, not the enforcement boundary. Use server time for expiration decisions.

## Threat: Paid Key And License Confusion

Description:
Paid keys may be confused with premium licenses, license assignments, entitlements, or customer identifiers.

Impact:
Support, analytics, and entitlement semantics become unclear. Phase 7B may expand into premium-license risk unintentionally.

Mitigation Strategy:
Document paid keys as keys, not licenses. Keep them on the key validation/device limit model. Move license assignments, customer identifiers, HWID binding, license entitlements, license analytics, and license hardening to deferred future license work.

## Threat: Brute Force Attempts

Description:
Attackers may try many generated keys, provider tokens, device fingerprints, or slugs against `/api/validate` or `/api/delivery/session`.

Impact:
Valid keys may be discovered, rate limits may be exhausted, and authorization infrastructure may experience abuse load.

Mitigation Strategy:
Preserve route rate limits, use generic failures, monitor repeated authorization failures, and avoid creating key-validity or existence oracles.

## Threat: Analytics Credential Exposure

Description:
Key analytics may accidentally store raw keys, raw provider tokens, raw fingerprints, IP-sensitive data, or overly specific denial reasons.

Impact:
Analytics tables can become a credential leakage vector or privacy risk.

Mitigation Strategy:
Use snippets, hashes, aggregate counters, provider names, key types, and denial categories. Keep raw credentials, raw provider payloads, and raw fingerprints out of analytics payloads and dashboards.

## Threat: Access Mode Confusion

Description:
Creators or operators may confuse `visibility` with `access_mode`, causing scripts to be public when intended to be key-required or key-required when intended to be public.

Impact:
Scripts may become unexpectedly inaccessible or monetization may be bypassed.

Mitigation Strategy:
Keep `visibility` and `access_mode` UI language separate. Restrict Phase 7B controls to key monetization behavior. Keep `license_required` and license entitlements deferred unless future license hardening is explicitly active.

## Threat: Scope Creep Into Premium License Work

Description:
Phase 7B may expand to include premium licenses, assignments, customer identifiers, HWID binding, license entitlements, or license analytics.

Impact:
The release becomes larger, requires migrations or atomic authorization design, and introduces higher production risk.

Mitigation Strategy:
Keep Phase 7B limited to Key Monetization Platform. Move premium licenses, runtime license enforcement, assignment lifecycle, assignment capacity enforcement, customer identifiers, HWID binding, device transfer workflows, license entitlements, license analytics, and license hardening to deferred future license work.

## Benefits

- Reduced provider dependency.
- Reduced key sharing.
- Simpler support model than HWID.
- Better monetization flexibility.

## Tradeoffs

- Fingerprints are not perfect.
- Device resets may be needed.
- Device-limited keys are not a full anti-sharing solution.

## Review Notes

Phase 7B.6 Runtime Key Integration is the critical blocker. Implementation should be reviewed against this threat model before code changes begin and again before production rollout.

Future premium license hardening requires its own threat model before implementing premium licenses, license assignments, customer identifiers, HWID binding, device transfer workflows, license entitlements, license analytics, or license hardening.
