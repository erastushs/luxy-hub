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

No rate limiting is applied to this endpoint.

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
| `POST /api/cleanup` | — | Unlimited | Bearer auth |

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
