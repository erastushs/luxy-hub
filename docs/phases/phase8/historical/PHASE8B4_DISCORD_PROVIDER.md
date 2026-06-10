# Phase 8B.4 — Discord Provider Delivery

Status: Implemented
Date: 2026-06-09
Scope: Real Discord webhook delivery (replaces MockProvider)

## Scope Boundary

Implemented:

- `app/lib/providers/discord-provider.ts` — `deliver()`, `validateConfig()`, `validateWebhookUrl()`
- Provider integration into `POST /api/internal/event-worker`
- `ProviderResolver` type in queue service for multi-provider routing
- All 8 event types formatted as Discord embeds
- HTTP error classification: retryable vs permanent

Not implemented:

- Telegram delivery
- Slack delivery
- Dashboard UI for webhook config
- Analytics

## Provider Flow

```
Worker polls pending event
  |
  v
Resolve provider by webhook_config.provider
  |
  v
discordProvider.deliver(event, webhookUrl)
  |
  ├─ validateWebhookUrl (pre-flight, no HTTP)
  │   └─ reject invalid → permanent failure
  |
  ├─ formatEventEmbed
  │   ├─ title (event label)
  │   ├─ color (event-type specific)
  │   ├─ timestamp
  │   ├─ fields: Script, Event ID
  │   └─ fields: up to 8 payload entries
  |
  ├─ POST to Discord webhook (10s timeout)
  │   ├─ 2xx → success → delivered
  │   ├─ 429 → retryable → retry
  │   ├─ 5xx → retryable → retry
  │   ├─ network error → retryable → retry
  │   ├─ 404 code 10015 → permanent → dead_letter (deleted webhook)
  │   ├─ 400 → permanent → dead_letter
  │   ├─ 401 → permanent → dead_letter
  │   └─ 403 → permanent → dead_letter
  |
  └─ result returned to queue processor
```

## Webhook Configuration Model

The webhook URL comes exclusively from `webhook_config.config.webhook_url` — never from Lua, never from the API payload.

Validation layers:

1. **Config-level** (`validateConfig`): checks provider type, enabled state, webhook URL format
2. **Pre-flight** (`validateWebhookUrl`): regex check before HTTP call — rejects invalid URLs without making a request
3. **HTTP-level** (`classifyHttpError`): Discord response codes determine retryability

URL format: `https://discord.com/api/webhooks/<snowflake>/<token>` or `https://discordapp.com/api/webhooks/<snowflake>/<token>`.

## Event Formatting

All 8 event types produce Discord embeds:

| Event Type | Embed Title | Color |
|-----------|-------------|-------|
| `execute` | Execute | Green (`#57F287`) |
| `purchase` | Purchase | Yellow (`#FEE75C`) |
| `error` | Error | Red (`#ED4245`) |
| `ban` | Ban | Red (`#ED4245`) |
| `key_redeem` | Key Redeem | Blurple (`#5865F2`) |
| `heartbeat` | Heartbeat | Grey (`#95A5A6`) |
| `license_activate` | License Activate | Green (`#57F287`) |
| `license_revoke` | License Revoke | Red (`#ED4245`) |

Each embed includes:
- Timestamp from the event
- Script ID field
- Event ID field
- Up to 8 payload key-value pairs (first 1024 chars each)

## Retry Strategy

Retryable errors (provider-level + queue-level):

| Error | Classification | Behavior |
|-------|---------------|----------|
| Discord 429 (rate limit) | Retryable | Backoff: 10s → 30s → … → 810s → dead_letter |
| Discord 5xx (server error) | Retryable | Same backoff |
| Network timeout / DNS / ECONNREFUSED | Retryable | Same backoff |

Permanent errors (dead-letter immediately, no retries):

| Error | Reason |
|-------|--------|
| Invalid webhook URL format | Failed pre-flight regex — never makes HTTP call |
| Discord 404 code 10015 | Webhook deleted |
| Discord 400 | Malformed request — won't become valid later |
| Discord 401 | Invalid token — won't self-heal |
| Discord 403 | Permissions revoked |

## Queue Integration Changes

The queue service now accepts a `ProviderResolver` instead of a single `DeliveryProvider`:

```typescript
type ProviderResolver = (provider: string) => DeliveryProvider | null
```

The worker route resolves providers:

```typescript
const resolveProvider = (provider: string): DeliveryProvider | null => {
  if (provider === 'discord') return discordProvider
  return null
}
```

Unknown provider types (e.g. `telegram`, `slack` before they're implemented) dead-letter immediately with a descriptive error message.

## Files

| File | Change |
|------|--------|
| `app/lib/providers/discord-provider.ts` | Created — full Discord provider with validation, formatting, HTTP, error classification |
| `app/lib/services/event-queue-service.ts` | Modified — `processEventQueue` signature changed to `ProviderResolver`, unknown provider dead-letters |
| `app/api/internal/event-worker/route.ts` | Modified — imports `discordProvider`, passes resolver function |
| `__tests__/discord-provider.test.ts` | Created — 28 tests: URL validation, config validation, success, retryable, permanent, formatting |
| `__tests__/event-queue-service.test.ts` | Modified — updated for `ProviderResolver` signature |
| `__tests__/event-worker-route.test.ts` | Modified — updated mock import from `mockProvider` to `discordProvider` |

## Future Provider Integration

To add Telegram or Slack:

1. Create `app/lib/providers/telegram-provider.ts` (implements `DeliveryProvider`)
2. Add `if (provider === 'telegram') return telegramProvider` to the resolver
3. Write provider tests

No queue service or worker route changes needed — the `ProviderResolver` interface is the extension seam.
