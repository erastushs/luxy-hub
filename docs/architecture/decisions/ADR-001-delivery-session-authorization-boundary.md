# ADR-001: Delivery Session Authorization Boundary

## Status

Accepted

## Date

2026-06-11

## Context

LuxyHub delivers script runtime payloads through secure delivery rather than exposing raw source as the primary loader path. The implemented delivery flow uses two runtime endpoints:

- `POST /api/delivery/session`
- `POST /api/delivery/fetch`

Delivery sessions are short-lived, one-time access records stored in `delivery_sessions`. Raw session tokens are returned to the loader, while only SHA-256 token hashes are stored in the database. Sessions expire after 60 seconds and are consumed during payload fetch.

Phase 7A added `scripts.access_mode` with `public`, `key_required`, and `license_required` values. Phase 7B is now Key Monetization Platform, while premium runtime license enforcement has moved to Phase 7C. The architectural authorization boundary already exists at delivery session creation.

## Problem

The system needs to authorize access to a script before payload delivery without exposing encrypted payloads, source code, license/key details, or ownership details to untrusted clients.

Combining authorization and payload delivery in one request would increase risk:

- A failed authorization path could become an oracle for script existence, license validity, or key validity.
- Retrying payload delivery could repeat expensive authorization logic or create inconsistent counters.
- Fetching payloads directly with long-lived credentials would weaken replay resistance.
- Event reporting needs a short-lived per-session secret but must not consume payload fetch authorization.

## Decision

LuxyHub accepts delivery sessions as the authorization boundary for secure delivery.

Authorization occurs only during `POST /api/delivery/session`. Payload fetch is separated into `POST /api/delivery/fetch`, which validates and consumes an already-authorized session.

Session creation behavior:

- Validate slug shape.
- Load the script by slug.
- Require a current version.
- Require script visibility to be `public` or `unlisted`.
- Authorize based on `scripts.access_mode`.
- Select a compatible ready delivery build.
- Generate a raw session token and event secret.
- Store only the session token hash, script/build references, event secret, expiration, and timestamps.
- Return the raw session token, event secret, and TTL with `Cache-Control: no-store`.

Authorization boundary:

- `public` scripts authorize session creation when deliverable.
- `key_required` scripts authorize session creation through the existing key validation path.
- `license_required` scripts authorize session creation through license validation. Phase 7C will harden this path without moving the boundary.
- `creator_id` is never accepted from client input.

Fetch authorization:

- Fetch receives only `session_token`.
- Server hashes the token and looks up the session.
- Fetch rejects missing, expired, consumed, malformed, or mismatched sessions.
- Fetch verifies the referenced build is still ready and belongs to the same script.
- Fetch consumes the session atomically before returning runtime payload data.

## Consequences

Positive consequences:

- Payload delivery is protected by short-lived one-time authorization.
- Raw session tokens are never persisted.
- Runtime payload fetch does not need raw keys or license credentials.
- Authorization failures can stay generic and avoid leaking resource state.
- Event reporting can reuse session-scoped `event_secret` without changing payload fetch semantics.
- Phase 7B can productize key-required access while preserving the existing delivery boundary.
- Phase 7C can harden license checks while preserving the existing delivery boundary.

Negative consequences:

- Delivery requires two network calls after loader bootstrap.
- Session creation must be highly reliable because fetch cannot independently authorize.
- Session TTL needs to balance replay resistance against client/network latency.
- Operational debugging requires correlating session, build, and script records server-side.

Security implications:

- The loader is treated as untrusted.
- Authorization must remain server-side.
- Fetch must never accept license/key credentials as a substitute for a valid session.
- Event reporting must not consume delivery sessions.
- Session token replay is limited by expiration and one-time fetch consumption.

## Alternatives Considered

### Single Combined Authorization and Payload Endpoint

Rejected because it couples credential validation with payload delivery, increases replay/counter complexity, and makes it harder to keep authorization failures generic.

### Long-Lived API Keys for Payload Fetch

Rejected because long-lived credentials increase leakage impact and weaken replay resistance.

### Direct Public Build URL

Rejected because encrypted payload artifacts and delivery metadata must remain service-role-only and gated by session state.

### Authorization During Runtime Execution

Rejected because runtime code is untrusted and can be tampered with. Authorization must occur before payload delivery on the server.

## Related Documents

- `docs/runtime/SECURE_DELIVERY.md`
- `docs/runtime/BUILD_PIPELINE.md`
- `docs/database/SCHEMA.md`
- `docs/database/RLS_POLICIES.md`
- `docs/phases/phase7/PHASE_7B_DESIGN.md`
- `docs/phases/phase7/PHASE_7B_THREAT_MODEL.md`
- `docs/architecture/ARCHITECTURE.md`
