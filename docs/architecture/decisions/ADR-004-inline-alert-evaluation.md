# ADR-004: Inline Alert Evaluation

## Status

Accepted

## Date

2026-06-11

## Context

LuxyHub records internal operational alerts in `alert_events`. Alert evaluation is implemented by `checkAlerts()` and currently runs after event queue processing inside `POST /api/internal/event-worker`.

Alert inputs include:

- Queue snapshot from `event_logs`.
- Security counters from `verification_logs`.
- Webhook failure counters from `verification_logs`.

Alert types include queue backlog, dead-letter spikes, invalid signatures, replay attacks, webhook failures, and event auth failures.

## Problem

The system needs regular internal alert evaluation without adding another scheduled endpoint, another scheduler workflow, or a separate alert worker.

Alert evaluation should happen near the event queue state changes so queue and webhook counters are fresh.

## Decision

LuxyHub accepts inline alert evaluation after event worker execution.

Execution model:

- `POST /api/internal/event-worker` validates `CRON_SECRET`.
- The worker processes a batch of pending events.
- After queue processing completes, the route calls `checkAlerts()`.
- Alert check creates new active alert rows, deduplicates by alert type, resolves alerts whose current value falls below threshold, and optionally notifies Discord for high/critical alerts.
- Alert check failures are logged and do not fail the queue worker response.

No separate alert scheduler exists for the current architecture.

## Consequences

Positive consequences:

- One scheduled route covers queue processing and alert evaluation.
- Alert values are evaluated after queue counters are updated.
- Operational setup is simpler.
- No extra CRON secret path or workflow must be maintained.
- Alert check failures do not block queue processing.

Negative consequences:

- Alert evaluation cadence is tied to event worker cadence.
- If the event worker scheduler fails, alert evaluation also stops.
- Alert checks add work to the worker route and can contribute to function duration.
- Alerting for non-event systems may need separate evaluation later if scope grows.

Performance considerations:

- Current alert checks are simple count queries over operational tables and recent counters.
- Evaluation is acceptable after each 5-minute worker run at expected scale.
- Thresholds are coarse operational signals rather than high-cardinality metrics.
- If alert queries become expensive, indexes, rollups, or a separate scheduler can be revisited.

Operational mitigations:

- External uptime monitors remain independent of internal alert evaluation.
- GitHub Actions workflow failures are monitored separately.
- Manual worker execution also runs alert checks.
- `alert_events` provides persisted state even if Discord routing fails.

## Alternatives Considered

### Separate Alert Scheduler

Rejected for current scope because it duplicates scheduler configuration and secrets while providing little benefit for event-driven alert inputs.

### Evaluate Alerts During Every Event Report

Rejected because event report should remain low-latency and should not run aggregate operational queries on runtime request path.

### External Monitoring Only

Rejected because external uptime monitors cannot see internal queue backlog, dead-letter counts, replay spikes, or webhook provider failure bursts.

### Database Triggers for Alerts

Rejected because alert threshold logic is easier to test and operate in application service code, and triggers would add hidden database-side behavior.

## Related Documents

- `docs/runtime/EVENT_QUEUE.md`
- `docs/operations/MONITORING.md`
- `docs/operations/INCIDENT_RESPONSE.md`
- `docs/operations/EVENT_QUEUE_RUNBOOK.md`
- `docs/database/SCHEMA.md`
- `docs/phases/phase8/active/PHASE8_EVENT_PLATFORM_ARCHITECTURE.md`
