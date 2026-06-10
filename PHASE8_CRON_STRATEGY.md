# Phase 8 Cron Strategy — Vercel Hobby Compatibility

Date: 2026-06-10
Status: Architecture review (no code changes)

## Current Cron Inventory

| Path | Schedule | Purpose | Hobby Compat |
|---|---|---|---|
| `/api/cleanup` | `0 0 * * *` (daily midnight) | Event retention cleanup | **Yes** |
| `/api/internal/event-worker` | `*/5 * * * *` (every 5 min) | Queue processing + inline alert check | **No** |
| `/api/internal/check-alerts` | `*/5 * * * *` (every 5 min) | Standalone alert threshold evaluation | **No** |

## Vercel Hobby Limitation

Vercel Hobby allows only **daily** cron jobs. `*/5 * * * *` and other sub-daily schedules require Vercel Pro.

Two of three current crons are Hobby-incompatible. The event worker itself can not run every 5 minutes on Hobby.

## Alert Processing Architecture

### Current flow (two paths to `checkAlerts()`)

```
Path A (primary):
  Vercel Cron → /api/internal/event-worker
    → processEventQueue()         // process up to 50 pending events
    → checkAlerts()               // inline, fire-and-forget
    → respond with { queue stats + alert results }

Path B (redundant):
  Vercel Cron → /api/internal/check-alerts
    → checkAlerts()               // standalone
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

## Recommendation

### Simplest architecture: remove the independent alert cron

**Keep:**
```
/api/cleanup         0 0 * * *    (daily — Hobby compatible)
/api/internal/event-worker   */5 * * * *    (sub-daily — Pro required)
```

**Remove:**
```
/api/internal/check-alerts   */5 * * * *    (redundant — remove)
```

**Preserve:**
- `/api/internal/check-alerts` route itself — keep it for manual invocation and future use
- `checkAlerts()` inline call inside the event worker — this is and remains the primary path

### Rationale

1. **Alert evaluation is already coupled to queue processing by design.** The counters that `checkAlerts()` reads are populated by event ingestion and queue operations. Running it independently adds no fresh data.

2. **The worker already calls `checkAlerts()` after every batch.** This is the natural trigger: queue processing just finished, counters are current, alert evaluation follows.

3. **Redundancy cost > benefit.** An extra cron means extra cold starts, extra `verification_logs` queries, and extra alert operations for no additional detection capability.

4. **Simpler mental model.** Alert cadence = worker cadence. Operations team knows alerts are evaluated whenever the queue processes.

### Hobby Plan: daily cadence

On Vercel Hobby, even the event worker can only run daily. In that scenario:

```
/api/cleanup                0 0 * * *   (daily)
/api/internal/event-worker  0 0 * * *   (daily — only option)
```

Tradeoffs:
- Queue processing latency: up to 24 hours for event delivery
- Alert evaluation latency: up to 24 hours
- Acceptable for low-volume dev/staging environments
- Not suitable for production event delivery

### Pro Plan (recommended for production)

```
/api/cleanup                0 0 * * *       (daily)
/api/internal/event-worker  */5 * * * *     (every 5 min)
```

Alert evaluation runs inline inside the worker, so it inherits the 5-minute cadence. No separate alert cron needed.

### Upgrade Path: Hobby → Pro

When upgrading from Hobby to Pro:
1. Change event worker schedule from daily to `*/5 * * * *`
2. Alert evaluation automatically runs at the new cadence (inlined in worker)
3. No additional `check-alerts` cron needed
4. If future alert types require faster evaluation (e.g., 1-minute attack detection), add a standalone cron then — but the architecture doesn't need it today

## Required Changes

| Change | File | Priority |
|---|---|---|
| Remove `/api/internal/check-alerts` cron | `vercel.json` | High |
| Update event worker route comment — remove "independently scheduled" language | `app/api/internal/event-worker/route.ts` | Medium |
| Update check-alerts route comment — note it's for manual/adhoc use, not scheduled | `app/api/internal/check-alerts/route.ts` | Medium |
| Update ARCHITECTURE.md — remove independent alert cron from security posture | `ARCHITECTURE.md` | Low |
| Update PHASE8_CLOSEOUT.md — note cron strategy decision | `PHASE8_CLOSEOUT.md` | Low |

## What Stays

- `/api/internal/check-alerts` route: preserved for ad-hoc manual invocation (`curl -X POST -H "Authorization: Bearer $CRON_SECRET" /api/internal/check-alerts`). Useful for operations debugging and post-incident checks.
- `checkAlerts()` inline call in event worker: unchanged — this is the canonical alert evaluation path.
- All alert thresholds, dedup logic, resolution, Discord notifications: unchanged.

## Operational Tradeoffs

| Tradeoff | Impact |
|---|---|
| Alert cadence = worker cadence | A 5-min gap between worker runs means a 5-min gap between alert evaluations. All thresholds operate on 24h windows, so 5-min granularity is adequate. |
| No independent alert trigger on event ingestion spike | If 10,000 invalid-signature events arrive in 1 minute, the alert fires at most 5 minutes later when the worker runs. Acceptable for the current threshold levels (low starts at 20/24h). |
| Worker failure suppresses alerts | If the worker route 500s, neither queue processing nor alerting happens. This is the correct behavior: if the platform can't process events, alerting about event stats is noise. |

## Conclusion

The dedicated alert cron was introduced during Phase 8E.3 hardening as a precaution against the worker failing after queue processing but before `checkAlerts()`. This window is too narrow to justify the operational complexity and extra cron invocation.

**Remove the independent `check-alerts` cron. Alert evaluation remains inlined in the event worker.** This is simpler, cheaper (one less cold start every 5 minutes), and operationally equivalent.
