# Phase 7B Threat Model — Key Monetization

Status: Deferred / Planning Realigned
Date: 2026-06-16

Reason: Product direction changed. Phase 7B is now Key Monetization only. Premium License System threats and controls have moved to Phase 7C.

Implementation: Not part of this documentation realignment.

Design: Realigned

Threat Model: Realigned

Documentation: Realigned

This document records the intended threat model for Phase 7B Key Monetization. It does not implement controls. It must not be used to start premium license, customer identifier, device binding, assignment capacity, or runtime license enforcement work. Those concerns belong to Phase 7C.

## Threat: Raw Endpoint Bypass

Description:
A script configured for `key_required` access may still be retrievable through a raw script/source endpoint that does not enforce `access_mode`.

Impact:
Attackers can bypass Work.ink and key authorization entirely, making key monetization ineffective.

Mitigation Strategy:
Before Phase 7B release, raw delivery must respect key-required access or be disabled for key-required scripts. Authorization remains server-side and must not rely on client behavior.

## Threat: Missing Loader Key Forwarding

Description:
The server can require keys at delivery-session creation, but the production loader may not forward keys.

Impact:
Legitimate users with valid keys cannot run key-required scripts through the default loader, causing false denials and support burden.

Mitigation Strategy:
Add a key-only credential forwarding path for `POST /api/delivery/session`. Do not forward keys to delivery fetch, runtime payload delivery, event reporting, or unrelated runtime APIs.

## Threat: Key Leakage

Description:
Free keys may leak through logs, dashboard screens, generated loader snippets, browser output, errors, analytics payloads, or support screenshots.

Impact:
Leaked keys can be reused until expiration, reducing monetization effectiveness and increasing abuse.

Mitigation Strategy:
Avoid logging raw keys. Use snippets only when operationally necessary. Keep key display one-time where practical. Return generic authorization errors. Do not include raw keys in analytics payloads.

## Threat: Expiration Bypass

Description:
Expired keys may continue to authorize access because expiration is not checked consistently, cleanup fails, or time handling is incorrect.

Impact:
Users retain access beyond the intended monetization window.

Mitigation Strategy:
Validate `expires_at` during every key authorization. Treat cleanup as operational hygiene, not the enforcement boundary. Use server time for expiration decisions.

## Threat: Work.ink Replay Abuse

Description:
A Work.ink token may be reused to generate multiple keys or replayed from another client.

Impact:
Attackers can create more free keys than intended from one ad-supported completion.

Mitigation Strategy:
Preserve token replay protection through `used_workink_tokens`. Keep token verification server-side and avoid accepting client assertions as proof of completion.

## Threat: Brute Force Attempts

Description:
Attackers may try many generated keys or slugs against `/api/validate` or `/api/delivery/session`.

Impact:
Valid keys may be discovered, rate limits may be exhausted, and authorization infrastructure may experience abuse load.

Mitigation Strategy:
Preserve route rate limits, use generic failures, monitor repeated authorization failures, and avoid creating key-validity or existence oracles.

## Threat: Analytics Credential Exposure

Description:
Key analytics may accidentally store raw keys, raw Work.ink tokens, IP-sensitive data, or overly specific denial reasons.

Impact:
Analytics tables can become a credential leakage vector or privacy risk.

Mitigation Strategy:
Use snippets, hashes, aggregate counters, or event categories where possible. Keep raw credentials out of event payloads, logs, and dashboard analytics.

## Threat: Access Mode Confusion

Description:
Creators or operators may confuse `visibility` with `access_mode`, causing scripts to be public when intended to be key-required or key-required when intended to be public.

Impact:
Scripts may become unexpectedly inaccessible or monetization may be bypassed.

Mitigation Strategy:
Keep `visibility` and `access_mode` UI language separate. Restrict Phase 7B controls to `public` and `key_required` unless Phase 7C is explicitly active.

## Threat: Scope Creep Into Premium License Work

Description:
Phase 7B may expand to include premium licenses, assignments, customer identifiers, device binding, or license analytics.

Impact:
The release becomes larger, requires migrations or atomic authorization design, and introduces higher production risk.

Mitigation Strategy:
Keep Phase 7B limited to key monetization. Move premium licenses, runtime license enforcement, assignment lifecycle, assignment capacity enforcement, customer identifiers, device binding, license lookup hashes, license verifier storage, and premium analytics to Phase 7C.

## Review Notes

Phase 7B implementation should remain deferred until the Production Stabilization Window completes. When resumed, implementation should be reviewed against this threat model before code changes begin and again before production rollout.

Phase 7C requires its own premium-license threat model before implementing runtime license enforcement, assignment capacity enforcement, customer identifiers, or device binding.
