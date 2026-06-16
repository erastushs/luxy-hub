# Phase 7B Design — Key Monetization

Status: Deferred / Planning Realigned
Date: 2026-06-16

Reason: Product direction changed. Phase 7B is now Key Monetization only. Premium License System work has moved to Phase 7C.

Implementation: Partially founded in MAIN by existing key, Work.ink, key expiration, and access-mode infrastructure. No feature implementation is part of this documentation realignment.

Design: Realigned

Threat Model: Realigned

Documentation: Realigned

This document describes intended Phase 7B scope only. It is not an implementation record. Phase 7B must not implement premium licenses, license assignments, customer identifiers, device binding, license lookup hashes, license verifier storage, premium analytics, runtime license enforcement, assignment lifecycle, or assignment capacity enforcement. Those items belong to Phase 7C.

## 1. Objective

Phase 7B should productize the existing free key system into a small, stable, releasable Key Monetization phase.

The phase should preserve the current Work.ink-backed free key flow while adding the minimum missing product wiring for creator/admin issuance, configurable expiration, key-required script access, loader key forwarding, raw endpoint protection, and key analytics.

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

Known gaps in MAIN:

- Dashboard key issuance is not implemented.
- Weekly, monthly, and custom-expiration issuance paths are not implemented.
- Dashboard script management does not yet expose `key_required` as a productized creator control.
- The production loader does not currently forward a key to `POST /api/delivery/session`.
- Raw script delivery must be protected so it cannot bypass `key_required` access.
- Key analytics are incomplete for a key monetization funnel.

## 3. Phase 7B Scope

Phase 7B includes only:

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

Phase 7B excludes:

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
- Marketplace, paid scripts, and creator economy features.

## 4. Free Key Access and Work.ink Flow

Goal:
Preserve the existing ad-supported free key acquisition path.

Current State:
The current branch already supports `/get-key`, Work.ink token verification, key generation, key validation, and token replay protection.

Target State:
The existing Work.ink flow remains compatible. Phase 7B should not break existing generated keys or existing validation behavior.

Risks:
Changing the Work.ink flow can break current users, weaken replay protection, or reduce ad-supported completion reliability.

## 5. Key Expiration Durations

Goal:
Support operational key issuance for multiple durations without changing the database schema.

Current State:
Generated keys already store `expires_at`, and existing generation produces a fixed 24-hour key.

Target State:
Dashboard or server-side issuance supports:

- 24-hour/free key.
- Weekly key.
- Monthly key.
- Custom expiration key.

Risks:
Incorrect expiration calculation can overgrant or prematurely revoke access. Custom expiration inputs must be validated before any implementation work.

## 6. Dashboard Key Issuance

Goal:
Provide a creator/admin-facing way to issue keys for Phase 7B durations.

Current State:
The existing dashboard focuses on scripts, analytics, events, profile, and license management. Dashboard key issuance is not productized.

Target State:
Dashboard key issuance should create keys with explicit expiration, show safe key output once where appropriate, and avoid exposing unnecessary raw key history.

Risks:
Raw free keys are currently stored in the existing key table. Dashboard views must avoid creating unnecessary credential exposure.

## 7. `key_required` Script Access

Goal:
Make `access_mode = key_required` usable as the key monetization access mode.

Current State:
The database and delivery authorization foundation support `key_required`, but script management does not yet productize creator-facing access-mode changes.

Target State:
Creators can configure eligible scripts as `public` or `key_required` without enabling Phase 7C premium license behavior.

Risks:
Confusing `visibility` with `access_mode` can accidentally expose or block scripts. `license_required` should remain deferred unless Phase 7C is active.

## 8. Loader Key Forwarding

Goal:
Allow the production loader to satisfy key-required session authorization while preserving secure delivery boundaries.

Current State:
The loader posts only `slug` to `/api/delivery/session`.

Target State:
The loader forwards a supplied key only to `POST /api/delivery/session`. It must not forward keys to delivery fetch, payload delivery, event reporting, or unrelated runtime surfaces.

Risks:
Credential forwarding can leak keys through logs, errors, generated Lua, or analytics if boundaries are not explicit.

## 9. Raw Endpoint Protection

Goal:
Prevent raw script delivery from bypassing key monetization.

Current State:
Raw delivery remains available for public/unlisted scripts. `access_mode` protection must be accounted for before Phase 7B release.

Target State:
If a script is `key_required`, raw script/source endpoints must not provide a bypass around delivery-session key authorization.

Risks:
If raw delivery remains open for key-required scripts, Phase 7B monetization can be bypassed entirely.

## 10. Key Analytics

Goal:
Provide operational visibility into key monetization.

Current State:
The project has `verification_logs`, `key_usage`, event infrastructure, and delivery/session analytics foundations, but key monetization analytics are not complete.

Target State:
Phase 7B should track enough information to review:

- Key generation.
- Work.ink completion to key issuance.
- Key validation success/failure.
- Expired key attempts.
- Missing/invalid key denials.
- Key-authorized delivery sessions.

Risks:
Analytics that overcollect raw keys or token data can leak credentials. Analytics that undercount delivery authorization can misrepresent monetization performance.

## 11. Progress Assessment

Current Phase 7B completion estimate based only on MAIN: 60%.

Completed foundation:

- Free key generation.
- Work.ink integration.
- Key validation.
- Key expiration.
- Token replay protection.
- `access_mode` schema foundation.
- Session-boundary `key_required` authorization foundation.

Remaining work:

- Dashboard key issuance.
- Weekly/monthly/custom expiration controls.
- Productized `key_required` script access controls.
- Loader key forwarding.
- Raw endpoint protection.
- Key analytics.
- Key monetization rollout checklist and tests.

Production blockers:

- Production loader does not forward keys.
- Raw endpoint bypass must be resolved before key-required monetization can be trusted.
- Dashboard does not yet expose key issuance or key-required access-mode management.

Nice-to-have items:

- Key hashing.
- Script-scoped keys.
- Creator-specific Work.ink campaigns.
- Revenue attribution.
- Rich conversion funnel analytics.

Nice-to-have items are not required for Phase 7B and may require future migrations or design review.

## 12. Recommended Implementation Order

1. Update roadmap and planning documents to reflect Phase 7B Key Monetization and Phase 7C Premium License System.
2. Confirm production stabilization entry criteria.
3. Add tests/planning for raw endpoint access-mode protection.
4. Productize `key_required` script access configuration.
5. Add dashboard key issuance with 24-hour, weekly, monthly, and custom expiration.
6. Add loader key forwarding only to the delivery-session endpoint.
7. Add key analytics using existing operational tables where possible.
8. Run security review focused on key leakage, raw endpoint bypass, and delivery-session authorization.

## 13. Phase 7C Boundary

All premium-license work is Phase 7C:

- Runtime license enforcement.
- Premium license assignment enforcement.
- Customer identifiers.
- Device binding.
- License lookup hashes.
- License verifier storage.
- Premium analytics.
- Assignment lifecycle.
- Assignment capacity enforcement.
- License counters and runtime audit trail.
- `license_key` contract alignment.

Phase 7C may require migrations or database functions. Those risks must not be introduced into Phase 7B.
