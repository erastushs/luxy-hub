# Build Operations Runbook

Status: Operational documentation for current secure delivery build pipeline.

## Scope

This runbook covers diagnosis, common failures, recovery procedures, and escalation for:

- `delivery_builds`
- Automatic build generation
- Manual rebuild operations
- Payload secret/key-id rotation side effects
- Runtime failures caused by missing or invalid ready builds

## Quick Diagnosis

Check build status distribution:

```sql
SELECT build_status, COUNT(*)
FROM delivery_builds
GROUP BY build_status
ORDER BY build_status;
```

Check recent failures:

```sql
SELECT id, script_id, version_id, build_status, build_error_code, build_error_message, created_at, updated_at
FROM delivery_builds
WHERE build_status = 'failed'
ORDER BY updated_at DESC
LIMIT 50;
```

Check stale running builds:

```sql
SELECT id, script_id, version_id, build_status, created_at, updated_at
FROM delivery_builds
WHERE build_status IN ('pending', 'building')
  AND updated_at < NOW() - INTERVAL '15 minutes'
ORDER BY updated_at ASC;
```

Check ready build availability for current versions:

```sql
SELECT s.id, s.slug, s.current_version_id, b.id AS ready_build_id, b.built_at
FROM scripts s
LEFT JOIN LATERAL (
  SELECT id, built_at
  FROM delivery_builds
  WHERE version_id = s.current_version_id
    AND build_status = 'ready'
  ORDER BY built_at DESC
  LIMIT 1
) b ON true
WHERE s.visibility IN ('public', 'unlisted')
ORDER BY s.updated_at DESC;
```

## Common Failures

### Missing Ready Build

Symptoms:

- `/api/delivery/session` returns `Delivery unavailable` for an otherwise valid public/unlisted script.
- Script has current version but no ready compatible build.

Diagnosis:

- Check `scripts.current_version_id`.
- Check `delivery_builds` for that version.
- Confirm build version and payload format match current constants.

Recovery:

1. Trigger manual rebuild from dashboard build operations.
2. If dashboard is unavailable, use existing server action path after restoring dashboard access.
3. Verify a `ready` row is created.
4. Test session and fetch flow for the script.

Escalation:

- P2 for one script.
- P1 if many public/unlisted scripts lost ready builds after deploy or migration.

### Build Failed: Empty Source

Symptoms:

- `build_error_code = 'empty_source'`.

Diagnosis:

- Source content is empty after normalization.
- Check version content via trusted admin/service tooling only.

Recovery:

1. Creator updates script content.
2. Trigger rebuild for latest version.
3. Confirm ready build exists.

Escalation:

- Usually creator support/P3 unless caused by a platform source mutation bug.

### Build Failed: Missing Payload Secret

Symptoms:

- `build_error_code = 'missing_payload_secret'`.
- Vercel logs indicate payload encryption secret is not configured.

Diagnosis:

- Check production `DELIVERY_PAYLOAD_SECRET`.
- Confirm `DELIVERY_PAYLOAD_SECRET` is present; production does not use `SUPABASE_SERVICE_ROLE_KEY` as a payload-secret fallback.
- Check environment variable scope and redeploy status.

Recovery:

1. Set `DELIVERY_PAYLOAD_SECRET` in production.
2. Set `DELIVERY_PAYLOAD_KEY_ID` to the active non-secret key id.
3. Redeploy if required.
4. Rebuild failed versions.
5. Verify delivery session/fetch for known deliverable scripts.

Escalation:

- P1 if new builds are blocked for production scripts.
- P0 if delivery fetch is also failing for existing ready builds.

### Stale Pending or Building Builds

Symptoms:

- Rows remain `pending` or `building` for more than expected function duration.
- Automatic build skip reason becomes `already_running`.

Diagnosis:

- Check Vercel function logs for crashes or timeouts.
- Check Supabase write failures around `updated_at`.
- Confirm no deployment interruption occurred mid-build.

Recovery:

1. Trigger manual rebuild if latest row is stale and no build is actually running.
2. If stale row blocks auto build but manual rebuild succeeds, leave stale row for audit unless it causes dashboard confusion.
3. Consider marking stale row failed or invalidated only after incident lead approval.

Escalation:

- P2 for isolated stale build.
- P1 for systemic stale builds across many scripts.

### Previous Ready Build Not Invalidated

Symptoms:

- Multiple ready builds exist for one version.
- Manual rebuild reports success with warning/failure around invalidation.

Diagnosis:

```sql
SELECT version_id, COUNT(*) AS ready_count
FROM delivery_builds
WHERE build_status = 'ready'
GROUP BY version_id
HAVING COUNT(*) > 1;
```

Recovery:

1. Confirm newest ready build is valid.
2. Runtime selects latest ready build by `built_at DESC`.
3. Invalidate older ready build if needed:

```sql
UPDATE delivery_builds
SET build_status = 'invalidated',
    invalidated_reason = 'manual_cleanup_superseded',
    invalidated_at = NOW(),
    updated_at = NOW()
WHERE id = '<old-build-id>'
  AND build_status = 'ready';
```

Escalation:

- P3 if no runtime impact.
- P2 if creators see confusing build state.

### Delivery Fails After Secret Rotation

Symptoms:

- Builds are `ready` but fetch/runtime payload consumption fails.
- Failure begins after `DELIVERY_PAYLOAD_SECRET` rotation.

Diagnosis:

- Compare `delivery_builds.encryption_key_id` with current `DELIVERY_PAYLOAD_KEY_ID`.
- Check whether affected builds predate rotation.
- Verify current production environment variables.

Recovery:

1. Confirm active secret is correct and stable.
2. Rebuild all deliverable current versions.
3. Verify newly built payloads have the expected key id.
4. Test delivery session/fetch for representative scripts.

Escalation:

- P1 if multiple scripts are affected.
- P0 if secure delivery is broadly unavailable.

## Recovery Procedures

### Rebuild a Script Version

Preferred:

- Use dashboard build operations as the owning creator/admin.

Validation after rebuild:

```sql
SELECT id, build_status, build_error_code, build_error_message, built_at, payload_byte_size
FROM delivery_builds
WHERE version_id = '<version-id>'
ORDER BY created_at DESC
LIMIT 5;
```

### Verify Runtime Delivery

Use a known public/unlisted script slug:

```bash
curl -s -X POST https://luxyhub.vercel.app/api/delivery/session \
  -H "Content-Type: application/json" \
  -d '{"slug":"<slug>"}'
```

Then use returned `session_token`:

```bash
curl -s -X POST https://luxyhub.vercel.app/api/delivery/fetch \
  -H "Content-Type: application/json" \
  -d '{"session_token":"<session-token>"}'
```

Expected:

- Session response contains `session_token`, `event_secret`, and `expires_in`.
- Fetch response contains `runtime_payload`, build metadata, and `event_secret`.

## Escalation Paths

- Build service errors: application owner.
- Missing/incorrect environment secret: operations owner.
- Supabase write failures: infrastructure owner.
- Payload decrypt/fetch failures after rotation: incident lead and security owner.
- Broad delivery outage: P0/P1 incident response.
