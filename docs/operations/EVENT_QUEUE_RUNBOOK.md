# Event Queue Runbook

Status: Operational documentation for current event queue behavior.

## Scope

This runbook covers diagnosis, common failures, recovery procedures, and escalation for:

- `POST /api/events/report`
- `POST /api/internal/event-worker`
- `event_logs` queue lifecycle
- `webhook_config` provider delivery
- Internal alert records in `alert_events`

## Quick Diagnosis

1. Check worker scheduler status in GitHub Actions or Vercel Cron.
2. Manually call worker with `CRON_SECRET` against the Vercel hostname.
3. Check queue counts in Supabase.
4. Check recent `alert_events` rows.
5. Check `verification_logs` for event security and webhook counters.
6. Check provider-specific failures, especially Discord response errors.

Manual worker call:

```bash
curl -s -X POST https://luxyhub.vercel.app/api/internal/event-worker \
  -H "Authorization: Bearer $CRON_SECRET"
```

Queue snapshot:

```sql
SELECT delivery_status, COUNT(*)
FROM event_logs
GROUP BY delivery_status
ORDER BY delivery_status;
```

Oldest pending event:

```sql
SELECT id, script_id, event_type, retry_count, received_at, claimed_at, error_message
FROM event_logs
WHERE delivery_status = 'pending'
ORDER BY received_at ASC
LIMIT 20;
```

Dead letters:

```sql
SELECT id, script_id, event_type, retry_count, last_retry_at, error_message
FROM event_logs
WHERE delivery_status = 'dead_letter'
ORDER BY last_retry_at DESC NULLS LAST, received_at DESC
LIMIT 50;
```

## Common Failures

### Worker Not Running

Symptoms:

- Pending count grows.
- Oldest pending age increases.
- No recent worker run in GitHub Actions/Vercel Cron.

Diagnosis:

- Confirm scheduler is enabled.
- Confirm scheduler targets `https://luxyhub.vercel.app/api/internal/event-worker`.
- Confirm request method is POST.
- Confirm `CRON_SECRET` in scheduler matches production environment.

Recovery:

1. Run worker manually once.
2. Re-enable failed scheduler workflow/cron.
3. Monitor pending count until it decreases.
4. If backlog is large, run manual worker calls at controlled intervals.

Escalation:

- Escalate to P1 if queue backlog affects most event deliveries for more than 30 minutes.
- Escalate to P0 if queue growth threatens database availability.

### Unauthorized Worker

Symptoms:

- Worker returns `401 Unauthorized`.
- Scheduler logs show failed POST calls.

Diagnosis:

- Compare scheduler secret with Vercel `CRON_SECRET`.
- Check for accidental whitespace or environment mismatch.

Recovery:

1. Rotate `CRON_SECRET` if exposure is suspected.
2. Update Vercel production environment variable.
3. Update GitHub Actions/Vercel Cron secret.
4. Redeploy if required by environment variable propagation.
5. Run manual worker call to verify.

Escalation:

- P2 if caught before backlog.
- P1 if queue backlog is already causing delivery delays.

### Stale Claims

Symptoms:

- Pending events have `claimed_at` set but are not delivered.
- Worker was interrupted or timed out.

Diagnosis:

```sql
SELECT id, script_id, received_at, claimed_at, retry_count
FROM event_logs
WHERE delivery_status = 'pending'
  AND claimed_at IS NOT NULL
ORDER BY claimed_at ASC
LIMIT 50;
```

Recovery:

- No manual action is usually required. Claims older than 15 minutes are eligible for recovery.
- If urgently needed and worker is confirmed stopped, clear stale claims older than 15 minutes:

```sql
UPDATE event_logs
SET claimed_at = NULL
WHERE delivery_status = 'pending'
  AND claimed_at < NOW() - INTERVAL '15 minutes';
```

Escalation:

- Escalate if claims repeatedly become stale, indicating worker timeout, provider slowness, or database update failures.

### Webhook Provider Failure

Symptoms:

- `webhook.delivery_failure` or `webhook.provider_failure` counters increase.
- Events retry and then move to dead letter.
- Creator reports missing Discord notifications.

Diagnosis:

```sql
SELECT event, message, created_at
FROM verification_logs
WHERE event LIKE 'webhook.%'
ORDER BY created_at DESC
LIMIT 50;
```

```sql
SELECT e.id, e.script_id, e.retry_count, e.error_message, w.provider, w.enabled
FROM event_logs e
LEFT JOIN webhook_config w ON w.script_id = e.script_id
WHERE e.delivery_status IN ('pending', 'dead_letter')
ORDER BY e.received_at DESC
LIMIT 50;
```

Recovery:

1. Verify webhook URL in `webhook_config` is present and correct.
2. If provider outage is suspected, pause replay and wait for provider recovery.
3. If URL was revoked, ask creator or operator to replace webhook config.
4. Replay dead-letter events only after fixing provider/config issue.

Escalation:

- P2 for one script/creator.
- P1 for platform-wide provider outage or webhook failure burst alert at high/critical severity.

### Event Report Rejections

Symptoms:

- Runtime receives `Invalid event session`, `Invalid event timestamp`, `Invalid event payload`, `Unknown event type`, `Too many events`, or `Payload too large`.
- Security counters increase.

Diagnosis:

```sql
SELECT event, message, created_at
FROM verification_logs
WHERE event LIKE 'event.%'
ORDER BY created_at DESC
LIMIT 100;
```

Recovery:

- For timestamp failures, verify runtime/client clock behavior and payload signing code.
- For invalid signatures, verify event secret usage and payload JSON serialization.
- For replay attempts, investigate duplicate nonce generation or malicious reuse.
- For rate limits, reduce runtime event volume or batch/report fewer events.

Escalation:

- P2 for isolated script integration issue.
- P1 for widespread invalid signatures after deployment.
- Security escalation for replay attack or auth failure spikes.

## Backlog Response

Severity guide:

- Low: pending > 100.
- Medium: pending > 500.
- High: pending > 1000.
- Critical: pending > 5000.

Response:

1. Confirm worker route is healthy and authorized.
2. Run worker manually and inspect returned stats.
3. Determine whether backlog is no-config no-op, provider failure, or worker failure.
4. If provider is healthy, run repeated worker calls until backlog drains.
5. If provider is unhealthy, stop replay loops and communicate degraded event delivery.
6. Monitor `alert_events` for trigger/resolution.

## Dead-Letter Recovery

Recommended process:

1. Group dead letters by `script_id` and `error_message`.
2. Fix root cause first.
3. Replay a small sample.
4. Confirm delivery success.
5. Replay the remaining set in batches.

Manual reset SQL when application replay tooling is not available:

```sql
UPDATE event_logs
SET delivery_status = 'pending',
    retry_count = 0,
    last_retry_at = NULL,
    delivered_at = NULL,
    error_message = NULL,
    claimed_at = NULL
WHERE id = '<event-id>'
  AND delivery_status = 'dead_letter';
```

Do not bulk replay during active provider outage.

## Escalation Paths

- Event worker scheduler failure: platform operator.
- Supabase write/read failures: infrastructure owner and Supabase status review.
- Discord/webhook provider failure: provider status and creator support.
- Replay/signature/auth spikes: security incident lead.
- Database growth/backlog threatening availability: incident lead, P0/P1 depending impact.
