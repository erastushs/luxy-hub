# Phase 8E.1 — Event Analytics Dashboard

Status: Implemented
Date: 2026-06-09
Scope: Creator-facing event analytics visualization from existing event_logs and monitoring counters

## Scope Boundary

Implemented:

- `/dashboard/scripts/[slug]/analytics/events` — Script-level event analytics page (owner-only)
- Analytics overview cards (total events, delivered, pending, dead letter, success rate)
- Event trend charts (24h, 7d, 30d) broken down by event type
- Provider health card (deliveries, failures, failure rate, last delivery)
- Queue health card (per-script pending, dead letter, oldest pending age)
- Security metrics card (invalid signatures, replay attempts, rate limit hits)
- Safe DTOs — no secrets, webhook URLs, session IDs, or nonces exposed
- Service layer with ownership enforcement via `getOwnedScript()`
- Loading skeleton matching dashboard conventions

Not implemented:

- Discord alerting
- Email alerting
- Telegram alerting
- License system analytics
- HWID/key system analytics
- Audit trail events (`webhook.created`, `webhook.deleted`, etc.)

## Navigation

```
Dashboard
└── Scripts
    └── [slug]
        └── Analytics (Events)
```

Route: `/dashboard/scripts/[slug]/analytics/events`

Link from: script detail page (same model as webhooks, events, builds sub-routes).

## UI Flow

```
Event Analytics Page (Server Component)
  |
  ├─ Authenticate user → getCurrentUser()
  ├─ Resolve ownership → getEventAnalytics(slug, userId)
  |   └─ Returns EventAnalyticsDTO (safe, no secrets)
  |
  └─ Client Component: EventAnalyticsClient
      |
      ├─ AnalyticsOverviewCards
      |   ├─ Total Events (Hash)
      |   ├─ Delivered (CheckCircle2, emerald)
      |   ├─ Pending (Clock, amber)
      |   ├─ Dead Letter (AlertTriangle, red)
      |   └─ Success Rate % (TrendingUp)
      |
      ├─ EventTrendChart × 3 (24h, 7d, 30d)
      |   └─ Stacked SVG bars: delivered (emerald) / pending (amber) / dead letter (red)
      |       per event type, with legend
      |
      ├─ ProviderHealthCard
      |   ├─ Provider name + Enabled/Disabled badge
      |   ├─ Deliveries count
      |   ├─ Failures count
      |   ├─ Failure Rate %
      |   └─ Last Delivery timestamp
      |
      ├─ QueueHealthCard (per-script)
      |   ├─ Current Pending count
      |   ├─ Dead Letter count
      |   └─ Oldest Pending Age (formatted as Xm Ys)
      |
      └─ SecurityMetricsCard
          ├─ Invalid Signatures count
          ├─ Replay Attempts count
          └─ Rate Limit Hits count
```

## Service Layer

`app/lib/services/event-analytics-service.ts`

### Safe DTO

```typescript
export type EventAnalyticsDTO = {
  totalEvents: number
  deliveredEvents: number
  pendingEvents: number
  deadLetterEvents: number
  successRatePercent: number

  trends24h: TrendBreakdown
  trends7d: TrendBreakdown
  trends30d: TrendBreakdown

  queueHealth: ScriptQueueSnapshot

  providerHealth: ProviderHealthDTO | null

  securityMetrics: SecurityMetricsDTO
}
```

What is NEVER included:
- `session_id`
- `nonce`
- `event_secret`
- `webhook_url` (raw URL)
- `creator_id`
- `session_token` / `session_token_hash`

### Aggregation Logic

| Metric | Source | Aggregation |
|---|---|---|
| Total Events | `countEventsByScriptId(scriptId)` | Exact count via `count: 'exact', head: true` |
| Delivered/Pending/Dead Letter | `countEventsByScriptId(scriptId, { deliveryStatus })` | Status-filtered exact counts |
| Success Rate % | Derived | `Math.round((delivered / total) * 1000) / 10` → 1 decimal |
| Event Trends (24h/7d/30d) | `getEventTypeCountsByScriptId(scriptId, since)` | Client-side grouping by type+status from DB rows |
| Queue Health | `getScriptQueueSnapshot(scriptId)` | Parallel exact counts + oldest pending `received_at` query |
| Provider Health | `getWebhookConfigByScriptId(scriptId)` + overview counts + `getLastDeliveryTimestamp(scriptId)` | Provider identity from config, totals from overview |
| Security Metrics | `verification_logs` (countSecurityMetric, 30d window) | Sum of `event.invalid_signature`, `event.replay_attempt`, `event.rate_limited` |

All queries are per-script and scoped via `script_id` filter, enforced at the database layer through the repository functions.

### Repository Additions

`app/lib/repositories/event-repository.ts`:

| Function | Purpose |
|---|---|
| `getEventTypeCountsByScriptId(scriptId, since?)` | Returns `[{ event_type, delivery_status, count }]` grouped from raw rows |
| `getLastDeliveryTimestamp(scriptId)` | Returns latest `delivered_at` for delivered events |
| `getScriptQueueSnapshot(scriptId)` | Returns `{ pendingCount, deadLetterCount, oldestPendingAgeSeconds }` per script |

## Security Review

### Ownership

- `getEventAnalytics(slug, userId)` calls `getOwnedScript(slug, userId)` first.
- Non-owners receive `{ success: false, message: 'Script not found', status: 404 }` — indistinguishable from missing script.
- No event data leaks across accounts.

### No Secrets in DTO

All analytics DTOs are safe by construction — they contain aggregate counts and timestamps only. No cryptographic material, session identifiers, or webhook URLs are included.

### Security Metrics Scope

Security metrics (`invalidSignatures`, `replayAttempts`, `rateLimitHits`) are queried globally from `verification_logs` over a 30-day window. These are not per-script since they represent event API abuse signals, not script-level activity. This is read-only — no alerting or mutation.

### Read-Only Dashboard

The analytics page only invokes `getEventAnalytics()`, which is read-only. It does not:

- Create, modify, or delete events
- Modify webhook configs
- Trigger queue processing
- Call any provider delivery code
- Expose any credentials

## Components

| Component | File | Usage |
|---|---|---|
| `AnalyticsOverviewCards` | `events-analytics-client.tsx` | 5-card overview grid |
| `EventTrendChart` | `events-analytics-client.tsx` | Stacked SVG bar chart per time window |
| `ProviderHealthCard` | `events-analytics-client.tsx` | Provider delivery health summary |
| `QueueHealthCard` | `events-analytics-client.tsx` | Per-script queue health snapshot |
| `SecurityMetricsCard` | `events-analytics-client.tsx` | Security counter display |
| `EventAnalyticsClient` | `events-analytics-client.tsx` | Wrapper exporting all cards |

All components:
- `'use client'`
- Follow existing dashboard dark theme (zinc-950, zinc-800 borders, red accents)
- Use lucide-react icons
- Mobile responsive (grid-cols-1 → sm/lg/xl breakpoints)
- Handle null/empty states gracefully

## Files

| File | Change |
|---|---|
| `app/lib/repositories/event-repository.ts` | Added `getEventTypeCountsByScriptId`, `getLastDeliveryTimestamp`, `getScriptQueueSnapshot` |
| `app/lib/services/event-analytics-service.ts` | Created — safe DTOs, ownership enforcement, parallel aggregation |
| `app/dashboard/scripts/[slug]/analytics/events/page.tsx` | Created — server component (auth, ownership, analytics fetch) |
| `app/dashboard/scripts/[slug]/analytics/events/events-analytics-client.tsx` | Created — 6 client components (5 cards + wrapper) |
| `app/dashboard/scripts/[slug]/analytics/events/loading.tsx` | Created — skeleton loading state |
| `__tests__/event-analytics-service.test.ts` | Created — 26 tests: ownership, aggregation, DTO safety, trends, empty state |
| `PHASE8E1_ANALYTICS_DASHBOARD.md` | Created — this document |

## Tests

26 tests covering:

- **Ownership** (3): 404 for non-owned script, slug+userId resolution, no leakage for wrong owner
- **Analytics aggregation** (6): zero state, overview counts, success rate (0% and decimal precision), trend grouping, since-date call verification
- **Provider health** (4): null when no config, enabled/disabled states, last delivery timestamp
- **Queue health** (2): per-script snapshot equality, empty queue handling
- **Security metrics** (2): counter values from verification_logs, call count verification
- **DTO safety** (5): no session_id, nonce, event_secret, webhook_url, creator_id in JSON serialization
- **Empty state** (2): all-zeroes analytics, empty trend objects
- **Trend calculations** (2): window separation (24h/7d/30d), status accumulation per event type

## Dependencies

### Depends on (reads)

- `app/lib/auth/ownership` — `getOwnedScript(slug, userId)`
- `app/lib/repositories/event-repository` — `countEventsByScriptId`, `getEventTypeCountsByScriptId`, `getLastDeliveryTimestamp`, `getScriptQueueSnapshot`
- `app/lib/repositories/webhook-config-repository` — `getWebhookConfigByScriptId`
- `app/lib/supabase` — `supabaseAdmin` (for `verification_logs` security metric queries)
- `app/dashboard/components/ErrorBanner` — error display
- `app/dashboard/lib/format-date` — `formatDateTime` for last delivery display

### Used by (written for)

- `/dashboard/scripts/[slug]/analytics/events` page
- `EventAnalyticsClient` component

### No changes to

- Event API (`/api/events/report`)
- Queue worker (`/api/internal/event-worker`)
- Discord provider
- Delivery sessions
- License system
- Loader system
- Webhook config management
- Event operations dashboard

## Success Criteria

- [x] Creator can view event analytics for owned scripts
- [x] Overview counts (total, delivered, pending, dead letter, success rate) displayed
- [x] Event trends by type visible for 24h, 7d, and 30d windows
- [x] Provider health metrics displayed (when webhook configured)
- [x] Queue health visible (per-script pending, dead letter, oldest age)
- [x] Security metrics visible (invalid signatures, replay attempts, rate limit hits)
- [x] No secrets exposed in any DTO or component
- [x] No alerting implemented (per scope boundary)
- [x] Ownership enforced at service layer
- [x] Tests cover ownership, aggregation, DTO safety, empty state, trend calculations
- [x] Build, lint, and full test suite pass
