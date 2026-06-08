# LuxyHub API Reference v1

## Overview

**Base URL:** `https://luxyhub.vercel.app`

All requests and responses use `Content-Type: application/json`.

---

## Response Format

All endpoints return JSON objects with a `success` boolean. Error responses include a `message` string.

### Success

```json
{ "success": true }
```

### Error

```json
{ "success": false, "message": "Error description" }
```

---

## Endpoints

### GET /api/health

Health check. No authentication required.

**Request:**
```http
GET /api/health
```

**Success (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-06-07T09:00:00.000Z"
}
```

Use this to verify connectivity before sending validation requests.

---

### POST /api/validate

Validate a LuxyHub access key.

**Request:**
```http
POST /api/validate
Content-Type: application/json

{
  "key": "LUXY-ABCD-EFGH-IJKL"
}
```

**Response Table:**

| HTTP | Body | Meaning |
|------|------|---------|
| 200 | `{ "success": true }` | Key is valid and active |
| 400 | `{ "success": false, "message": "Key is required" }` | Request body missing the `key` field |
| 403 | `{ "success": false, "message": "Invalid key" }` | Key format invalid, key not found, expired, or disabled |
| 413 | `{ "success": false, "message": "Payload too large" }` | Request body exceeds 64 KB |
| 429 | `{ "success": false, "message": "Too many requests. Please try again later." }` | Rate limit exceeded (30 req/min per IP) |
| 500 | `{ "success": false, "message": "Server error" }` | Internal server error |

All key validation failures return `403 Invalid key` with the same message. The API does not distinguish between "not found", "expired", or "disabled" keys to prevent key enumeration.

**Rate Limit:** 30 requests per minute per IP. Response includes `Retry-After` header in seconds.

**Security:** Server-side only. All responses include `Access-Control-Allow-Origin: *`.

**Validation rules:** A key passes when all conditions are met:
1. Key is present and non-empty
2. Key matches format `LUXY-XXXX-XXXX-XXXX`
3. Key exists in the database
4. `is_active` is true
5. `expires_at` is in the future

---

### POST /api/verify-workink

Complete the Work.ink verification flow and receive an access key.

**Request:**
```http
POST /api/verify-workink
Content-Type: application/json

{
  "token": "<workink_verification_token>"
}
```

**Success (200):**
```json
{
  "success": true,
  "key": "LUXY-ABCD-EFGH-IJKL",
  "expires_at": "2026-06-08T09:00:00.000Z",
  "tokenInfo": { ... }
}
```

The `tokenInfo` field contains Work.ink response metadata (varies by provider).

**Error Responses:**

| HTTP | Body | Meaning |
|------|------|---------|
| 400 | `{ "success": false, "message": "Token required" }` | Token field missing, empty, or invalid format |
| 403 | `{ "success": false, "message": "Invalid token" }` | Work.ink determined the token is invalid |
| 403 | `{ "success": false, "message": "Token already used" }` | Token was already consumed (replay protection) |
| 413 | `{ "success": false, "message": "Payload too large" }` | Request body exceeds 64 KB |
| 429 | `{ "success": false, "message": "Too many requests. Please try again later." }` | Rate limit exceeded (10 req/min per IP) |
| 500 | `{ "success": false, "message": "Internal server error" }` | Service unavailable |

**Rate Limit:** 10 requests per minute per IP. Token replay protection prevents the same token from being redeemed more than once.

**Token constraints:**
- Maximum 256 characters
- Validated via Work.ink's `/_api/v2/token/isValid/` endpoint
- IP matching is a soft check (logged but not enforced)

---

### POST /api/generate-key

Generate a key using a Work.ink verification token. Identical behavior to `/api/verify-workink` but with `GENERATE` rate limits.

**Request:**
```http
POST /api/generate-key
Content-Type: application/json

{
  "token": "<workink_verification_token>"
}
```

**Success (200):**
```json
{
  "success": true,
  "key": "LUXY-ABCD-EFGH-IJKL",
  "expires_at": "2026-06-08T09:00:00.000Z"
}
```

**Error Responses:**

| HTTP | Body | Meaning |
|------|------|---------|
| 400 | `{ "success": false, "message": "Work.ink verification token required" }` | Token missing, empty, or >256 chars |
| 403 | `{ "success": false, "message": "Invalid token" }` | Token rejected by Work.ink |
| 403 | `{ "success": false, "message": "Token already used" }` | Token already consumed |
| 403 | `{ "success": false, "message": "Internal server error" }` | Work.ink API unreachable |
| 413 | `{ "success": false, "message": "Payload too large" }` | Request body exceeds 64 KB |
| 429 | `{ "success": false, "message": "Too many keys generated. Try again tomorrow." }` | Rate limit exceeded (5 keys/day per IP) |
| 500 | `{ "success": false, "message": "Failed to generate key" }` | Internal server error |

**Rate Limit:** 5 keys per 24 hours per IP.

---

### POST /api/cleanup

Administrative endpoint for database maintenance. Used by cron jobs.

**Authentication:** Requires `CRON_SECRET` environment variable. Request must include `Authorization: Bearer <CRON_SECRET>`.

**Request:**
```http
POST /api/cleanup
Authorization: Bearer <CRON_SECRET>
```

**Success (200):**
```json
{
  "success": true,
  "message": "Cleanup completed",
  "timestamp": "2026-06-07T09:00:00.000Z"
}
```

**Error Responses:**

| HTTP | Body | Meaning |
|------|------|---------|
| 401 | `{ "success": false, "message": "Unauthorized" }` | Missing or incorrect `Authorization` header |
| 500 | `{ "success": false, "message": "CRON_SECRET not configured" }` | `CRON_SECRET` env var not set on server |
| 500 | `{ "success": false, "message": "Cleanup failed" }` | Database operation failed |

**Operations performed:**
1. Deactivate keys where `expires_at < now()`
2. Delete `used_workink_tokens` older than 3 days
3. Delete `rate_limits` older than 3 days
4. Delete `verification_logs` older than 30 days
5. Delete `script_downloads` older than 90 days

No rate limiting is applied to this endpoint.

---

## CDN Endpoints

All CDN endpoints live under `/api/scripts`. Write operations require a valid session (ownership is derived server-side). Read endpoints are public where the script visibility allows it. An admin bearer token (`verifyAdminAuth`) is accepted for private script reads.

### Visibility Model

| Value | Raw Endpoint | Directory Listing | Auth Required |
|-------|-------------|-------------------|---------------|
| `public` | Anyone | Listed | None |
| `private` | Session or admin bearer | Not listed | Write: Session, Read: Session or admin bearer |
| `unlisted` | Anyone | Not listed | Write: Session |

---

### GET /api/scripts

List public scripts with pagination.

**Request:**
```http
GET /api/scripts?limit=20&offset=0
```

**Query Parameters:**
| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `limit` | 20 | 100 | Results per page |
| `offset` | 0 | — | Pagination offset |

**Success (200):**
```json
{
  "success": true,
  "scripts": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "slug": "bloxatlas",
      "name": "BloxAtlas",
      "description": "Universal ESP and aimbot for Roblox",
      "visibility": "public",
      "creator_id": null,
      "current_version_id": "660e8400-e29b-41d4-a716-446655440001",
      "created_at": "2026-06-07T09:00:00.000Z",
      "updated_at": "2026-06-07T09:00:00.000Z"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

**Note:** The `content` field is not returned. Use `/api/scripts/[slug]/raw` for script content.

**Response Table:**
| HTTP | Body | Meaning |
|------|------|---------|
| 200 | `{ "success": true, "scripts": [...], "total": N, "limit": N, "offset": N }` | Scripts listed |
| 400 | `{ "success": false, "message": "Limit must be a number between 1 and 100" }` | Invalid pagination |
| 429 | `{ "success": false, "message": "Too many requests. Please try again later." }` | Rate limit exceeded |
| 500 | `{ "success": false, "message": "Failed to list scripts" }` | Internal server error |

**Rate Limit:** 30 requests per minute per IP (`SCRIPT_LIST`).

---

### POST /api/scripts

Upload a new script. Requires valid session authentication (ownership derived server-side).

**Request:**
```http
POST /api/scripts
Content-Type: application/json

{
  "slug": "bloxatlas",
  "name": "BloxAtlas",
  "description": "Universal ESP and aimbot for Roblox",
  "visibility": "public",
  "content": "loadstring(game:HttpGet('https://...'))()"
}
```

| Field | Required | Type | Constraints |
|-------|----------|------|-------------|
| `slug` | Yes | string | 3-64 chars, lowercase alphanumeric + hyphens (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`) |
| `name` | Yes | string | 1-100 characters |
| `content` | Yes | string | Non-empty, max 62 KB |
| `visibility` | No | `"public"` \| `"private"` \| `"unlisted"` | Defaults to `"private"` |
| `description` | No | string | Any string |

**Success (201):**
```json
{
  "success": true,
  "script": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "slug": "bloxatlas",
    "name": "BloxAtlas",
    "description": "Universal ESP and aimbot for Roblox",
    "visibility": "public",
    "creator_id": null,
    "current_version_id": "660e8400-e29b-41d4-a716-446655440001",
    "created_at": "2026-06-07T09:00:00.000Z",
    "updated_at": "2026-06-07T09:00:00.000Z"
  }
}
```

A `script_versions` row (version `"1.0.0"`) is automatically created.

**Response Table:**
| HTTP | Body | Meaning |
|------|------|---------|
| 201 | `{ "success": true, "script": {...} }` | Script created |
| 400 | `{ "success": false, "message": "..." }` | Validation error (slug, name, content, visibility) |
| 401 | `{ "success": false, "message": "Unauthorized" }` | Missing or invalid admin key |
| 409 | `{ "success": false, "message": "A script with slug \"...\" already exists" }` | Slug conflict |
| 429 | `{ "success": false, "message": "Too many requests. Please try again later." }` | Rate limit exceeded |
| 500 | `{ "success": false, "message": "Failed to create script" }` | Internal server error |

**Rate Limit:** 30 requests per hour per IP (`SCRIPT_UPLOAD`).

---

### GET /api/scripts/[slug]

Get script metadata. Content is not returned.

**Request:**
```http
GET /api/scripts/bloxatlas
```

**Success (200):**
```json
{
  "success": true,
  "script": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "slug": "bloxatlas",
    "name": "BloxAtlas",
    "description": "Universal ESP and aimbot for Roblox",
    "visibility": "public",
    "creator_id": null,
    "current_version_id": "660e8400-e29b-41d4-a716-446655440001",
    "created_at": "2026-06-07T09:00:00.000Z",
    "updated_at": "2026-06-07T09:00:00.000Z"
  }
}
```

**Response Table:**
| HTTP | Body | Meaning |
|------|------|---------|
| 200 | `{ "success": true, "script": {...} }` | Script found |
| 400 | `{ "success": false, "message": "Invalid slug format" }` | Slug does not match format |
| 404 | `{ "success": false, "message": "Script not found" }` | Slug does not exist |
| 429 | `{ "success": false, "message": "Too many requests. Please try again later." }` | Rate limit exceeded |
| 500 | `{ "success": false, "message": "Failed to fetch script" }` | Internal server error |

**Rate Limit:** 60 requests per minute per IP (`SCRIPT_GET`).

---

### PATCH /api/scripts/[slug]

Update script metadata and/or content. Requires admin authentication.

**Request:**
```http
PATCH /api/scripts/bloxatlas
Content-Type: application/json
Authorization: Bearer <ADMIN_API_KEY>

{
  "name": "BloxAtlas v2",
  "description": "Updated description",
  "visibility": "public",
  "content": "loadstring(game:HttpGet('https://...'))()"
}
```

All fields are optional. Only provided fields are updated. `slug` cannot be changed.

When `content` is provided and differs from current content, a new `script_versions` row is auto-created and `current_version_id` is updated to point to the new version. Version numbers auto-increment (`1.0.0` → `1.0.1` → `1.0.2`).

**Success (200):**
```json
{
  "success": true,
  "script": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "slug": "bloxatlas",
    "name": "BloxAtlas v2",
    "description": "Updated description",
    "visibility": "public",
    "creator_id": null,
    "current_version_id": "660e8400-e29b-41d4-a716-446655440002",
    "created_at": "2026-06-07T09:00:00.000Z",
    "updated_at": "2026-06-07T10:30:00.000Z"
  }
}
```

**Response Table:**
| HTTP | Body | Meaning |
|------|------|---------|
| 200 | `{ "success": true, "script": {...} }` | Script updated |
| 400 | `{ "success": false, "message": "..." }` | Validation error |
| 401 | `{ "success": false, "message": "Unauthorized" }` | Missing admin key |
| 404 | `{ "success": false, "message": "Script not found" }` | Slug does not exist |
| 429 | `{ "success": false, "message": "Too many requests. Please try again later." }` | Rate limit exceeded |
| 500 | `{ "success": false, "message": "Failed to update script" }` | Internal server error |

**Rate Limit:** 60 requests per hour per IP (`SCRIPT_UPDATE`).

---

### DELETE /api/scripts/[slug]

Delete a script and all associated data. Requires admin authentication.

**Request:**
```http
DELETE /api/scripts/bloxatlas
Authorization: Bearer <ADMIN_API_KEY>
```

**Success (200):**
```json
{
  "success": true,
  "message": "Script deleted"
}
```

Cascade deletes: all `script_versions` and `script_downloads` for this script are also removed.

**Response Table:**
| HTTP | Body | Meaning |
|------|------|---------|
| 200 | `{ "success": true, "message": "Script deleted" }` | Script deleted |
| 400 | `{ "success": false, "message": "Invalid slug format" }` | Slug validation failed |
| 401 | `{ "success": false, "message": "Unauthorized" }` | Missing admin key |
| 404 | `{ "success": false, "message": "Script not found" }` | Slug does not exist |
| 500 | `{ "success": false, "message": "Failed to delete script" }` | Internal server error |

No rate limiting is applied to DELETE operations.

---

### POST /api/scripts/[slug]/publish

Change script visibility. Requires admin authentication.

**Request:**
```http
POST /api/scripts/bloxatlas/publish
Content-Type: application/json
Authorization: Bearer <ADMIN_API_KEY>

{
  "visibility": "public"
}
```

`visibility` must be one of: `"public"`, `"private"`, `"unlisted"`.

**Success (200):**
```json
{
  "success": true,
  "script": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "slug": "bloxatlas",
    "name": "BloxAtlas",
    "description": "...",
    "visibility": "public",
    "creator_id": null,
    "current_version_id": "660e8400-e29b-41d4-a716-446655440001",
    "created_at": "2026-06-07T09:00:00.000Z",
    "updated_at": "2026-06-07T10:30:00.000Z"
  }
}
```

**Response Table:**
| HTTP | Body | Meaning |
|------|------|---------|
| 200 | `{ "success": true, "script": {...} }` | Visibility updated |
| 400 | `{ "success": false, "message": "Invalid visibility. Must be public, private, or unlisted" }` | Invalid visibility |
| 401 | `{ "success": false, "message": "Unauthorized" }` | Missing admin key |
| 404 | `{ "success": false, "message": "Script not found" }` | Slug does not exist |
| 429 | `{ "success": false, "message": "Too many requests. Please try again later." }` | Rate limit exceeded |
| 500 | `{ "success": false, "message": "Failed to update visibility" }` | Internal server error |

**Rate Limit:** 60 requests per hour per IP (`SCRIPT_UPDATE`).

---

### GET /api/scripts/[slug]/raw

Get raw script content. Returns `text/plain` (not JSON).

**Request:**
```http
GET /api/scripts/bloxatlas/raw
```

**Success (200):**
```
Content-Type: text/plain; charset=utf-8
Cache-Control: public, max-age=300, s-maxage=3600

loadstring(game:HttpGet('https://...'))()
```

**Cache Headers:**
- `max-age=300` — browsers cache for 5 minutes
- `s-maxage=3600` — shared caches (CDN) cache for 1 hour

**Response Table:**
| HTTP | Body | Meaning |
|------|------|---------|
| 200 | Raw script content (`text/plain`) | Content delivered |
| 400 | `{ "success": false, "message": "Invalid slug format" }` | Slug validation failed |
| 403 | `{ "success": false, "message": "This script is private" }` | Private script without auth |
| 404 | `{ "success": false, "message": "Script not found" }` | Slug does not exist or no published version |
| 429 | `{ "success": false, "message": "Too many requests. Please try again later." }` | Rate limit exceeded |
| 500 | `{ "success": false, "message": "Failed to fetch script content" }` | Internal server error |

**Error responses return JSON** (not text/plain). This ensures clients that expect JSON error objects work correctly.

**Private Scripts:** When `visibility = "private"`, the raw endpoint returns 403 unless the request includes `Authorization: Bearer <ADMIN_API_KEY>`.

**Rate Limit:** 100 requests per minute per IP (`SCRIPT_RAW`).

---

### GET /api/scripts/[slug]/stats

Get download analytics for a script.

**Request:**
```http
GET /api/scripts/bloxatlas/stats
```

**Success (200):**
```json
{
  "success": true,
  "stats": {
    "slug": "bloxatlas",
    "total_downloads": 1523,
    "unique_ips": 847,
    "downloads_today": 42,
    "downloads_this_week": 0,
    "last_downloaded_at": "2026-06-07T18:30:00.000Z"
  }
}
```

**Stats Fields:**
| Field | Description |
|-------|-------------|
| `total_downloads` | All-time download count |
| `unique_ips` | Unique hashed IP addresses |
| `downloads_today` | Downloads since midnight UTC |
| `downloads_this_week` | Downloads this calendar week |
| `last_downloaded_at` | Timestamp of most recent download |

**Response Table:**
| HTTP | Body | Meaning |
|------|------|---------|
| 200 | `{ "success": true, "stats": {...} }` | Stats returned |
| 400 | `{ "success": false, "message": "Invalid slug format" }` | Slug validation failed |
| 404 | `{ "success": false, "message": "Script not found" }` | Slug does not exist |
| 429 | `{ "success": false, "message": "Too many requests. Please try again later." }` | Rate limit exceeded |
| 500 | `{ "success": false, "message": "Failed to fetch stats" }` | Internal server error |

**Rate Limit:** 30 requests per minute per IP (`SCRIPT_STATS`).

---

## Dashboard API Endpoints

Dashboard endpoints serve the Creator Dashboard and are authenticated via Supabase session cookies. All write operations derive `creator_id` from the authenticated session — never from client payloads. Ownership is enforced at the service and repository layers.

### GET /api/dashboard/scripts

List scripts owned by the authenticated creator. Supports pagination, search, and visibility filtering.

**Request:**
```http
GET /api/dashboard/scripts?limit=12&offset=0&visibility=public&search=term
```

**Query Parameters:**
| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `limit` | 20 | 100 | Results per page |
| `offset` | 0 | — | Pagination offset |
| `visibility` | — | — | Filter: `public`, `private`, or `unlisted` |
| `search` | — | — | Case-insensitive search on name and slug |

**Success (200):**
```json
{
  "success": true,
  "scripts": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "slug": "bloxatlas",
      "name": "BloxAtlas",
      "description": "Universal ESP and aimbot",
      "visibility": "public",
      "creator_id": "uuid-of-authenticated-creator",
      "current_version_id": "660e8400-e29b-41d4-a716-446655440001",
      "created_at": "2026-06-07T09:00:00.000Z",
      "updated_at": "2026-06-07T09:00:00.000Z"
    }
  ],
  "total": 5,
  "limit": 12,
  "offset": 0
}
```

**Response Table:**
| HTTP | Body | Meaning |
|------|------|---------|
| 200 | scripts list | Scripts returned |
| 401 | error | Missing/invalid session |
| 429 | rate limit | Too many requests |

**Rate Limit:** 60 requests per minute per IP (`DASHBOARD_SCRIPTS_LIST`).

---

### POST /api/dashboard/scripts

Create a new script owned by the authenticated creator.

**Request:**
```http
POST /api/dashboard/scripts
Content-Type: application/json

{
  "slug": "my-script",
  "name": "My Script",
  "description": "Description",
  "visibility": "private",
  "content": "-- placeholder content"
}
```

| Field | Required | Type | Constraints |
|-------|----------|------|-------------|
| `slug` | Yes | string | 3-64 chars, lowercase alphanumeric + hyphens |
| `name` | Yes | string | 1-100 characters |
| `content` | Yes | string | Non-empty, max 62 KB |
| `visibility` | No | string | Defaults to `private` |
| `description` | No | string | Any string |

**Success (201):**
```json
{
  "success": true,
  "script": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "slug": "my-script",
    "name": "My Script",
    "description": "Description",
    "visibility": "private",
    "creator_id": "509ed267-...",
    "current_version_id": "660e8400-...",
    "created_at": "2026-06-07T09:00:00.000Z",
    "updated_at": "2026-06-07T09:00:00.000Z"
  }
}
```

**Response Table:**
| HTTP | Body | Meaning |
|------|------|---------|
| 201 | script object | Script created |
| 400 | error | Validation error |
| 401 | error | Missing/invalid session |
| 409 | error | Slug already exists |
| 429 | rate limit | Too many requests |

**Rate Limit:** 30 requests per hour per IP (`DASHBOARD_SCRIPTS_CREATE`).

---

### GET /api/dashboard/scripts/[slug]

Get script metadata for a script owned by the authenticated creator.

**Success (200):** Same response shape as `GET /api/scripts/[slug]`.

**Response Table:**
| HTTP | Body | Meaning |
|------|------|---------|
| 200 | script object | Script found |
| 401 | error | Missing/invalid session |
| 404 | error | Script not found or not owned |
| 429 | rate limit | Too many requests |

**Rate Limit:** 60 requests per minute per IP (`DASHBOARD_SCRIPTS_GET`).

---

### PATCH /api/dashboard/scripts/[slug]

Update script metadata for a script owned by the authenticated creator. Content updates create new versions.

**Request:**
```http
PATCH /api/dashboard/scripts/my-script
Content-Type: application/json

{
  "name": "Updated Name",
  "description": "New description",
  "visibility": "public",
  "content": "-- updated content"
}
```

All fields are optional. Only provided fields are updated. When `content` is provided and differs from current content, a new version row is auto-created.

**Success (200):** Same response shape as `PATCH /api/scripts/[slug]`.

**Response Table:**
| HTTP | Body | Meaning |
|------|------|---------|
| 200 | script object | Script updated |
| 400 | error | Validation error |
| 401 | error | Missing/invalid session |
| 404 | error | Script not found or not owned |
| 429 | rate limit | Too many requests |

**Rate Limit:** 60 requests per hour per IP (`DASHBOARD_SCRIPTS_UPDATE`).

---

### DELETE /api/dashboard/scripts/[slug]

Delete a script owned by the authenticated creator and all associated data.

**Success (200):**
```json
{
  "success": true,
  "message": "Script deleted"
}
```

**Response Table:**
| HTTP | Body | Meaning |
|------|------|---------|
| 200 | success | Script deleted |
| 401 | error | Missing/invalid session |
| 404 | error | Script not found or not owned |
| 429 | rate limit | Too many requests |

**Rate Limit:** 30 requests per hour per IP (`DASHBOARD_SCRIPTS_DELETE`).

---

### GET /api/dashboard/scripts/[slug]/stats

Get per-script analytics for a script owned by the authenticated creator.

**Success (200):**
```json
{
  "success": true,
  "analytics": {
    "slug": "my-script",
    "total_downloads": 150,
    "downloads_today": 5,
    "downloads_7d": 42,
    "downloads_30d": 120,
    "last_downloaded_at": "2026-06-07T18:30:00.000Z"
  }
}
```

**Rate Limit:** 30 requests per minute per IP (`DASHBOARD_ANALYTICS_STATS`).

---

### GET /api/dashboard/analytics/overview

Get portfolio-level analytics for the authenticated creator.

**Success (200):**
```json
{
  "success": true,
  "overview": {
    "total_scripts": 5,
    "published_scripts": 3,
    "private_scripts": 2,
    "total_downloads": 1500,
    "downloads_today": 50,
    "downloads_7d": 300,
    "downloads_30d": 1200
  }
}
```

**Rate Limit:** 30 requests per minute per IP (`DASHBOARD_ANALYTICS_OVERVIEW`).

---

### GET /api/dashboard/analytics/downloads

Get download trends for the authenticated creator. Supports full-portfolio or per-script trends.

**Query Parameters:**
| Parameter | Required | Description |
|-----------|----------|-------------|
| `range` | Yes | `7d` or `30d` |
| `slug` | No | Script slug for per-script trends |

**Success (200):**
```json
{
  "success": true,
  "trends": {
    "points": [
      { "day": "2026-05-09", "downloads": 12 },
      { "day": "2026-05-10", "downloads": 25 }
    ]
  }
}
```

**Rate Limit:** 30 requests per minute per IP (`DASHBOARD_ANALYTICS_DOWNLOADS`).

---

### GET /api/dashboard/scripts/[slug]/versions

List versions for a script owned by the authenticated creator.

**Query Parameters:**
| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `limit` | 20 | 100 | Results per page |
| `offset` | 0 | — | Pagination offset |

**Success (200):**
```json
{
  "success": true,
  "versions": [
    {
      "id": "v10-uuid",
      "script_id": "script-uuid",
      "version": "1.0.2",
      "changelog": "Fixed bug",
      "created_at": "2026-06-07T09:00:00.000Z"
    }
  ],
  "total": 3,
  "limit": 10,
  "offset": 0
}
```

**Note:** The `content` field is not returned in the version list. Use `/api/dashboard/scripts/[slug]/versions/[versionId]` for full version content.

**Rate Limit:** 60 requests per minute per IP (`DASHBOARD_VERSIONS_LIST`).

---

### GET /api/dashboard/scripts/[slug]/versions/[versionId]

Get full version detail for a version belonging to a script owned by the authenticated creator.

**Success (200):**
```json
{
  "success": true,
  "version": {
    "id": "v10-uuid",
    "script_id": "script-uuid",
    "version": "1.0.2",
    "content": "-- full script content",
    "changelog": "Fixed bug",
    "created_at": "2026-06-07T09:00:00.000Z"
  }
}
```

Cross-script isolation: version IDs from a different script return 404.

**Rate Limit:** 60 requests per minute per IP (`DASHBOARD_VERSIONS_GET`).

---

## Key Format

**Pattern:** `LUXY-XXXX-XXXX-XXXX`

**Regex:** `/^LUXY-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/`

- 4 segments separated by hyphens
- First segment always `LUXY` (case-sensitive, uppercase)
- Remaining 3 segments: exactly 4 uppercase alphanumeric characters each
- Generated using `crypto.getRandomValues()` (cryptographically secure PRNG)
- Example valid: `LUXY-ABCD-EFGH-IJKL`, `LUXY-0T2L-V9YT-Q1NA`
- Example invalid: `luxy-abcd-efgh-ijkl` (lowercase), `LUXY-ABC-DEFG-HIJK` (wrong lengths)

Keys expire 24 hours after generation.

---

## Rate Limits

| Endpoint | Window | Limit | Scope |
|----------|--------|-------|-------|
| `GET /api/health` | — | Unlimited | None |
| `POST /api/validate` | 1 minute | 30 requests | Per IP |
| `POST /api/verify-workink` | 1 minute | 10 requests | Per IP |
| `POST /api/generate-key` | 24 hours | 5 keys | Per IP |
| `POST /api/cleanup` | — | Unlimited | Cron secret |
| `GET /api/scripts` | 1 minute | 30 requests | Per IP |
| `POST /api/scripts` | 1 hour | 30 requests | Per IP + Session |
| `GET /api/scripts/[slug]` | 1 minute | 60 requests | Per IP |
| `PATCH /api/scripts/[slug]` | 1 hour | 60 requests | Per IP + Session |
| `DELETE /api/scripts/[slug]` | 1 hour | 30 requests | Per IP + Session |
| `POST /api/scripts/[slug]/publish` | 1 hour | 60 requests | Per IP + Session |
| `GET /api/scripts/[slug]/raw` | 1 minute | 100 requests | Per IP |
| `GET /api/scripts/[slug]/stats` | 1 minute | 30 requests | Per IP |
| `GET /api/dashboard/scripts` | 1 minute | 60 requests | Per IP + Session |
| `POST /api/dashboard/scripts` | 1 hour | 30 requests | Per IP + Session |
| `GET /api/dashboard/scripts/[slug]` | 1 minute | 60 requests | Per IP + Session |
| `PATCH /api/dashboard/scripts/[slug]` | 1 hour | 60 requests | Per IP + Session |
| `DELETE /api/dashboard/scripts/[slug]` | 1 hour | 30 requests | Per IP + Session |
| `GET /api/dashboard/scripts/[slug]/stats` | 1 minute | 30 requests | Per IP + Session |
| `GET /api/dashboard/analytics/overview` | 1 minute | 30 requests | Per IP + Session |
| `GET /api/dashboard/analytics/downloads` | 1 minute | 30 requests | Per IP + Session |
| `GET /api/dashboard/scripts/[slug]/versions` | 1 minute | 60 requests | Per IP + Session |
| `GET /api/dashboard/scripts/[slug]/versions/[versionId]` | 1 minute | 60 requests | Per IP + Session |

Rate-limited responses (HTTP 429) include a `Retry-After` header with the number of seconds until the window resets.

IP extraction priority on Vercel: `x-vercel-forwarded-for` → rightmost `x-forwarded-for` → `x-real-ip`.

---

## Security Headers

All API responses include:

| Header | Value |
|--------|-------|
| `Access-Control-Allow-Origin` | `*` |
| `Access-Control-Allow-Methods` | `GET, POST, OPTIONS` |
| `Access-Control-Allow-Headers` | `Content-Type, Authorization` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |

Request body maximum: **64 KB** (returns HTTP 413 if exceeded).
