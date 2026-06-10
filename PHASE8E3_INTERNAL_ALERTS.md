# Phase 8E.3 — Internal Alerts

Status: Implemented
Date: 2026-06-10
Scope: Internal operational and security alert monitoring for the LuxyHub Event Platform

## Scope Boundary

**Implemented:**

- `app/lib/services/internal-alert-service.ts` — Alert engine with threshold evaluation, deduplication, auto-resolution, Discord notification
- `alert_events` table in `schema.sql` (migration `010_internal_alerts.sql`)
- `/api/internal/check-alerts` route — CRON-secured alert evaluation endpoint
- Worker integration — alert check runs after each event worker cycle
- `/dashboard/admin/alerts` — Admin-only alert dashboard with active/resolved views, severity filters, pagination
- 3 UI components: `AlertSeverityBadge`, `ActiveAlertsTable`, `AlertHistoryTable`
- 24 tests covering pure threshold logic, integration, dedup, resolution, Discord gating

**Not implemented:**

- Creator-facing alerts (Phase 8E.2 security dashboard is creator-facing; this is internal-only)
- License system alerts
- HWID/Key system alerts
- Customer-facing notifications
- Telegram provider integration (scope: Discord only)

## Alert Model

### States
- `active` — Alert is currently triggered and undismissed
- `resolved` — Metrics have returned below threshold

### Severity Model
| Severity | Icon | Color | Default Discord Color |
|---|---|---|---|
| `low` | Info | blue | N/A |
| `medium` | AlertTriangle | amber | N/A |
| `high` | AlertOctagon | orange | 0xFEE75C (yellow) |
| `critical` | ShieldAlert | red | 0xED4245 (red) |

### Storage Table

```sql
CREATE TABLE alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','resolved')),
  current_value numeric NOT NULL,
  threshold_value numeric NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object')
);
```

### Indexes
- `idx_alert_events_type_status` — fast dedup lookups
- `idx_alert_events_severity_status` — dashboard severity filtering
- `idx_alert_events_created_at` — chronological ordering
- `idx_alert_events_resolved_at` — resolved history browsing

## Alert Types & Thresholds

All alerts evaluate metrics over a 24-hour window.

### Thresholds Table

| Alert Type | Critical | High | Medium | Low | Source |
|---|---|---|---|---|---|
| `queue_backlog_spike` | ≥5000 | ≥1000 | ≥500 | ≥100 | `getQueueSnapshot().pendingCount` |
| `dead_letter_spike` | ≥500 | ≥100 | ≥50 | ≥10 | `getQueueSnapshot().deadLetterCount` |
| `invalid_signature_spike` | ≥500 | ≥100 | ≥50 | ≥20 | `verification_logs` (event: `event.invalid_signature`) |
| `replay_attack_spike` | ≥100 | ≥50 | ≥10 | ≥5 | `verification_logs` (event: `event.replay_attempt`) |
| `webhook_failure_burst` | ≥500 | ≥100 | ≥30 | ≥10 | `verification_logs` (event: `webhook.provider_failure`) |
| `auth_failure_spike` | ≥1000 | ≥500 | ≥100 | ≥30 | `verification_logs` (event: `event.auth_failure`) |

### Threshold Evaluation Logic

```
For each alertType:
  exceeded = thresholds.filter(t => currentValue >= t.value)
                       .sort(desc by value)
  if exceeded.length > 0:
    alert with severity = exceeded[0].severity (highest matched)
```

## Deduplication

Only one active alert per `alert_type` at any time. `getActiveAlertOfType()` queries:

```sql
SELECT id FROM alert_events
WHERE alert_type = $type AND status = 'active'
LIMIT 1
```

If an active alert exists, no new alert is created for that type.

## Auto-Resolution

Each `checkAlerts()` run fetches all active alerts and compares current values against their thresholds.

```
For each active alert:
  currentValue = getCurrentValue(alert.alert_type)
  if currentValue < alert.threshold_value:
    UPDATE alert SET status='resolved', resolved_at=NOW()
```

This means resolution cadence is tied to the check frequency (every 5 minutes, same as the event worker CRON).

## Discord Notifications

Sent for newly triggered alerts with severity `high` or `critical` only. No notification for `low`/`medium` or duplicate-suppressed alerts.

**Environment variable:** `INTERNAL_ALERT_DISCORD_WEBHOOK`

If unset, notifications are silently skipped — no crash, no log spam.

Discord embed format:
- Title: `🔔 {Alert Label}` (e.g., "Queue Backlog Spike")
- Color: red (critical), yellow (high)
- Fields: Severity, Current Value, Threshold, Alert ID
- Timestamp: ISO 8601

## Integration Points

### Event Worker Integration

`/api/internal/event-worker` runs `checkAlerts()` after `processEventQueue()`:
- Fresh queue + webhook counters are available
- Alert check failures are caught and logged — never block queue processing
- Worker response includes `alerts: { triggered, resolved }` when successful

### Alert Check Endpoint

`POST /api/internal/check-alerts` — standalone endpoint (same CRON_SECRET auth):
- Response: `{ success: true, triggered: N, resolved: M }`
- Can be called independently if alert evaluation cadence differs from queue processing

### Monitoring Counters

Alerts reuse the existing monitoring foundation:
- `verification_logs` for security and webhook counters (via `countMetric()`)
- `getQueueSnapshot()` for queue health (pending + dead letter from `event_logs`)

## Admin Dashboard

Route: `/dashboard/admin/alerts`

### Access Control
- Requires `role === 'admin'` from the session profile
- Non-admin users see "Access Denied" shield with "Admin role required" message
- No data leakage — the entire page is gated before any query

### UI Features
- **Summary Cards:** Active (red), Resolved (green), Total counts
- **Filter Bar:** Toggle active/resolved, filter by severity (All/Low/Medium/High/Critical)
- **ActiveAlertsTable:** Severity badge (icon + colored border), current value, threshold, relative trigger time
- **AlertHistoryTable:** Same columns + resolved time column
- **Pagination:** Page navigation with prev/next, "Page X of Y" indicator
- **Empty States:** Green shield icon + "No active alerts" for active view; Shield icon for resolved view

### Component Mapping
| Component | Export | Location |
|---|---|---|
| `AlertSeverityBadge` | Inline (alerts-client.tsx) | Severity column |
| `AlertStatusBadge` | Inline (alerts-client.tsx) | Status column |
| `ActiveAlertsTable` | Exported function | Main content (active view) |
| `AlertHistoryTable` | Exported function | Main content (resolved view) |
| `FilterBar` | Exported function | Above tables |
| `SummaryCards` | Exported function | Top of page |
| `Pagination` | Exported function | Table footer |
| `AlertsClient` | Exported function | Wrapper composing all above |

## Security Review

### No Secrets Exposed
- DTOs contain only: `id`, `alertType`, `severity`, `status`, `currentValue`, `thresholdValue`, `message`, `createdAt`, `resolvedAt`
- No `event_secret`, `session_id`, `nonce`, `webhook_url`, `creator_id`, or session tokens
- `message` field is auto-generated from alert type + values — no user-provided content

### Internal-Only
- `/dashboard/admin/alerts` requires `user.role === 'admin'`
- `/api/internal/check-alerts` requires `CRON_SECRET` Bearer token
- Worker call to `checkAlerts()` is server-side only, within the CRON-secured worker route

### Discord Webhook Safety
- `INTERNAL_ALERT_DISCORD_WEBHOOK` env var is optional
- If missing, notification path short-circuits immediately — no crash, no error
- Webhook URL is never included in any DTO or dashboard response

### Database Access
- `alert_events` table has no RLS — accessed only by `supabaseAdmin` (service role)
- No client-facing endpoints query this table
- All reads and writes are server-side only

## Files

| File | Change |
|---|---|
| `app/lib/services/internal-alert-service.ts` | **Created** — alert engine, threshold evaluation, dedup, resolution, Discord |
| `app/api/internal/check-alerts/route.ts` | **Created** — CRON-secured alert check endpoint |
| `app/api/internal/event-worker/route.ts` | Modified — imports `checkAlerts` and calls after queue processing |
| `app/dashboard/admin/alerts/page.tsx` | **Created** — admin-only server component |
| `app/dashboard/admin/alerts/alerts-client.tsx` | **Created** — 7 client components |
| `app/dashboard/admin/alerts/loading.tsx` | **Created** — skeleton loading state |
| `migrations/010_internal_alerts.sql` | **Created** — `alert_events` table + indexes |
| `migrations/010_internal_alerts_rollback.sql` | **Created** — drop table |
| `__tests__/internal-alert-service.test.ts` | **Created** — 24 tests |
| `PHASE8E3_INTERNAL_ALERTS.md` | **Created** — this document |

## Dependencies

### Depends on (reads)
- `app/lib/services/event-monitoring-service` — `getQueueSnapshot()`
- `app/lib/supabase` — `supabaseAdmin` (service role)
- `app/lib/auth/session-auth` — `getCurrentUser()` (dashboard route)
- `app/dashboard/components/ErrorBanner` — error display

### No changes to
- Event API (`/api/events/report`)
- Delivery sessions
- Discord provider delivery
- Loader system
- Creator-facing dashboards
- License system
- Phase 7 code

## Tests

24 tests covering:

- **Pure threshold evaluation (12):** empty state, low trigger, high trigger, critical trigger, below-threshold no-op, exact boundary, dead_letter medium, invalid_signature low, replay critical, auth_failure low, webhook low, multiple all-critical
- **Integration (6):** queue backlog trigger, no trigger below threshold, invalid signature, replay, auth failure, webhook failure
- **Deduplication (2):** suppress duplicate type, allow other type
- **Resolution (2):** resolve below threshold, keep active above threshold
- **Discord gating (1):** no crash when env var absent

## Success Criteria

- [x] Internal alerts generated automatically via CRON worker
- [x] Duplicate alerts suppressed (one active per alert_type)
- [x] Alerts auto-resolve when metrics return below threshold
- [x] Discord notifications for high/critical alerts (via INTERNAL_ALERT_DISCORD_WEBHOOK env var)
- [x] Admin alert dashboard at `/dashboard/admin/alerts` with active/resolved views, severity filters, pagination
- [x] No creator-visible alerts
- [x] No secrets exposed in DTOs or Discord embeds
- [x] Build, lint, and full test suite pass
