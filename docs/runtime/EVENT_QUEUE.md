# Event Queue Runtime

Status: Documents current event reporting and queue behavior after completed Phase 7C production runtime performance optimizations. This file is documentation only.

Primary files:

- `app/api/events/report/route.ts`
- `app/lib/services/event-reporting-service.ts`
- `app/lib/services/event-queue-service.ts`
- `app/lib/repositories/event-repository.ts`
- `app/api/internal/event-worker/route.ts`
- `app/lib/services/internal-alert-service.ts`
- `app/lib/services/event-monitoring-service.ts`

## Runtime Goals

- Accept only authenticated, signed runtime events.
- Store accepted events before provider delivery.
- Deliver events asynchronously through a queue worker.
- Avoid exposing creator webhook URLs to runtime scripts.
- Provide replay protection, rate limiting, retries, dead-letter handling, and internal alerts.

## Report Flow

Endpoint: `POST /api/events/report`

Input fields:

- `sessionId`: raw delivery session token.
- `event`: allowlisted event type.
- `timestamp`: Unix timestamp in seconds.
- `nonce`: 32-character lowercase hex nonce.
- `signature`: HMAC signature in hex or base64.
- `payload`: JSON payload object.

Accepted event types:

- `execute`
- `purchase`
- `error`
- `ban`
- `key_redeem`
- `heartbeat`
- `license_activate`
- `license_revoke`

Validation sequence:

1. Request body must be JSON object.
2. `sessionId` must have valid token length.
3. Event type must be allowlisted.
4. Timestamp must be finite and positive.
5. Timestamp skew must be within 300 seconds.
6. Nonce must match 32 lowercase hex characters.
7. Signature must be 64 hex characters or supported base64 form.
8. Payload JSON byte size must be <= 4096 bytes.
9. Server hashes `sessionId` and loads `delivery_sessions` by `session_token_hash`.
10. Session must exist, have `event_secret`, and not be expired.
11. Server computes HMAC SHA-256 over `event:timestamp:nonce:JSON(payload)`.
12. Signature comparison uses timing-safe equality.
13. Per-session event rate limit allows up to 10 events per minute.
14. Nonce must not already exist for the session.
15. Event is inserted into `event_logs` with `delivery_status = 'pending'`.

Performance note:

- Event insert/update write projections intentionally omit `payload` from returned rows to reduce database response size.
- Event read paths still select `payload` when dashboard, queue, replay, or nonce workflows require it.
- Runtime event reporting API behavior is unchanged; successful event reports still return `{ "success": true }` after storage.

Failure behavior:

- Invalid session returns `401`.
- Unknown event type returns `422`.
- Invalid timestamp or payload format returns `400`.
- Payload too large returns `413`.
- Rate limit returns `429` with `Retry-After`.
- Insert failure returns `500` with `Event rejected`.

Monitoring counters:

- Invalid session/timestamp/nonce/signature cases record security counters in `verification_logs` where implemented.
- Invalid signature records `event.invalid_signature`.
- Rate limit records `event.rate_limited`.
- Replay attempt records `event.replay_attempt`.

## Queue Lifecycle

Storage table: `event_logs`.

States:

- `pending`: accepted and waiting for delivery or retry.
- `delivered`: successfully delivered or no enabled webhook was configured.
- `dead_letter`: permanently failed or unsupported provider after retry exhaustion.

Important columns:

- `retry_count`: number of delivery attempts, capped by application logic at 5.
- `claimed_at`: worker lease marker.
- `last_retry_at`: most recent attempt timestamp.
- `delivered_at`: success timestamp.
- `error_message`: sanitized provider/worker error summary.

Polling:

- Worker reads up to 50 pending events.
- Pending selection includes unclaimed events and events with stale claims older than 15 minutes.
- Events are ordered by `received_at ASC` for FIFO-like processing.

Claiming:

- Worker claims each event by updating `claimed_at` only when status remains pending and claim is absent/stale.
- If claim fails, event is skipped for that worker run.
- Updating delivery status resets `claimed_at` to null.

Backoff:

- Attempt 1: immediate.
- Attempt 2: 10 seconds after prior attempt.
- Attempt 3: 30 seconds.
- Attempt 4: 90 seconds.
- Attempt 5: 270 seconds.
- Later calculations clamp to final schedule value of 810 seconds, but events should dead-letter once retry limit is reached.

Provider resolution:

- Worker loads enabled `webhook_config` by `script_id`.
- If no enabled config or no webhook URL exists, event is marked delivered as a no-op.
- Current internal worker resolves `discord` provider.
- Unknown provider is a permanent failure and moves event to dead letter.

## Worker Lifecycle

Endpoint: `POST /api/internal/event-worker`

Authentication:

- Requires `Authorization: Bearer $CRON_SECRET`.
- Missing `CRON_SECRET` returns `500`.
- Wrong bearer token returns `401`.

Scheduling:

- Intended to run every 5 minutes through GitHub Actions on Vercel Hobby or Vercel Cron on Pro deployments.
- The route can be called manually for debugging and incident response.

Worker sequence:

1. Validate `CRON_SECRET` bearer token.
2. Resolve provider function for configured provider names.
3. Call `processEventQueue()` with batch size 50.
4. Process pending events one by one.
5. Run `checkAlerts()` after queue processing so counters are fresh.
6. Return queue stats and alert stats when available.

Returned stats:

- `processed`
- `delivered`
- `failed`
- `deadLettered`
- `skipped`
- `alerts.triggered`
- `alerts.resolved`

Alert check failure:

- Alert check errors are logged but do not fail queue processing.

## Dead-Letter Handling

Dead-letter conditions:

- Provider reports non-retryable failure.
- Retryable provider failures reach max retry attempts.
- Provider throws repeatedly until retry limit is reached.
- Webhook config references unsupported provider.

Dead-letter state:

- `delivery_status = 'dead_letter'`.
- `retry_count` is incremented.
- `last_retry_at` records the attempt time.
- `error_message` stores last failure summary.

Replay function:

- `replayDeadLetterEvent(eventId)` resets an event to pending.
- It sets `retry_count = 0`, clears retry/delivery timestamps, and clears error message.

Operational handling:

- Review dead-letter rows by script and error message.
- Fix webhook configuration or provider outage before replaying.
- Replay in small batches to avoid immediately re-triggering provider rate limits.

## Internal Alerts

Alert types:

- `queue_backlog_spike`
- `dead_letter_spike`
- `invalid_signature_spike`
- `replay_attack_spike`
- `webhook_failure_burst`
- `auth_failure_spike`

Alert sources:

- Queue snapshot from `event_logs` pending/dead-letter counts.
- Security and webhook counters from `verification_logs` over the last 24 hours.

Severity thresholds:

- Thresholds are defined in `internal-alert-service.ts` for low, medium, high, and critical severities.
- One active alert per alert type is deduplicated.
- Alerts resolve when current value drops below the threshold recorded on the active alert.
- High and critical alerts notify Discord through `INTERNAL_ALERT_DISCORD_WEBHOOK` when configured.

## Cleanup

Event cleanup is handled by cleanup repository functions and `/api/cleanup`:

- Delivered events can be deleted after retention.
- Dead-letter events can be deleted after retention.
- Stale pending events can be deleted after retention.
- Rate-limit cleanup is batched in bounded batches.
- Expired delivery session cleanup deletes only expired sessions without `script_executions` references.

Do not delete recent pending or dead-letter events during active incidents unless data volume threatens availability and the incident lead approves.

Current cleanup caveats:

- Event log retention deletes are not batched in the current repository functions.
- Delivery sessions referenced by execution analytics are intentionally retained. True delivery session TTL cleanup requires Phase 7D database decoupling and is not implemented yet.

## Phase Boundary

This document describes the current event queue and webhook delivery system. It does not add event types, providers, APIs, schemas, Redis/Valkey, database decoupling, analytics aggregation, runtime delivery changes, or planned key-validation runtime behavior.
