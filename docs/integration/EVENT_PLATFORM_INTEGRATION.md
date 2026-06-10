# LuxyHub Event Platform — Integration Guide

> **Audience**: Script developers integrating runtime telemetry and event reporting.
> **Version**: v1 (Event Platform Phase 8)
> **Last updated**: 2026-06-10
>
> Every claim in this document is verified against the actual implementation at
> time of writing. No inferred behavior.

---

## 1. Overview

The Event Platform lets script runtimes report telemetry events (executions,
purchases, errors, etc.) to LuxyHub. Events flow through:

```
Runtime → [Delivery Session] → [Event API] → [Queue] → [Worker/Cron] → [Discord]
```

Key properties:

- **Per-session auth**: Each runtime boot creates a short-lived delivery session
  that doubles as an event auth token.
- **HMAC signatures**: Every event is signed with `event_secret` so LuxyHub can
  verify authenticity without checking a shared key on every call.
- **Replay protection**: Per-session nonce deduplication prevents replay attacks.
- **Rate limiting**: 10 events per session per minute.
- **Payload cap**: 4,096 bytes per event payload.

---

## 2. Delivery Session

The session is the bridge between script delivery and event reporting. When your
loader fetches the script payload, it also receives credentials for reporting
events back.

### 2.1 Create a Session

```
POST /api/delivery/session
Content-Type: application/json
```

**Request body**:

```json
{
  "slug": "your-script-slug"
}
```

- `slug` (required, string): The script's URL slug. Must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`, 3–64 characters.

**Rate limit**: 20 requests/minute/IP (`DELIVERY_SESSION` bucket).

**Success response (200)**:

```json
{
  "session_token": "dGhpcyBpcyBhIGJhc2U2NHVybCBlbmNvZGVkIHN0cmluZw",
  "event_secret": "YW5vdGhlciBiYXNlNjR1cmwgcmFuZG9tIHN0cmluZw",
  "expires_in": 60
}
```

| Field | Type | Description |
|---|---|---|
| `session_token` | string | Base64URL-encoded 32-byte random value. Use as `sessionId` in event reports. |
| `event_secret` | string | Base64URL-encoded 32-byte random value. **Never expose to clients.** Used only server-side to generate event signatures. |
| `expires_in` | integer | TTL in seconds (fixed 60). |

**Error responses**:

| Status | Body | Cause |
|---|---|---|
| 404 | `{"success":false,"message":"Delivery unavailable"}` | Unknown/invalid slug, no ready build, private script, or internal error |
| 429 | `{"success":false,"message":"Too many requests..."}` | IP rate limit exceeded; `Retry-After` header included |

### 2.2 Session Token Purpose

The `session_token` is used as the `sessionId` field in event reports. LuxyHub
maps it to a script and an `event_secret` via SHA-256 hashing (the token is
hashed before storage — the raw token is never persisted).

### 2.3 `event_secret` Purpose

`event_secret` is a symmetric HMAC key. The runtime **must** use it (server-side
only) to sign every event report. The `event_secret` is embedded in the
encrypted delivery payload (`POST /api/delivery/fetch`), so your loader receives
it automatically.

### 2.4 Expiration

Sessions expire 60 seconds after creation. After expiry, event reports with that
`session_token` will receive 401. Your runtime should create a new session on
each boot.

### 2.5 Fetching the Script + Secret Together

The loader endpoint `POST /api/delivery/fetch` consumes the session and returns
both the runtime payload and the `event_secret`:

```
POST /api/delivery/fetch
Content-Type: application/json

{"session_token": "dGhpcyBpcyBhIGJhc2U2NHVybCBlbmNvZGVkIHN0cmluZw"}
```

**Success response (200)** contains `event_secret` along with `runtime_payload`,
`build_version`, `version_id`, and `runtime_format_version`.

**Rate limit**: 40 requests/minute/IP (`DELIVERY_FETCH` bucket).

---

## 3. Event Reporting Endpoint

### 3.1 Endpoint

```
POST /api/events/report
```

### 3.2 Request Format

All fields are in the JSON body. There are no custom headers required.

```json
{
  "sessionId": "<session_token from /api/delivery/session>",
  "event": "execute",
  "timestamp": 1717977600,
  "nonce": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
  "signature": "abc123...64 hex chars...",
  "payload": { "optional": "data" }
}
```

### 3.3 Field Reference

| Field | Type | Required | Validation |
|---|---|---|---|
| `sessionId` | string | **Yes** | 44–256 characters |
| `event` | string | **Yes** | Must be a supported event type (see §6) |
| `timestamp` | number | **Yes** | Unix seconds; ±300s skew allowed |
| `nonce` | string | **Yes** | `/^[a-f0-9]{32}$/` — 32 lowercase hex chars |
| `signature` | string | **Yes** | `/^[a-f0-9]{64}$/` — 64 lowercase hex chars |
| `payload` | any | No | JSON-serializable; max 4,096 bytes when serialized |

### 3.4 Rate Limit

10 events per session per minute. Exceeding this returns **429** with a
`Retry-After` header.

---

## 4. Authentication & Validation

### 4.1 Signature Algorithm

```
HMAC-SHA256(event_secret, payload_string)
```

Where `payload_string` is:

```
{event}:{timestamp}:{nonce}:{JSON-serialized payload}
```

The result is hex-encoded (64 lowercase hex characters).

**Pseudocode**:

```
payload_string = event + ":" + timestamp + ":" + nonce + ":" + JSON.stringify(payload)
signature     = hex(HMAC-SHA256(event_secret, payload_string))
```

### 4.2 Validation Order

The server validates in this order (first failure stops processing):

1. `sessionId` format → 401
2. `event` type → 422
3. `timestamp` type and skew → 400
4. `nonce` format → 400
5. `signature` format → 400
6. `payload` size → 413
7. Session token lookup (hash, expiry check) → 401
8. HMAC signature verification (constant-time comparison) → 401
9. Rate limit check → 429
10. Nonce replay check → 401
11. DB insert → 500 (on unexpected failure)

### 4.3 Replay Protection

Every `nonce` is unique per session. The server stores `(session_id, nonce)` and
rejects duplicates with 401. Generate a fresh random nonce for each event.

### 4.4 Timestamp Requirements

- Must be a finite positive number.
- Must be within ±300 seconds (5 minutes) of server time.
- Sent as Unix epoch seconds (not milliseconds).

### 4.5 Session Validation

The `sessionId` is hashed with SHA-256 before lookup. The session must:
- Exist in the database
- Have an `event_secret` set
- Not be expired (`expires_at > now`)

---

## 5. Payload Schema

The `payload` field is free-form JSON — no enforced schema. Constraints:

- Must be JSON-serializable (objects, arrays, primitives).
- Serialized size ≤ 4,096 bytes.
- Stored as `jsonb` in PostgreSQL.

**Recommendation**: Keep payloads small and flat. Use short field names.
Example:

```json
{
  "placeId": 123456,
  "placeVersion": 58,
  "fps": 59.94,
  "playerCount": 1
}
```

---

## 6. Supported Event Types

| Type | Description |
|---|---|
| `execute` | Script executed successfully. Most common event. |
| `purchase` | In-experience purchase or microtransaction. |
| `error` | Runtime error or exception. |
| `ban` | Player banned or kicked. |
| `key_redeem` | Key/code redeemed in-experience. |
| `heartbeat` | Periodic liveness ping. |
| `license_activate` | License activated for this session. |
| `license_revoke` | License revoked or expired. |

All event types are stored in the DB `event_type` CHECK constraint. Unknown
types receive HTTP 422.

---

## 7. Example Request

### 7.1 Create a Session

```bash
curl -s -X POST https://luxyhub.example.com/api/delivery/session \
  -H "Content-Type: application/json" \
  -d '{"slug":"my-script"}'
```

Response:

```json
{
  "session_token": "abc123base64urlstring",
  "event_secret": "def456base64urlstring",
  "expires_in": 60
}
```

### 7.2 Report an Event

```javascript
// JavaScript/Node.js — server-side only
const crypto = require('crypto');

const sessionToken = "abc123base64urlstring";
const eventSecret  = "def456base64urlstring";
const timestamp    = Math.floor(Date.now() / 1000);
const nonce        = crypto.randomBytes(16).toString('hex');  // 32 hex chars
const event        = "execute";
const payload      = { placeId: 123456 };

// Build signature string
const payloadString = `${event}:${timestamp}:${nonce}:${JSON.stringify(payload)}`;
const signature = crypto
  .createHmac('sha256', eventSecret)
  .update(payloadString)
  .digest('hex');

// Send
const response = await fetch('https://luxyhub.example.com/api/events/report', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: sessionToken,
    event,
    timestamp,
    nonce,
    signature,
    payload,
  }),
});

// { success: true }
console.log(await response.json());
```

### 7.3 `curl` Example

```bash
# These values must be computed, not hardcoded
TIMESTAMP=$(date +%s)
NONCE=$(openssl rand -hex 16)
EVENT="execute"
PAYLOAD='{"placeId":123456}'
EVENT_SECRET="def456base64urlstring"
SESSION_TOKEN="abc123base64urlstring"

# Compute signature
PAYLOAD_STRING="${EVENT}:${TIMESTAMP}:${NONCE}:${PAYLOAD}"
SIGNATURE=$(echo -n "$PAYLOAD_STRING" | openssl dgst -sha256 -hmac "$EVENT_SECRET" | awk '{print $NF}')

# Send event
curl -s -X POST https://luxyhub.example.com/api/events/report \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_TOKEN\",
    \"event\": \"$EVENT\",
    \"timestamp\": $TIMESTAMP,
    \"nonce\": \"$NONCE\",
    \"signature\": \"$SIGNATURE\",
    \"payload\": $PAYLOAD
  }"
```

---

## 8. Error Handling

All error responses follow the shape `{"success": false, "message": "<string>"}`.

| Status | Message | Meaning | Action |
|---|---|---|---|
| **200** | `{"success":true}` | Event accepted and queued. | — |
| **400** | `"Invalid event timestamp"` | Timestamp missing, NaN, or skew >5 min. | Sync clock, retry. |
| **400** | `"Invalid event payload"` | Nonce or signature format invalid. | Check nonce (32 hex) and signature (64 hex). |
| **401** | `"Invalid event session"` | Session expired, unknown, or missing `event_secret`. Also: bad signature, replayed nonce. | Create new session. |
| **403** | — | Not used by event endpoint (used by `/api/delivery/fetch`). | — |
| **404** | — | Not used by event endpoint (used by session creation). | — |
| **413** | `"Payload too large"` | Serialized payload exceeds 4,096 bytes. | Reduce payload size. |
| **422** | `"Unknown event type"` | Event type not in allowed set. | Use a supported type from §6. |
| **429** | `"Too many events"` | Per-session rate limit breached. | Respect `Retry-After` header; throttle. |
| **500** | `"Event rejected"` | Internal server error during DB insert. | Retry with backoff. |

**Important**: 404 and 403 are never returned by `POST /api/events/report`.
They appear on the delivery endpoints (`/api/delivery/session`,
`/api/delivery/fetch`).

---

## 9. Event Processing Flow

```
┌──────────┐    POST /api/delivery/session     ┌──────────────┐
│  Runtime  │ ─────────────────────────────────>│  LuxyHub API  │
│ (Loader)  │<───────────────────────────────── │               │
└──────────┘    session_token + event_secret    └──────┬───────┘
     │                                                 │
     │ POST /api/events/report                         │
     │ (HMAC-signed, per-event)                        │
     │ ──────────────────────────────────────────────> │
     │                                                 │
     │                                    ┌────────────▼──────────┐
     │                                    │   event_logs table     │
     │                                    │   status: pending      │
     │                                    └────────────┬──────────┘
     │                                                 │
     │                                    ┌────────────▼──────────┐
     │                                    │  Cron Worker (5 min)   │
     │                                    │  /api/internal/        │
     │                                    │  event-worker          │
     │                                    └────────────┬──────────┘
     │                                                 │
     │                                    ┌────────────▼──────────┐
     │                                    │  Discord Webhook       │
     │                                    │  POST embed            │
     │                                    └───────────────────────┘
```

1. **Runtime** creates a delivery session, receives `session_token` + `event_secret`.
2. **Runtime** signs each event with HMAC-SHA256 and sends to `/api/events/report`.
3. **API** validates, inserts into `event_logs` with `delivery_status = 'pending'`.
4. **Cron Worker** (`/api/internal/event-worker`, every 5 min) claims pending events
   with a 15-minute lease timeout.
5. **Worker** resolves the `discord` provider, formats an embed, and POSTs to the
   configured Discord webhook URL.
6. **Worker** runs alert evaluation (`checkAlerts()`) inline after processing.

### 9.1 Delivery Statuses

| Status | Meaning |
|---|---|
| `pending` | Queued, not yet delivered. |
| `delivered` | Successfully posted to webhook. |
| `dead_letter` | Failed after max retries (5) or permanent failure. |

### 9.2 Retry Strategy

- Max 5 retries per event.
- Exponential backoff (seconds): `[10, 30, 90, 270, 810]` (×3 multiplier).
- Retryable: network errors, DNS failures, timeouts, HTTP 429, HTTP 5xx.
- Non-retryable (dead-letter): HTTP 400, invalid webhook URL, HTTP 401/403.

### 9.3 Provider Support

**Currently implemented**: Discord only.

Telegram and Slack are valid `provider` values in the database schema but have
no provider implementation. The worker resolves only `"discord"` → a real
provider; everything else returns `null` and events dead-letter with
`"Unknown provider: {name}"`.

---

## 10. Security Notes

### What You MUST Do

- **Keep `event_secret` server-side.** It is the HMAC key. Never send it to
  client devices or include it in client-visible code.
- **Generate a new nonce for every event.** Use `crypto.randomBytes(16)` or
  equivalent.
- **Use constant-time comparison** if you verify signatures yourself (the
  server already does, but your tests should too).
- **Create a fresh session on each runtime boot.** Sessions expire in 60s.
- **Validate the session creation response.** If `POST /api/delivery/session`
  returns 404, the script has no deliverable build — don't retry aggressively.

### What You MUST NOT Do

- **Never reuse nonces.** Replay is detected and rejected with 401.
- **Never hardcode `event_secret`.** It is per-session and derived from the
  delivery flow.
- **Never send `event_secret` in event reports.** The `signature` field proves
  possession; the secret itself must never appear in request bodies.
- **Never use millisecond timestamps.** The API expects Unix seconds.
- **Never exceed 4,096 bytes in `payload`.** Large payloads receive 413.
- **Never report events without a valid session.** Requests with expired or
  unknown `sessionId` receive 401.
