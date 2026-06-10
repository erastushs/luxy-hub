# Phase 8D — Monitoring Foundation

Status: Implemented
Date: 2026-06-09
Scope: Lightweight security, queue, and webhook monitoring primitives only

## Scope Boundary

Implemented:

- Security counters for event API abuse signals
- Webhook delivery outcome counters
- Queue health snapshot helper
- Event retention cleanup counts returned from `/api/cleanup`
- Documentation for future alerting hooks

Not implemented:

- Full analytics dashboard
- Alert delivery integrations
- Long-term metrics warehouse
- Provider-specific dashboards
- User-facing event analytics charts

## Storage Approach

Phase 8D uses existing infrastructure instead of introducing a new analytics subsystem:

- Counter events are written to `verification_logs` with event names such as `event.invalid_signature` and `webhook.delivery_success`.
- Queue health is computed on demand from `event_logs` through `getQueueSnapshot()`.
- Cleanup deletion counts are returned from the existing cron response.

This keeps the foundation deployable without new tables beyond the Phase 8 hardening migration for queue claims.

## Metric Definitions

### Security Counters

| Metric | Source | Meaning |
|---|---|---|
| `event.invalid_signature` | `reportEvent()` | A session lookup succeeded, but HMAC comparison failed. |
| `event.replay_attempt` | `reportEvent()` | A validly signed event reused an existing nonce for the same session. |
| `event.rate_limited` | `reportEvent()` | A valid event session exceeded the per-session event limit. |

### Queue Counters / Gauges

| Metric | Source | Meaning |
|---|---|---|
| `pendingCount` | `getQueueSnapshot()` | Number of `event_logs` rows with `delivery_status = 'pending'`. |
| `deadLetterCount` | `getQueueSnapshot()` | Number of `event_logs` rows with `delivery_status = 'dead_letter'`. |
| `oldestPendingAgeSeconds` | `getQueueSnapshot()` | Age of the oldest pending event, or `null` when queue is empty. |

### Webhook Counters

| Metric | Source | Meaning |
|---|---|---|
| `webhook.delivery_success` | `processClaimedEvent()` | Provider delivery succeeded and event was marked delivered. |
| `webhook.delivery_failure` | `processClaimedEvent()` | Retryable provider failure left the event pending. |
| `webhook.provider_failure` | `processClaimedEvent()` | Permanent/exhausted provider failure moved the event to dead-letter. |

### Cleanup Counts

`/api/cleanup` now returns:

```json
{
  "event_logs": {
    "delivered": 0,
    "deadLetter": 0,
    "pending": 0
  }
}
```

Retention windows:

- Delivered: 30 days
- Dead Letter: 90 days
- Pending: 7 days

## Future Alerting Hooks

Recommended alerts once external monitoring is attached:

- Invalid signature spike: `event.invalid_signature` exceeds baseline in 5 minutes.
- Replay attack spike: `event.replay_attempt` greater than zero sustained over 5 minutes.
- Event flood: `event.rate_limited` spike by session.
- Queue backlog: `pendingCount` exceeds worker capacity for two cron intervals.
- Queue staleness: `oldestPendingAgeSeconds` exceeds 900 seconds.
- Dead-letter growth: `deadLetterCount` increases faster than baseline.
- Provider burst failure: `webhook.provider_failure` or `webhook.delivery_failure` spike by provider/script.

## Files

| File | Purpose |
|---|---|
| `app/lib/services/event-monitoring-service.ts` | Counter writers and queue snapshot helper. |
| `app/lib/services/event-reporting-service.ts` | Records security counters. |
| `app/lib/services/event-queue-service.ts` | Records webhook delivery counters. |
| `app/api/cleanup/route.ts` | Returns event retention deletion counts. |
| `__tests__/cleanup-route.test.ts` | Verifies cleanup count response. |
