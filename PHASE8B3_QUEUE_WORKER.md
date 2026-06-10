# Phase 8B.3 — Event Queue Worker

Status: Implemented
Date: 2026-06-09
Scope: Queue processing infrastructure only (no provider integrations)

## Scope Boundary

Implemented:

- `app/lib/services/event-queue-service.ts` — queue processor with backoff, retry, dead-letter
- `app/lib/providers/mock-provider.ts` — stub provider (always succeeds)
- `app/api/internal/event-worker/route.ts` — cron-invoked worker endpoint
- `vercel.json` — 5-minute cron schedule
- Queue tests (29 tests across 2 files)
- Dead-letter replay helper

Not implemented in this phase:

- Discord delivery
- Telegram delivery
- Slack delivery
- Real provider HTTP calls
- Dashboard pages
- Queue depth monitoring

## Queue Lifecycle

```
Event stored with delivery_status = 'pending', retry_count = 0
  |
  v
Worker polls (every 5 min, Vercel Cron)
  |
  ├─ retry_count = 0 → deliver immediately
  ├─ retry_count > 0 → check retry due (backoff elapsed?)
  │   ├─ not due → skip
  │   └─ due → deliver
  |
  ├─ Delivery succeeds → delivery_status = 'delivered', delivered_at = now()
  ├─ Delivery fails (retryable, retries < 5) → retry_count++, stays pending
  ├─ Delivery fails (retryable, retries = 5) → dead_letter
  └─ Delivery fails (non-retryable, any retries) → dead_letter
```

## Queue States

The database `delivery_status` CHECK constraint allows: `pending`, `delivered`, `dead_letter`.

Two additional application-level states:

| State | Visibility | Meaning |
|-------|-----------|---------|
| `pending` | DB column | Awaiting delivery or retry |
| `processing` | `claimed_at IS NOT NULL` | Leased by a worker for delivery processing |
| `delivered` | DB column | Successfully delivered to provider |
| `failed` | Derived | `delivery_status = 'pending' AND retry_count > 0` |
| `dead_letter` | DB column | Exhausted all retries or non-retryable error |

`processing` is represented by `event_logs.claimed_at`, added by `migrations/009_event_platform_hardening.sql`. Workers claim a pending event before provider delivery. Rows with no claim, or claims older than the 15-minute lease window, are eligible for processing. Delivery status updates clear `claimed_at`, so worker crashes recover automatically after lease expiry.

## Retry Policy

Exponential backoff with 5 retries (6 total attempts including original):

| Attempt | Retry Count | Backoff |
|---------|-------------|---------|
| 0 (original) | 0 | 0 (immediate) |
| 1 | 1 | 10 s |
| 2 | 2 | 30 s |
| 3 | 3 | 90 s |
| 4 | 4 | 270 s |
| 5 | 5 | 810 s |
| Beyond | N/A | Dead letter |

Implementation: events with `retry_count > 0` are skipped unless `min(backoff, 810s)` has elapsed since `last_retry_at`.

## Dead-Letter Policy

An event enters dead-letter when:

- A non-retryable error occurs (provider returns `retryable: false`)
- A retryable error occurs after 5 retries have been exhausted
- The provider throws an uncaught exception after 5 retries

Dead-letter events are NOT automatically retried. They are visible via `event_logs WHERE delivery_status = 'dead_letter'`.

Replay: `replayDeadLetterEvent(eventId)` resets `retry_count = 0`, `delivery_status = 'pending'`, and clears `error_message`, `last_retry_at`, `delivered_at`. The event re-enters the queue for fresh delivery attempts. Dashboard UI for this is deferred to later phases.

## Worker Route

```
POST /api/internal/event-worker
Authorization: Bearer <CRON_SECRET>
```

### Auth

Same pattern as `/api/cleanup` — `CRON_SECRET` env var, Bearer token. Returns 401 on wrong/missing auth, 500 if env var not configured.

### Behavior

1. Fetches up to 50 pending events (FIFO by `received_at`).
2. For each event: checks retry readiness, looks up webhook config, invokes provider.
3. Returns batch statistics in JSON response.

### Response

```json
{
  "success": true,
  "processed": 10,
  "delivered": 8,
  "failed": 1,
  "deadLettered": 1,
  "skipped": 0
}
```

- `processed` — events that were attempted (delivered, failed, or dead-lettered)
- `delivered` — successfully delivered or no webhook configured (no-op)
- `failed` — retryable failure, will be retried later
- `deadLettered` — moved to dead-letter
- `skipped` — not yet due for retry (backoff not elapsed)

## Cron Strategy

Vercel Cron every 5 minutes (`*/5 * * * *`). Each invocation processes up to 50 events. If queue depth exceeds 50, subsequent cron invocations catch the remainder.

Vercel Cron has a 900-second timeout — more than ample for 50 delivery attempts even once real providers are wired in.

## Mock Provider

`app/lib/providers/mock-provider.ts` — always returns `{ success: true }`. Used to validate:

- Event fetch → delivery attempt → status update pipeline
- No-op delivery when no webhook config exists
- Queue batch statistics
- Worker route auth and error handling

Provider interface (`DeliveryProvider`):

```typescript
type DeliveryProvider = {
  deliver(event: EventLogRow, webhookUrl: string): Promise<DeliveryResult>
}

type DeliveryResult = {
  success: boolean
  retryable: boolean
  messageId?: string
  error?: string
}
```

## Future Provider Integration Points

When Discord/Telegram/Slack providers are implemented:

1. Create `app/lib/providers/discord-provider.ts` (implements `DeliveryProvider`).
2. Create `app/lib/providers/telegram-provider.ts`.
3. Create `app/lib/providers/slack-provider.ts`.
4. Create `app/lib/providers/provider-registry.ts` — maps `provider` string from `webhook_config` to the right `DeliveryProvider`.
5. Swap `mockProvider` in the worker route for the registry lookup.

No changes to the queue service or worker route are needed — the provider interface is the extension seam.

## Files

| File | Purpose |
|------|---------|
| `app/lib/services/event-queue-service.ts` | Queue processor, backoff, dead-letter replay |
| `app/lib/providers/mock-provider.ts` | Stub provider for lifecycle validation |
| `app/api/internal/event-worker/route.ts` | Cron-invoked worker endpoint |
| `__tests__/event-queue-service.test.ts` | 22 tests: lifecycle, retry, batching, skips, mixed batches |
| `__tests__/event-worker-route.test.ts` | 5 tests: auth, success, error |
| `vercel.json` | Added `*/5 * * * *` cron entry |
| `ARCHITECTURE.md` | Added route + Phase 8 status |
