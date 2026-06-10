# Phase 8A — Event Foundation Design

Status: Historical design / Superseded by implementation closeout
Date: 2026-06-10
Scope: Design record only. Current Phase 8 implementation is complete/100% for Discord-backed production scope; see `PHASE8_CLOSEOUT.md`.
Depends on: Phase 6H (Runtime Payload Delivery), Phase 5C (Secure Delivery API)
Coordinates with: Phase 7 (License & Delivery Authorization — still planning)

## 1. Event Platform Scope

### 1.1 Supported Use Cases

Events originate from Roblox scripts that have already obtained a delivery session. The event platform accepts validated, signed, rate-limited reports and delivers them to configured provider webhooks.

**Allowed event types (registry — server-enforced allowlist):**

| Event | Semantic | Typical Timing |
|-------|----------|---------------|
| `execute` | Script started execution on a client | Once per session, near bootstrap completion |
| `purchase` | In-script purchase completed (game pass, product, etc.) | Occasional, user-driven |
| `error` | Script encountered a recoverable or fatal error | Rare, diagnostic |
| `ban` | A player was banned by script logic | Rare, admin action |
| `key_redeem` | License key redeemed in-script | Occasional, Phase 7 integration |
| `heartbeat` | Script alive / periodic health signal | Periodic, ~30-60s intervals |
| `enter_world` | Player entered a tracked game world | Occasional |
| `leave_world` | Player left a tracked game world | Occasional |

**Provider delivery targets:**

| Provider | Phase 8 Status | Use Case |
|----------|----------------|---------|
| Discord | Complete | Creator receives execution, purchase, error notifications via webhook embed |
| Telegram | Deferred | Future bot-delivered messages for mobile-first creators |
| Slack | Deferred | Future team workspace notifications |

### 1.2 Explicitly Unsupported

These are design-time exclusions — they are not "V2" items, they are anti-goals that would break the security model:

- **Arbitrary webhook relay.** Scripts cannot specify a destination URL. The `webhook_config` is owned by the creator, set in the dashboard, and immutable from Lua.
- **Generic HTTP proxy.** Scripts cannot POST arbitrary URLs through the event endpoint. Provider selection is server-side only.
- **User-defined destinations from Lua.** The event schema has no `webhook_url`, `provider`, or `destination` field.
- **Arbitrary event names.** Only registered event types are accepted. Custom event names are rejected with 422.
- **File uploads or binary payloads.** Event data is JSON only, bounded in size (see §2.3).
- **Real-time streaming or WebSocket delivery.** Events are fire-and-report, not pub/sub.
- **Cross-script event sharing.** Events are scoped to the script that owns the session. One script cannot report events on behalf of another.
- **Event fan-out to multiple providers per script in V1.** One webhook config per script. Multi-provider fan-out is deferred.

### 1.3 Trust Boundaries

```
┌─────────────────────────────┐
│  UNTRUSTED: Roblox Executor  │
│  - Session token known       │
│  - Event secret known        │
│  - Can craft arbitrary       │
│    event payloads            │
│  - Can replay within TTL     │
│    (mitigated by nonce)      │
└──────────┬──────────────────┘
           │ HTTPS (TLS)
           v
┌─────────────────────────────┐
│  TRUST BOUNDARY: API Gateway │
│  - Validates session         │
│  - Validates signatures      │
│  - Enforces rate limits      │
│  - Rejects before storage    │
└──────────┬──────────────────┘
           │
           v
┌─────────────────────────────┐
│  TRUSTED: Server             │
│  - event_logs storage        │
│  - Queue worker              │
│  - Provider credentials      │
│  - webhook_config (encrypted)│
└──────────┬──────────────────┘
           │ HTTPS
           v
┌─────────────────────────────┐
│  EXTERNAL: Provider APIs     │
│  - Discord Webhook API       │
│  - Telegram Bot API          │
│  - Slack Incoming Webhook    │
└─────────────────────────────┘
```

Key: The Roblox executor is **untrusted**. It can craft, replay, tamper, or flood. Validation happens at the API boundary — invalid events never reach storage or the queue.

### 1.4 Threat Model

**Threats we defend against:**

| Threat | Mitigation |
|--------|-----------|
| Script floods Discord with events | Rate limit per script + event type |
| Replayed event (same nonce within TTL) | Nonce uniqueness check within session scope |
| Tampered event data (modified en route) | HMAC-SHA256 signature with event_secret |
| Expired session used for events | Session TTL check (same 60s as delivery) |
| Unknown event type (open relay) | Server-side allowlist — 422 for unregistered |
| Provider credential theft from Lua source | Credentials never leave server — not in Lua, not in loader, not in runtime payload |
| Session token brute-force | Inherits delivery session rate limiting |
| Cross-script event spoofing | Session is bound to script_id; event stored with script_id from session, not from request |
| DB compromise exposes provider credentials | Discord/Slack URLs + Telegram tokens encrypted at rest in webhook_config.config |

**Threats we explicitly accept:**

| Threat | Acceptance Rationale |
|--------|---------------------|
| Malicious client with valid session reports fake events | Same as "malicious client can execute code" — Lua is untrusted by definition |
| Event secret extraction from executor memory | Same as "client can dump runtime_payload" — executor is untrusted |
| Creator sets malicious webhook URL in own dashboard | Creator owns their webhook config; they can only hurt themselves |
| Event nonce collision (birthday bound) | 32 hex chars = 128 bits = negligible collision probability within 60s TTL |
| Worker delivery to wrong provider if config corrupted | Same as any DB corruption — mitigated by CHECK constraints and validation |

## 2. Event Data Model Review

### 2.1 `webhook_config` Table

**Purpose:** Store provider credentials per script. One row per script (1:1). Managed through dashboard by creator. Sensitive fields encrypted at rest in `config` column.

**Schema:**

```sql
CREATE TABLE webhook_config (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id     uuid NOT NULL UNIQUE
                REFERENCES scripts(id) ON DELETE CASCADE,
  creator_id    uuid NOT NULL
                REFERENCES auth.users(id) ON DELETE CASCADE,
  provider      text NOT NULL
                CHECK (provider IN ('discord', 'telegram', 'slack')),
  config        jsonb NOT NULL DEFAULT '{}',
  enabled       boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
```

**`config` structure per provider:**

```jsonc
// Discord
{
  "webhook_url": "https://discord.com/api/webhooks/..."  // encrypted at rest in Phase 8B
}

// Telegram
{
  "bot_token": "...",   // encrypted at rest in Phase 8B
  "chat_id": "..."
}

// Slack
{
  "webhook_url": "https://hooks.slack.com/services/..."   // encrypted at rest in Phase 8B
}
```

The `config` column stores provider credentials. At rest in Phase 8A, these are plain JSON (development). In Phase 8B, sensitive fields (`webhook_url`, `bot_token`) will be encrypted before storage using a server-side config encryption key. The schema supports this by using `jsonb` (extensible — keys are never fixed-width).

**Indexes:**

```sql
CREATE INDEX idx_webhook_config_script_id
  ON webhook_config (script_id);                    -- lookup by script at event time

CREATE INDEX idx_webhook_config_creator_id
  ON webhook_config (creator_id);                   -- dashboard listing

CREATE INDEX idx_webhook_config_enabled_provider
  ON webhook_config (enabled, provider)
  WHERE enabled = true;                             -- worker polls only enabled configs
```

**Ownership model:**

- `webhook_config.creator_id` matches `scripts.creator_id` (set on creation, validated on update).
- RLS policy: owner-aware — creator can read/write own configs; service-role for worker delivery.
- Deletion: `ON DELETE CASCADE` from `scripts` — when a script is deleted, its webhook config is removed.
- Uniqueness: `script_id UNIQUE` — one webhook config per script in V1.

**Audit requirements (Phase 8E):**

| Action | Trigger |
|--------|---------|
| `webhook.created` | Config row inserted |
| `webhook.updated` | Config row updated (provider, enabled, config changed) |
| `webhook.deleted` | Config row deleted (script deleted, or explicit removal) |
| `webhook.test_sent` | Test webhook button clicked in dashboard |

**Retention strategy:**

Webhook configs live as long as the parent script. On script deletion, cascade removes the config. No separate retention policy needed — configs are small and scarce (one per script, at most).

### 2.2 `event_logs` Table

**Purpose:** Store validated events for async delivery. Acts as the queue backing store and the delivery audit trail.

**Schema:**

```sql
CREATE TABLE event_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id       uuid NOT NULL
                  REFERENCES scripts(id) ON DELETE CASCADE,
  session_id      uuid NOT NULL
                  REFERENCES delivery_sessions(id) ON DELETE SET NULL,
  event           text NOT NULL
                  CHECK (event IN (
                    'execute', 'purchase', 'error', 'ban',
                    'key_redeem', 'heartbeat',
                    'enter_world', 'leave_world'
                  )),
  timestamp       timestamptz NOT NULL,          -- client-claimed
  received_at     timestamptz NOT NULL DEFAULT now(), -- server wall clock
  nonce           text NOT NULL,
  data            jsonb DEFAULT '{}',
  delivered       boolean NOT NULL DEFAULT false,
  retry_count     integer NOT NULL DEFAULT 0
                  CHECK (retry_count >= 0 AND retry_count <= 5),
  last_retry_at   timestamptz,
  delivered_at    timestamptz,
  error_message   text,
  dead_letter     boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

**Constraints rationale:**

- `event CHECK (IN (...))` — server-enforced allowlist. DB constraint means no code path can insert an unknown event type.
- `retry_count CHECK (0..5)` — hard cap at 5 retries. After 5 failures, `dead_letter = true`.
- `script_id NOT NULL` + `session_id NOT NULL` — every event is traceable to both a script and a session.
- `timestamp` (client-claimed) vs `received_at` (server wall clock) — separate columns for audit. The client timestamp is validated for skew; the server timestamp is authoritative for ordering.
- No UNIQUE constraint on `nonce` alone — see "Nonce uniqueness strategy" below.

**Indexes:**

```sql
-- Worker polling: find undelivered, non-dead-letter events
CREATE INDEX idx_event_logs_pending_delivery
  ON event_logs (received_at ASC)
  WHERE delivered = false AND dead_letter = false;

-- Nonce replay check within session scope (covering index for SELECT lookup)
CREATE INDEX idx_event_logs_session_nonce
  ON event_logs (session_id, nonce);

-- Dashboard: event history per script
CREATE INDEX idx_event_logs_script_event_time
  ON event_logs (script_id, event, received_at DESC);

-- Dashboard: dead-letter review
CREATE INDEX idx_event_logs_dead_letter
  ON event_logs (script_id, received_at DESC)
  WHERE dead_letter = true;

-- Delivery latency analytics (Phase 8E)
CREATE INDEX idx_event_logs_delivered_latency
  ON event_logs (script_id, received_at)
  WHERE delivered = true;

-- Cleanup of old delivered events
CREATE INDEX idx_event_logs_delivered_created
  ON event_logs (created_at)
  WHERE delivered = true;
```

**Nonce uniqueness strategy:**

Nonces must be unique within the session TTL window. Two approaches considered:

1. **UNIQUE constraint on `(session_id, nonce)`** — strict, DB-enforced. But requires a composite unique index on UUID + text, which is expensive per-insert on a high-write table.

2. **Application-level check with covering index** — query `SELECT 1 FROM event_logs WHERE session_id = $1 AND nonce = $2 LIMIT 1`. Use a covering index. If found, reject as replay.

**Recommendation: Approach 2 (application-level).** The session TTL is 60 seconds, so the nonce window is very small. The application check is a single indexed lookup — negligible overhead. Avoids the composite unique index maintenance cost on a write-heavy table. The `idx_event_logs_session_nonce` covering index supports this check. A race condition (two concurrent events with the same nonce) is theoretically possible but practically harmless — the second insert would succeed, and the event would be delivered twice (at-least-once semantics). UNIQUE would prevent the double-insert but at higher operational cost. For V1, application-level is sufficient.

**Ownership model:**

- RLS: service-role-only (deny-all for `anon`/`authenticated`). Same pattern as `delivery_sessions`.
- Browser users never interact with event_logs directly. Dashboard API routes filter by `script_id` via ownership check on the parent script.
- `ON DELETE CASCADE` from `scripts` — deleting a script removes its event logs.
- `ON DELETE SET NULL` from `delivery_sessions` — session cleanup does not cascade-delete events. Events are independently useful for audit after session expiry.

**Retention strategy:**

| Category | Retention | Cleanup Query |
|----------|-----------|---------------|
| Delivered events | 30 days | `DELETE FROM event_logs WHERE delivered = true AND created_at < NOW() - INTERVAL '30 days'` |
| Dead-letter events | 90 days | `DELETE FROM event_logs WHERE dead_letter = true AND created_at < NOW() - INTERVAL '90 days'` |
| Undelivered (stuck) | 7 days | `DELETE FROM event_logs WHERE delivered = false AND dead_letter = false AND created_at < NOW() - INTERVAL '7 days'` |
| Expired sessions | Daily | Existing cleanup via `deleteExpiredSessions()` |

Cleanup runs via the existing Vercel Cron `/api/cleanup` endpoint. Add the event_logs cleanup queries to the existing cleanup handler.

### 2.3 Event Payload Size Limits

| Field | Limit | Enforcement Point |
|-------|-------|-------------------|
| `event` | 50 chars | DB CHECK + route-level validation |
| `nonce` | 32 hex chars (exact) | Route-level validation |
| `session_token` | 200 chars (base64url) | Route-level validation |
| `data` (jsonb) | 4 KB | Route-level + DB CHECK using `pg_column_size(data) <= 4096` |
| `signature` | 64 hex chars (exact) | Route-level validation |
| Total request body | 8 KB | Existing middleware body size limit |

### 2.4 `delivery_sessions` Extension

The existing Phase 5C/6H `delivery_sessions` table needs one column for event support:

```sql
ALTER TABLE delivery_sessions
  ADD COLUMN event_secret text;   -- plaintext 32-byte random → base64url
                                  -- NULL for sessions created before Phase 8
```

**Rationale:** The session token is SHA-256 hashed in `session_token_hash`. HMAC validation for events requires the raw secret, but we cannot reverse the hash. A separate `event_secret` stored in plaintext solves this:

- `event_secret` is NOT the delivery session token. It is an independent random value.
- HMAC signature validation uses `event_secret`, never the session token.
- DB compromise exposes `event_secret` → attacker can forge events (but not delivery fetches, which require matching the session token hash).
- `event_secret` is NULL for sessions created before Phase 8 → event validation rejects these sessions.

**How `event_secret` reaches the loader:**

The session creation response is extended with an optional field:

```jsonc
// Current (Phase 6H):
{
  "session_token": "...",
  "expires_in": 60
}

// Phase 8 addition:
{
  "session_token": "...",
  "expires_in": 60,
  "event_secret": "..."   // NEW: 32-byte random → base64url, absent if no webhook configured
}
```

The `event_secret` is included in the session response only when the script has an enabled webhook config. If no webhook is configured, `event_secret` is absent — the loader has nothing to sign.

**Lua-side usage:**

```lua
-- Bootstrap receives session_token and event_secret (if configured)
local eventSecret = sessionResponse.event_secret  -- may be nil

-- When reporting an event:
local function reportEvent(eventName, data)
    if not eventSecret then return end  -- no webhook configured, skip

    local timestamp = os.time()
    local nonce = generateRandomHex(32)
    local payload = game:GetService("HttpService"):JSONEncode(data or {})

    local signatureInput = eventName .. ":" .. timestamp .. ":" .. nonce .. ":" .. payload
    local signature = hmacSha256(signatureInput, eventSecret)

    local body = game:GetService("HttpService"):JSONEncode({
        session_token = sessionToken,
        event = eventName,
        timestamp = timestamp,
        nonce = nonce,
        signature = signature,
        data = data
    })

    game:HttpPostAsync("https://www.luxyhub.space/api/events/report", body)
end
```

The loader runtime needs a pure-Lua HMAC-SHA256 implementation. This is an implementation detail for Phase 8B.

## 3. Provider Architecture

### 3.1 Abstraction Layer

```typescript
// app/lib/events/providers/types.ts

interface WebhookProvider {
  readonly name: string;  // "discord", "telegram", "slack"

  /** Deliver an event to the provider. Called by the queue worker. */
  deliver(event: EventLogRow, config: WebhookConfigRow): Promise<DeliverResult>;

  /** Validate that a config is correct and the provider is reachable.
   *  Called when creator clicks "Test Webhook" in dashboard. */
  validate(config: WebhookConfigRow): Promise<ValidationResult>;
}

type DeliverResult =
  | { success: true; providerMessageId: string }
  | { success: false; error: string; retryable: boolean };

type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };
```

The abstraction isolates provider-specific logic from the queue worker and API route. Each provider implements `deliver` and `validate`. The queue worker only calls `provider.deliver(event, config)` — it never knows about Discord embed formatting or Telegram bot API details.

### 3.2 Discord Provider

**Configuration:**

```json
{
  "webhook_url": "https://discord.com/api/webhooks/..."   // encrypted at rest
}
```

**Formatting — event → Discord embed:**

```typescript
// Pseudo — implementation detail
function formatDiscordEmbed(event: EventLogRow): DiscordWebhookPayload {
  const colorMap: Record<string, number> = {
    execute: 0x00ff00,    // green
    purchase: 0xffa500,   // orange
    error: 0xff0000,      // red
    ban: 0x8b0000,        // dark red
    key_redeem: 0x00bfff, // deep sky blue
    heartbeat: 0x808080,  // gray
    enter_world: 0x00ff7f,// spring green
    leave_world: 0xff6347 // tomato
  };

  return {
    embeds: [{
      title: `Event: ${event.event}`,
      description: formatEventDescription(event),
      color: colorMap[event.event] ?? 0x808080,
      fields: buildEmbedFields(event),
      footer: { text: "LuxyHub Event System" },
      timestamp: event.received_at
    }]
  };
}
```

**Rate limits (Discord-side):**

- Discord webhook rate limit: 5 requests per 2 seconds per webhook URL.
- Global rate limit: 30 requests per second per IP.
- Our per-script rate limit (1/sec, 60/min) is well within Discord's limits.

**Retry behavior:**

- Discord 429 → retryable. Use `Retry-After` header if present.
- Discord 5xx → retryable.
- Discord 4xx (400, 401, 403, 404) → not retryable. Invalid webhook URL, revoked, or deleted. Move to dead-letter immediately.

### 3.3 Telegram Provider

**Configuration:**

```json
{
  "bot_token": "...",   // encrypted at rest
  "chat_id": "..."
}
```

**Formatting — event → Telegram message (MarkdownV2):**

```
*Event: execute*
Script: luxy
Time: 2026-06-09 12:34:56 UTC

Player executed the script.
```

**Rate limits (Telegram-side):**

- Bot API: 30 messages per second per chat, 20 messages per minute per group.
- Burst: 1 message per second per chat is a safe default.
- Our per-script rate limit (1/sec) matches.

**Retry behavior:**

- Telegram 429 → retryable. Use `Retry-After`.
- Telegram 5xx → retryable.
- Telegram 400 (bad token) → not retryable. Dead-letter.
- Telegram 403 (bot blocked) → not retryable. Dead-letter.

### 3.4 Slack Provider

**Configuration:**

```json
{
  "webhook_url": "https://hooks.slack.com/services/..."   // encrypted at rest
}
```

**Formatting — event → Slack message:**

```json
{
  "blocks": [
    {
      "type": "header",
      "text": { "type": "plain_text", "text": "Event: execute" }
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*Script:*\nluxy" },
        { "type": "mrkdwn", "text": "*Time:*\n2026-06-09 12:34:56 UTC" }
      ]
    }
  ]
}
```

**Rate limits (Slack-side):**

- Incoming Webhooks: 1 message per second per channel.
- Short bursts are allowed; sustained excess is throttled.
- Our per-script rate limit (1/sec) matches.

**Retry behavior:**

- Slack 429 → retryable. Use `Retry-After`.
- Slack 5xx → retryable.
- Slack 4xx → not retryable. Dead-letter.

### 3.5 Provider Registry

```typescript
// app/lib/events/providers/registry.ts

import { discordProvider } from './discord-provider';
import { telegramProvider } from './telegram-provider';
import { slackProvider } from './slack-provider';

const providers: Record<string, WebhookProvider> = {
  discord: discordProvider,
  telegram: telegramProvider,
  slack: slackProvider,
};

export function getProvider(name: string): WebhookProvider | undefined {
  return providers[name];
}
```

## 4. Event Flow

### 4.1 Happy Path — End-to-End

```
Roblox Script
  |
  | Bootstrap → session_token + event_secret
  |
  | Nonce = random_hex(32)
  | sig = HMAC-SHA256(event + ":" + ts + ":" + nonce + ":" + JSON(data), event_secret)
  |
  | POST /api/events/report
  | { session_token, event, timestamp, nonce, signature, data }
  v
Session Validation
  |
  | hash(session_token) → lookup delivery_sessions
  | reject if: not found, expired, consumed (delivery), missing event_secret
  | extract: session_id, script_id, event_secret
  v
Input Validation
  |
  | validate event in allowed registry → 422 if unknown
  | validate nonce is 32 hex chars → 400 if malformed
  | validate timestamp abs(now - ts) <= 60s → 400 if skewed
  | validate data size <= 4KB → 413 if too large
  | validate signature length = 64 hex → 400 if malformed
  v
Signature Validation
  |
  | recompute HMAC: event + ":" + ts + ":" + nonce + ":" + JSON(data)
  | compare with provided signature (constant-time)
  | reject if mismatch → 401
  v
Replay Protection
  |
  | SELECT 1 FROM event_logs WHERE session_id = $1 AND nonce = $2 LIMIT 1
  | reject if found → 401
  v
Rate Limiting
  |
  | check rate limit: key = "event:{script_id}:{event}"
  | reject if exceeded → 429
  v
Event Storage
  |
  | INSERT INTO event_logs (script_id, session_id, event, timestamp, nonce, data)
  | values extracted from session (not from client — cross-script protection)
  v
Response: 202 Accepted
  |
  | { "success": true }
  v
Queue Worker (async, separate process)
  |
  | polls event_logs WHERE delivered = false AND dead_letter = false
  | for each:
  |   lookup webhook_config WHERE script_id = event.script_id AND enabled = true
  |   if no config → mark delivered = true (no-op delivery)
  |   if config found:
  |     getProvider(config.provider).deliver(event, config)
  |     on success → mark delivered = true, delivered_at = now()
  |     on retryable failure → retry_count++, last_retry_at = now()
  |     on non-retryable failure → dead_letter = true
  |     after 5 retries → dead_letter = true
```

### 4.2 Failure Flows

**Session failure (all → 401 "Invalid event session"):**

- Session not found (bad token) → uniform 401
- Session expired → uniform 401
- Session has no event_secret (created before Phase 8 or script has no webhook) → uniform 401
- Session consumed (delivery fetch already used it — this check may be relaxed; see §5.1) → uniform 401

**Validation failure:**

- Unknown event type → 422 "Unknown event type" (not 401 — this is a schema error, not an auth error)
- Malformed nonce/signature/timestamp → 400 "Invalid event payload"

**Signature failure:**

- HMAC mismatch → uniform 401 "Invalid event session"

**Replay failure:**

- Nonce already seen in this session → uniform 401 "Invalid event session"

**Rate limit failure:**

- Per-script + event type limit exceeded → 429 "Too many events"

**Storage failure:**

- DB insert fails → 500 (internal error, logged server-side)

**Worker delivery failure:**

- Provider returns retryable error → retry_count incremented, event stays in queue
- Provider returns non-retryable error → dead_letter = true
- Provider unreachable (network error) → retryable, backoff

### 4.3 Retry Flow

```
Event stored with delivered = false, retry_count = 0
  |
  v
Worker polls (every 5-10s)
  |
  | event.retry_count = 0 → try delivery now
  | fails → retry_count = 1, last_retry_at = now()
  v
Worker polls again later
  |
  | event.retry_count = 1, last_retry_at was 8s ago
  | backoff: need >= 10s since last_retry → skip (not yet)
  v
Worker polls again
  |
  | event.retry_count = 1, last_retry_at was 12s ago
  | backoff: >= 10s elapsed → try delivery
  | fails → retry_count = 2, last_retry_at = now()
  v
... repeat with backoff: 30s, 90s, 270s, 810s ...
  v
event.retry_count = 5
  |
  | tries delivery one last time
  | fails → dead_letter = true, error_message = last error
  v
No further automatic retries. Visible in dashboard dead-letter queue.
Creator can manually replay from dashboard.
```

### 4.4 Dead-Letter Flow

```
Worker finds event where retry_count >= 5
  |
  | does NOT attempt delivery (already at max)
  | sets dead_letter = true
  v
Event visible in dashboard:
  - Dead-letter filter in event history
  - Shows: event type, timestamp, retry_count, last error_message
  - "Replay" button available
  v
Creator clicks "Replay":
  |
  | sets retry_count = 0, dead_letter = false, error_message = NULL
  | event re-enters queue for fresh delivery attempts
  v
If replay also fails 5 times → dead_letter = true again
```

## 5. Security Model

### 5.1 Session Validation — Delivery vs Event Sessions

The event endpoint reuses the delivery session for authentication, but the consumption model differs:

| Aspect | Delivery Session | Event Session |
|--------|-----------------|---------------|
| Token | One-time — consumed on fetch | Multi-use within TTL |
| Purpose | Retrieve runtime payload | Report events |
| TTL | 60s | 60s (same row, same expiry) |
| Consumption | `consumed_at` set atomically | Never consumed by events |
| Rate limit | N/A (one use) | Per script + event type |
| Secret | `session_token_hash` (SHA-256) | `event_secret` (plaintext) |

**Key decision:** The `consumed_at` check in event validation is **relaxed** for events. The event endpoint allows sessions that have been consumed (delivery fetch already happened) but are not yet expired. This means:

1. Script gets session → immediately fetches runtime payload (consumes session).
2. Script executes runtime payload → starts reporting events.
3. Events use the same session token → validation passes (session exists, not expired, has event_secret).
4. `consumed_at IS NOT NULL` is NOT a rejection condition for events.

The existing `validateDeliverySession` function checks `consumed_at IS NULL`. For events, we need a separate validation path:

```typescript
// New function in delivery-session-service.ts
export async function validateEventSession(sessionToken: unknown) {
  // hash token → lookup session
  // reject if: not found, expired, event_secret IS NULL
  // does NOT check consumed_at
  // returns: session_id, script_id, event_secret
}
```

This is a new function — it does not modify `validateDeliverySession`.

### 5.2 Signature Validation

**Construction (Lua-side):**

```
HMAC-SHA256(
    event_name + ":" + timestamp + ":" + nonce + ":" + JSON.stringify(data),
    event_secret
) → hex digest (64 lowercase hex chars)
```

**Validation (server-side):**

```typescript
function validateEventSignature(
  event: string,
  timestamp: number,
  nonce: string,
  data: unknown,
  signature: string,
  eventSecret: string
): boolean {
  const payload = `${event}:${timestamp}:${nonce}:${JSON.stringify(data)}`;
  const expected = createHmac('sha256', eventSecret)
    .update(payload)
    .digest('hex');
  return timingSafeEqual(expected, signature);
}
```

The `event_secret` is looked up from the session row and used as the HMAC key. Constant-time comparison prevents timing oracle attacks.

**Why HMAC and not asymmetric (Ed25519, ECDSA):**

- HMAC-SHA256 is fast, well-supported, and has trivial pure-Lua implementations.
- The `event_secret` is already distributed via the session response — no key exchange problem.
- The threat model already accepts that the executor is untrusted. Asymmetric would not add meaningful security.
- HMAC verification is O(1) — no public key lookup.

### 5.3 Nonce Validation

**Client generates:** 32 random hex characters (128 bits of entropy).

**Server validates:** `SELECT 1 FROM event_logs WHERE session_id = $1 AND nonce = $2 LIMIT 1`. If a row exists, the nonce has been used — reject.

**Window:** The nonce is only checked within the session TTL (60s). After session expiry, the session is no longer valid for event reporting. A nonce replay from an expired session fails at session validation, not nonce check.

**Edge case — concurrent events with same nonce:**
Two Lua threads reporting simultaneously with the same nonce (buggy client script). The first insert succeeds, the second fails application-level check. The second event is rejected. This is acceptable — the client should generate unique nonces.

### 5.4 Timestamp Validation

```
abs(server_now - client_timestamp) <= 60 seconds
```

- Client timestamp is in Unix seconds.
- Server compares against its own clock.
- Skew > 60s → reject with 400 "Invalid event timestamp".
- Replay attacks using old events with old timestamps also fail this check (nonce replay protection is an additional layer).
- Clock drift up to 60s is generous — typical Roblox executor clock sync is within a few seconds.

### 5.5 Rate Limiting

**Rate limit keys:**

```
event:{script_id}:{event}      → 1 per second, 60 per minute
event:{script_id}:total        → 120 per minute (aggregate)
event:ip:{ip_hash}             → 30 per minute per IP (abuse prevention)
```

**Implementation:** Extend the existing `rate_limits` table pattern. Each rate limit check is a `COUNT` query with a time window filter:

```sql
SELECT COUNT(*) FROM rate_limits
WHERE endpoint = 'event:{script_id}:{event}'
  AND created_at > NOW() - INTERVAL '1 second'
```

**429 response:**

```json
{
  "success": false,
  "message": "Too many events",
  "retry_after": 1
}
```

### 5.6 Replay Protection — Layered Defense

Replay protection is multi-layered, not single-point:

| Layer | Check | Failure Response |
|-------|-------|-----------------|
| 1. Session expiry | `expires_at > now()` | 401 (via session validation) |
| 2. Timestamp skew | `abs(now - client_ts) <= 60s` | 400 |
| 3. Nonce uniqueness | Nonce not seen for session | 401 |
| 4. Signature match | HMAC recomputation | 401 |
| 5. Rate limit | Per-script + event type cap | 429 |

An attacker must pass all five layers to get an event stored. A replayed event from an expired session fails at layer 1. A replayed event with a valid session fails at layer 3 (nonce). An event with a forged nonce fails at layer 4 (signature).

### 5.7 Uniform Error Responses

Following the existing pattern (uniform 403 `"Invalid delivery session"` for all session failures, uniform `"Invalid or revoked license"` for license failures):

**401 responses — uniform:**

All authentication/authorization failures return the same 401:

```json
{ "success": false, "message": "Invalid event session" }
```

Conditions that return this:
- Session not found (bad token)
- Session expired
- Session has no event_secret
- HMAC signature mismatch
- Nonce replay detected

**Non-401 responses — distinct:**

Only validation errors that are not security-relevant get distinct messages:

| Condition | HTTP | Message |
|-----------|------|---------|
| Unknown event type | 422 | `"Unknown event type"` |
| Malformed payload | 400 | `"Invalid event payload"` |
| Timestamp skewed | 400 | `"Invalid event timestamp"` |
| Rate limited | 429 | `"Too many events"` |
| Payload too large | 413 | `"Payload too large"` |

The 401 envelope prevents oracle attacks — an attacker cannot distinguish between "session expired", "bad signature", and "nonce already used".

## 6. Queue Architecture

### 6.1 Comparison

**Option A: Immediate Provider Delivery (synchronous)**

```
POST /api/events/report
  → validate
  → store event
  → deliver to provider (HTTP call)
  → wait for provider response
  → return 202
```

| Criterion | Assessment |
|-----------|-----------|
| Implementation complexity | Low — no worker, no polling |
| Reliability | Poor — provider outage = event lost (or must be retried in-process) |
| Response latency | High — blocked on provider HTTP call (up to 5s+) |
| Scalability | Poor — provider latency directly impacts API capacity |
| Operational complexity | Low (no worker) but fragile |
| Data loss risk | High — no queue persistence for failed deliveries |
| Retry capability | None — must implement in-process, blocking API handler |

**Option B: Database Queue + Worker (asynchronous)**

```
POST /api/events/report
  → validate
  → store event (INSERT)
  → return 202 immediately
  |
  (separate worker polls event_logs)
  → deliver to provider
  → retry on failure
```

| Criterion | Assessment |
|-----------|-----------|
| Implementation complexity | Medium — worker process, polling loop, retry logic |
| Reliability | High — events survive restarts, retried until delivery |
| Response latency | Low — single INSERT, no external HTTP wait |
| Scalability | Good — API unblocked; worker scales independently |
| Operational complexity | Medium — worker monitoring needed |
| Data loss risk | Very low — events in DB until delivered or dead-letter |
| Retry capability | Full — exponential backoff, dead-letter, manual replay |

### 6.2 Recommendation: Option B (Database Queue + Worker)

**Rationale:**

1. **Provider outages must not block event acceptance.** Discord goes down for 30 minutes — events should still be accepted (202) and delivered later.
2. **Consistent with the existing architecture.** The system already uses DB-backed state (delivery sessions, rate limits, audit logs). A DB-backed queue is a natural extension.
3. **No new infrastructure.** No Redis, RabbitMQ, SQS, or BullMQ. PostgreSQL is already running, already scaled, already backed up.
4. **Vercel Cron is already configured.** The existing `vercel.json` has a cron entry. Adding a second cron job or extending the cleanup handler is trivial.
5. **At-least-once delivery is sufficient.** The event use case (notifications, analytics) does not require exactly-once delivery. At-least-once with nonce replay protection is correct.

### 6.3 Worker Design

**Polling strategy:**

- Vercel Cron: every 5 minutes, invoke `/api/events/worker`.
- Each invocation processes up to 50 pending events.
- If queue depth > 50, next cron invocation catches the remainder.
- Alternative: Vercel Cron at 1-minute intervals with smaller batch (20). Depends on expected event volume.

**Batch processing:**

```typescript
// app/api/events/worker/route.ts

export async function GET() {
  const events = await getPendingEvents(50);  // WHERE delivered = false AND dead_letter = false
  let delivered = 0, failed = 0, dead = 0;

  for (const event of events) {
    const config = await getWebhookConfig(event.script_id);
    if (!config || !config.enabled) {
      await markDelivered(event.id);  // no-op — no webhook to deliver to
      delivered++;
      continue;
    }

    const backoffMs = computeBackoff(event.retry_count); // 10s, 30s, 90s, 270s, 810s
    const elapsed = Date.now() - new Date(event.last_retry_at ?? event.created_at).getTime();
    if (elapsed < backoffMs) continue;  // not yet due for retry

    const provider = getProvider(config.provider);
    const result = await provider.deliver(event, config);

    if (result.success) {
      await markDelivered(event.id, result.providerMessageId);
      delivered++;
    } else if (result.retryable) {
      await incrementRetry(event.id, result.error);
      if (event.retry_count + 1 >= 5) {
        await markDeadLetter(event.id, result.error);
        dead++;
      } else {
        failed++;
      }
    } else {
      await markDeadLetter(event.id, result.error);
      dead++;
    }
  }

  return Response.json({ delivered, failed, dead });
}
```

**Backoff computation:**

```typescript
const BACKOFF_SCHEDULE = [10_000, 30_000, 90_000, 270_000, 810_000]; // ms

function computeBackoff(retryCount: number): number {
  return BACKOFF_SCHEDULE[Math.min(retryCount, BACKOFF_SCHEDULE.length - 1)];
}
```

### 6.4 Vercel Cron Configuration

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cleanup",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/events/worker",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Worker runs every 5 minutes. Vercel Cron has a 900-second timeout — more than enough for 50 provider HTTP calls.

### 6.5 Queue Depth Monitoring

For Phase 8E (Analytics), monitor:

- `COUNT(*) FROM event_logs WHERE delivered = false AND dead_letter = false` — queue depth
- `MAX(received_at) FROM event_logs WHERE delivered = false` — oldest undelivered event
- Delivery rate: delivered / total per time window

## 7. Retention Policy

### 7.1 Event Retention

| Category | Retention | Rationale |
|----------|-----------|-----------|
| Delivered events | 30 days | Enough for recent audit; old notifications have no ongoing value |
| Dead-letter events | 90 days | Longer window for creator to notice and replay failed deliveries |
| Undelivered (stuck) | 7 days | Events from expired sessions that never got delivered. Past 7 days, the session is long gone and delivery is meaningless |
| Delivery sessions | Existing cleanup | Unchanged — expired sessions cleaned up as before |

### 7.2 Cleanup Strategy

Extend the existing `/api/cleanup` route handler to include event_logs cleanup:

```typescript
// app/api/cleanup/route.ts — Phase 8A addition

async function cleanupEventLogs() {
  // Delivered events older than 30 days
  await supabaseAdmin
    .from('event_logs')
    .delete()
    .eq('delivered', true)
    .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  // Dead-letter events older than 90 days
  await supabaseAdmin
    .from('event_logs')
    .delete()
    .eq('dead_letter', true)
    .lt('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

  // Stuck undelivered events older than 7 days
  await supabaseAdmin
    .from('event_logs')
    .delete()
    .eq('delivered', false)
    .eq('dead_letter', false)
    .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
}
```

### 7.3 Webhook Config Retention

Webhook configs live as long as the parent script. `ON DELETE CASCADE` handles removal. No separate cleanup needed.

### 7.4 Storage Estimate

Worst-case per-event row overhead: ~200 bytes (UUIDs + metadata) + 4 KB (data jsonb max) ≈ 4.2 KB.

At 1 event/second peak per script, 100 active scripts: 100 events/sec = 360,000 events/day ≈ 1.5 GB/day before cleanup. With 30-day retention: 45 GB max.

In practice, event rates will be much lower (scripts report few events per execution, not sustained 1/sec). The cleanup query runs daily and keeps storage bounded.

## 8. Dashboard Requirements

### 8.1 Webhook Settings Page

Route: `/dashboard/scripts/[slug]/webhooks`

**Layout:**

- Provider selector: Discord / Telegram / Slack (dropdown)
- Provider-specific form fields:
  - Discord: Webhook URL input (masked)
  - Telegram: Bot Token input (masked) + Chat ID input
  - Slack: Webhook URL input (masked)
- Enable/Disable toggle (default: disabled)
- "Test Webhook" button — sends a test message to verify connectivity
- "Save" button

**States:**

- No webhook configured: "Configure a webhook to receive event notifications"
- Configured + disabled: "Webhook is disabled. Enable to start receiving events."
- Configured + enabled: "Active — events are being delivered to [provider]"
- Test pending: "Sending test event..."
- Test success: "Test event delivered successfully!"
- Test failure: "Test failed: [error message]"

**Ownership:** Only the script owner can view/edit webhook config. Enforced server-side via `creator_id` check.

### 8.2 Event History Page

Route: `/dashboard/scripts/[slug]/events`

**Layout:**

- Event history table:
  - Event type (with color badge)
  - Timestamp (server received_at)
  - Status: Delivered (green) / Pending (yellow) / Failed (red) / Dead-letter (gray)
  - Retry count (if not yet delivered)
  - Actions: View details
- Filters:
  - Event type (dropdown, multi-select)
  - Status (delivered, pending, failed, dead-letter)
  - Date range (7d, 30d, custom)
- Pagination (20 per page)

**Event detail modal:**

- Event type, timestamp, status
- data payload (pretty-printed JSON)
- Delivery attempts (timeline):
  - Attempt 1: 2026-06-09 12:34:56 — Delivered (124ms)
  - Attempt 2 (retry): 2026-06-09 12:35:26 — Failed: "Connection refused"
  - Attempt 3 (dead-letter): 2026-06-09 12:35:56 — Failed: "Connection refused"
- "Replay" button (dead-letter events only)

### 8.3 Delivery Status Overview

On script detail page or dashboard home:

- Card: "Events Today" — count of events received today
- Card: "Delivery Success" — % delivered in last 24h
- Card: "Pending" — count of undelivered events
- Card: "Dead Letter" — count of dead-letter events (with link to review)

### 8.4 Dead-Letter Review

Route: `/dashboard/scripts/[slug]/events?status=dead-letter`

Same table as event history, filtered to dead-letter events. Additional columns:

- Error message (last delivery error)
- Retry count (always 5)
- "Replay" action button

## 9. Migration Strategy

### 9.1 Migration Order

| Step | Migration | Description |
|------|-----------|-------------|
| 1 | `008_webhook_config.sql` | Create `webhook_config` table + indexes + RLS |
| 2 | `008_webhook_config_rollback.sql` | Rollback for step 1 |
| 3 | `009_event_logs.sql` | Create `event_logs` table + indexes + RLS |
| 4 | `009_event_logs_rollback.sql` | Rollback for step 3 |
| 5 | `010_delivery_sessions_event_secret.sql` | Add `event_secret` column to `delivery_sessions` |
| 6 | `010_delivery_sessions_event_secret_rollback.sql` | Rollback for step 5 |

### 9.2 Rollout Order

| Step | Phase | What | Impact |
|------|-------|------|--------|
| 1 | 8A | Run migrations (webhook_config, event_logs, event_secret column) | Zero impact — no code reads these yet |
| 2 | 8B | Deploy event reporting endpoint (`POST /api/events/report`) | Zero impact — no scripts use it until webhook configs are enabled |
| 3 | 8B | Deploy queue worker (Vercel Cron) | Zero impact — no undelivered events exist |
| 4 | 8C | Deploy webhook dashboard page | Creators can configure, but events only flow if they enable |
| 5 | 8B | Deploy event_secret in session response | Loaders receive `event_secret` field — nil-safe, backwards-compatible |

### 9.3 Backward Compatibility

- All 114 completed tasks continue working.
- All existing tests continue passing.
- `event_secret` column defaults to NULL — existing sessions have NULL, event validation rejects NULL.
- `POST /api/delivery/session` response adds optional `event_secret` field — existing loaders ignore unknown fields (Roblox `HttpService:JSONDecode` is lenient).
- No changes to `/api/delivery/fetch`, `/api/loader/[slug]`, build pipeline, encryption.
- No changes to `delivery_builds`, `script_versions`, or `scripts` schema.

### 9.4 Operational Risks

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| `event_logs` table grows fast under load | Low — scripts are not event-heavy in practice | 30-day cleanup cron; monitor queue depth |
| Vercel Cron cold start delays worker | Low — 5-min interval is generous | Cron timeout is 900s; 50 events per batch is conservative |
| Discord rate limits hit via worker | Very low — per-script rate limit (1/sec) is well within Discord's 5/2s webhook limit | Worker respects Discord `Retry-After` header |
| `event_secret` leaked from DB | Low — RLS deny-all; service-role-only | `event_secret` is not the session token; DB compromise already means full system compromise |
| Session creation latency increases | Very low — event_secret is just one extra randomBytes(32) call at session creation time | No measurable impact |
| `webhook_config` created for script that is later deleted | None — `ON DELETE CASCADE` handles it | Cascade is immediate and atomic |

## 10. Implementation Order

### Phase 8A Deliverable (this phase)

1. Finalize this design document — review, approve.
2. No code changes. No migrations.
3. Coordinate with Phase 7 planning — ensure `delivery_sessions` extension and session response changes are compatible.

### Implemented Phase 8B/8C Outcome

The final implementation supersedes the original next-step list:

1. Migrations created `webhook_config`, `event_logs`, and `delivery_sessions.event_secret`.
2. `POST /api/events/report` implements session validation, HMAC-SHA256 signature validation, nonce replay protection, timestamp validation, rate limiting, and event storage.
3. Queue worker route is `POST /api/internal/event-worker`.
4. Discord provider is implemented; Telegram and Slack providers are deferred future enhancements.
5. Session creation returns `event_secret` for runtime event signing.
6. Production scheduling uses GitHub Actions calling `https://luxyhub.vercel.app/api/internal/event-worker` every 5 minutes; no Vercel 5-minute cron or Cloudflare bypass rule is required.
7. Loader runtime event reporting uses the server-issued event secret.

### Phase 8C Deliverable (after 8B)

1. Implement webhook settings dashboard page.
2. Implement event history dashboard page.
3. Implement dead-letter review page.
4. Implement "Test Webhook" functionality.
5. Extend cleanup handler for event_logs retention.

### Phase 8D Deliverable (after 8B)

Dashboard management features (detailed in PHASE8_EVENT_PLATFORM_ARCHITECTURE.md §8).

### Phase 8E Deliverable (after 8C)

Analytics & audit (detailed in PHASE8_EVENT_PLATFORM_ARCHITECTURE.md §9).

## 11. Summary

### Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| DB-backed queue over immediate delivery | Provider outages don't block event acceptance; events survive restarts |
| `event_secret` as separate column | Session token is hashed — cannot reverse for HMAC; independent secret limits blast radius |
| Application-level nonce check over UNIQUE index | 60s TTL makes window tiny; avoids composite unique index cost on write-heavy table |
| HMAC-SHA256 over asymmetric crypto | Fast, trivial pure-Lua implementation; event_secret already distributed via session |
| Multi-use event sessions | Delivery fetch consumes once; events are separate concern — must work after payload delivery |
| Uniform 401 for auth failures | Prevents oracle attacks — same pattern as delivery sessions and licenses |
| Provider abstraction layer | Discord/Telegram/Slack share interface; adding a provider is a new file + registry entry |
| `ON DELETE SET NULL` for session FK | Deleting expired sessions should not cascade-delete event_logs (audit trail) |
| 4 KB max event data | Enough for structured metadata; prevents queue bloat from oversized payloads |
| 5 retries with exponential backoff | Standard pattern; dead-letter as safety valve; manual replay for recovery |

### Recommended Schema

Two new tables + one column extension:

1. **`webhook_config`** — 1:1 with scripts. Stores provider credentials (encrypted in Phase 8B). Owner-aware RLS.
2. **`event_logs`** — queue backing store. Service-role-only RLS. Retention via cleanup cron.
3. **`delivery_sessions.event_secret`** — nullable text column. Plaintext random for HMAC validation.

### Security Recommendations

1. Encrypt `webhook_config.config` sensitive fields at rest in Phase 8B — plain JSON in 8A is acceptable for initial deployment but must be hardened before production.
2. Use constant-time comparison for signature validation.
3. Never log event_secret or webhook URLs.
4. Session token continues to be SHA-256 hashed — event_secret is a separate value, not derived from the token.
5. Worker validates event ownership (`script_id` from session, not from request body) before delivering.
6. Uniform 401 errors for all auth failures — no oracle.

### Queue Recommendation

**Option B: Database-backed queue with worker.** Synchronous delivery would couple API response time to provider health and latency. The DB queue is crash-safe, already deployed, requires no new infrastructure, and fits the existing Vercel Cron pattern.

### Next Steps After This Review

1. Approve this design document.
2. Phase 8B: Write migrations, implement `/api/events/report`, implement worker, implement providers.
3. Coordinate with Phase 7 — the `delivery_sessions.event_secret` column and session response extension must be compatible with Phase 7 license validation.
