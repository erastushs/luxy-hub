# Phase 8 Event Platform Audit

Date: 2026-06-09
Status: Audit-only review
Final recommendation: **NO GO**

## Executive Summary

The Phase 8 implementation has a sound high-level security boundary: events are server-validated, signed with HMAC-SHA256, scoped to delivery sessions, persisted through service-role repositories, and exposed to dashboard users only after ownership checks. Discord webhook delivery is constrained to Discord webhook URL formats and the dashboard DTOs do not expose raw webhook URLs, session IDs, nonces, or event secrets.

However, the current implementation is **not production-ready**. The primary blocker is functional/security architecture mismatch: `/api/events/report` requires `delivery_sessions.event_secret`, but current delivery session creation intentionally does not generate or return an event secret. As implemented, legitimate runtime clients cannot sign accepted event reports. Additional production blockers include non-atomic nonce replay protection, no queue claiming/locking for overlapping workers, missing Phase 8 retention cleanup, no Phase 8 audit logging, and no monitoring/alerting hooks for security or queue health.

This report does not include speculative vulnerabilities. Every finding below is supported by current code or migration state.

## Evidence Reviewed

Design and planning artifacts:

- `PHASE8A_EVENT_FOUNDATION_DESIGN.md`
- `PHASE8B1_DATABASE_FOUNDATION.md`
- `PHASE8B2_EVENT_API.md`
- `PHASE8B3_QUEUE_WORKER.md`
- `PHASE8B4_DISCORD_PROVIDER.md`
- `PHASE8C1_WEBHOOK_DASHBOARD.md`
- `PHASE8C2_EVENT_OPERATIONS.md`
- `ARCHITECTURE.md`
- `TODO.md`

Implementation artifacts:

- `app/api/events/report/route.ts`
- `app/lib/services/event-reporting-service.ts`
- `app/lib/repositories/event-repository.ts`
- `app/lib/services/delivery-session-service.ts`
- `app/api/delivery/session/route.ts`
- `app/api/delivery/fetch/route.ts`
- `app/lib/services/event-queue-service.ts`
- `app/api/internal/event-worker/route.ts`
- `app/lib/providers/discord-provider.ts`
- `app/lib/services/dashboard-webhook-service.ts`
- `app/lib/services/event-dashboard-service.ts`
- `app/actions/events.ts`
- `app/actions/webhooks.ts`
- `app/lib/repositories/webhook-config-repository.ts`
- `migrations/008_event_platform.sql`
- `app/api/cleanup/route.ts`
- Phase 8 test files under `__tests__/`

## Architecture Review

### Implemented Architecture

The implementation follows the intended layered model:

1. `POST /api/events/report` parses JSON and delegates to `reportEvent()`.
2. `reportEvent()` validates event type, timestamp, nonce/signature format, session expiry, HMAC, rate limit, nonce replay, payload size, and stores into `event_logs`.
3. `processEventQueue()` polls pending `event_logs`, resolves enabled webhook config, dispatches via a provider, updates delivery status, and handles retry/dead-letter transitions.
4. `discordProvider` validates Discord webhook URLs, formats event embeds, POSTs to Discord with a 10 second timeout, and classifies retryable versus permanent failures.
5. Dashboard pages and Server Actions call service functions that gate on `getOwnedScript()` and return safe DTOs.
6. Database RLS denies direct `event_logs` access to `anon` and `authenticated`, while `webhook_config` has owner-aware authenticated policies plus service-role access.

### Architecture Strengths

- Event destination is server-owned: event requests cannot supply provider or webhook URL.
- Event `script_id` is derived from the delivery session row, not client input.
- Dashboard event detail and replay verify `event.script_id === owned script.id` after event lookup.
- Discord provider is isolated behind a `ProviderResolver`, so unknown providers are dead-lettered rather than sent through a fallback.
- Dead-letter replay resets state to `pending` and reuses the normal queue path.
- DTOs omit `session_id`, `nonce`, webhook config, event secret, creator ID, and session token/hash.

### Architecture Weaknesses

- Event reporting is not wired into delivery session issuance. The event API requires an event secret, but current session creation and delivery/fetch responses do not provide one to runtime clients.
- Queue processing has no persisted `processing` state, row claim, lock, lease, or idempotency key. Concurrent worker invocations can process the same pending row.
- Test webhook delivery runs `processEventQueue(resolveProvider, 50)`, which can process unrelated pending events from the global queue during a dashboard user action.
- Phase 8 retention is documented in design but not implemented in cleanup.
- Monitoring and audit hooks are not integrated with event/reporting/queue/dashboard operations.

## Security Review

### 1. Event API Security

#### Session validation

Observed:

- `reportEvent()` hashes the provided `sessionId` with `hashDeliverySessionToken()` and looks up `delivery_sessions.session_token_hash`.
- It rejects when the session row is missing, `event_secret` is null, or `expires_at <= Date.now()`.
- It does not reject `consumed_at`; the design explicitly allows consumed sessions to report events.

Assessment:

- Expired sessions cannot submit accepted events through `reportEvent()`.
- Consumed-but-not-expired sessions can submit events by design.
- Legitimate sessions currently cannot submit events unless `event_secret` is manually populated because session creation does not generate it.

#### event_secret usage

Observed:

- `migrations/008_event_platform.sql` adds `delivery_sessions.event_secret text` as nullable.
- `createSession()` accepts optional `eventSecret` but defaults it to null.
- `createDeliverySession()` calls `createSession()` without `eventSecret`.
- `/api/delivery/session` response includes only `session_token` and `expires_in`.
- `/api/delivery/fetch` response includes only runtime payload metadata and no event secret.
- `event-reporting-service` rejects rows with no `event_secret`.

Assessment:

- This is a production-blocking integration gap. The event API is secure-by-rejection, but unusable by normal clients.
- No evidence shows a supported client path for obtaining `event_secret`.

#### HMAC implementation

Observed:

- Signature payload is `event + ':' + timestamp + ':' + nonce + ':' + JSON.stringify(payload)`.
- HMAC uses SHA-256 with the per-session `event_secret`.
- Signature format must be 64 lowercase hex chars.
- Comparison uses `timingSafeEqual` after length check.

Assessment:

- Signatures cannot be forged without `event_secret` under the implemented HMAC model.
- The exact JSON serialization must match client-side serialization. This is a compatibility risk, not a forgery risk.
- The payload is not canonicalized beyond `JSON.stringify()`, so runtime clients must sign precisely the same serialized object structure sent to the API.

#### Timestamp validation

Observed:

- Timestamp must be a finite positive number.
- `abs(Date.now()/1000 - timestamp) <= 300` is enforced.

Assessment:

- Old events outside ±300 seconds are rejected.
- Future-dated events beyond +300 seconds are rejected.

#### Nonce validation and replay protection

Observed:

- Nonce must match `/^[a-f0-9]{32}$/`.
- `findEventByNonce(sessionId, nonce)` checks existing `event_logs` by `(session_id, nonce)`.
- Database has a non-unique index `idx_event_logs_session_nonce`.
- There is no unique constraint on `(session_id, nonce)`.

Assessment:

- Simple replay after an event is stored is rejected.
- Concurrent duplicate submissions with the same valid nonce can race through the application-level pre-insert check and both insert.
- This race condition is explicitly accepted in the Phase 8A design, but it still means replay protection is not strict under concurrency.

#### Payload size limits

Observed:

- `jsonByteSize(payload)` rejects payloads over 4096 bytes before session lookup.
- Route uses `req.json()` before service-level size validation.

Assessment:

- Stored event payload size is capped after JSON parsing.
- Request body parsing still occurs before the 4096-byte application check. Any global/proxy body limit must be relied on for oversized raw request defense.

#### Rate limiting

Observed:

- `checkEventRateLimit(sessionId)` inserts into `rate_limits`, counts rows in the last 60 seconds, and rejects count > 10.
- Rate limiting is per internal DB session UUID, not IP.
- Rate limit runs after HMAC validation and before nonce replay check.
- Invalid session/signature attempts do not consume the per-session event rate limit because the session UUID is not trusted until after HMAC.

Assessment:

- Valid session holders are capped at 10 accepted attempts per minute, including HMAC-valid replay attempts that reach the rate limiter.
- Attackers without a valid event secret can generate HMAC failures; those are not covered by the event session rate limit.
- API-level or edge/IP rate limits are still needed for invalid-signature floods.

### Event API Questions

- Can replay attacks bypass protections? **Yes, under concurrency only.** A duplicate valid request can race the non-atomic nonce pre-check because `(session_id, nonce)` is indexed but not unique. Non-concurrent replays are rejected after the first insert.
- Can signatures be forged? **No evidence of forgeability.** HMAC-SHA256 with `event_secret` and constant-time comparison is implemented. The larger issue is that clients currently cannot obtain the secret through normal session flow.
- Can expired sessions still submit events? **No.** `expires_at <= now` returns `401 Invalid event session`.
- Can attackers create event floods? **Partially mitigated.** HMAC-valid sessions are limited to 10/min/session. Invalid session/signature floods are not event-rate-limited and rely on platform/global protections.

## Reliability Review

### 2. Queue Architecture

#### Pending lifecycle

Observed:

- `getPendingEvents(limit)` selects `delivery_status = 'pending'`, orders by `received_at`, and limits to 50 by default.
- No claim/update occurs before delivery attempt.
- No `processing` DB status exists.

Assessment:

- Pending lifecycle is simple and understandable.
- Pending events can be selected by multiple overlapping workers.
- A worker crash before status update leaves the event pending for future retry; this avoids loss but can duplicate delivery if the provider received the webhook before the crash.

#### Retry lifecycle

Observed:

- Backoff schedule is 10s, 30s, 90s, 270s, 810s.
- `isRetryDue()` uses `retry_count` and `last_retry_at`/`received_at`.
- Retryable failures remain `pending`, increment `retry_count`, and set `last_retry_at` and `error_message`.
- Max retry behavior dead-letters when `event.retry_count + 1 >= 5`.

Assessment:

- Retry state is persisted and recoverable.
- Because worker cron is every 5 minutes, the 10/30/90 second backoff intervals are effectively bounded by cron cadence, not exact retry timing.

#### Dead-letter lifecycle

Observed:

- Non-retryable provider failures immediately set `dead_letter`.
- Retryable failures at the retry cap set `dead_letter`.
- Unknown providers set `dead_letter` with `Unknown provider: <provider>`.
- `replayDeadLetterEvent()` resets `delivery_status = 'pending'`, `retry_count = 0`, clears retry/delivery/error fields.

Assessment:

- Dead-letter lifecycle is straightforward.
- Replay can create duplicate provider deliveries if the original event had been delivered externally but not marked delivered due to worker crash.
- Bulk replay iterates all dead-letter events for a script and has no upper bound in service code.

#### Worker processing

Observed:

- `/api/internal/event-worker` requires `Authorization: Bearer <CRON_SECRET>`.
- It invokes `processEventQueue(resolveProvider)` and returns batch stats.
- Cron is configured for every 5 minutes in `vercel.json`.
- Worker route returns raw caught error messages in JSON response.

Assessment:

- Cron endpoint is protected by shared secret.
- No overlap prevention is implemented.
- No queue-depth/backlog metric is emitted or stored.
- Raw worker error response is available only to callers with `CRON_SECRET`, but it is still broader than necessary.

### Queue Questions

- Can events become stuck forever? **Yes.** Pending events can remain indefinitely if worker cron is disabled, `CRON_SECRET` is misconfigured, repeated config lookup failures are swallowed as no-config delivered, or processing never runs. Retryable failures eventually dead-letter, but old pending retention cleanup is not implemented.
- Can worker crashes lose events? **No database loss observed.** Events remain pending until status update. External delivery can still duplicate if a crash happens after Discord accepts the webhook but before DB update.
- Can replay create duplicates? **Yes.** Replay intentionally requeues the same event and there is no provider idempotency key. Duplicate external notification is possible, especially after crash-before-update scenarios or repeated manual replay.
- Can cron overlap cause issues? **Yes.** Without row locking or a claim state, overlapping workers can deliver the same pending event more than once.

## Discord Provider Review

### Webhook URL validation

Observed:

- Regex: `^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$`.
- Validation requires string and exact match.
- Delivery validates URL before fetch.
- Dashboard save validates URL before storing.

Assessment:

- Malformed URLs cannot bypass current validation if they are routed through dashboard/service/provider paths.
- Query strings, fragments, alternate hosts, non-HTTPS, path traversal, and userinfo are rejected by regex.

### Retryable failures

Observed:

- Discord `429`, `5xx`, network errors, DNS errors, and timeouts are retryable.
- Unknown status codes are treated retryable.

Assessment:

- Transient provider failures do not poison the whole queue; they affect the current event and eventually dead-letter.

### Permanent failures

Observed:

- Invalid webhook URL is non-retryable.
- 404 with Discord code `10015`, any 404, 400, 401, and 403 are permanent.

Assessment:

- Deleted webhooks dead-letter rather than loop forever.
- Generic 404 also dead-letters, which is safe for Discord webhook semantics.

### Timeout handling

Observed:

- `fetch()` uses `AbortSignal.timeout(10_000)`.
- Timeout falls into catch path and returns retryable failure.

Assessment:

- A slow Discord endpoint cannot hang one delivery attempt indefinitely.
- With 50 events and 10s timeout each, worst-case worker runtime can approach 500 seconds plus overhead, below the documented Vercel 900s timeout.

### Provider isolation

Observed:

- Provider is resolved by config provider string.
- Only `discord` resolves to `discordProvider`.
- Unknown provider dead-letters the event.

Assessment:

- Provider failures are event-scoped and do not directly poison unrelated provider implementations.
- No multi-provider fanout is implemented.

### Discord Questions

- Can malformed URLs bypass validation? **No evidence.** Both save and delivery validate against an anchored Discord webhook regex.
- Can deleted webhooks cause loops? **No.** 404/10015 is permanent and dead-letters.
- Can provider failures poison the queue? **Partially no.** One provider failure updates that event only. However, slow retryable failures can consume worker batch time and backlog capacity.

## Dashboard Security Review

### Ownership enforcement

Observed:

- Webhook service functions call `getOwnedScript(slug, userId)` before read, save, toggle, or test event.
- Event dashboard service functions call `getOwnedScript(slug, userId)` before listing, detail, dead-letter list, replay, and bulk replay.
- Event detail and single replay verify `event.script_id === script.id` after event lookup.
- Server Actions call `requireAuth()` and pass `user.id` into services.
- Server pages call `getCurrentUser()` and redirect unauthenticated users to `/login`.

Assessment:

- Cross-account dashboard access is blocked at service boundaries.
- Non-owner event detail/replay returns not-found style errors.

### DTO safety

Observed:

- `WebhookConfigDTO` includes masked URL only: fixed string `Discord webhook configured` or empty.
- `EventDashboardDTO` includes event ID, script ID, event type, payload on detail only, delivery status, retry count, provider string, timestamps, and error message.
- DTOs do not include session ID, nonce, config, webhook URL, event secret, creator ID, session token, or session token hash.

Assessment:

- Raw webhook URLs and cryptographic/session material are not exposed through dashboard DTOs.
- Event detail intentionally exposes event payload to the owning creator. Payload may contain user-submitted data from the untrusted runtime; this is expected for debugging but should be treated as untrusted display data.

### Dead-letter replay authorization

Observed:

- `replayEvent()` requires owned script, event exists, event belongs to script, and status is `dead_letter`.
- `replayAllDeadLetters()` requires owned script and fetches only dead-letter events by the owned script ID.

Assessment:

- Users cannot replay another creator's dead letters through service functions.
- Bulk replay has no service-level maximum and could requeue a large number of dead letters for the owner’s script.

### Webhook management authorization

Observed:

- `saveWebhookConfig()` requires owned script and only accepts provider `discord`.
- `toggleWebhookConfig()` requires owned script.
- Repository uses service-role Supabase client, so ownership must be enforced by callers; dashboard service does enforce this.

Assessment:

- Webhook management through dashboard actions is owner-gated.
- Repository functions are broad service-role primitives and must not be exposed directly to untrusted callers.

### Dashboard Questions

- Can users access another creator's events? **No evidence.** Service functions gate by owned script and event detail checks script match.
- Can users replay another creator's dead letters? **No evidence.** Replay checks owned script and event script match.
- Can secrets leak through DTOs? **No evidence.** DTOs omit raw webhook config, event secret, session token/hash, nonce, and session ID.

## Database Security Review

### webhook_config RLS

Observed:

- RLS is enabled.
- Authenticated policies require `creator_id = auth.uid()` and an owned parent `scripts` row for select/insert/update/delete.
- Service-role policy permits all access.

Assessment:

- Direct authenticated access is owner-scoped.
- Service-role paths are intentionally broad; safety depends on service-layer ownership checks.

### event_logs RLS

Observed:

- RLS is enabled.
- `anon` and `authenticated` are denied all operations.
- Service-role policy permits all access.

Assessment:

- Direct browser/dashboard Supabase access cannot read event logs.
- Dashboard visibility relies on server-side service functions, which currently enforce ownership.

### delivery_sessions.event_secret

Observed:

- `event_secret` is plaintext nullable text.
- No length/format constraint exists.
- Current session creation leaves it null.
- No current response path returns it to runtime clients.

Assessment:

- Event secrets are not yet operationally provisioned.
- At-rest secrecy is equivalent to database/service-role secrecy; no encryption-at-rest at the application level is implemented for this field.

### Indexes

Observed:

- Pending queue, session nonce lookup, script event history, dead-letter, delivered latency, delivered cleanup, webhook script/creator/enabled-provider indexes are present.
- Nonce index is not unique.

Assessment:

- Indexes support intended queries.
- Non-unique nonce index enables lookup but not atomic replay prevention.

### Retention assumptions

Observed:

- Phase 8A documents delivered/dead-letter/stuck event retention cleanup.
- `/api/cleanup` currently cleans keys, used Work.ink tokens, rate limits, verification logs, and script downloads.
- `/api/cleanup` does not delete old `event_logs` in any status.

Assessment:

- Phase 8 event retention is not implemented.
- Event logs can grow indefinitely until manual cleanup or script deletion cascade.

### Database Questions

- Are any tables overexposed? **No direct overexposure observed.** RLS is enabled; `event_logs` denies anon/authenticated; `webhook_config` owner policies are present.
- Are service-role paths too broad? **Broad by design.** Repositories are service-role and unrestricted by themselves; current services enforce ownership for dashboard paths. Future callers must preserve this boundary.
- Are cleanup requirements sufficient? **No.** Event log retention cleanup is documented but not implemented.

## Monitoring Gaps

The following monitoring/alerting gaps are present in the current Phase 8 implementation:

- No audit log entries for `webhook.created`, `webhook.updated`, `webhook.deleted`, `webhook.test_sent`, event replay, bulk replay, or event/report authentication failures.
- No metric or alert for invalid signature spikes.
- No metric or alert for nonce replay spikes.
- No metric or alert for event report rate-limit spikes.
- No queue backlog gauge for pending event count or age of oldest pending event.
- No dead-letter growth metric or alert.
- No webhook failure burst metric by script/provider/status code.
- No worker overlap detection.
- No provider latency metric.
- No retention cleanup metric for event logs because cleanup is absent.

Existing observability is limited to:

- Worker route JSON batch stats returned to the cron caller.
- `console.error` on worker route catch.
- Provider error strings persisted on individual `event_logs.error_message`.
- Dashboard lists for owner-visible event/dead-letter review.

## OWASP-Style Review

### Broken Access Control

Status: mostly controlled, with service-role caution.

Evidence:

- Dashboard services gate on `getOwnedScript()`.
- Event detail and replay verify script ownership after event lookup.
- `event_logs` denies `anon` and `authenticated` through RLS.
- `webhook_config` authenticated RLS checks both config `creator_id` and parent script ownership.

Risk:

- Service-role repositories are broad primitives. Direct future use without service-layer ownership would bypass RLS. No current violation was found in Phase 8 dashboard paths.

### Cryptographic Failures

Status: mixed.

Evidence:

- HMAC-SHA256 and `timingSafeEqual` are implemented.
- Event secret is plaintext nullable DB text.
- Session creation does not generate the event secret.
- Runtime responses do not deliver event secret.

Risk:

- Crypto verification path is solid, but key provisioning is incomplete.
- Webhook URLs are stored raw inside `webhook_config.config`; the Phase 8A design expected encrypted sensitive config in Phase 8B, but migration/service code stores JSON plaintext.

### Security Misconfiguration

Status: needs hardening.

Evidence:

- Worker route requires `CRON_SECRET` and fails closed if absent.
- Worker returns caught error message to authorized caller.
- No event-specific body parser limit was observed before `req.json()`.

Risk:

- Invalid-event floods rely on platform/global controls rather than event-specific controls.

### Insufficient Logging and Monitoring

Status: weak.

Evidence:

- Existing audit system is used by script service, not Phase 8 services.
- Event reporting failures and replay operations do not write audit logs.
- No anomaly metrics are emitted.

Risk:

- Attacks and operational degradation can occur without alerting.

### Denial-of-Service Vectors

Status: partially mitigated.

Evidence:

- Valid event reports are rate-limited per session.
- Payload storage is limited to 4096 bytes after JSON parse.
- Discord fetch has a 10s timeout.
- Queue batch defaults to 50.

Risk:

- Invalid signature/session floods are not event-rate-limited.
- Worker can spend up to ~500 seconds on 50 timed-out Discord attempts.
- Test webhook action can process a global batch of pending events.
- No queue backlog alert or throttle beyond per-session report limits.

### Trust-Boundary Violations

Status: no direct arbitrary relay found.

Evidence:

- Event API accepts no webhook URL/provider/destination fields.
- Provider URL comes from creator dashboard config.
- Discord URL validation is anchored to Discord webhook URL format.

Risk:

- Creator-controlled webhook URL is trusted only within Discord URL shape. This matches the design acceptance that creators can configure their own webhook.

## Production Readiness Score

Overall score: **58 / 100**

| Category | Score | Rationale |
|---|---:|---|
| Architecture | 68 | Clean layering and provider seam, but event secret provisioning is not integrated and queue has no claim/lock state. |
| Security | 62 | HMAC/session/ownership/RLS are strong, but event secret is not provisioned, nonce replay is non-atomic, invalid-signature floods lack event-specific rate limiting, and sensitive webhook config is plaintext JSON. |
| Reliability | 55 | Retry/dead-letter lifecycle exists, but overlapping workers can duplicate delivery, crashes can duplicate external sends, test webhook processes global queue, and retention cleanup is absent. |
| Scalability | 50 | Batch size and indexes are reasonable for V1, but no backlog controls, no row leasing, no provider concurrency controls, and per-session-only rate limiting limits flood resistance. |
| Monitoring | 25 | No Phase 8 audit logs, security alerts, anomaly detection, backlog/dead-letter metrics, provider latency, or failure burst monitoring. |
| Operability | 48 | Dashboard visibility and replay exist, but no retention controls, no queue health metrics, no replay audit, no worker overlap detection, and no operational runbook integration was observed. |

## Risk Register

### HIGH-1: Event secret is not provisioned to runtime sessions

Description:

- `/api/events/report` rejects sessions without `event_secret`.
- `createDeliverySession()` does not pass `eventSecret` to `createSession()`.
- `/api/delivery/session` and `/api/delivery/fetch` responses do not include an event secret.
- Tests explicitly assert event secret remains nullable and absent from session creation behavior.

Impact:

- Legitimate clients cannot produce accepted event signatures through normal flows.
- Event Platform reporting is effectively unusable unless rows are manually backfilled or another unobserved path supplies the secret.

Likelihood: High

Recommendation:

- Before production, define and implement the event secret issuance contract in the existing delivery session/runtime payload flow. The event API should only be considered ready after an end-to-end client can obtain the secret and submit a signed accepted event.

### HIGH-2: Queue workers can duplicate deliveries under overlap

Description:

- `getPendingEvents()` selects pending events without claiming rows.
- `processEventQueue()` updates status only after provider delivery.
- Cron overlap or manual concurrent worker calls can select the same row and deliver it more than once.

Impact:

- Duplicate Discord notifications.
- Replay/delivery audit state may not reflect all external sends.
- Creator trust issue for purchase/ban/license-like event notifications.

Likelihood: Medium

Recommendation:

- Add an atomic claim/lease or DB-level lock before provider delivery, or otherwise enforce one active processor per event. Preserve at-least-once behavior intentionally and document external duplicate semantics if exact-once is not required.

### HIGH-3: Nonce replay protection is not atomic

Description:

- Replay protection uses `findEventByNonce()` before insert.
- Database has a non-unique `(session_id, nonce)` index.
- No transaction or unique constraint prevents two concurrent inserts with the same session/nonce.

Impact:

- Concurrent replay can store and deliver duplicate events despite nonce reuse.

Likelihood: Low to Medium

Recommendation:

- If strict replay protection is required, enforce uniqueness at the database layer or insert through an atomic operation. If the accepted duplicate risk remains intentional, document it in production security notes and monitor duplicate nonce attempts.

### HIGH-4: Missing Phase 8 monitoring and security alerting

Description:

- No audit logs or metrics for invalid signatures, replay attempts, event rate limits, queue backlog, dead-letter growth, webhook failure bursts, provider latency, or replay actions.

Impact:

- Active abuse and operational failures may go undetected.
- Incident response lacks structured evidence.

Likelihood: High

Recommendation:

- Add Phase 8 audit events and operational metrics before production launch. At minimum alert on invalid signature spikes, replay spikes, dead-letter growth, oldest pending age, worker failures, and provider failure bursts.

### MEDIUM-1: Event retention cleanup is documented but not implemented

Description:

- Phase 8A documents retention cleanup for delivered, dead-letter, and stuck events.
- `/api/cleanup` does not delete `event_logs`.

Impact:

- Unbounded event log growth.
- Increased storage costs and slower dashboards over time.
- Longer retention of untrusted event payload data than documented.

Likelihood: High

Recommendation:

- Implement event log retention cleanup consistent with documented retention windows, with metrics/counts for deleted rows.

### MEDIUM-2: Invalid session/signature floods are not event-rate-limited

Description:

- Event rate limiting occurs after successful session lookup and HMAC validation.
- Invalid session IDs, expired sessions, missing secrets, and bad signatures return before `checkEventRateLimit()`.

Impact:

- Attackers can force DB session lookups and HMAC checks without consuming the event session rate limit.
- Platform/edge protections must absorb this traffic.

Likelihood: Medium

Recommendation:

- Add IP/edge-level throttling for `/api/events/report` failures while preserving uniform auth error responses.

### MEDIUM-3: Test webhook action processes unrelated pending events

Description:

- `sendTestWebhookEvent()` creates one heartbeat event, then calls `processEventQueue(resolveProvider, 50)`.
- `processEventQueue()` polls global pending events ordered by `received_at`, not the newly created test event only.

Impact:

- A creator clicking “Send Test Event” can synchronously process unrelated pending events for other scripts.
- Test result can be affected by unrelated dead-letter/failure outcomes in the batch.

Likelihood: Medium

Recommendation:

- Isolate test delivery to the created test event or return “queued” without processing the global queue from a dashboard action.

### MEDIUM-4: Webhook credentials are stored as plaintext JSON

Description:

- `webhook_config.config` stores `{ webhook_url: webhookUrl }` directly.
- The Phase 8A threat model expected sensitive provider credentials encrypted at rest in Phase 8B.
- No encryption layer was observed in repository or service code.

Impact:

- Database/service-role compromise exposes Discord webhook URLs.
- Discord webhooks can be abused until rotated.

Likelihood: Medium

Recommendation:

- Encrypt sensitive provider config fields before storage or explicitly update the security model to accept plaintext webhook URLs with compensating controls.

### MEDIUM-5: Bulk replay has no service-level cap

Description:

- `replayAllDeadLetters()` fetches all dead-letter events for a script without a limit and iterates them.

Impact:

- Large dead-letter sets can cause long dashboard action runtimes and large queue bursts.

Likelihood: Medium

Recommendation:

- Add bounded bulk replay batches and make the UI/operation explicit about batch size.

### MEDIUM-6: Worker crash after provider success can duplicate external delivery

Description:

- Provider delivery occurs before DB status update.
- A crash after Discord accepts the webhook but before `delivery_status = 'delivered'` leaves the row pending.

Impact:

- The next worker run may send the same event again.

Likelihood: Low to Medium

Recommendation:

- Treat delivery as at-least-once and surface duplicate risk, or add provider-level idempotency where available. For Discord webhooks, monitor and reduce duplicates with queue claiming and careful crash handling.

### LOW-1: Worker route returns raw caught error messages to authorized caller

Description:

- Worker catch returns `{ success: false, message }` where message comes from caught error.

Impact:

- Limited information disclosure to holders of `CRON_SECRET`.

Likelihood: Low

Recommendation:

- Return a generic worker failure response and log details server-side.

### LOW-2: JSON serialization contract is brittle

Description:

- HMAC signs `JSON.stringify(payload)` exactly.
- Client must produce the same serialization shape as the server receives.

Impact:

- Legitimate clients can fail signatures due to serialization mismatch.

Likelihood: Medium during integration

Recommendation:

- Document canonical client signing rules and add integration tests using the actual runtime payload/client implementation.

### LOW-3: Event payload is displayed to creators without a schema-specific sanitizer

Description:

- Event detail includes full payload for owner debugging.
- React rendering escapes text, but payload content is untrusted runtime data.

Impact:

- Current risk is low in React text rendering, but future formatting/rendering changes could introduce injection hazards.

Likelihood: Low

Recommendation:

- Keep payload rendering as escaped text/JSON only. Do not render event payload values as HTML or URLs without sanitizer rules.

## Final Recommendation

**NO GO**

Phase 8 should not accept new feature work or production rollout until the high-risk blockers are resolved or explicitly accepted with documented operational constraints.

Minimum conditions before changing recommendation to GO WITH CONDITIONS:

1. Event secret issuance is implemented and verified end-to-end from delivery session/runtime client to accepted signed event report.
2. Queue processing prevents overlapping workers from delivering the same pending event concurrently, or duplicate delivery is formally accepted and monitored.
3. Replay protection is either made atomic or the concurrency replay gap is explicitly accepted with monitoring.
4. Phase 8 audit logging and monitoring exist for invalid signatures, replay attempts, queue backlog, dead-letter growth, worker failures, and webhook failure bursts.
5. Event log retention cleanup is implemented.
6. Test webhook delivery no longer processes unrelated global queue entries from a dashboard action.

The architecture can become production-ready without a rewrite, but the current implementation is incomplete at the event secret contract and operational safety layers.