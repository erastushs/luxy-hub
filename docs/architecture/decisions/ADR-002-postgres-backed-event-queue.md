# ADR-002: PostgreSQL-Backed Event Queue

## Status

Accepted

## Date

2026-06-11

## Context

LuxyHub accepts signed runtime events through `POST /api/events/report`. Accepted events are stored in `event_logs` with queue state and are later processed by `POST /api/internal/event-worker`.

The current queue uses Supabase PostgreSQL tables and application-level polling:

- `event_logs.delivery_status` tracks `pending`, `delivered`, and `dead_letter`.
- `event_logs.retry_count`, `last_retry_at`, and `error_message` track delivery attempts.
- `event_logs.claimed_at` provides a worker lease for overlapping worker protection.
- The worker processes pending events in small batches and applies retry/backoff behavior.

## Problem

Runtime event delivery must be durable enough to survive provider failures and worker interruptions, but the project should avoid unnecessary infrastructure complexity before scale requires it.

The system needs:

- Durable event storage.
- Simple retry and dead-letter behavior.
- Operational visibility from the dashboard and SQL.
- Low operational cost.
- Minimal infrastructure footprint.
- Behavior that works on Vercel and Supabase without a long-running worker process.

## Decision

LuxyHub accepts PostgreSQL as the backing store for the event queue.

No Redis, external message broker, queue SaaS, or long-running worker infrastructure is used for the current expected scale.

Queue behavior:

- Event report API validates and inserts durable `event_logs` rows.
- Worker polls pending rows ordered by `received_at`.
- Worker claims rows by setting `claimed_at`.
- Stale claims older than the lease window are recoverable.
- Provider delivery updates the same row to `delivered`, `pending`, or `dead_letter`.
- Dead-letter rows remain queryable and replayable.

## Consequences

Positive consequences:

- No additional infrastructure beyond Supabase PostgreSQL.
- Queue state is queryable with SQL and easy to inspect during incidents.
- Event history and queue state live together.
- Backups include queue data and delivery audit history.
- Development and production use the same persistence model.
- Operational cost remains low.

Negative consequences:

- Polling is less efficient than broker push semantics at high volume.
- Queue throughput is constrained by serverless worker cadence, batch size, and database performance.
- PostgreSQL table growth requires retention cleanup.
- Complex queue semantics such as priorities, delayed jobs, and high fan-out are application-managed.
- Large backlogs can increase database load.

Reliability implications:

- Accepted events are durable once inserted.
- Worker interruption can leave stale claims, but lease expiry makes them recoverable.
- At-least-once provider delivery semantics are possible; provider idempotency is not guaranteed.
- Ordering is best effort by `received_at`, not a hard global guarantee.

Expected scale:

- Current expected scale is compatible with periodic batch polling.
- The design is appropriate for creator webhook notifications and event analytics at current project size.
- A broker can be reconsidered if queue volume, latency requirements, or worker concurrency exceed PostgreSQL polling limits.

## Alternatives Considered

### Redis Queue

Rejected for now because it adds infrastructure, credentials, operational monitoring, backup concerns, and deployment complexity. Redis may be reconsidered if queue latency/throughput requirements grow beyond PostgreSQL polling.

### External Broker or Queue SaaS

Rejected for now because services such as SQS, Cloud Tasks, or managed queue products add provider-specific integration and operational cost that are not justified by current scale.

### Synchronous Webhook Delivery During Event Report

Rejected because provider latency or downtime would block runtime scripts and make `/api/events/report` unreliable.

### Vercel Background Execution Only

Rejected because serverless background execution alone does not provide durable retry/dead-letter state or easy operational inspection.

## Related Documents

- `docs/runtime/EVENT_QUEUE.md`
- `docs/operations/EVENT_QUEUE_RUNBOOK.md`
- `docs/database/SCHEMA.md`
- `docs/database/MIGRATIONS.md`
- `docs/architecture/ARCHITECTURE.md`
- `docs/phases/phase8/active/PHASE8_EVENT_PLATFORM_ARCHITECTURE.md`
