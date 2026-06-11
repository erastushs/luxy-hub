# Secret Rotation Runbook

Status: Operational documentation for current secrets. This document does not change secrets or runtime behavior.

## Scope

This runbook covers diagnosis, common failures, recovery procedures, and escalation for rotating secrets that affect runtime systems:

- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `DELIVERY_PAYLOAD_SECRET`
- `DELIVERY_PAYLOAD_KEY_ID`
- `INTERNAL_ALERT_DISCORD_WEBHOOK`
- Creator webhook URLs stored in `webhook_config`

## General Rotation Rules

- Rotate one secret at a time unless responding to confirmed compromise.
- Record start time, operator, affected systems, and validation results in the incident/change log.
- Update production environment variables before revoking old provider credentials when possible.
- Redeploy if the hosting platform requires redeploy for environment changes.
- Validate affected runtime paths immediately after rotation.
- Do not paste secrets into logs, tickets, screenshots, or documentation.

## `SUPABASE_SERVICE_ROLE_KEY`

Purpose:

- Server-side database access for repositories, runtime delivery, event worker, cleanup, license APIs, dashboard services, rate limiting, and monitoring counters.

Impact:

- Incorrect value can break most server-side database operations.
- If used as fallback payload secret, rotation may also affect delivery payload decryption unless builds are rebuilt with the new effective secret.

Rotation procedure:

1. Generate or retrieve the new service role key from Supabase.
2. Update Vercel production `SUPABASE_SERVICE_ROLE_KEY`.
3. Redeploy production if required.
4. Validate `/api/health`.
5. Validate database-backed endpoints such as `/api/validate` with an invalid key expecting controlled `403`, not `500`.
6. Validate dashboard login and script listing.
7. Validate `/api/delivery/session` and `/api/delivery/fetch` for a known deliverable script.
8. Validate `/api/internal/event-worker` with `CRON_SECRET`.
9. If `DELIVERY_PAYLOAD_SECRET` is not set, rebuild delivery payloads because service role key fallback changed.
10. Revoke old key only after validation.

Common failures:

- All DB-backed routes return `500`.
- Rate limiter fails closed.
- Event worker returns database errors.
- Delivery build/fetch fails if secret fallback changed.

Escalation:

- P0 if production DB access is broken globally.
- Security incident if rotation was compromise-driven.

## `CRON_SECRET`

Purpose:

- Bearer token for internal scheduled endpoints, including event worker, alert checks, and cleanup.

Impact:

- Incorrect value breaks scheduled worker/cleanup calls.
- Queue backlog can grow if event worker authorization fails.

Rotation procedure:

1. Generate a new high-entropy secret.
2. Update Vercel production `CRON_SECRET`.
3. Update GitHub Actions or Vercel Cron secret/configuration.
4. Redeploy if required.
5. Manually validate event worker:

```bash
curl -s -X POST https://luxyhub.vercel.app/api/internal/event-worker \
  -H "Authorization: Bearer $CRON_SECRET"
```

6. Manually validate cleanup if applicable:

```bash
curl -s -X POST https://luxyhub.vercel.app/api/cleanup \
  -H "Authorization: Bearer $CRON_SECRET"
```

7. Confirm next scheduled run succeeds.
8. Remove old secret from scheduler stores.

Common failures:

- Worker returns `401`.
- Worker returns `500` if production environment lacks `CRON_SECRET`.
- Event backlog increases.

Escalation:

- P2 if caught immediately.
- P1 if event backlog or cleanup failure affects production behavior.

## `DELIVERY_PAYLOAD_SECRET`

Purpose:

- Explicit secret used to derive AES-256-GCM payload encryption/decryption key.

Impact:

- Existing ready builds encrypted with the old secret may become unreadable unless compatibility is intentionally preserved.
- New builds use the new secret.

Planned rotation procedure:

1. Set `DELIVERY_PAYLOAD_KEY_ID` to a new non-secret identifier for the new generation.
2. Set new `DELIVERY_PAYLOAD_SECRET` in Vercel production.
3. Redeploy if required.
4. Rebuild all current deliverable script versions.
5. Verify new `delivery_builds.encryption_key_id` matches the new key id.
6. Validate delivery session/fetch for representative public and unlisted scripts.
7. Monitor delivery errors and build failures.
8. Keep the old secret available only if the runtime has an explicit compatibility mechanism; otherwise prioritize rebuilding before removing old value from any secure store.

Emergency rotation procedure:

1. Rotate secret immediately.
2. Temporarily expect delivery disruption for builds encrypted under the old secret.
3. Rebuild all deliverable versions as priority P0/P1 work.
4. Verify runtime delivery after rebuild.
5. Review audit logs and delivery/session activity for compromise indicators.

Common failures:

- Ready builds exist but fetch/runtime payload consumption fails.
- New builds have different `encryption_key_id` while old builds remain selected for some versions.
- Manual rebuild fails due to missing secret or source issues.

Escalation:

- P1 for planned rotation with partial delivery failures.
- P0 for compromise or broad secure delivery outage.

## `DELIVERY_PAYLOAD_KEY_ID`

Purpose:

- Non-secret identifier stored in build metadata to identify payload key generation.

Impact:

- Does not itself encrypt/decrypt payloads.
- Used for operations and rebuild tracking.

Rotation procedure:

1. Choose a clear identifier, for example `payload-2026-06`.
2. Update Vercel production `DELIVERY_PAYLOAD_KEY_ID` with the payload secret rotation.
3. Rebuild affected versions.
4. Validate key id on new build rows.

Validation SQL:

```sql
SELECT encryption_key_id, build_status, COUNT(*)
FROM delivery_builds
GROUP BY encryption_key_id, build_status
ORDER BY encryption_key_id, build_status;
```

## `INTERNAL_ALERT_DISCORD_WEBHOOK`

Purpose:

- Optional internal Discord webhook for high/critical operational alerts.

Impact:

- If missing or invalid, alert records still persist in `alert_events`, but Discord notification may fail.

Rotation procedure:

1. Create new Discord webhook in the internal alerts channel.
2. Update Vercel production `INTERNAL_ALERT_DISCORD_WEBHOOK`.
3. Redeploy if required.
4. Run alert check or wait for worker-triggered alert evaluation.
5. Confirm high/critical test condition or controlled manual validation posts to the expected channel.
6. Delete old Discord webhook.

Common failures:

- Alert records created but no Discord message.
- Discord webhook returns non-2xx in logs.

Escalation:

- P3 if alert persistence works and only routing is degraded.
- P1/P2 if alert routing outage hides an active production incident.

## Creator Webhook URLs

Purpose:

- Provider URLs stored in `webhook_config.config` for event delivery.

Impact:

- Invalid URL causes event retries and dead letters for that script.
- Runtime scripts never see these URLs.

Rotation procedure:

1. Creator/operator creates new provider webhook URL.
2. Update webhook config through dashboard/service path.
3. Confirm `enabled = true` only after URL is valid.
4. Trigger or wait for a test event.
5. Replay dead-letter events for that script if needed.
6. Revoke old provider webhook.

Escalation:

- Creator support for one script.
- Platform incident if many webhook URLs are compromised or provider-wide credentials are exposed.

## Post-Rotation Validation Matrix

Validate these systems after relevant rotations:

- Health: `GET /api/health` returns 200.
- Key validation: invalid key returns controlled 403, not 500.
- Dashboard auth: creator dashboard loads.
- Delivery: session and fetch succeed for a known deliverable script.
- Build: manual rebuild succeeds for a safe test script/version.
- Event worker: authenticated worker call succeeds.
- Alerts: `alert_events` can be created/resolved by worker and high/critical notifications route when configured.
- Licenses: license dashboard/API loads for an authenticated owner.

## Escalation Paths

- Secret compromise: security incident lead immediately.
- Broad runtime outage: incident lead, P0/P1.
- Vercel environment propagation issue: infrastructure owner.
- Supabase key issue: infrastructure owner and Supabase status review.
- Discord/internal alert routing issue: operations owner.
