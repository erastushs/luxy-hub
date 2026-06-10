# Phase 8 Final Audit

Date: 2026-06-10
Status: Final audit-only review
Final recommendation: GO WITH CONDITIONS

## Executive Summary

Phase 8 can be considered feature-complete for the Discord-backed Event Platform: event ingestion, event signing, queue processing, replay operations, Discord delivery, creator operations dashboards, monitoring counters, creator analytics/security dashboards, and internal alerting all exist in the current implementation.

The hardening work materially resolved the earlier NO GO blockers documented in `PHASE8_EVENT_PLATFORM_AUDIT.md`: event secrets are now generated and returned to runtime clients, the queue has claim leases, dashboard test webhooks process only the created event, retention cleanup exists, and monitoring/alerting surfaces have been added.

This is not a clean GO. The strongest remaining issue is that `alert_events` is created without RLS or explicit deny policies, unlike the rest of the operational schema. There are also accepted or unresolved limitations around nonce replay atomicity, plaintext Discord webhook URLs, unbounded bulk replay, best-effort counters, and global security metrics being shown in creator-facing security dashboards.

## Evidence Reviewed

Documents:

- `PHASE8_EVENT_PLATFORM_AUDIT.md`
- `PHASE8_POST_HARDENING_AUDIT.md`
- `PHASE8D_MONITORING_FOUNDATION.md`
- `PHASE8E1_ANALYTICS_DASHBOARD.md`
- `PHASE8E2_SECURITY_MONITORING.md`
- `PHASE8E3_INTERNAL_ALERTS.md`
- `ARCHITECTURE.md`
- `TODO.md`

Implementation:

- `app/lib/services/delivery-session-service.ts`
- `app/api/delivery/session/route.ts`
- `app/api/delivery/fetch/route.ts`
- `app/api/events/report/route.ts`
- `app/lib/services/event-reporting-service.ts`
- `app/lib/repositories/event-repository.ts`
- `app/lib/services/event-queue-service.ts`
- `app/api/internal/event-worker/route.ts`
- `app/lib/providers/discord-provider.ts`
- `app/lib/services/dashboard-webhook-service.ts`
- `app/lib/services/event-dashboard-service.ts`
- `app/lib/services/event-analytics-service.ts`
- `app/lib/services/security-monitoring-service.ts`
- `app/lib/services/internal-alert-service.ts`
- `app/api/internal/check-alerts/route.ts`
- `app/api/cleanup/route.ts`
- `migrations/008_event_platform.sql`
- `migrations/009_event_platform_hardening.sql`
- `migrations/010_internal_alerts.sql`
- `schema.sql`
- `vercel.json`

## Completed Capabilities

### Event API

Implemented:

- `POST /api/events/report` parses JSON and delegates validation to `reportEvent()`.
- Delivery sessions now generate a per-session `event_secret` with `randomBytes(32).toString('base64url')`.
- `/api/delivery/session` returns `session_token`, `event_secret`, and `expires_in`.
- `/api/delivery/fetch` returns `event_secret` with the runtime payload.
- Event sessions are looked up by SHA-256 session token hash.
- Expired sessions and sessions missing `event_secret` are rejected.
- Consumed sessions are accepted for event reporting, matching the documented design.
- HMAC-SHA256 verification uses the server-stored `event_secret` and `timingSafeEqual`.
- Event type, timestamp, nonce, signature format, payload size, rate limit, and replay checks are implemented.
- Security counters record auth failures, invalid signatures, replay attempts, and rate-limit hits.

Assessment:

- The earlier end-to-end event secret gap is fixed.
- HMAC forgery is not supported by any evidence reviewed.
- Expired sessions are rejected.
- Event signing remains tied to exact `JSON.stringify(payload)` serialization, which is a compatibility constraint.

### Event Security

Implemented:

- Nonce format is restricted to 32 lowercase hex characters.
- Replay lookup is scoped to `(session_id, nonce)`.
- Stored `script_id` comes from the delivery session, not client input.
- Payload storage is capped at 4096 bytes after JSON parsing.
- Event rate limiting is enforced per internal delivery session ID after successful HMAC validation.
- Auth and signature failures are counted in `verification_logs`.

Assessment:

- Normal replay after first storage is rejected.
- Concurrent duplicate signed submissions can still race because `(session_id, nonce)` is indexed but not unique.
- Invalid-session and malformed-request floods are measured, but not throttled by the event session limiter because the trusted session ID is not available before validation.

### Queue Processing

Implemented:

- `event_logs.claimed_at` was added by `migrations/009_event_platform_hardening.sql`.
- `getPendingEvents()` selects pending rows where `claimed_at` is null or stale.
- `claimEventForProcessing()` claims rows before provider delivery.
- `processEventQueue()` skips rows it cannot claim.
- Stale claims recover after the 15-minute lease window.
- Retryable failures remain pending with retry count and `last_retry_at`.
- Permanent or exhausted failures move to `dead_letter`.
- Delivered, failed, skipped, replayed, and dead-letter updates clear `claimed_at`.
- Cleanup deletes delivered events after 30 days, dead-letter events after 90 days, and pending events after 7 days.

Assessment:

- Worker overlap is materially mitigated.
- Queue semantics remain at-least-once, not exactly-once.
- A crash after Discord accepts a webhook but before DB status update can still cause duplicate external delivery on a later run.

### Replay Protection

Implemented:

- Replay attempts after a stored nonce are rejected.
- Replay attempts are counted via `event.replay_attempt`.
- Dead-letter replay is owner-gated and only allowed for `delivery_status = 'dead_letter'`.
- Replay resets the event to `pending` and reuses the normal queue path.

Assessment:

- Replay controls are adequate for normal sequential replays.
- Strict replay prevention is not guaranteed under concurrent duplicate submissions.
- Bulk replay remains unbounded per script.

### Monitoring Foundation

Implemented:

- Security counters: `event.invalid_signature`, `event.replay_attempt`, `event.rate_limited`, `event.auth_failure`.
- Webhook counters: `webhook.delivery_success`, `webhook.delivery_failure`, `webhook.provider_failure`.
- Queue snapshot: pending count, dead-letter count, oldest pending age.
- Event cleanup counts in `/api/cleanup`.
- Counters are written asynchronously to `verification_logs`.

Assessment:

- Monitoring is broad enough to detect the main Phase 8 abuse and reliability signals.
- Counter writes are best-effort and swallowed on failure, so they are metrics rather than durable audit records.

### Analytics Dashboard

Implemented:

- `/dashboard/scripts/[slug]/analytics/events`.
- Owner-gated service via `getOwnedScript()`.
- Overview counts, success rate, trends, provider health, queue health, and security metric cards.
- Safe DTOs exclude session IDs, nonces, webhook URLs, event secrets, creator IDs, and session tokens.

Assessment:

- Useful creator-facing operational visibility exists.
- Trend aggregation currently fetches event rows and groups in application code, which is acceptable for V1 but a scaling concern for high-volume scripts.
- Security metrics shown here are global counters, not script-scoped.

### Security Dashboard

Implemented:

- `/dashboard/scripts/[slug]/security`.
- Owner-gated service via `getOwnedScript()`.
- Security overview, 24h/7d/30d trends, weighted security score, risk classification, anomaly detection, and events table.
- `event.auth_failure` tracking was added to ingestion failures.
- Safe DTOs avoid secrets and session material.

Assessment:

- Creator-facing security visibility exists.
- The dashboard is gated by script ownership, but the counters it displays come from global `verification_logs`, not per-script metrics. This is not a cross-account event leak, but it can expose platform-wide abuse levels to any creator and can misrepresent a script-specific security posture.

### Internal Alerts

Implemented:

- `alert_events` table and indexes.
- `checkAlerts()` threshold engine for queue backlog, dead-letter growth, invalid signatures, replay attacks, webhook failures, and auth failures.
- One active alert per alert type deduplication.
- Auto-resolution when values drop below threshold.
- Discord notification for high and critical alerts via `INTERNAL_ALERT_DISCORD_WEBHOOK`.
- `/api/internal/check-alerts` protected by `CRON_SECRET`.
- `/api/internal/event-worker` runs `checkAlerts()` after queue processing.
- `/dashboard/admin/alerts` gates on `user.role === 'admin'`.

Assessment:

- Alert evaluation and internal dashboard are present.
- The standalone check-alert route exists but is not scheduled in `vercel.json`; scheduled alert checks currently depend on the event worker completing far enough to call `checkAlerts()`.
- `alert_events` has no RLS or explicit deny policies in `migrations/010_internal_alerts.sql` or `schema.sql`.

### Discord Integration

Implemented:

- Webhook URLs must match anchored Discord or DiscordApp webhook URL regex.
- Invalid webhook URLs are rejected before HTTP.
- Discord 429, 5xx, network errors, and timeouts are retryable.
- Discord 400, 401, 403, and 404 are permanent failures.
- Fetch timeout is 10 seconds.
- Provider selection comes from server-side webhook config, not event payload.

Assessment:

- Malformed URLs cannot bypass the current validation path.
- Deleted Discord webhooks dead-letter instead of looping forever.
- Provider failures are event-scoped, but slow retryable failures can still consume worker runtime.

### Dashboard Operations

Implemented:

- Webhook config read/save/toggle/test actions call `requireAuth()` and service-layer ownership checks.
- Event history, detail, dead-letter listing, replay, and bulk replay call `requireAuth()` and service-layer ownership checks.
- Event detail and single replay verify the event belongs to the owned script.
- Webhook DTO masks raw webhook URLs.
- Event DTO omits session IDs, nonces, event secrets, webhook config, creator IDs, and session token/hash.
- Test webhook now processes only the created heartbeat event via `processSingleEvent()`.

Assessment:

- No evidence was found that users can read or replay another creator's event rows through the implemented services.
- Webhook lifecycle audit records remain unimplemented.

## Risk Register

### Critical

No Critical finding is supported by the current evidence.

### High

#### HIGH-1: `alert_events` lacks RLS / explicit deny policies

Description:

- `migrations/010_internal_alerts.sql` creates `alert_events` and indexes but does not enable RLS.
- `schema.sql` mirrors the table without RLS.
- Existing operational tables such as `event_logs`, `verification_logs`, `rate_limits`, `delivery_sessions`, `audit_logs`, and `delivery_builds` enable RLS with deny-all or owner-aware policies.
- `ARCHITECTURE.md` states that RLS is enabled across the schema, which is not true for `alert_events`.

Impact:

- Depending on deployed Supabase grants, internal alert records may be readable or writable outside intended service-role/admin paths.
- Unauthorized writes could suppress, create, or pollute operational alert state.
- Even read-only exposure would leak internal operational/security posture.

Likelihood:

- Medium. The app code uses service-role access and the dashboard is admin-gated, but the database table itself does not follow the project's established RLS boundary.

Recommendation:

- Before production launch, enable RLS on `alert_events` and add deny-all policies for `anon` and `authenticated`, plus service-role access if desired for documentation parity. If relying on explicit grants instead, document and verify them in the migration.

### Medium

#### MEDIUM-1: Nonce replay protection is not atomic

Description:

- Replay detection uses `findEventByNonce()` before `createEventLog()`.
- `idx_event_logs_session_nonce` is not unique.
- There is no transaction or atomic insert path preventing two concurrent inserts with the same `(session_id, nonce)`.

Impact:

- Concurrent duplicate signed requests can create duplicate event rows and duplicate Discord deliveries.

Likelihood:

- Low to Medium.

Recommendation:

- Either accept and document at-least-once duplicate semantics, or add a DB-level unique constraint / atomic insert path for `(session_id, nonce)`.

#### MEDIUM-2: Discord webhook URLs are stored as plaintext JSON

Description:

- `dashboard-webhook-service` stores `{ webhook_url: webhookUrl }` directly in `webhook_config.config`.
- Phase 8 design expected sensitive provider credentials to be encrypted at rest, but no encryption layer is present in the repository or service path.

Impact:

- Database or service-role compromise exposes creator Discord webhook URLs.
- Exposed webhooks can be abused until rotated.

Likelihood:

- Medium.

Recommendation:

- Encrypt provider credential fields at rest, or explicitly update the production security model to accept plaintext webhook URLs with compensating controls.

#### MEDIUM-3: Bulk dead-letter replay is unbounded

Description:

- `replayAllDeadLetters()` fetches all dead-letter events for a script and iterates them without a service-level cap.

Impact:

- Large dead-letter sets can cause long server action runtime and large queue bursts.

Likelihood:

- Medium.

Recommendation:

- Add bounded replay batches or require explicit batch size/pagination.

#### MEDIUM-4: Alert checks are not independently scheduled

Description:

- `/api/internal/check-alerts` exists and is CRON-secret protected.
- `vercel.json` schedules `/api/cleanup` and `/api/internal/event-worker`, but not `/api/internal/check-alerts`.
- Alert checks run after `processEventQueue()` inside the worker route.

Impact:

- If the worker route fails before `checkAlerts()` or queue processing is disabled, alert evaluation may not run independently.

Likelihood:

- Medium.

Recommendation:

- Add an explicit cron for `/api/internal/check-alerts` or document that alert evaluation cadence is intentionally coupled to the event worker.

#### MEDIUM-5: Creator security dashboards use global security counters

Description:

- `event-analytics-service` and `security-monitoring-service` query global `verification_logs` counters.
- The services are owner-gated by script slug, but the returned security metrics are not scoped to that script.

Impact:

- Creators can see platform-wide event abuse signal counts after authenticating with any owned script.
- The UI may imply script-specific security posture when the metric source is global.

Likelihood:

- High.

Recommendation:

- Either label these metrics as platform-wide signals or add script/session attribution to counters so creator-facing views can be scoped per script.

#### MEDIUM-6: Durable audit events remain incomplete

Description:

- TODO still lists webhook audit events as incomplete: `webhook.created`, `webhook.updated`, `webhook.deleted`, `webhook.test_sent`.
- Event replay and bulk replay are not written to the durable audit log.
- Monitoring counters are best-effort and not equivalent to audit records.

Impact:

- Administrative and incident review lacks a durable trail for webhook changes and replay operations.

Likelihood:

- High during operational incidents.

Recommendation:

- Add durable audit events for webhook lifecycle, test sends, single replay, and bulk replay.

### Low

#### LOW-1: Worker and alert routes return raw caught error messages to authorized callers

Description:

- `/api/internal/event-worker` and `/api/internal/check-alerts` return caught error messages in JSON responses.

Impact:

- Limited information disclosure to callers with `CRON_SECRET`.

Likelihood:

- Low.

Recommendation:

- Return generic failure messages externally and log details server-side.

#### LOW-2: Event API parses JSON before the 4096-byte payload check

Description:

- `POST /api/events/report` calls `req.json()` before `reportEvent()` applies the 4096-byte payload limit.

Impact:

- Oversized raw request defense relies on framework/platform/global body limits rather than this service-level payload limit.

Likelihood:

- Low to Medium, depending on deployment edge limits.

Recommendation:

- Keep platform body limits documented and consider an endpoint-level request size guard if needed.

#### LOW-3: Event analytics aggregation is application-side

Description:

- `getEventTypeCountsByScriptId()` selects event rows and groups counts in application code.

Impact:

- High-volume scripts may make analytics pages slower or more expensive than SQL-side aggregation.

Likelihood:

- Medium as event volume grows.

Recommendation:

- Move trend aggregation to SQL/grouped queries or materialized summaries when event volume justifies it.

#### LOW-4: Documentation drift remains

Description:

- `ARCHITECTURE.md` route topology does not list the newer analytics, security, admin alert, or check-alert routes.
- `TODO.md` still marks Phase 8E as in progress and lists Phase 8E analytics expansion as pending while also showing Phase 8E complete.
- Older Phase 8 docs still contain superseded phase-boundary notes.

Impact:

- Maintainer/operator confusion.

Likelihood:

- Medium.

Recommendation:

- Publish one consolidated "current Phase 8 implementation" document or update roadmap and architecture route lists.

#### LOW-5: Telegram and Slack providers remain deferred

Description:

- The implemented provider path is Discord only.
- TODO still lists Slack and Telegram provider work as pending/deferred.

Impact:

- Not a production blocker for a Discord-only launch, but Phase 8 should not be represented as multi-provider complete.

Likelihood:

- High if roadmap language is ambiguous.

Recommendation:

- State clearly that Phase 8 production readiness applies to the Discord provider only.

## Production Readiness Scores

| Category | Score | Rationale |
|---|---:|---|
| Architecture | 86 / 100 | Layering is clean, event secret flow is integrated, queue leases exist, and provider/dashboard boundaries are clear. Deductions for docs drift, Discord-only provider scope, and alert scheduling coupling. |
| Security | 76 / 100 | HMAC/session validation, ownership checks, and event/webhook RLS are strong. Deductions for `alert_events` lacking RLS, plaintext webhook URLs, non-atomic nonce replay, and global counters in creator views. |
| Reliability | 82 / 100 | Queue claims, retry, dead-letter, stale-claim recovery, and retention cleanup are implemented. At-least-once duplicate risk and unbounded bulk replay remain. |
| Operations | 80 / 100 | Event operations dashboards, replay, cleanup counts, admin alerts, and cron-protected worker routes exist. Deductions for missing durable audit logs and alert check coupling. |
| Monitoring | 84 / 100 | Counters, analytics dashboard, security dashboard, alert thresholds, Discord alert notifications, and admin alert dashboard exist. Deductions for best-effort counters, global metric scope, and no independent alert cron. |
| Overall | 82 / 100 | Feature-complete and materially hardened, but not cleanly production-ready until the high/medium operational security conditions are addressed or explicitly accepted. |

## Final Recommendation

GO WITH CONDITIONS.

Phase 8 is complete enough to stop adding feature work and move into production readiness hardening. It is suitable for controlled production rollout only after the high-priority database exposure condition is resolved or formally disproven by deployment grants.

Minimum production conditions:

1. Enable RLS or explicit deny grants for `alert_events`.
2. Decide whether nonce replay concurrency is accepted or enforce `(session_id, nonce)` atomically.
3. Decide whether plaintext Discord webhook URLs are accepted or implement encryption at rest.
4. Add a cap/batch size for bulk dead-letter replay.
5. Schedule `/api/internal/check-alerts` independently, or document the intentional worker-coupled alert cadence.
6. Label creator-facing security counters as platform-wide or make them script-scoped.
7. Add durable audit events for webhook lifecycle and replay operations.

## Recommended Next Phase

Recommended next phase: Phase 9 - Operations and Release Hardening.

Focus:

- Close the production conditions above.
- Verify Supabase grants/RLS for every operational table.
- Add a short event-platform runbook for alerts, queue backlog, dead letters, webhook rotation, and replay procedures.
- Update `ARCHITECTURE.md` and `TODO.md` to reflect the final Phase 8 route and status.
- Decide whether Telegram/Slack providers are still roadmap items or explicitly outside the production Phase 8 definition.

Phase 7 license work should remain separate from this final Phase 8 hardening pass.
