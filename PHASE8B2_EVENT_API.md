# Phase 8B.2 — Event Reporting API

Status: Implemented
Date: 2026-06-09
Scope: Secure event ingestion API only

## Scope Boundary

Implemented:

- `POST /api/events/report`
- `app/lib/services/event-reporting-service.ts`
- `app/api/events/report/route.ts`
- session validation for event sessions
- event-type allowlist enforcement
- HMAC-SHA256 signature validation
- nonce uniqueness check
- timestamp skew check
- per-session rate limiting
- event persistence into `event_logs`

Not implemented in this phase:

- Discord delivery
- Telegram delivery
- Slack delivery
- queue worker / polling loop
- cron jobs
- dashboard pages
- provider integrations

## Request Schema

```
POST /api/events/report
Content-Type: application/json
```

Body:

| Field | Type | Constraint |
|-------|------|------------|
| `sessionId` | string | 44–256 chars, base64url session token |
| `event` | string | allowed event type (see below) |
| `timestamp` | number | Unix seconds, ±300s of server clock |
| `nonce` | string | 32 lowercase hex chars |
| `signature` | string | 64 lowercase hex chars |
| `payload` | object | ≤ 4096 bytes JSON-encoded |

Example:

```json
{
  "sessionId": "abc...base64url...xyz",
  "event": "execute",
  "timestamp": 1749400000,
  "nonce": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
  "signature": "fb8a...64 hex chars...7c1e",
  "payload": { "player": "Player1" }
}
```

## Response Schema

**Success (200):**

```json
{ "success": true }
```

**Failure:**

```json
{ "success": false, "message": "..." }
```

Standard headers: `Cache-Control: no-store` on all responses.

## Validation Flow

Six gates, executed in order:

1. **Input shape** — JSON parse, field coercion. Malformed → 400.
2. **Event type** — server-enforced allowlist. Unknown → 422 "Unknown event type".
3. **Timestamp** — Unix seconds. `abs(now - ts) > 300s` → 400 "Invalid event timestamp".
4. **Nonce + signature format** — regex validation. Malformed → 400 "Invalid event payload".
5. **Session + HMAC** — uniform rejection. Covers:
   - session not found, expired, missing `event_secret` → 401 "Invalid event session"
   - HMAC-SHA256 mismatch (constant-time comparison) → 401 "Invalid event session"
6. **Replay** — nonce already seen for this session → 401 "Invalid event session"
7. **Rate limit** — 10 requests per minute per session → 429 "Too many events"
8. **Payload size** — `JSON.stringify(payload).length > 4096` → 413 "Payload too large"
9. **Storage** — INSERT into `event_logs` with `delivery_status = 'pending'`.

## Security Model

### Authentication

Events authenticate using the existing delivery session token. The token is SHA-256 hashed and looked up against `delivery_sessions.session_token_hash`. Sessions consumed for delivery (`consumed_at IS NOT NULL`) are still accepted for events — this is intentional since the same session serves both delivery fetch and subsequent event reporting.

### HMAC Signature

```
HMAC-SHA256(
  event + ":" + timestamp + ":" + nonce + ":" + JSON.stringify(data),
  event_secret
)
```

The `event_secret` is a per-session random value stored in plaintext in `delivery_sessions`. It is NOT the delivery session token. Constant-time comparison (`timingSafeEqual`) prevents timing oracle attacks.

### Defense in Depth

Replay protection is multi-layered:

| Layer | Check | Failure |
|-------|-------|---------|
| Session expiry | `expires_at > now()` | 401 |
| Timestamp skew | `abs(now - client_ts) ≤ 300s` | 400 |
| Nonce uniqueness | Nonce not seen for session | 401 |
| Signature match | HMAC recomputation | 401 |
| Rate limit | ≤10/min per session | 429 |

An attacker must pass all five layers to store an event.

### Uniform Error Responses

All authentication/authorization failures return identical 401 responses to prevent oracle attacks:

```json
{ "success": false, "message": "Invalid event session" }
```

Conditions returning this:

- Session not found
- Session expired
- Session has no `event_secret`
- HMAC signature mismatch
- Nonce replay detected

## Replay Protection Model

Nonce uniqueness is scoped to `(session_id, nonce)`. The application performs a pre-insert lookup via `findEventByNonce()`. Session TTL is 60 seconds — the nonce window is bounded.

Nonce constraint: 32 lowercase hex characters (128 bits of entropy). Collision probability within a 60-second session window at realistic event volumes is negligible.

## Rate Limiting Model

10 requests per minute per session, enforced via the existing `rate_limits` table with endpoint key `EVENT_REPORT:{session_id}`.

No per-IP rate limiting in this phase — IP-based limits are added in later phases.

## Data Flow

```
POST /api/events/report
  |
  v
  route handler parses JSON body
  |
  v
  event-reporting-service.reportEvent()
  |
  ├─ input validation (shape, types, formats)
  ├─ session lookup via token hash
  ├─ HMAC verification (constant-time)
  ├─ nonce replay check
  ├─ rate limit check
  └─ INSERT INTO event_logs (status: pending)
  |
  v
  Response: { "success": true }
```

No provider delivery, no queue polling, no worker process — pure ingestion and persistence.
