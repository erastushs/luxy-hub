# ADR-003: GitHub Actions Event Worker Scheduler

## Status

Accepted

## Date

2026-06-11

## Context

The event queue worker is exposed as an authenticated internal route:

- `POST /api/internal/event-worker`

The route requires `Authorization: Bearer $CRON_SECRET`, processes pending `event_logs`, and then evaluates internal alerts. Production scheduling currently uses GitHub Actions every 5 minutes against the Vercel deployment hostname:

```text
GitHub Actions
  -> POST https://luxyhub.vercel.app/api/internal/event-worker
  -> processEventQueue()
  -> checkAlerts()
```

Vercel Cron remains available for daily cleanup and as an option on deployments where cron availability and plan constraints permit it.

## Problem

LuxyHub needs reliable periodic worker execution without running dedicated worker infrastructure. The scheduler must work with the deployed serverless application and avoid Cloudflare challenges on the public custom domain.

Constraints:

- The app runs on Vercel serverless functions.
- A separate long-running worker is not part of current infrastructure.
- Event processing should run every 5 minutes.
- The public custom domain can be affected by Cloudflare bot protections.
- Scheduler failures must be visible and easy to diagnose.

## Decision

LuxyHub accepts GitHub Actions as the primary production scheduler for the event worker.

The scheduler calls the Vercel hostname directly instead of the Cloudflare-fronted custom hostname.

Architecture:

- GitHub Actions workflow runs on a 5-minute schedule.
- Workflow sends `POST` to `https://luxyhub.vercel.app/api/internal/event-worker`.
- Workflow includes `Authorization: Bearer $CRON_SECRET`.
- Worker processes queue and evaluates alerts inline.
- Vercel Cron remains secondary/plan-dependent and daily cleanup remains separate.

## Consequences

Positive consequences:

- No dedicated worker host is required.
- Scheduler state and failures are visible in GitHub Actions logs.
- Vercel hostname avoids Cloudflare Bot Fight Mode and custom-domain challenge issues.
- `CRON_SECRET` gives a simple shared authorization mechanism.
- Manual incident response can use the same endpoint and secret.

Negative consequences:

- GitHub Actions scheduled workflows are not hard real-time and can be delayed.
- Scheduler depends on GitHub availability and repository workflow configuration.
- Secrets must be kept in sync between GitHub Actions and Vercel.
- Worker cadence is coarse compared with a continuously running worker.
- Missed scheduled runs can create queue backlog until the next successful run or manual invocation.

Failure modes:

- GitHub Actions disabled or delayed.
- `CRON_SECRET` mismatch returns `401`.
- Vercel environment missing `CRON_SECRET` returns `500`.
- Worker route errors return `500` and leave queue rows pending.
- Provider latency can make a run slow and leave stale claims recoverable after lease expiry.

Operational mitigations:

- Monitor workflow results.
- Keep event backlog alerts active.
- Use manual `curl` worker execution during incidents.
- Use the Vercel hostname for scheduler target.
- Rotate and validate `CRON_SECRET` using the secret rotation runbook.

## Alternatives Considered

### Vercel Cron as Primary Scheduler

Not selected as primary because availability and frequency can be plan-dependent. It remains useful for daily cleanup and can be used for event worker scheduling where deployment plan supports it reliably.

### Cloudflare-Fronted Custom Domain Scheduler Target

Rejected because bot protection can challenge automated scheduler requests. The Vercel hostname avoids that routing risk.

### Dedicated Worker Service

Rejected for current scale because it adds hosting, deployment, health checks, secrets, and monitoring overhead.

### Manual-Only Worker Execution

Rejected because event delivery must progress without operator intervention.

## Related Documents

- `docs/runtime/EVENT_QUEUE.md`
- `docs/operations/EVENT_QUEUE_RUNBOOK.md`
- `docs/operations/MONITORING.md`
- `docs/operations/INCIDENT_RESPONSE.md`
- `docs/operations/SECRET_ROTATION.md`
- `docs/phases/phase8/active/PHASE8_GITHUB_ACTIONS_SCHEDULER.md`
