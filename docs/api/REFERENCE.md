# LuxyHub V1 API Reference

Status: Canonical V1 API source of truth  
Last updated: 2026-06-11

This document describes the current LuxyHub V1 API surface. It supersedes archived API documents under `docs/archive/**` for current production behavior.

## Conventions

### Base URL

Production APIs are served by the same Next.js application as the public site and dashboard.

```text
https://www.luxyhub.space
```

Operational schedulers may call the Vercel hostname directly when documented, especially for internal worker routes that must avoid Cloudflare bot challenges.

```text
https://luxyhub.vercel.app
```

### Authentication Models

| Model | Used By | Description |
|---|---|---|
| Public | Health, public script reads, loader bootstrap, key validation | No session or bearer token required. Rate limits still apply. |
| Supabase session | script writes, owner-scoped script reads, license APIs | Authenticated creator session from Supabase SSR cookies. |
| Delivery session | delivery fetch and event reporting | Short-lived server-issued delivery token created by `/api/delivery/session`. |
| Cron bearer | internal worker, manual alert check, cleanup | `Authorization: Bearer <CRON_SECRET>`. |
| Admin bearer | private raw script reads outside this reference scope | `Authorization: Bearer <ADMIN_API_KEY>` for private raw reads. |

### Ownership Model

Creator-owned resources derive ownership from the authenticated server session. Clients never provide `creator_id`. Non-owned resources return not-found style errors where possible to avoid leaking existence.

### Response Conventions

Most JSON endpoints return either:

```json
{ "success": true }
```

or:

```json
{ "success": false, "message": "Human-readable error" }
```

Rate-limited responses include HTTP `429` and normally include a `Retry-After` header.

### Runtime Safety

API documentation is descriptive only. This document does not change API behavior, runtime behavior, delivery behavior, authorization, schema, or frontend features.

## Health/Auth

### GET `/api/health`

Purpose: Lightweight production health check for the Next.js application runtime.

Authentication model: Public.

Request format:

```http
GET /api/health
```

Response format:

```json
{
  "status": "ok",
  "timestamp": "2026-06-11T00:00:00.000Z"
}
```

Error responses:

| Status | Body | Cause |
|---|---|---|
| 500 | Platform-generated error | Unexpected runtime failure before handler response. |

Ownership requirements: None.

Side effects: None. The endpoint does not perform a database deep check.

### `/api/auth/callback`

Purpose: Supabase auth callback endpoint used by the authentication flow.

Authentication model: Supabase auth callback parameters/cookies.

Request format: Managed by Supabase auth flow. Consumers should not call this endpoint directly unless implementing the same auth callback flow.

Response format: Redirect/session handling response from the application auth flow.

Error responses:

| Status | Body | Cause |
|---|---|---|
| 4xx/5xx | Framework or redirect response | Invalid callback parameters or unexpected auth runtime failure. |

Ownership requirements: None directly. Successful auth establishes the user session used by dashboard and owner-scoped APIs.

Side effects: Creates or refreshes Supabase SSR auth cookies as part of the callback flow.

## Key System

### POST `/api/validate`

Purpose: Validate a LuxyHub key.

Authentication model: Public. Rate limited by client IP.

Request format:

```json
{
  "key": "LUXY-ABCD-EFGH-IJKL"
}
```

Response format:

```json
{ "success": true }
```

Error responses:

| Status | Body | Cause |
|---|---|---|
| 400 | `{ "success": false, "message": "Invalid JSON body" }` | Missing or invalid JSON body. |
| 4xx | `{ "success": false, "message": "..." }` | Invalid, expired, inactive, or otherwise rejected key. |
| 429 | `{ "success": false, "message": "Too many requests. Please try again later." }` | Validation rate limit exceeded. |
| 500 | `{ "success": false, "message": "Server error" }` | Unexpected server failure. |

Ownership requirements: None.

Side effects: Logs validation success, validation failure, and rate-limit events to verification logging.

### POST `/api/verify-workink`

Purpose: Verify a Work.ink token and issue a LuxyHub key after successful verification.

Authentication model: Public. Rate limited by client IP.

Request format:

```json
{
  "token": "workink-verification-token"
}
```

Response format:

```json
{
  "success": true,
  "key": "LUXY-ABCD-EFGH-IJKL",
  "expires_at": "2026-06-12T00:00:00.000Z",
  "tokenInfo": {}
}
```

Error responses:

| Status | Body | Cause |
|---|---|---|
| 400 | `{ "success": false, "message": "Token required" }` | Missing or invalid token field. |
| 403 | `{ "success": false, "message": "Invalid token" }` | Work.ink token rejected. |
| 403 | `{ "success": false, "message": "Token already used" }` | Token has already been consumed. |
| 429 | `{ "success": false, "message": "Too many requests. Please try again later." }` | Rate limit exceeded. |
| 500 | `{ "success": false, "message": "Internal server error" }` | Unexpected failure. |

Ownership requirements: None.

Side effects: Verifies and records token usage, creates a key, and logs key generation.

### POST `/api/generate-key`

Purpose: Generate a LuxyHub key after Work.ink verification.

Authentication model: Public. Rate limited by client IP.

Request format:

```json
{
  "token": "workink-verification-token"
}
```

Response format:

```json
{
  "success": true,
  "key": "LUXY-ABCD-EFGH-IJKL",
  "expires_at": "2026-06-12T00:00:00.000Z"
}
```

Error responses:

| Status | Body | Cause |
|---|---|---|
| 400 | `{ "success": false, "message": "Work.ink verification token required" }` | Missing or invalid token field. |
| 403 | `{ "success": false, "message": "..." }` | Work.ink verification failed. |
| 429 | `{ "success": false, "message": "Too many keys generated. Try again tomorrow." }` | Key generation limit exceeded. |
| 500 | `{ "success": false, "message": "Failed to generate key" }` | Unexpected failure. |

Ownership requirements: None.

Side effects: Verifies Work.ink token, creates a key, and logs key generation.

## Script Management

### GET `/api/scripts`

Purpose: List public scripts.

Authentication model: Public. Rate limited by client IP.

Request format:

```http
GET /api/scripts?limit=20&offset=0
```

Response format:

```json
{
  "success": true,
  "scripts": [
    {
      "slug": "example-script",
      "name": "Example Script",
      "description": "Short description",
      "visibility": "public",
      "created_at": "2026-06-11T00:00:00.000Z",
      "updated_at": "2026-06-11T00:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

Error responses:

| Status | Body | Cause |
|---|---|---|
| 4xx | `{ "success": false, "message": "..." }` | Invalid list parameters or service validation failure. |
| 429 | `{ "success": false, "message": "Too many requests. Please try again later." }` | Rate limit exceeded. |
| 500 | `{ "success": false, "message": "Failed to list scripts" }` | Unexpected failure. |

Ownership requirements: None. Only public/listable data is returned.

Side effects: Logs rate-limit events when applicable.

### POST `/api/scripts`

Purpose: Create a new script and initial version.

Authentication model: Supabase session required. Rate limited by client IP.

Request format:

```json
{
  "slug": "example-script",
  "name": "Example Script",
  "description": "Short description",
  "visibility": "private",
  "content": "print('hello')"
}
```

Response format:

```json
{
  "success": true,
  "script": {}
}
```

Success status: `201`.

Error responses:

| Status | Body | Cause |
|---|---|---|
| 401/403 | `{ "success": false, "message": "..." }` | Missing or invalid Supabase session. |
| 4xx | `{ "success": false, "message": "..." }` | Invalid slug, metadata, visibility, content, duplicate slug, or service validation failure. |
| 429 | `{ "success": false, "message": "Too many requests. Please try again later." }` | Upload rate limit exceeded. |
| 500 | `{ "success": false, "message": "Failed to create script" }` | Unexpected failure. |

Ownership requirements: `creator_id` is derived from the authenticated session. Client input cannot set ownership.

Side effects: Creates `scripts` and `script_versions` records, may trigger delivery build automation through service-level behavior, and logs creation.

### GET `/api/scripts/[slug]`

Purpose: Fetch script metadata/detail visible to the current caller.

Authentication model: Optional Supabase session. Public callers receive public-safe fields. Authenticated owners may receive owner-visible data.

Request format:

```http
GET /api/scripts/example-script
```

Response format:

```json
{
  "success": true,
  "script": {
    "slug": "example-script",
    "name": "Example Script",
    "description": "Short description",
    "visibility": "public",
    "created_at": "2026-06-11T00:00:00.000Z",
    "updated_at": "2026-06-11T00:00:00.000Z"
  }
}
```

Error responses:

| Status | Body | Cause |
|---|---|---|
| 4xx | `{ "success": false, "message": "..." }` | Script not visible, not found, invalid slug, or validation failure. |
| 429 | `{ "success": false, "message": "Too many requests. Please try again later." }` | Rate limit exceeded. |
| 500 | `{ "success": false, "message": "Failed to fetch script" }` | Unexpected failure. |

Ownership requirements: Owner-only data requires the authenticated user to own the script.

Side effects: Logs rate-limit events when applicable.

### PATCH `/api/scripts/[slug]`

Purpose: Update script metadata and optionally script content.

Authentication model: Supabase session required. Rate limited by client IP.

Request format:

```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "visibility": "unlisted",
  "content": "print('updated')"
}
```

Response format:

```json
{
  "success": true,
  "script": {}
}
```

Error responses:

| Status | Body | Cause |
|---|---|---|
| 401/403 | `{ "success": false, "message": "..." }` | Missing or invalid session. |
| 404 | `{ "success": false, "message": "..." }` | Script missing or not owned by caller. |
| 4xx | `{ "success": false, "message": "..." }` | Invalid metadata/content. |
| 429 | `{ "success": false, "message": "Too many requests. Please try again later." }` | Update rate limit exceeded. |
| 500 | `{ "success": false, "message": "Failed to update script" }` | Unexpected failure. |

Ownership requirements: Caller must own the script or have a role accepted by the service layer.

Side effects: Updates script metadata, creates a new version when content changes, may trigger delivery build automation, and logs update.

### DELETE `/api/scripts/[slug]`

Purpose: Delete an owned script.

Authentication model: Supabase session required. Rate limited by client IP.

Request format:

```http
DELETE /api/scripts/example-script
```

Response format:

```json
{
  "success": true,
  "message": "Script deleted"
}
```

Error responses:

| Status | Body | Cause |
|---|---|---|
| 401/403 | `{ "success": false, "message": "..." }` | Missing or invalid session. |
| 404 | `{ "success": false, "message": "..." }` | Script missing or not owned by caller. |
| 429 | `{ "success": false, "message": "Too many requests. Please try again later." }` | Delete rate limit exceeded. |
| 500 | `{ "success": false, "message": "Failed to delete script" }` | Unexpected failure. |

Ownership requirements: Caller must own the script or have a role accepted by the service layer.

Side effects: Deletes script data according to database constraints and service behavior.

## Secure Delivery

### GET `/api/loader/[slug]`

Purpose: Return a Lua loader bootstrap for the requested script slug.

Authentication model: Public. Rate limited by client IP.

Request format:

```http
GET /api/loader/example-script
```

Response format:

```text
-- Lua bootstrap text
```

Response headers include `Content-Type: text/plain; charset=utf-8` and `Cache-Control: no-store`.

Error responses:

| Status | Body | Cause |
|---|---|---|
| 429 | `{ "success": false, "message": "Too many requests. Please try again later." }` | Loader bootstrap rate limit exceeded. |
| 404 | `{ "success": false, "message": "Loader unavailable" }` | Unexpected loader generation failure. |

Ownership requirements: None at bootstrap generation. Authorization occurs when creating a delivery session.

Side effects: None besides rate-limit tracking.

### POST `/api/delivery/session`

Purpose: Create a short-lived delivery session for a script and return event credentials.

Authentication model: Public runtime endpoint with script access checks performed by service layer. Rate limited by client IP.

Request format:

```json
{
  "slug": "example-script",
  "key": "optional-workink-key",
  "license": "optional-license-key",
  "customer_identifier": "optional-customer-id"
}
```

Response format:

```json
{
  "session_token": "base64url-token",
  "event_secret": "base64url-secret",
  "expires_in": 60
}
```

Error responses:

| Status | Body | Cause |
|---|---|---|
| 4xx | `{ "success": false, "message": "..." }` | Invalid slug, access denied, missing ready build, invalid key/license, or service validation failure. |
| 429 | `{ "success": false, "message": "Too many requests. Please try again later." }` | Delivery session rate limit exceeded. |
| 404 | `{ "success": false, "message": "Delivery unavailable" }` | Unexpected delivery-session failure or unavailable delivery. |

Ownership requirements: No creator ownership from the runtime caller. Access is determined by script visibility/access mode, key/license requirements, and delivery authorization rules.

Side effects: Creates a `delivery_sessions` record with token hash and event secret. May update delivery/license counters depending on service outcome.

### POST `/api/delivery/fetch`

Purpose: Consume a delivery session and return the encrypted/runtime payload and event secret.

Authentication model: Delivery session token. Rate limited by client IP.

Request format:

```json
{
  "session_token": "base64url-token"
}
```

Response format:

```json
{
  "runtime_payload": "payload-string",
  "build_version": "1.0.0",
  "version_id": "uuid",
  "runtime_format_version": 1,
  "event_secret": "base64url-secret"
}
```

Error responses:

| Status | Body | Cause |
|---|---|---|
| 4xx | `{ "success": false, "message": "..." }` | Missing, invalid, expired, or consumed delivery session. |
| 429 | `{ "success": false, "message": "Too many requests. Please try again later." }` | Delivery fetch rate limit exceeded. |
| 403 | `{ "success": false, "message": "Invalid delivery session" }` | Unexpected session consume failure. |

Ownership requirements: None from caller. Session token gates access.

Side effects: Consumes the delivery session for payload fetch and records service-level delivery state.

## Event Platform

### POST `/api/events/report`

Purpose: Accept signed runtime events and enqueue them for provider delivery.

Authentication model: Delivery session token plus HMAC signature using `event_secret`.

Request format:

```json
{
  "sessionId": "session_token_from_delivery_session",
  "event": "execute",
  "timestamp": 1717977600,
  "nonce": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
  "signature": "64-character-lowercase-hex-hmac",
  "payload": { "optional": "data" }
}
```

Response format:

```json
{ "success": true }
```

Error responses:

| Status | Body | Cause |
|---|---|---|
| 400 | `{ "success": false, "message": "Invalid event payload" }` | Missing or invalid JSON object. |
| 400/401/413/422 | `{ "success": false, "message": "..." }` | Timestamp, session, nonce, signature, payload size, or event type rejected by event service. |
| 429 | `{ "success": false, "message": "...", "retry_after": 60 }` | Per-session event rate limit exceeded. |
| 500 | `{ "success": false, "message": "Event rejected" }` | Unexpected failure. |

Ownership requirements: None from caller. Session maps event to a script server-side.

Side effects: Inserts event queue records, tracks replay/security/rate-limit signals, and enables asynchronous Discord delivery through the event worker.

Canonical integration details: `docs/integration/EVENT_PLATFORM_INTEGRATION.md`.

## License System

### GET `/api/licenses`

Purpose: List licenses for an owned script.

Authentication model: Supabase session required.

Request format:

```http
GET /api/licenses?script_id=<script_uuid>
```

Response format:

```json
{
  "success": true,
  "licenses": [
    {
      "id": "license_uuid",
      "status": "active",
      "max_assignments": 1,
      "activation_count": 0,
      "delivery_count": 0,
      "expires_at": null,
      "created_at": "2026-06-11T00:00:00.000Z"
    }
  ]
}
```

Error responses:

| Status | Body | Cause |
|---|---|---|
| 401/403 | `{ "success": false, "message": "..." }` | Missing or invalid session. |
| 404 | `{ "success": false, "message": "Script not found" }` | Script missing or not owned by caller. |
| 500 | `{ "success": false, "message": "License operation failed" }` | Unexpected failure. |

Ownership requirements: `script_id` must belong to the authenticated creator.

Side effects: None.

### POST `/api/licenses`

Purpose: Create a license for an owned script.

Authentication model: Supabase session required.

Request format:

```json
{
  "script_id": "script_uuid",
  "max_assignments": 1,
  "expires_at": null
}
```

Response format:

```json
{
  "success": true,
  "license": "raw-license-key-shown-once"
}
```

Success status: `201`.

Error responses:

| Status | Body | Cause |
|---|---|---|
| 401/403 | `{ "success": false, "message": "..." }` | Missing or invalid session. |
| 404 | `{ "success": false, "message": "Script not found" }` | Script missing or not owned by caller. |
| 500 | `{ "success": false, "message": "License operation failed" }` | Unexpected failure. |

Ownership requirements: The target script must belong to the authenticated creator. `creator_id` is derived from the session.

Side effects: Creates a license. The raw license key is returned at creation time; persisted storage uses service/repository security behavior.

### POST `/api/licenses/[id]/enable`

Purpose: Set an owned license back to active/enabled state.

Authentication model: Supabase session required.

Request format:

```http
POST /api/licenses/license_uuid/enable
```

Response format:

```json
{
  "success": true,
  "license": {}
}
```

Error responses:

| Status | Body | Cause |
|---|---|---|
| 401/403 | `{ "success": false, "message": "..." }` | Missing or invalid session. |
| 404 | `{ "success": false, "message": "License not found" }` | License missing or not owned by caller. |
| 500 | `{ "success": false, "message": "License operation failed" }` | Unexpected failure. |

Ownership requirements: License must belong to the authenticated creator through its script.

Side effects: Updates license status.

### POST `/api/licenses/[id]/disable`

Purpose: Disable an owned license without revoking it.

Authentication model: Supabase session required.

Request format:

```http
POST /api/licenses/license_uuid/disable
```

Response format:

```json
{
  "success": true,
  "license": {}
}
```

Error responses:

| Status | Body | Cause |
|---|---|---|
| 401/403 | `{ "success": false, "message": "..." }` | Missing or invalid session. |
| 404 | `{ "success": false, "message": "License not found" }` | License missing or not owned by caller. |
| 500 | `{ "success": false, "message": "License operation failed" }` | Unexpected failure. |

Ownership requirements: License must belong to the authenticated creator through its script.

Side effects: Updates license status.

### POST `/api/licenses/[id]/revoke`

Purpose: Revoke an owned license.

Authentication model: Supabase session required.

Request format:

```http
POST /api/licenses/license_uuid/revoke
```

Response format:

```json
{
  "success": true,
  "license": {}
}
```

Error responses:

| Status | Body | Cause |
|---|---|---|
| 401/403 | `{ "success": false, "message": "..." }` | Missing or invalid session. |
| 404 | `{ "success": false, "message": "License not found" }` | License missing or not owned by caller. |
| 500 | `{ "success": false, "message": "License operation failed" }` | Unexpected failure. |

Ownership requirements: License must belong to the authenticated creator through its script.

Side effects: Updates license status to revoked.

### GET `/api/licenses/[id]/assignments`

Purpose: List assignments for an owned license.

Authentication model: Supabase session required.

Request format:

```http
GET /api/licenses/license_uuid/assignments
```

Response format:

```json
{
  "success": true,
  "assignments": [
    {
      "id": "assignment_uuid",
      "license_id": "license_uuid",
      "customer_identifier_hash": "hash",
      "display_name": "Customer",
      "status": "active",
      "created_at": "2026-06-11T00:00:00.000Z",
      "updated_at": "2026-06-11T00:00:00.000Z"
    }
  ]
}
```

Error responses:

| Status | Body | Cause |
|---|---|---|
| 401/403 | `{ "success": false, "message": "..." }` | Missing or invalid session. |
| 404 | `{ "success": false, "message": "License not found" }` | License missing or not owned by caller. |
| 500 | `{ "success": false, "message": "License operation failed" }` | Unexpected failure. |

Ownership requirements: License must belong to the authenticated creator through its script.

Side effects: None.

### POST `/api/licenses/[id]/assignments`

Purpose: Create an assignment for an owned license.

Authentication model: Supabase session required.

Request format:

```json
{
  "customer_identifier": "roblox-user-or-customer-id",
  "display_name": "Optional display name"
}
```

Response format:

```json
{
  "success": true,
  "assignment": {}
}
```

Success status: `201`.

Error responses:

| Status | Body | Cause |
|---|---|---|
| 400 | `{ "success": false, "message": "Customer identifier is required" }` | Missing or empty customer identifier. |
| 401/403 | `{ "success": false, "message": "..." }` | Missing or invalid session. |
| 404 | `{ "success": false, "message": "License not found" }` | License missing or not owned by caller. |
| 500 | `{ "success": false, "message": "License operation failed" }` | Unexpected failure. |

Ownership requirements: License must belong to the authenticated creator through its script.

Side effects: Creates a license assignment. The raw `customer_identifier` is parsed by the API and stored according to service/repository hashing behavior.

### DELETE `/api/licenses/[id]/assignments/[assignmentId]`

Purpose: Remove an assignment from an owned license.

Authentication model: Supabase session required.

Request format:

```http
DELETE /api/licenses/license_uuid/assignments/assignment_uuid
```

Response format:

```json
{
  "success": true,
  "assignment": {}
}
```

Error responses:

| Status | Body | Cause |
|---|---|---|
| 401/403 | `{ "success": false, "message": "..." }` | Missing or invalid session. |
| 404 | `{ "success": false, "message": "License not found" }` | License missing or not owned by caller. |
| 404 | `{ "success": false, "message": "Assignment not found" }` | Assignment missing or not attached to the owned license. |
| 500 | `{ "success": false, "message": "License operation failed" }` | Unexpected failure. |

Ownership requirements: License must belong to the authenticated creator and the assignment must belong to that license.

Side effects: Removes or marks the assignment according to license service behavior.

## Internal Operations

### POST `/api/internal/event-worker`

Purpose: Process pending event queue items and then evaluate internal alert thresholds.

Authentication model: Cron bearer token. Requires `Authorization: Bearer <CRON_SECRET>`.

Request format:

```http
POST /api/internal/event-worker
Authorization: Bearer <CRON_SECRET>
```

Response format:

```json
{
  "success": true,
  "processed": 0,
  "delivered": 0,
  "failed": 0,
  "deadLettered": 0,
  "alerts": {
    "triggered": 0,
    "resolved": 0
  }
}
```

Exact counter fields are returned by the event queue service.

Error responses:

| Status | Body | Cause |
|---|---|---|
| 401 | `{ "success": false, "message": "Unauthorized" }` | Missing or wrong bearer token. |
| 500 | `{ "success": false, "message": "CRON_SECRET not configured" }` | Required secret missing. |
| 500 | `{ "success": false, "message": "..." }` | Worker failure. |

Ownership requirements: None. This is an internal service operation.

Side effects: Claims pending events, delivers Discord webhooks, updates retry/dead-letter state, and creates/resolves internal alerts.

### POST `/api/internal/check-alerts`

Purpose: Manually evaluate internal alert thresholds.

Authentication model: Cron bearer token. Requires `Authorization: Bearer <CRON_SECRET>`.

Request format:

```http
POST /api/internal/check-alerts
Authorization: Bearer <CRON_SECRET>
```

Response format:

```json
{
  "success": true,
  "triggered": 0,
  "resolved": 0
}
```

Error responses:

| Status | Body | Cause |
|---|---|---|
| 401 | `{ "success": false, "message": "Unauthorized" }` | Missing or wrong bearer token. |
| 500 | `{ "success": false, "message": "CRON_SECRET not configured" }` | Required secret missing. |
| 500 | `{ "success": false, "message": "Alert check failed" }` | Alert evaluation failure. |

Ownership requirements: None. This is an internal service operation.

Side effects: Creates or resolves `alert_events` records and may send internal alert notifications if configured.

### POST `/api/cleanup`

Purpose: Run production cleanup for expired keys, old Work.ink tokens, rate-limit rows, verification logs, script download analytics, and event logs.

Authentication model: Cron bearer token. Requires `Authorization: Bearer <CRON_SECRET>`.

Request format:

```http
POST /api/cleanup
Authorization: Bearer <CRON_SECRET>
```

Response format:

```json
{
  "success": true,
  "message": "Cleanup completed",
  "timestamp": "2026-06-11T00:00:00.000Z",
  "event_logs": {
    "delivered": {},
    "deadLetter": {},
    "pending": {}
  }
}
```

Error responses:

| Status | Body | Cause |
|---|---|---|
| 401 | `{ "success": false, "message": "Unauthorized" }` | Missing or wrong bearer token. |
| 500 | `{ "success": false, "message": "CRON_SECRET not configured" }` | Required secret missing. |
| 500 | `{ "success": false, "message": "Cleanup failed" }` | Unexpected cleanup failure. |

Ownership requirements: None. This is an internal service operation.

Side effects: Deactivates expired keys and deletes old operational/analytics/event records according to retention rules.
