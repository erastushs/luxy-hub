# Phase 7B Design — Runtime License Enforcement

Status: Planned / Not Started
Date: 2026-06-11

This document describes intended Phase 7B scope only. It is not an implementation record. No Phase 7B code, schema, API, runtime, loader, service, repository, delivery, or authorization changes have started.

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
The loader should forward key, license key, and customer identifier values only when present and only to the delivery session endpoint. Runtime payload delivery and event reporting should remain unchanged.

Risks:
Credential forwarding can leak secrets if logged, embedded unsafely, exposed in errors, or passed to unrelated runtime/event surfaces.

## 6. License Counters

Goal:
Make license analytics counters reflect runtime authorization activity.

Current State:
Phase 7A schema and dashboard expose activation and delivery counters. Phase 7A UI displays existing data from current APIs.

Target State:
`activation_count` should increment only when a new assignment is created. `delivery_count` should increment when a license-authorized delivery session is successfully created. Timestamps should update with the same events.

Risks:
Counters can become misleading if updated outside the same authorization transaction or if retries double-count activity.

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
