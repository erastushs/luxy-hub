# Phase 8C.2 — Event Operations Dashboard

Status: Implemented
Date: 2026-06-09
Scope: Creator-facing event history, dead-letter review, and replay operations

## Scope Boundary

Implemented:

- `/dashboard/scripts/[slug]/events` — event history with filters (status, event type) and pagination
- `/dashboard/scripts/[slug]/events/[eventId]` — event detail with full metadata and payload
- `/dashboard/scripts/[slug]/events/dead-letter` — dead-letter review with single and bulk replay
- Safe DTOs — no session IDs, nonces, or webhook URLs ever exposed to client
- Ownership enforcement at service layer for all reads and writes
- Replay through existing queue service (reset → pending, normal queue flow)
- Reusable components: `EventStatusBadge`, `EventsTable`, `DeadLetterTable`, `ReplayButton`, `ReplayAllButton`

Not implemented:

- Analytics dashboard
- Event log retention controls
- Telegram/Slack provider details in UI
- Timeline/graph views

## Navigation

```
Dashboard
└── Scripts
    └── [slug]
        └── Events
            ├── List (with filters + pagination)
            ├── [eventId] (detail)
            └── Dead Letter (review + replay)
```

Link from: script detail page.
Route: `/dashboard/scripts/[slug]/events`

## Page Structure

### Events List

Server Component: auth → ownership → `getEventHistory(slug, userId, { ... })`

Client Component: `EventsTable`
- Status filter: All, Pending, Delivered, Dead Letter
- Event type filter: All + 8 registered types
- Table columns: Event Type, Status, Created, Delivered, Retries, Provider
- Each row links to detail page
- Pagination: Prev/Next with page counter (showing N–M of total)
- Dead Letter link button in header

### Event Detail

Server Component: auth → ownership → `getEventDetail(slug, userId, eventId)`

Displays:
- Metadata card: event type, status, retry count, provider, all timestamps
- Error card (only if error_message present)
- Payload card (pretty-printed JSON)
- ReplayButton (only if delivery_status === 'dead_letter')

### Dead Letter

Server Component: auth → ownership → `getDeadLetters(slug, userId, { page, pageSize })`

Client Component: `DeadLetterTable`
- Table columns: Event Type, Error, Retries, Created, Actions
- Per-row Replay button (single event replay)
- ReplayAllButton (bulk replay all dead letters for script)
- Empty state: "No dead-letter events — everything is healthy" with green check
- Pagination

## Service Layer

`app/lib/services/event-dashboard-service.ts`

### Safe DTO

```typescript
export type EventDashboardDTO = {
  id: string
  scriptId: string
  eventType: string
  payload: Record<string, unknown> | null
  deliveryStatus: string
  retryCount: number
  provider: string | null
  timestamp: string
  receivedAt: string
  lastRetryAt: string | null
  deliveredAt: string | null
  errorMessage: string | null
  createdAt: string
}
```

What is NEVER included:
- `session_id`
- `nonce`
- `config` (raw webhook URL)
- `event_secret`
- `creator_id`
- `session_token` / `session_token_hash`

### Functions

| Function | Ownership | Returns |
|----------|-----------|---------|
| `getEventHistory` | `getOwnedScript(slug, userId)` | Paginated list with filters |
| `getEventDetail` | `getOwnedScript(slug, userId)` + script_id match | Single event with payload |
| `getDeadLetters` | `getOwnedScript(slug, userId)` | Paginated dead-letter list |
| `replayEvent` | `getOwnedScript(slug, userId)` + script_id match + status check | Replay confirmation |
| `replayAllDeadLetters` | `getOwnedScript(slug, userId)` | Bulk replay count |

### Payload inclusion policy

- **List views**: `payload: null` — never included in list results
- **Detail view**: `payload` included (the actual event data is useful for debugging)

### Provider display

The `provider` field comes from `getWebhookConfigByScriptId(script.id)`. It shows the configured provider type (e.g., "discord") — never the webhook URL or credentials.

## Replay Workflow

```
User clicks "Replay" on dead-letter event
  |
  v
replayEventAction(slug, eventId) → requireAuth()
  |
  v
event-dashboard-service.replayEvent(slug, userId, eventId)
  |
  ├─ Ownership: getOwnedScript(slug, userId)
  ├─ Event lookup: getEventLog(eventId)
  |   ├─ 404 if not found
  |   └─ 404 if script_id mismatch
  ├─ Status check: delivery_status === 'dead_letter'
  |   └─ 400 if not dead-letter
  ├─ replayDeadLetterEvent(eventId) → event-queue-service
  |   └─ Sets: delivery_status='pending', retry_count=0, clears error fields
  └─ Returns: { success: true, message: "Event queued for redelivery", replayed: 1 }
```

Bulk replay (`replayAllDeadLetters`):
1. Fetches all dead-letter events for script
2. Iterates and calls `replayDeadLetterEvent` for each
3. Reports count: "2 of 3 dead-letter events replayed"

The replay does NOT bypass the queue. It resets the event to `pending` with `retry_count=0` — the next cron worker invocation picks it up normally.

## Repository Changes

### `event-repository.ts`

Added `countEventsByScriptId(scriptId, { eventType?, deliveryStatus? })`:

- Uses `select('*', { count: 'exact', head: true })` for exact count
- Supports filtering by event type and delivery status
- Returns 0 when no rows match

No other changes to repository API. Existing `getEventsByScriptId` and `getEventLog` used as-is.

## Security Review

### Ownership

Every service function calls `getOwnedScript(slug, userId)` first. Non-owners get 404. No event data leaks across accounts.

### Cross-script isolation

`getEventDetail` and `replayEvent` verify `event.script_id === script.id` after fetching the event. An event from a different script returns 404 — indistinguishable from "not found".

### No secrets in DTO

- `session_id` — omitted (not in `EventDashboardDTO`)
- `nonce` — omitted
- `webhook URL` — never queried for events; `provider` field only shows type string
- `event_secret` — never accessed by dashboard service

### Replay gating

- Only dead-letter events can be replayed
- Ownership check before replay
- Replay uses existing `replayDeadLetterEvent` from queue service — same code path as worker recovery

### No mutation of queue architecture

The dashboard layer reads events (SELECT) and resets dead-letter events (UPDATE via `replayDeadLetterEvent`). It never:
- Calls `processEventQueue` directly
- Modifies delivery provider behavior
- Bypasses CRON_SECRET auth on worker route
- Creates new delivery sessions

## Components

| Component | File | Usage |
|-----------|------|-------|
| `EventStatusBadge` | `events-client.tsx` | Pending/Delivered/Dead Letter/Failed badge |
| `EventsTable` | `events-client.tsx` | Full event list with filters, pagination, row links |
| `DeadLetterTable` | `events-client.tsx` | Dead-letter list with per-row replay |
| `ReplayButton` | `[eventId]/replay-button.tsx` | Single event replay on detail page |
| `ReplayAllButton` | `events-client.tsx` | Bulk replay on dead-letter page |

All components:
- 'use client'
- Use `useTransition` for async actions
- Show loading spinners during operations
- Display inline success/error feedback
- Follow existing dashboard dark theme styling (Tailwind, lucide icons)

## Files

| File | Change |
|------|--------|
| `app/lib/repositories/event-repository.ts` | Added `countEventsByScriptId` |
| `app/lib/services/event-dashboard-service.ts` | Created — safe DTOs, ownership, queries, replay |
| `app/actions/events.ts` | Created — server actions with `requireAuth()` |
| `app/dashboard/scripts/[slug]/events/page.tsx` | Created — event list server component |
| `app/dashboard/scripts/[slug]/events/events-client.tsx` | Created — EventsTable, DeadLetterTable, EventStatusBadge, ReplayAllButton |
| `app/dashboard/scripts/[slug]/events/[eventId]/page.tsx` | Created — event detail server component |
| `app/dashboard/scripts/[slug]/events/[eventId]/replay-button.tsx` | Created — single replay button |
| `app/dashboard/scripts/[slug]/events/dead-letter/page.tsx` | Created — dead-letter server component |
| `app/dashboard/scripts/[slug]/events/loading.tsx` | Created — skeleton loading state |
| `__tests__/event-dashboard.test.ts` | Created — 24 tests: ownership, DTO safety, queries, replay |

## Dependencies

### Depends on (reads)

- `app/lib/auth/ownership` — `getOwnedScript(slug, userId)`
- `app/lib/repositories/event-repository` — `getEventsByScriptId`, `countEventsByScriptId`, `getEventLog`
- `app/lib/repositories/webhook-config-repository` — `getWebhookConfigByScriptId` (provider display)
- `app/lib/services/event-queue-service` — `replayDeadLetterEvent`

### Used by (written for)

- Dashboard pages (events list, detail, dead-letter)
- Server actions (`app/actions/events.ts`)

### No changes to

- Event API (`/api/events/report`)
- Queue worker (`/api/internal/event-worker`)
- Discord provider
- Delivery sessions
- License system
- Loader system
