# Phase 8 Post-Hardening Audit

Date: 2026-06-09
Status: Post-hardening audit-only review
Final decision: **GO WITH CONDITIONS**

> Superseded on 2026-06-10 by `../active/PHASE8_CLOSEOUT.md`. The remaining conditions in this post-hardening audit were resolved or formally accepted during final closeout: alert delivery and dashboards exist, bulk replay is capped, stale Phase 8 docs were reconciled, and Phase 8 is complete/100% for the Discord-backed production scope. Telegram/Slack providers, webhook encryption at rest, nonce atomicity, and durable audit stream expansion are deferred accepted risks, not Phase 8 blockers.

## Executive Summary

The Phase 8 hardening sprint resolved the major NO GO blockers from `PHASE8_EVENT_PLATFORM_AUDIT.md`:

- Runtime event secrets are now generated, persisted, and returned to runtime delivery clients.
- Queue workers now use a persisted `event_logs.claimed_at` lease before delivery processing.
- Dashboard test webhook delivery now processes only the created heartbeat event.
- Event retention cleanup is integrated into `/api/cleanup` with deletion counts.
- Lightweight security, queue, and webhook monitoring counters now exist.

The platform is materially safer and more operable than the original audited implementation. It is still not a clean unconditional GO because several accepted or partially implemented controls remain: nonce replay protection is still application-level rather than DB-atomic, monitoring has counters but no alert delivery, webhook provider credentials are still stored as plaintext JSON, and some Phase 8 docs still contain stale per-phase “not implemented in this phase” notes that can confuse operators.

## Evidence Reviewed

Primary audit documents:

- `PHASE8_EVENT_PLATFORM_AUDIT.md`
- `PHASE8D_MONITORING_FOUNDATION.md`
- `PHASE8A_EVENT_FOUNDATION_DESIGN.md`
- `PHASE8B1_DATABASE_FOUNDATION.md`
- `PHASE8B2_EVENT_API.md`
- `PHASE8B3_QUEUE_WORKER.md`
- `PHASE8B4_DISCORD_PROVIDER.md`
- `PHASE8C1_WEBHOOK_DASHBOARD.md`
- `PHASE8C2_EVENT_OPERATIONS.md`

Implementation evidence:

- `app/lib/services/delivery-session-service.ts`
- `app/api/delivery/session/route.ts`
- `app/api/delivery/fetch/route.ts`
- `app/lib/services/event-reporting-service.ts`
- `app/lib/repositories/event-repository.ts`
- `app/lib/services/event-queue-service.ts`
- `app/api/internal/event-worker/route.ts`
- `app/api/cleanup/route.ts`
- `app/lib/services/event-monitoring-service.ts`
- `app/lib/providers/discord-provider.ts`
- `app/lib/services/dashboard-webhook-service.ts`
- `app/lib/services/event-dashboard-service.ts`
- `app/actions/events.ts`
- `app/actions/webhooks.ts`
- `migrations/008_event_platform.sql`
- `migrations/009_event_platform_hardening.sql`
- `schema.sql`

## Fixed Findings

### FIXED-1: Event secret end-to-end flow

Previous finding:

- `/api/events/report` required `delivery_sessions.event_secret`, but normal delivery session creation did not generate or expose it.

Current evidence:

- `createDeliverySession()` generates `eventSecret = randomBytes(32).toString('base64url')`.
- `createSession()` receives `eventSecret` and persists it.
- `POST /api/delivery/session` returns `{ session_token, event_secret, expires_in }`.
- `consumeDeliverySession()` rejects consumed sessions missing `event_secret`.
- `POST /api/delivery/fetch` returns `event_secret` with the runtime payload response.
- `reportEvent()` rejects missing/expired event secrets and verifies HMAC with the stored per-session secret.

Assessment:

- Runtime clients now have a supported signing path.
- `session_token_hash` remains server-only.
- Service credentials and encryption secrets are not exposed by the delivery responses.

Residual note:

- `event_secret` is exposed to the untrusted runtime by design. A malicious executor with a valid session can still forge semantically false events during the session TTL; this is accepted in the Phase 8 trust model.

### FIXED-2: Queue claim / worker overlap protection

Previous finding:

- Multiple workers could select and deliver the same pending row concurrently.

Current evidence:

- `migrations/009_event_platform_hardening.sql` adds nullable `event_logs.claimed_at`.
- `idx_event_logs_pending_claim` supports pending lease lookup.
- `getPendingEvents()` returns only rows where `claimed_at IS NULL` or `claimed_at < now - 15 minutes`.
- `claimEventForProcessing()` updates `claimed_at` and selects the row only if it is still pending and unclaimed/stale.
- `processEventQueue()` claims each candidate before processing and skips if claim fails.
- `processSingleEvent()` uses the same claim function.
- `updateEventDeliveryStatus()` clears `claimed_at` for delivered, pending retry, skipped retry, replay, and dead-letter transitions.

Assessment:

- Overlapping workers should not process the same unexpired claim concurrently.
- Worker crashes recover after lease expiry.
- Queue semantics remain at-least-once, not exactly-once.

Residual note:

- External duplicate delivery remains possible if Discord accepts a webhook and the worker crashes before status update. The lease prevents concurrent duplication, not post-delivery crash duplication.

### FIXED-3: Test webhook isolation

Previous finding:

- Dashboard test webhook ran `processEventQueue(resolveProvider, 50)`, which could process unrelated global pending events.

Current evidence:

- `sendTestWebhookEvent()` creates a heartbeat event and calls `processSingleEvent(event.id, resolveProvider)`.
- `processSingleEvent()` claims and processes only the requested event ID.
- The dashboard test path no longer calls global `processEventQueue()`.

Assessment:

- Dashboard test sends no longer drain or mutate unrelated queued events.

### FIXED-4: Event retention cleanup

Previous finding:

- Phase 8 retention was documented but absent from `/api/cleanup`.

Current evidence:

- `deleteDeliveredEventsBefore()` deletes delivered events older than the passed cutoff.
- `deleteDeadLetterEventsBefore()` deletes dead-letter events older than the passed cutoff.
- `deletePendingEventsBefore()` deletes pending events older than the passed cutoff.
- `/api/cleanup` calls these with 30 days, 90 days, and 7 days respectively.
- `/api/cleanup` returns `event_logs: { delivered, deadLetter, pending }` deletion counts.

Assessment:

- Documented retention windows are now implemented.

Residual note:

- Cleanup deletes old pending events, including any still-claimed old pending rows. This matches the stated stale-pending retention policy but should be operationally understood as data deletion, not dead-lettering.

### FIXED-5: Monitoring counters foundation

Previous finding:

- No Phase 8 counters existed for invalid signatures, replay attempts, rate limits, queue health, or webhook failures.

Current evidence:

- `recordSecurityCounter()` records:
  - `event.invalid_signature`
  - `event.replay_attempt`
  - `event.rate_limited`
- `recordWebhookCounter()` records:
  - `webhook.delivery_success`
  - `webhook.delivery_failure`
  - `webhook.provider_failure`
- `getQueueSnapshot()` computes:
  - `pendingCount`
  - `deadLetterCount`
  - `oldestPendingAgeSeconds`
- Counters are stored in existing `verification_logs`.
- `PHASE8D_MONITORING_FOUNDATION.md` documents future alerting hooks.

Assessment:

- Monitoring foundation exists and is lightweight.
- It is not yet full alerting, analytics, or dashboard observability.

## Fresh Review by Area

### 1. Event Secret Flow

Score: strong.

Observed controls:

- 32 random bytes are generated per delivery session and encoded as base64url.
- Event secret is persisted with the delivery session.
- Runtime receives the secret through both delivery session creation and delivery fetch responses.
- HMAC verification uses server-stored secret and `timingSafeEqual`.
- Expired sessions are rejected by `reportEvent()`.
- Consumed sessions are allowed for event reporting by design.

Security assessment:

- The production-blocking “no secret path” issue is fixed.
- The secret is intentionally runtime-visible and should be treated like bearer material during the session TTL.
- Event signing remains bound to exact `JSON.stringify(payload)` serialization.

### 2. Queue Locking

Score: improved, production-acceptable with at-least-once semantics.

Observed controls:

- `claimed_at` lease column exists through migration `009`.
- Claiming is persisted before provider delivery.
- Failed claim results in `skipped` and no provider delivery.
- Retry-not-due events release the claim through `updateEventDeliveryStatus()`.
- Failed/retry/dead-letter/delivered paths clear the claim.
- Stale claims are eligible after 15 minutes.

Reliability assessment:

- Concurrent worker overlap is mitigated.
- Crash recovery is present.
- External duplicate delivery remains possible after provider success but before DB update.

### 3. Replay Protection

Score: moderate.

Observed controls:

- Nonce format requires 32 lowercase hex characters.
- Replay lookup is scoped to `(session_id, nonce)`.
- Replay attempts after the first stored event are rejected.
- Replay attempts are counted via `event.replay_attempt`.

Remaining limitation:

- There is no unique DB constraint on `(session_id, nonce)`.
- Two concurrent valid submissions with the same nonce can still race the pre-insert lookup.
- This was explicitly accepted in the Phase 8A design, but it remains a security/reliability condition rather than a fully fixed control.

### 4. Retention Cleanup

Score: good.

Observed controls:

- Delivered events: 30-day deletion.
- Dead-letter events: 90-day deletion.
- Pending events: 7-day deletion.
- Cleanup endpoint is protected by `CRON_SECRET`.
- Cleanup returns deletion counts.

Remaining limitation:

- There is no pre-cleanup dead-letter conversion for old pending events. The current behavior deletes old pending rows directly, matching the requested sprint requirement.

### 5. Monitoring Counters

Score: foundation complete, alerts incomplete.

Observed controls:

- Security counters exist for invalid signatures, replay attempts, and rate limits.
- Webhook counters exist for delivery success/failure/provider failure.
- Queue snapshot helper computes pending/dead-letter count and oldest pending age.
- Counters are written asynchronously and failures are swallowed to avoid breaking request/worker paths.

Remaining limitations:

- No alert delivery integration.
- No dashboard displaying counters.
- No metric aggregation API.
- `verification_logs` cleanup deletes rows older than 30 days.
- Counter write failures are intentionally silent, so counters are best-effort rather than guaranteed audit records.

### 6. Discord Delivery

Score: good.

Observed controls:

- Webhook URL regex is anchored to `https://discord.com/api/webhooks/<id>/<token>` or `https://discordapp.com/api/webhooks/<id>/<token>`.
- Invalid URLs fail before HTTP request.
- Discord `429`, `5xx`, network errors, and timeouts are retryable.
- Discord `400`, `401`, `403`, `404`, and `404 code 10015` are permanent/dead-letter.
- Fetch timeout is 10 seconds.
- Provider is selected server-side from webhook config, not from event payload.

Remaining limitations:

- Webhook URL is stored plaintext in `webhook_config.config.webhook_url`.
- Discord request does not use provider-specific idempotency because Discord webhooks do not provide an obvious idempotency mechanism here.

### 7. Dashboard Operations

Score: good.

Observed controls:

- Webhook actions call `requireAuth()` and service-layer ownership checks.
- Event actions call `requireAuth()` and service-layer ownership checks.
- Webhook DTO masks raw URL.
- Event DTO omits `session_id`, `nonce`, `event_secret`, webhook config, creator ID, session token, and session token hash.
- Event detail and single replay verify `event.script_id === owned script.id`.
- Bulk replay fetches dead-letter rows by owned `script.id`.
- Test webhook is isolated to `processSingleEvent(event.id, resolveProvider)`.

Remaining limitations:

- Bulk replay has no explicit service-level maximum.
- Webhook lifecycle audit events (`webhook.created`, `webhook.updated`, `webhook.deleted`, `webhook.test_sent`) are still not implemented as durable audit records.

## Remaining Findings

### HIGH: None blocking production hardening goal

No remaining finding rises to the previous NO GO level for the stated Phase 8 hardening sprint.

### MEDIUM-1: Replay protection remains non-atomic under concurrency

Description:

- Replay detection is still lookup-before-insert through `findEventByNonce()`.
- `idx_event_logs_session_nonce` is not unique.

Impact:

- Two concurrent signed requests with the same nonce can both insert before either is visible to the other request.
- This can create duplicate event rows and duplicate provider delivery.

Likelihood: Low to Medium

Recommendation:

- Either accept and document this at-least-once duplicate window, or add a DB-level unique constraint / atomic insert path for `(session_id, nonce)`.

### MEDIUM-2: Monitoring has counters but no alerting or dashboard

Description:

- Counters are written to `verification_logs`, and queue gauges can be computed on demand.
- No alert delivery, aggregation API, or dashboard surface exists.

Impact:

- Security and operational signals exist but may not be noticed without manual queries or future integration.

Likelihood: High

Recommendation:

- Add alert hooks for invalid signature spikes, replay attempts, queue staleness, dead-letter growth, and provider failure bursts before high-volume production exposure.

### MEDIUM-3: Provider credentials remain plaintext in webhook config

Description:

- `webhook_config.config` stores `{ webhook_url: webhookUrl }` directly.
- Phase 8A design anticipated encryption for sensitive provider credentials in Phase 8B.

Impact:

- Database/service-role compromise exposes Discord webhook URLs.
- Exposed webhooks can be abused until rotated.

Likelihood: Medium

Recommendation:

- Encrypt provider credential fields at rest or explicitly update the production security model to accept plaintext webhook URLs with compensating controls.

### MEDIUM-4: Bulk dead-letter replay has no service-level cap

Description:

- `replayAllDeadLetters()` fetches all dead-letter events for a script without explicit limit and replays each one.

Impact:

- A large dead-letter backlog can produce a large queue burst and long server action runtime.

Likelihood: Medium

Recommendation:

- Add bounded replay batches or require explicit pagination/batch size for bulk replay.

### LOW-1: Worker route returns raw caught error messages to authorized caller

Description:

- Worker catch block returns `{ success: false, message }` from caught error.

Impact:

- Limited information disclosure to holders of `CRON_SECRET`.

Likelihood: Low

Recommendation:

- Return a generic worker failure response and keep detailed errors server-side.

### LOW-2: Monitoring counters are best-effort, not guaranteed audit logs

Description:

- `recordCounter()` writes asynchronously and swallows failures.

Impact:

- Request/worker availability is preserved, but security counters can be missed during transient DB/write failures.

Likelihood: Low to Medium

Recommendation:

- Keep best-effort metrics for runtime counters, but add durable audit logs for administrative/security-critical actions where required.

### LOW-3: Documentation contains stale per-phase notes

Description:

- Some phase documents still say items were “not implemented in this phase,” even though later hardening or subsequent phase files now implement them.
- `PHASE8B1_DATABASE_FOUNDATION.md` still documents `delivery_sessions.event_secret` compatibility as nullable and notes existing session creation remained valid without a secret, while later sections correctly describe hardening behavior.
- `PHASE8A_EVENT_FOUNDATION_DESIGN.md` still references encrypted provider credentials and earlier event names like `enter_world` / `leave_world` from design-time assumptions.

Impact:

- Operator or future-maintainer confusion.
- Low direct security impact because code behavior is clear.

Likelihood: Medium

Recommendation:

- Add a short “Superseded by hardening” note to older phase docs or create a consolidated current Phase 8 implementation document.

## Risk Register

| ID | Severity | Finding | Impact | Likelihood | Recommendation |
|---|---|---|---|---|---|
| R1 | MEDIUM | Non-atomic nonce replay protection | Concurrent duplicate events and duplicate provider delivery | Low-Medium | Add DB uniqueness/atomic insert or document accepted at-least-once duplicate window. |
| R2 | MEDIUM | Monitoring lacks alert delivery/dashboard | Abuse or queue degradation may not page anyone | High | Wire counters to alerting and dashboard surfaces before high-volume launch. |
| R3 | MEDIUM | Plaintext Discord webhook URLs | DB/service-role compromise exposes webhook credentials | Medium | Encrypt provider config fields or document accepted plaintext model. |
| R4 | MEDIUM | Unbounded bulk replay | Large queue burst and long server action runtime | Medium | Add bounded replay batches. |
| R5 | LOW | Worker returns raw caught errors to cron caller | Limited info disclosure to `CRON_SECRET` holder | Low | Return generic error externally, log details internally. |
| R6 | LOW | Best-effort counters can be dropped | Missing metric rows during DB failures | Low-Medium | Use durable audit path for critical security/admin events. |
| R7 | LOW | Stale phase documentation | Maintainer/operator confusion | Medium | Consolidate current implementation docs or add supersession notes. |

## Scorecard

| Category | Score | Previous Audit Direction | Rationale |
|---|---:|---|---|
| Architecture | 82 / 100 | Improved | Event secret contract, queue leases, retention, and isolated test dispatch now align with intended architecture. Remaining concerns are plaintext provider config and docs drift. |
| Security | 78 / 100 | Improved | HMAC path is operational, ownership checks hold, RLS remains strong, and counters exist. Non-atomic replay and plaintext webhook URLs keep score below GO-clean. |
| Reliability | 80 / 100 | Improved | Queue leases mitigate overlap and stale leases recover. At-least-once crash-after-provider-success duplicate risk remains. |
| Operations | 76 / 100 | Improved | Cleanup counts, queue snapshots, dead-letter operations, and cron protections exist. Bulk replay cap and alert wiring are still missing. |
| Monitoring | 62 / 100 | Improved from weak | Counters and gauges exist, but no alert delivery, dashboards, aggregation API, or durable audit guarantees. |

Overall post-hardening readiness: **76 / 100**

## Final Decision

**GO WITH CONDITIONS**

Phase 8 is no longer a NO GO for the original high-risk hardening scope. The core event-secret, queue-overlap, webhook-test-isolation, retention, and monitoring-foundation blockers were remediated.

Conditions before broad/high-volume production exposure:

1. Explicitly accept or fix the non-atomic nonce replay race.
2. Add alert delivery or operational dashboards for the Phase 8 monitoring counters.
3. Decide whether plaintext Discord webhook URLs are acceptable; otherwise encrypt provider config secrets.
4. Add a service-level cap/batch size for bulk dead-letter replay.
5. Clean up stale Phase 8 documentation so operators rely on current behavior.

This is suitable for controlled production rollout behind existing operational controls, not for unattended high-volume launch without the conditions above.
