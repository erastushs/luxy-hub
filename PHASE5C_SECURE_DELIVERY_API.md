# Phase 5C - Secure Delivery API

Status: Implemented
Date: 2026-06-08
Scope: Session-based payload delivery only. No loader, license, key validation, customer management, dashboard UI, or build pipeline behavior changes.

## 1. Summary

Phase 5C exposes pre-built secure payloads through a short-lived delivery session API.

Current payload path:

```text
script_versions.content
  |
  v
build pipeline
  |
  v
delivery_builds.payload_ciphertext
```

Phase 5C delivery path:

```text
POST /api/delivery/session
  |
  v
delivery_sessions
  |
  v
POST /api/delivery/fetch
  |
  v
delivery_builds.payload_ciphertext
```

## 2. Schema

Migration:

```text
migrations/007_delivery_sessions.sql
migrations/007_delivery_sessions_rollback.sql
```

Table:

```text
delivery_sessions
  id uuid primary key
  script_id uuid references scripts(id) on delete cascade
  build_id uuid references delivery_builds(id) on delete cascade
  session_token_hash text unique
  expires_at timestamptz
  consumed_at timestamptz nullable
  created_at timestamptz
```

Constraints:

- `session_token_hash` must be a 64-character lowercase SHA-256 hex digest.
- Raw session tokens are never stored.
- `expires_at` must be after `created_at`.
- Sessions are one-time use through `consumed_at`.

Indexes:

- `idx_delivery_sessions_token_hash`
- `idx_delivery_sessions_expires_at`
- `idx_delivery_sessions_build_id`

RLS:

- `delivery_sessions` has deny-all RLS for `anon` and `authenticated`.
- Access is service-role-only through repository functions.

## 3. Flow

### Session Creation

```text
Client
  |
  | POST /api/delivery/session { "slug": "script-slug" }
  v
delivery session service
  |
  | validate slug
  | find script
  | require public or unlisted visibility
  | require current_version_id
  | require ready delivery_build
  | generate random token
  | hash token
  v
delivery_sessions row
  |
  v
return raw session token once
```

Session TTL:

```text
60 seconds
```

### Payload Fetch

```text
Client
  |
  | POST /api/delivery/fetch { "session_token": "..." }
  v
delivery session service
  |
  | hash token
  | find session by token hash
  | reject expired session
  | reject consumed session
  | validate build exists and is ready
  | consume session
  v
return encrypted payload
```

The fetch response returns encrypted payload data and, as of Phase 6D, safe loader context. It never reads or returns `script_versions.content`.

## 4. Endpoint Catalog

### POST `/api/delivery/session`

Request:

```json
{
  "slug": "script-slug"
}
```

Success:

```json
{
  "session_token": "...",
  "expires_in": 60
}
```

Failure:

```json
{
  "success": false,
  "message": "Delivery unavailable"
}
```

Notes:

- Only `public` and `unlisted` scripts can create sessions in Phase 5C.
- Private delivery waits for future entitlement and token integration.
- Missing script, private script, missing current version, and missing build share the same response.

### POST `/api/delivery/fetch`

Request:

```json
{
  "session_token": "..."
}
```

Success:

```json
{
  "payload": "...",
  "context": {
    "build_id": "...",
    "version_id": "...",
    "source_sha256": "...",
    "payload_sha256": "..."
  },
  "payload_format_version": "inline-json-v1",
  "build_version": "delivery-build-v1"
}
```

Failure:

```json
{
  "success": false,
  "message": "Invalid delivery session"
}
```

Notes:

- Phase 6D adds safe loader context to the fetch response.
- Expired, missing, malformed, reused, and build-missing tokens share the same response.
- The session is consumed before the payload response is returned.
- Successful responses use `Cache-Control: no-store`.

## 5. Repository Architecture

File:

```text
app/lib/repositories/delivery-session-repository.ts
```

Functions:

- `createSession()`
- `getSessionByTokenHash()`
- `consumeSession()`
- `deleteExpiredSessions()`

The repository stores only token hashes and never accepts raw session tokens.

## 6. Service Architecture

File:

```text
app/lib/services/delivery-session-service.ts
```

Functions:

- `createDeliverySession()`
- `validateDeliverySession()`
- `consumeDeliverySession()`

Token rules:

- Tokens are generated from 32 random bytes.
- Tokens are returned only once from session creation.
- SHA-256 token hashes are stored in the database.
- Session TTL is 60 seconds.
- Sessions are consumed with an atomic update that requires `consumed_at IS NULL` and `expires_at > now`.

## 7. Rate Limiting

New rate limit keys:

```text
DELIVERY_SESSION: 20 requests/minute/IP
DELIVERY_FETCH:   40 requests/minute/IP
```

Rate limiting remains fail-closed through the existing `rate_limits` table.

## 8. Security Model

- Token hash only in database.
- Raw tokens are never logged or stored by the repository.
- One-time-use sessions.
- 60-second expiry.
- Uniform fetch errors to reduce token oracle behavior.
- Uniform session creation errors for missing/private/unbuilt scripts.
- Deny-all RLS on `delivery_sessions`.
- Service-role-only repository access.
- No source exposure.
- No reads from `script_versions.content` in delivery session service.
- No loader implementation.
- No key, license, or customer management implementation.
- No dashboard UI changes.

## 9. Threat Model

Defends against:

- Casual direct payload scraping without a session token.
- Reuse of a captured token after first successful fetch.
- Reuse of stale tokens after 60 seconds.
- Database token disclosure leading directly to usable raw tokens.
- Source disclosure through delivery endpoints.
- Existence probing through detailed token errors.

Does not fully defend against:

- A malicious client that receives a valid token and immediately uses it.
- Network interception outside TLS assumptions.
- Runtime dumping after a future loader decrypts the payload.
- Executor-level hooks.
- Full reverse engineering of client-side execution.

Phase 5C improves direct HTTP delivery control. It is not a complete loader DRM system.

## 10. Test Coverage

Files:

```text
__tests__/delivery-session-service.test.ts
__tests__/delivery-api.test.ts
```

Validated:

- session creation
- token hashing
- missing build rejection
- expired token rejection
- reused token rejection
- build missing during validation
- payload retrieval
- one-time consume failure handling
- session API success
- fetch API success
- uniform fetch error response

## 11. Remaining Work for Phase 5D

- Apply migration 007 in Supabase.
- Add cleanup integration for expired sessions.
- Add operational logging that does not record raw session tokens.
- Add secure loader integration.
- Add entitlement/private-script authorization design.
- Add executor compatibility validation.
- Add production monitoring for delivery errors and token replay attempts.
