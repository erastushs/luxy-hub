# Phase 8 Cron Strategy — Vercel Hobby Compatibility

Date: 2026-06-10
Status: Implemented scheduler decision

## Current Scheduler Inventory

| Path | Schedule | Purpose | Current Scheduler |
|---|---|---|---|
| `/api/cleanup` | `0 0 * * *` (daily midnight) | Event retention cleanup | Vercel Cron |
| `/api/internal/event-worker` | `*/5 * * * *` (every 5 min) | Queue processing + inline alert check | GitHub Actions |
| `/api/internal/check-alerts` | Unscheduled | Manual/debug standalone alert threshold evaluation | None |

Production event scheduling is implemented with GitHub Actions calling `https://luxyhub.vercel.app/api/internal/event-worker`. This keeps LuxyHub on Vercel Hobby while preserving a 5-minute worker cadence.

Do not use `https://www.luxyhub.space/api/internal/event-worker` for the scheduler. Cloudflare Bot Fight Mode or challenge rules can block GitHub Actions traffic before it reaches Vercel. No Cloudflare bypass rule is required because the scheduler uses the Vercel hostname directly.

## Alert Processing Architecture

### Current flow

```
GitHub Actions → POST https://luxyhub.vercel.app/api/internal/event-worker
  → processEventQueue()         // process pending events
  → checkAlerts()               // inline, fire-and-forget
  → respond with { queue stats + alert results }

Manual/debug only:
  POST /api/internal/check-alerts
    → checkAlerts()
    → respond with { triggered, resolved }
```

`checkAlerts()` inside `internal-alert-service.ts`:
- Queries `getCurrentValues()` — counts from `verification_logs` (24h window) + `getQueueSnapshot()` from `event_logs`
- Evaluates thresholds (queue backlog, dead letters, invalid sigs, replay attacks, webhook failures, auth failures)
- Deduplicates: one active alert per type
- Creates new alerts where threshold exceeded and no active alert exists
- Resolves active alerts where current value dropped below threshold
- Sends Discord notification for high/critical new alerts

### Why Path A already covers alert evaluation

The worker calls `checkAlerts()` immediately after queue processing (line 48 of `event-worker/route.ts`):

```typescript
const stats = await processEventQueue(resolveProvider)
// Alert check runs after queue processing so counters are fresh.
// Fire-and-forget — alert check failures never block queue processing.
let alertResult = null
try {
  alertResult = await checkAlerts()
} catch {
  console.error('Alert check failed during event worker run')
}
```

The queue snapshot (`pendingCount`, `deadLetterCount`) is current because `processEventQueue()` just finished mutating `event_logs`. The `verification_logs` counters are written asynchronously by event ingestion, so a 5-minute window between worker runs is already the granularity.

Path B (`/api/internal/check-alerts`) evaluates the same counters at the same cadence, producing identical results. The only failure mode it protects against is the worker crashing after `processEventQueue()` succeeds but before `checkAlerts()` completes — a ~100ms window within a CRON_SECRET-protected route that already has error handling around the alert call.

## Is a Dedicated Alert Cron Necessary?

**No.** The independent alert cron provides negligible additional safety:

| Failure scenario | Path A handles? | Path B helps? |
|---|---|---|
| Worker runs normally | Yes — `checkAlerts()` runs after queue | Redundant (same result) |
| Worker crashes before `processEventQueue()` | No queue processing, but `checkAlerts()` never called | No — queue stats are stale anyway |
| Worker crashes after `processEventQueue()`, before `checkAlerts()` | No | Yes — 5-min catch-up (narrow window) |
| Worker route 500s entirely | No | Yes — but root cause is worker failure, not alert gap |
| Queue is empty, no events to process | Yes — `checkAlerts()` still runs | Redundant |

The only meaningful benefit of Path B is the narrow window between queue processing completion and `checkAlerts()`. Given that:
- Both run inside `try/catch` with the same `CRON_SECRET` auth
- Alert evaluation itself has internal error handling per-alert-type
- Alert resolution is threshold-based (not time-critical to the second)

...this window is not operationally significant.

## Implemented Decision

### Production scheduler: GitHub Actions

**Keep:**
```
/api/cleanup                         0 0 * * *      (Vercel daily cron)
/api/internal/event-worker           */5 * * * *    (GitHub Actions)
```

**Do not schedule:**
```
/api/internal/check-alerts           (manual/debug only)
```

**Preserve:**
- `/api/internal/check-alerts` route itself — keep it for manual invocation and future use.
- `checkAlerts()` inline call inside the event worker — this is the canonical alert evaluation path.

### Rationale

1. **Vercel Hobby compatibility.** Vercel Hobby supports the daily cleanup cron but not a 5-minute event-worker cron.
2. **Alert evaluation is already coupled to queue processing by design.** The counters that `checkAlerts()` reads are populated by event ingestion and queue operations. Running it independently adds no fresh data.
3. **The worker already calls `checkAlerts()` after every batch.** Queue processing just finished, counters are current, alert evaluation follows.
4. **Cloudflare challenge avoidance.** GitHub Actions uses `https://luxyhub.vercel.app/api/internal/event-worker` directly, avoiding Cloudflare Bot Fight Mode challenges on `www.luxyhub.space`.
5. **Simpler mental model.** Alert cadence = worker cadence. Operations knows alerts are evaluated whenever the queue processes.

## Implemented Files

| File | Current State |
|---|---|
| `.github/workflows/event-worker.yml` | Runs every 5 minutes and posts to `$EVENT_WORKER_URL` with `CRON_SECRET`. |
| `vercel.json` | Keeps only daily `/api/cleanup`. |
| `app/api/internal/event-worker/route.ts` | Runs `processEventQueue()` then `checkAlerts()`. |
| `app/api/internal/check-alerts/route.ts` | Retained for manual/debug use; not scheduled. |
| `PHASE8_GITHUB_ACTIONS_SCHEDULER.md` | Documents the production scheduler and Cloudflare operational note. |
## What Stays

- `/api/internal/check-alerts` route: preserved for ad-hoc manual invocation (`curl -X POST -H "Authorization: Bearer $CRON_SECRET" /api/internal/check-alerts`). Useful for operations debugging and post-incident checks.
- `checkAlerts()` inline call in event worker: canonical alert evaluation path.
- All alert thresholds, dedup logic, resolution, and Discord notifications.

## Operational Tradeoffs

| Tradeoff | Impact |
|---|---|
| Alert cadence = worker cadence | A 5-min gap between worker runs means a 5-min gap between alert evaluations. All thresholds operate on 24h windows, so 5-min granularity is adequate. |
| No independent alert trigger on event ingestion spike | If 10,000 invalid-signature events arrive in 1 minute, the alert fires at most 5 minutes later when the worker runs. Acceptable for the current threshold levels (low starts at 20/24h). |
| Worker failure suppresses alerts | If the worker route 500s, neither queue processing nor alerting happens. This is the correct behavior: if the platform can't process events, alerting about event stats is noise. |

## Conclusion

The dedicated alert cron was introduced during Phase 8E.3 hardening as a precaution against the worker failing after queue processing but before `checkAlerts()`. This window is too narrow to justify the operational complexity and extra cron invocation.

The independent `check-alerts` cron has been removed. Alert evaluation remains inlined in the event worker. The production scheduler is GitHub Actions against the Vercel hostname, which preserves the 5-minute cadence on Vercel Hobby without requiring Cloudflare bypass rules.
