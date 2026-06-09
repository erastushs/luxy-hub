# Phase 8 — Event Reporting & Webhook Platform Architecture

Status: Planning (Future)
Date: 2026-06-09
Scope: Architecture and roadmap only. No implementation, migrations, API changes, delivery behavior changes, or loader modifications.

## 1. Goals

Allow Roblox scripts delivered by LuxyHub to securely report events to external providers without exposing provider credentials inside Lua scripts.

- Discord webhook URLs never appear inside Lua source code.
- LuxyHub is the sole holder of provider credentials.
- Events are validated, rate-limited, replay-protected, and queued before delivery.
- Provider outages do not block event acceptance or cause data loss.

## 2. Architecture Overview

### 2.1 Relationship to Existing System

```
Phase 5-7 (existing)
┌──────────────────────────────────────┐
│ Delivery Session Validation           │
│ License Authorization                │
│ Runtime Payload Delivery             │
└──────────────────────────────────────┘
                    │
                    │ session_token issued at delivery
                    v
Phase 8 (new)
┌──────────────────────────────────────┐
│ Event Reporting API                  │
│  └─ Session validation               │
│  └─ Signature validation             │
│  └─ Replay protection                │
│  └─ Rate limiting                    │
│  └─ Event storage                    │
│                                      │
│ Webhook Queue                        │
│  └─ Database-backed queue            │
│  └─ Retry with backoff               │
│  └─ Dead-letter handling             │
│                                      │
│ Provider Adapters                    │
│  └─ Discord                          │
│  └─ Telegram                         │
│  └─ Slack                            │
│  └─ Email (future)                   │
└──────────────────────────────────────┘
```

### 2.2 Key Principle: Never Expose Credentials

The core security invariant:

```
WRONG (never do this):  script contains raw Discord webhook URL
RIGHT (Phase 8):        script contains session_token → LuxyHub proxies to Discord
```

Lua scripts only know their delivery session token and event names. LuxyHub holds the mapping of script → webhook config → provider credentials. This is architecturally identical to how delivery sessions work: the script gets a transient session token, not the encrypted build payload directly.

## 3. Event Flow

### 3.1 End-to-End

```
Roblox Script
  |
  | (has delivery session_token from bootstrap)
  |
  | POST /api/events/report
  | {
  |   session_token: "eyJ...",
  |   event:        "execute",
  |   timestamp:    1717891200,
  |   nonce:        "abc123...",
  |   signature:    "sha256hmac...",
  |   data:         { ... }
  | }
  v
Session Validation                    (reuses existing delivery session infra)
  |
  | lookup session by token hash
  | verify session not expired (60s TTL)
  | verify session not consumed (event sessions are multi-use — see §3.2)
  v
Signature Validation
  |
  | HMAC(event + timestamp + nonce + data, session_secret)
  | reject if signature mismatch
  v
Replay Protection
  |
  | check nonce not seen before (T = session TTL window)
  | reject if replayed
  v
Timestamp Validation
  |
  | abs(now - timestamp) <= 60s
  | reject if too skewed
  v
Rate Limiting
  |
  | check event rate per script + event type
  | return 429 if exceeded
  v
Event Storage
  |
  | write to event_logs (idempotent by nonce)
  | return 202 Accepted
  v
Queue Worker (async, separate from API response)
  |
  | poll event_logs WHERE delivered = false
  | lookup webhook_config for script
  | invoke provider adapter
  | on success: mark delivered, record timestamp
  | on failure: increment retry_count, backoff
  | after N retries: move to dead-letter
```

### 3.2 Session Model for Events

The event endpoint reuses delivery session validation but introduces a multi-use session concept for events:

| Aspect | Delivery Session | Event Session |
|--------|-----------------|---------------|
| Token | One-time, consumed on fetch | Multi-use within TTL window |
| Purpose | Retrieve runtime payload | Report events |
| TTL | 60s | 60s (same window) |
| Rate limit | N/A (one use) | Per script + event type |
| Secret | Session token | Session token (source for HMAC) |

Implementation note: a single delivery session token can gate both delivery fetch (once) and event reporting (multiple, rate-limited). The token is NOT "consumed" by event reporting — only by delivery fetch. This keeps the existing one-time delivery guarantee while allowing multiple events from the same session.

### 3.3 Event Schema

```json
{
  "session_token": "string (required)",
  "event": "string (required, must be in allowed registry)",
  "timestamp": "number (required, Unix seconds)",
  "nonce": "string (required, random 32 hex chars)",
  "signature": "string (required, HMAC-SHA256 hex)",
  "data": "object (optional, provider-specific payload)"
}
```

### 3.4 Allowed Event Registry

Events are allowlisted. Only registered event names are accepted.

```
execute       — script started execution
purchase      — in-script purchase completed
error         — script encountered an error
ban           — user banned by script logic
key_redeem    — license key redeemed in-script
heartbeat     — script alive signal
enter_world   — player entered a game world
leave_world   — player left a game world
```

Unknown event names return `422 Unprocessable Entity` with `"Unknown event type"`.

### 3.5 Signature Construction

The Lua-side signature is computed as:

```
signature = HMAC-SHA256(
    event_name + ":" + timestamp + ":" + nonce + ":" + JSON.stringify(data),
    session_token
)
```

The session token acts as the shared secret. Since the bootstrap already contains the session token and the loader runtime already has access to it, no additional key distribution is needed.

This is validated server-side by recomputing the HMAC from the session token stored in the database. If token hashing prevents direct comparison, a separate `session_secret` (plaintext, not hashed, stored alongside the hash) is needed — or the event session uses a derived event secret issued at session creation time.

## 4. Security Model

### 4.1 Principles

1. **Never expose provider URLs to Lua.** Discord webhook URLs, Telegram bot tokens, Slack webhook URLs — all stored server-side in `webhook_config`, never shipped to the client.
2. **Never create a generic webhook relay.** Only allowlisted event types are accepted. No arbitrary URL posting. No open relay.
3. **Reuse existing session validation.** The event endpoint validates the same delivery session token, inheriting all existing session security.
4. **Replay protection via nonces.** Each event carries a random nonce. Nonces are checked server-side within the session TTL window.
5. **Rate limiting per script + event type.** Prevents a compromised or malicious script from flooding the webhook provider.
6. **Timestamp tolerance.** Events with timestamps >60s from server time are rejected.
7. **Signature verification before storage.** Invalid signatures never hit the queue — cheap rejection at the API boundary.

### 4.2 Abuse Prevention

| Threat | Mitigation |
|--------|-----------|
| Script floods Discord | Rate limit per script + event type (e.g., 1/sec, 60/min) |
| Replayed event | Nonce uniqueness check within session TTL |
| Tampered event data | HMAC signature validation |
| Expired session used for events | Same 60s session TTL as delivery |
| Unknown event type | Allowlist registry — 422 for unregistered events |
| Provider credential leak | Credentials never leave the server |
| Open relay attack | No arbitrary URL/webhook parameter accepted |
| Session token brute-force | Inherits delivery session rate limiting (20 req/min/IP) |

### 4.3 Event vs Delivery Error Response Consistency

Following the existing pattern (uniform `Invalid delivery session` for all session failures, uniform `Invalid or revoked license` for license failures):

| Error Condition | Response |
|----------------|---------|
| Invalid/missing/expired session | `401 Invalid event session` |
| Invalid signature | `401 Invalid event session` |
| Replayed nonce | `401 Invalid event session` |
| Unknown event type | `422 Unknown event type` |
| Rate limited | `429 Too many events` |
| Timestamp skewed | `400 Invalid event timestamp` |
| Success | `202 Accepted` |

The `401` responses are uniform — no oracle for whether the failure was session, signature, or nonce.

## 5. Queue Model

### 5.1 Database-Backed Queue

The queue is a database table, not an external message broker. This keeps the deployment simple (no Redis/RabbitMQ dependency) and ensures events survive process restarts.

```
event_logs table:
  id              uuid PK
  script_id       uuid FK
  session_id      uuid FK
  event           text
  timestamp       timestamptz (client-claimed)
  received_at     timestamptz (server wall clock)
  nonce           text UNIQUE
  data            jsonb
  delivered       boolean DEFAULT false
  retry_count     int DEFAULT 0
  last_retry_at   timestamptz
  delivered_at    timestamptz
  error_message   text
  dead_letter     boolean DEFAULT false
```

### 5.2 Worker Model

The worker is a simple polling loop — either a Vercel Cron Job or an in-process interval:

```
Every 5-10 seconds:
  SELECT * FROM event_logs
  WHERE delivered = false
    AND dead_letter = false
    AND retry_count < 5
  ORDER BY received_at ASC
  LIMIT 50

  FOR each event:
    invoke provider adapter
    on success → UPDATE delivered = true, delivered_at = now()
    on failure → UPDATE retry_count += 1, last_retry_at = now(), error_message = ...
    on retry_count >= 5 → UPDATE dead_letter = true
```

### 5.3 Retry Strategy

- Exponential backoff: retry at 10s, 30s, 90s, 270s, 810s
- Max 5 retries before dead-letter
- Dead-letter events are visible in dashboard for manual replay
- Provider outage does NOT return 5xx from `/api/events/report` — the API returns 202 as soon as the event is stored

### 5.4 Guarantees

- **At-least-once delivery**: events are retried until success or dead-letter.
- **No blocking**: API returns 202 immediately after storage — never waits for webhook delivery.
- **Crash-safe**: events in the database survive process restarts.
- **Ordering**: best-effort. Events from the same script are processed in `received_at` order, but provider latency can reorder visible delivery.

## 6. Provider Model

### 6.1 Abstraction

```typescript
// Future interface — planning only
interface WebhookProvider {
  name: string;                    // "discord", "telegram", "slack"
  deliver(event: EventLog): Promise<DeliverResult>;
  validate(config: WebhookConfig): Promise<ValidationResult>;
  formatPayload(event: EventLog, config: WebhookConfig): ProviderPayload;
}

type DeliverResult =
  | { success: true; providerId: string }
  | { success: false; error: string; retryable: boolean };
```

Each provider receives the event data and the webhook config, formats the provider-specific payload, and posts it to the provider's API. The abstraction isolates provider-specific logic from the queue worker.

### 6.2 Discord Provider

```typescript
// Webhook config stored in webhook_config:
{
  provider: "discord",
  webhook_url: "https://discord.com/api/webhooks/...",  // server-side only
  enabled: true
}

// Formatted payload:
{
  embeds: [{
    title: "Event: execute",
    description: "Script luxy executed by Player123",
    color: 0x00ff00,
    fields: [
      { name: "Event", value: "execute" },
      { name: "Timestamp", value: "..." }
    ],
    footer: { text: "LuxyHub Event System" }
  }]
}
```

### 6.3 Telegram Provider

```typescript
{
  provider: "telegram",
  bot_token: "...",       // server-side only
  chat_id: "...",         // server-side only
  enabled: true
}
```

### 6.4 Slack Provider

```typescript
{
  provider: "slack",
  webhook_url: "https://hooks.slack.com/services/...",  // server-side only
  enabled: true
}
```

### 6.5 Email Provider (Future)

Not in V1. Requires SMTP config or email service integration.

## 7. Database Additions (Planned)

### `webhook_config` table

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | Primary key |
| `script_id` | uuid | FK to `scripts.id`, UNIQUE |
| `creator_id` | uuid | FK to `auth.users.id` |
| `provider` | text | `discord`, `telegram`, `slack` |
| `config` | jsonb | Provider-specific encrypted config |
| `enabled` | boolean | Default false |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

RLS: owner-aware via `creator_id`, same pattern as `scripts`.

### `event_logs` table

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | Primary key |
| `script_id` | uuid | FK to `scripts.id` |
| `session_id` | uuid | FK to `delivery_sessions.id` |
| `event` | text | Event name from registry |
| `timestamp` | timestamptz | Client-claimed time |
| `received_at` | timestamptz | Server wall clock |
| `nonce` | text | UNIQUE, replay protection |
| `data` | jsonb | Event payload |
| `delivered` | boolean | Default false |
| `retry_count` | int | Default 0 |
| `last_retry_at` | timestamptz | |
| `delivered_at` | timestamptz | |
| `error_message` | text | Last delivery error |
| `dead_letter` | boolean | Default false |

RLS: owner-aware through join with scripts.

## 8. Dashboard Management (Phase 8D)

### 8.1 Webhook Configuration

Per-script webhook settings page in the dashboard:

- **Provider selector**: Discord / Telegram / Slack
- **Webhook URL input** (Discord/Slack) or **Bot Token + Chat ID** (Telegram)
- **Enable/Disable toggle**
- **Test Webhook** button — sends a test event to verify connectivity
- **Delivery Status**: last delivery timestamp, failure count, dead-letter count

### 8.2 Event Viewer

- Event history table with filters (event type, status, date range)
- Event detail view (payload, delivery attempts, error messages)
- Dead-letter queue with manual replay button

## 9. Analytics (Phase 8E)

- Event counts by type (per script, time range)
- Delivery success rate
- Failure counts and rate
- Queue depth (currently undelivered)
- Average delivery latency (received_at → delivered_at)
- Audit log events: `webhook.created`, `webhook.updated`, `webhook.deleted`, `webhook.test_sent`

## 10. Integration with Existing Architecture

### 10.1 Reuses

| Existing Component | How Phase 8 Uses It |
|-------------------|-------------------|
| Delivery sessions | Session token validated for event auth |
| Rate limiter | Per-script + event type rate limiting |
| Audit logging | `webhook.*` audit events |
| RLS / ownership | webhook_config inherits script owner |
| Creator dashboard | New webhook config page in script detail |
| Vercel Cron | Worker polling for queue processing |

### 10.2 Does Not Touch

- Build pipeline
- Encryption
- Runtime payload delivery
- `/api/delivery/session` or `/api/delivery/fetch`
- `/api/loader/[slug]`
- License validation
- Script content storage

### 10.3 New API Route

```
POST /api/events/report
```

This is the only new API surface. It lives alongside existing delivery routes under `/api/`.

## 11. Migration Strategy

1. Deploy `webhook_config` and `event_logs` tables.
2. Deploy `/api/events/report` endpoint with session validation, signature check, replay protection.
3. Queue is initially empty — no webhook configs created.
4. Creators opt in by configuring a webhook provider in the dashboard.
5. Until a webhook is configured, `/api/events/report` accepts events (stores them) but the queue worker has nothing to deliver.
6. No behavior change for existing scripts or loaders.

## 12. Security Edge Cases

### 12.1 Session Token as HMAC Secret

The session token must be available in plaintext for HMAC validation. Currently, delivery sessions store `session_token_hash` (SHA-256). For events, either:
- Store a separate `event_secret` (plaintext) alongside the hash at session creation; or
- Send the event secret in the session response body alongside `session_token`.

The event secret is NOT the delivery session token — it's a derived secret so that even if an event is intercepted, the delivery session token cannot be reconstructed.

### 12.2 Lua-Side Signature Implementation

The loader runtime (previously Phase 6H) must include an HMAC-SHA256 implementation. This is a pure-Lua computation — no external HTTP, no native code. The existing loader model (bootstrap → session → fetch → execute) would need a minor addition: the event secret is passed alongside the session token in the bootstrap response.

### 12.3 Event Secret Lifetime

The event secret is tied to the delivery session TTL (60s). After 60s, the session expires and events are rejected. For long-running scripts that need to report events beyond 60s, a session refresh mechanism would be needed — this is a Phase 8+ consideration.

## 13. Future Integrations

### 13.1 Phase 7 License Events

Once Phase 7 license management is implemented, event types like `key_redeem` and `license_check` can feed into license analytics.

### 13.2 Provider Ecosystem

Future providers:
- **Email** — SMTP or SendGrid integration for alert emails
- **Custom webhook** — creator-specified URL (with strict rate limiting, not open relay)
- **Analytics sink** — push events to external analytics platforms

### 13.3 Event Fan-Out

One script → multiple webhook configs (e.g., Discord + Telegram simultaneously). Not in V1.

## 14. Scaling Considerations

| Concern | Approach |
|---------|---------|
| Queue depth under load | DB-backed queue scales with PostgreSQL; Vercel Cron polls every 5-10s |
| Discord rate limits | Per-script rate limit prevents hitting Discord global limits |
| Event storage growth | Periodic cleanup of delivered events >30 days old |
| Worker throughput | 50 events per poll cycle; scale by shortening poll interval |
| HMAC computation cost | SHA-256 is cheap server-side; no meaningful latency impact |
| Session token lookup | Hashed lookup with index; same cost as delivery fetch validation |

## 15. Architecture Decisions Summary

| Decision | Rationale |
|----------|-----------|
| DB-backed queue over Redis/RabbitMQ | Zero new infrastructure; crash-safe; simple |
| Reuse delivery sessions for auth | No new auth system; inherits all existing session security |
| Allowlisted event types | Prevents open relay; explicit contract |
| 202 Accepted immediately | Provider outage never blocks API response |
| HMAC signature from session-derived secret | No key distribution problem; session already shared |
| Uniform 401 for auth failures | Prevents oracle attacks (matches existing pattern) |
| Provider abstraction layer | Discord first, but Telegram/Slack/Email are first-class future paths |
| Multi-use event session vs one-time delivery | Different use cases; 60s TTL is sufficient for initial event window |

## 16. Conflicts & Risks

### No Conflicts Found

- Phase 8 is additive — it sits alongside the existing delivery stack without modifying it.
- No API route collisions — `/api/events/report` is a new path.
- No database conflicts — new tables only.
- No loader changes to the delivery flow — only an optional event reporting path.

### Risks

- **Lua HMAC implementation**: Pure-Lua SHA-256 HMAC may have performance characteristics that need testing. Mitigation: benchmark in real executors early.
- **Event secret lifecycle**: 60s session TTL limits long-running script event reporting. Mitigation: document as V1 limitation; session refresh in Phase 8+.
- **Queue worker reliability**: Vercel Cron has cooldown between invocations; very high event volumes could cause queue backlog. Mitigation: monitor queue depth; consider dedicated worker in Phase 8+.
- **Creator misconfiguration**: Incorrect webhook URL causes delivery failures. Mitigation: "Test Webhook" button validates connectivity before enabling.
