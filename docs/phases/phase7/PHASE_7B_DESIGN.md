# Phase 7B Design — Runtime License Enforcement

Status: Hardening / Production Candidate Review
Date: 2026-06-12

This document records the Phase 7B runtime license enforcement design and hardening decisions for develop. It is not a production deployment record.

## 1. Runtime License Enforcement

Goal:
Ensure `license_required` scripts only receive delivery sessions when the supplied license is valid for the target script and the runtime assignment decision is allowed.

Current State:
Phase 7A provides the license foundation, license lifecycle management, assignment records, and dashboard visibility. Runtime validation foundation exists at the session boundary, while deeper enforcement hardening is deferred to Phase 7B.

Target State:
Runtime license authorization should consistently validate license hash, script binding, license status, expiry, assignment status, and assignment capacity before delivery session creation succeeds.

Risks:
Incorrect enforcement can block valid customers, allow unauthorized access, or change production delivery behavior outside the approved session boundary.

## 2. Assignment Capacity Enforcement

Goal:
Enforce `licenses.max_assignments` consistently for runtime-created and creator-created assignments.

Current State:
Phase 7A stores `max_assignments` and assignment records. UI displays capacity data and assignments, but Phase 7B must harden capacity enforcement semantics.

Target State:
When no assignment exists for a normalized customer identifier, authorization checks active assignment count against `max_assignments` before creating a new assignment. Capacity checks and assignment creation should be atomic.

Risks:
Non-atomic checks can allow concurrent assignment bypass. Overly strict checks can deny legitimate activations during retries or partial failures.

## 3. `customer_identifier` Handling

Goal:
Define and enforce a stable customer/device identifier contract for license-required runtime access.

Current State:
Phase 7A supports assignment customer identifiers and stores hashed identifiers. Dashboard assignment creation accepts customer identifiers for creator-managed assignments.

Target State:
`license_required` delivery should require a non-empty normalized `customer_identifier`. Normalization and validation should be shared across runtime and dashboard assignment paths.

Risks:
Changing identifier handling can strand existing assignment records if normalization changes are not migration-aware. Overly permissive identifiers can weaken assignment enforcement.

## 4. `license_key` Contract

Goal:
Align the runtime delivery request contract around the documented `license_key` field.

Current State:
Phase 7A documents license-required access and implements license management. Phase 7B will reconcile runtime request naming and compatibility expectations before behavior changes.

Target State:
Delivery session creation should accept the documented `license_key` field for premium license authorization. Any compatibility alias should be explicit, temporary, and tested.

Risks:
Contract changes can break existing loader snippets or clients if deployed without compatibility planning.

## 5. Loader Credential Forwarding

Goal:
Support key-required and license-required scripts through the production loader while preserving secure delivery boundaries.

Current State:
Phase 7A dashboard and license foundation are complete. Loader credential forwarding is intentionally deferred to Phase 7B planning and implementation.

Target State:
Credentialed runtime access should POST credentials directly to `/api/delivery/session`. Loader bootstrap URLs must not carry `key`, `license_key`, or `customer_identifier` values, and generated loader code must not embed those credentials as URL-derived literals. Runtime payload delivery and event reporting remain unchanged.

Migration Path:
Existing non-credentialed loader URLs remain valid for public scripts. Key-required and license-required consumers must migrate to direct session creation with a JSON POST body containing `slug`, `key` or `license_key`, and `customer_identifier`; the returned one-time session token is then used for payload fetch. The `license` request body alias remains as a temporary compatibility path for session creation only.

Risks:
Credential forwarding can leak secrets if logged, embedded unsafely, exposed in errors, or passed to unrelated runtime/event surfaces.

## 6. License Counters

Goal:
Make license analytics counters reflect runtime authorization activity.

Current State:
Phase 7A schema and dashboard expose activation and delivery counters. Phase 7A UI displays existing data from current APIs.

Target State:
`activation_count` increments inside the atomic assignment authorization function only when a new active assignment is created. `delivery_count` increments after a license-authorized delivery session is successfully created, but delivery must not fail if telemetry updates fail.

Risks:
Counters can become misleading if updated outside the same authorization transaction or if retries double-count activity.

Security Review Notes:
Runtime assignment authorization is implemented as a service-role-only RPC. The function must revoke execution from `PUBLIC`, `anon`, and `authenticated`, use a safe `search_path`, and fully qualify table references. Runtime audit events use `actor_role = runtime`, which requires the audit role constraint to include `runtime`.

## 7. Runtime Audit Trail

Goal:
Provide safe operational visibility into runtime license authorization decisions without leaking credentials.

Current State:
Phase 7A has dashboard visibility and existing audit infrastructure patterns elsewhere in the project. Runtime license audit trail expansion is planned for Phase 7B.

Target State:
Runtime authorization should record sanitized audit events for allowed, denied, exhausted, invalid, expired, and assignment-related license outcomes. Raw keys and raw customer identifiers should not be logged.

Risks:
Audit logging can introduce credential leakage, noisy high-volume records, or delivery latency if not handled asynchronously and safely.

## Recommended First Milestone

Phase 7B.1 should be a runtime enforcement design review that freezes the request contract, identifier normalization, atomic authorization strategy, and audit/counter semantics before implementation begins.
