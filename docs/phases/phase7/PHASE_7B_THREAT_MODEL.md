# Phase 7B Threat Model — Runtime License Enforcement

Status: Hardening / Production Candidate Review
Date: 2026-06-12

This document records the Phase 7B threat model and hardening notes for develop. It does not authorize production deployment.

## Threat: License Sharing

Description:
A valid license key may be copied and shared with multiple users or devices beyond the creator's intended assignment limit.

Impact:
Unauthorized users can access premium scripts, reducing license value and weakening creator trust.

Mitigation Strategy:
Require a normalized `customer_identifier`, bind assignments to hashed identifiers, enforce `max_assignments`, and deny new assignments when capacity is exhausted.

## Threat: Assignment Bypass

Description:
An attacker may attempt to bypass assignment checks by omitting identifiers, changing identifier formats, or exploiting assignment status gaps.

Impact:
Disabled or revoked assignments may retain access, or one license may authorize more customers than intended.

Mitigation Strategy:
Require non-empty normalized identifiers, share validation between runtime and dashboard assignment paths, enforce assignment status, and treat disabled/revoked assignments as denied.

## Threat: Unlimited Assignment Creation

Description:
Concurrent requests or manual assignment creation may create more active assignments than the license capacity allows.

Impact:
Assignment limits become ineffective and license-required access becomes equivalent to shared-key access.

Mitigation Strategy:
Use atomic authorization and assignment creation. Enforce capacity in both runtime-created and creator-created assignments.

Hardening Note:
The assignment RPC must be executable by `service_role` only. `PUBLIC`, `anon`, and `authenticated` execution must be revoked because the function bypasses RLS by design.

## Threat: Replay Attacks

Description:
Captured delivery session requests, session tokens, or credentials may be replayed to obtain repeated access.

Impact:
Attackers may reuse valid authorization material outside the intended session lifecycle.

Mitigation Strategy:
Keep one-time delivery sessions, preserve short TTLs, retain session token hashing, avoid reusing event secrets, and ensure license authorization occurs only before session creation.

## Threat: Loader Tampering

Description:
Users may modify loader code to remove credential forwarding, change identifiers, or call delivery APIs directly.

Impact:
Tampered clients may attempt to bypass intended UX or replay credentials outside the loader path.

Mitigation Strategy:
Treat the loader as untrusted. Enforce all authorization server-side at `POST /api/delivery/session`. Keep fetch/runtime payload delivery dependent on valid one-time sessions.

## Threat: Credential Leakage

Description:
License keys, Work.ink keys, customer identifiers, or event secrets may leak through logs, browser output, error messages, analytics, or dashboard tables.

Impact:
Leaked credentials can be reused, brute-forced, shared, or correlated with users.

Mitigation Strategy:
Never store raw license keys. Avoid logging raw credentials. Store hashed customer identifiers for enforcement. Return generic authorization errors where practical. Keep dashboard assignment views limited to safe display labels and record IDs.

Hardening Note:
Do not transport license credentials through loader GET URLs. Credentialed access must use JSON POST to the delivery session endpoint so raw `license_key` and `customer_identifier` values are not captured in URL logs, browser history, referrers, or reusable snippets.

## Threat: Brute Force Attempts

Description:
Attackers may try large numbers of license keys, Work.ink keys, script slugs, or customer identifiers against delivery session creation.

Impact:
Valid credentials may be discovered, rate limits may be exhausted, and authorization infrastructure may experience abuse load.

Mitigation Strategy:
Preserve delivery session rate limiting, use generic failures, monitor repeated authorization failures, consider per-script/per-license abuse thresholds, and avoid credential-validity or existence oracles.

## Review Notes

Phase 7B implementation should be reviewed against this threat model before production rollout. Rollout requires successful validation of RPC privilege restrictions, runtime audit persistence, POST-only credential transport, and capacity enforcement across runtime and manual assignment paths.
