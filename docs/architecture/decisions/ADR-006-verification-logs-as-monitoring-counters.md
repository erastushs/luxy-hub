# ADR-006: Verification Logs as Monitoring Counters

## Status

Accepted

## Date

2026-06-11

## Context

LuxyHub has a `verification_logs` table originally used by key validation and Work.ink/key flows. The event platform also records security and webhook monitoring counters into `verification_logs` through lightweight service helpers.

Examples:

- `event.invalid_signature`
- `event.replay_attempt`
- `event.rate_limited`
- `event.auth_failure`
- `webhook.delivery_success`
- `webhook.delivery_failure`
- `webhook.provider_failure`

Internal alerts read recent counts from `verification_logs` and queue state from `event_logs`.

## Problem

The application needs internal monitoring counters before a dedicated metrics pipeline exists. These counters must work in serverless environments, be queryable during incidents, and support alert evaluation without adding external telemetry infrastructure.

## Decision

LuxyHub accepts `verification_logs` and runtime event tables as the current monitoring counter sources.

Analytics source:

- `event_logs` stores accepted runtime events and queue delivery status.
- `script_executions` stores secure delivery execution records.
- `script_downloads` remains historical raw delivery analytics.
- `verification_logs` stores operational event counters for validation, security, and webhook activity.

Alert source:

- `checkAlerts()` counts recent security/webhook records in `verification_logs`.
- `checkAlerts()` reads pending/dead-letter queue counts from `event_logs`.
- `alert_events` stores active/resolved alert state.

## Consequences

Positive consequences:

- No external metrics service is required for current internal alerts.
- Counters are durable and inspectable with SQL.
- Existing cleanup/retention paths can manage table growth.
- Incident response can correlate counters with event and queue records.
- Serverless functions can record counters with simple database inserts.

Negative consequences:

- `verification_logs` is not a high-performance metrics time-series database.
- High-volume counters can increase database write load.
- Retention cleanup affects historical monitoring depth.
- Counter inserts are best-effort in some paths and may be dropped on failure.
- Aggregations over long time windows can become expensive without rollups.

Retention implications:

- Retention policies must preserve enough data for alert windows and incident review.
- Cleanup should avoid deleting recent monitoring counters required by alert thresholds.
- Long-term analytics should move to rollups or dedicated analytics storage if volume grows.

## Alternatives Considered

### Dedicated Metrics Platform

Rejected for current scope because it adds setup, cost, credentials, dashboards, and alert routing before the project needs high-cardinality metrics.

### Vercel Logs Only

Rejected because logs are harder to query relationally, may have retention limits, and are not directly available to SQL-based alert evaluation.

### Event Logs for All Counters

Rejected because rejected events and provider/security counters do not always correspond to accepted event rows.

### In-Memory Counters

Rejected because serverless functions are ephemeral and counters would not be durable or globally consistent.

## Related Documents

- `docs/runtime/EVENT_QUEUE.md`
- `docs/operations/MONITORING.md`
- `docs/operations/EVENT_QUEUE_RUNBOOK.md`
- `docs/database/SCHEMA.md`
- `docs/architecture/ARCHITECTURE.md`
