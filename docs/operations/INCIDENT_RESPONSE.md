# LuxyHub — Incident Response Plan

Last updated: 2026-06-11

---

## 1. Severity Classification

| Level | Name | Description | Response SLA |
|-------|------|-------------|-------------|
| **P0** | Critical | Service completely unavailable. All users affected. Revenue loss. | 15 min detection → 1 hour resolution |
| **P1** | High | Core API degraded. Key validation failing. Major feature broken. | 30 min detection → 4 hour resolution |
| **P2** | Medium | Single endpoint degraded. Non-critical feature broken. Partial impact. | 2 hour detection → 24 hour resolution |
| **P3** | Low | Minor bug. Cosmetic issue. No user impact. | Next business day |

### P0 Triggers
- `/api/health` returns non-200 for > 3 consecutive checks
- Website `www.luxyhub.space` returns 5xx for all requests
- Supabase database unreachable
- Work.ink API completely down preventing all key generation

### P1 Triggers
- `/api/validate` returns 500 for > 5% of requests
- `/api/generate-key` returns 500 for all requests
- Rate limiter fail-closed (all requests 429)
- Key validation success rate drops below 90%
- Event queue pending backlog exceeds 1000 or oldest pending age exceeds 30 minutes
- Secure delivery build failures affect multiple active scripts
- License ownership or assignment isolation issue suspected

### P2 Triggers
- Single API endpoint returns elevated error rate
- Rate limiting too aggressive for specific IPs
- Cleanup cron job fails repeatedly
- Dashboard partially degraded
- Event queue pending backlog exceeds 500 without broad user impact
- Webhook delivery failures affect one provider or a small set of scripts
- License dashboard/API degraded without confirmed security impact

### P3 Triggers
- Individual creator webhook misconfiguration
- Individual script build failure caused by empty source
- Internal alert routing degraded while alert records still persist
- Minor analytics/reporting inconsistencies without runtime impact

---

## 2. Escalation Path

```
Detection (Monitoring / User Report)
    │
    ▼
On-Call Responder — Initial triage (15 min)
    │
    ▼
Assess Severity — Apply classification
    │
    ├── P2/P3 → Fix during business hours
    │
    ▼ P0/P1
Incident Lead — Escalate and coordinate
    │
    ▼
Execute Response Playbook — Contain → Mitigate → Resolve
    │
    ▼
Communication — Update status page / Discord
    │
    ▼
Post-Incident Review — Within 48 hours
```

---

## 3. Response Playbooks

### 3.1 P0 — API Outage (validate returns 500)

**Symptom:** `/api/validate` returns HTTP 500 for all requests.

**Root Causes (in order of likelihood):**
1. Supabase database unreachable
2. `SUPABASE_SERVICE_ROLE_KEY` expired or invalid
3. Vercel function crash due to unhandled exception
4. Network partition between Vercel and Supabase

**Response Steps:**

```bash
# Step 1: Check Vercel status
curl -s https://www.vercel-status.com

# Step 2: Check Supabase status
curl -s https://status.supabase.com

# Step 3: Check health endpoint
curl -s https://luxyhub.vercel.app/api/health
# If 200: Vercel functions running, issue is Supabase
# If 500: Vercel function issue

# Step 4: Check Vercel function logs
# Vercel Dashboard → Deployments → Production → Functions → Logs
# Look for: "Supabase", "connection", "timeout", "service_role"

# Step 5: Check Supabase database connectivity
# Supabase Dashboard → Database → Settings → Connection status

# Step 6: If SUPABASE_SERVICE_ROLE_KEY suspected:
# Supabase Dashboard → Project Settings → API → service_role key
# Verify key in Vercel → Settings → Environment Variables

# Step 7: Roll back if recent deploy caused issue
# Vercel Dashboard → Deployments → [previous working deploy] → Promote to Production
```

**Containment:**
- If Supabase outage: no containment possible (external dependency)
- If Vercel function issue: rollback to last known good deployment
- If service_role key expired: rotate key immediately

**Resolution:**
- Supabase: automatic when Supabase recovers
- Vercel: rollback + investigate root cause post-incident
- Key expiry: rotate key, update env vars, redeploy

### 3.2 P1 — Supabase Database Outage

**Symptom:** All API endpoints return HTTP 500. Health endpoint may return 200.

**Response Steps:**
1. Verify outage at `https://status.supabase.com/`
2. Check Supabase Dashboard → Database → Status
3. All API requests will fail — rate limiter is fail-closed

**Containment:**
- No application-level containment possible
- Database operations blocked until Supabase recovers

**Resolution:**
- Automatic when Supabase comes back online
- Verify all tables and indexes intact after recovery
- Run cleanup endpoint to clear stale rate limit records

### 3.3 P1 — Vercel Deployment Failure

**Symptom:** New deploy causes errors. Website or API returns 5xx.

**Response Steps:**
```bash
# Immediate rollback
# Vercel Dashboard → Deployments → [previous green deploy] → Promote to Production

# After rollback, check:
curl -s https://luxyhub.vercel.app/api/health
curl -s -X POST https://luxyhub.vercel.app/api/validate \
  -H "Content-Type: application/json" \
  -d '{"key":"LUXY-ABCD-EFGH-IJKL"}'
```

**Containment:**
- Rollback to last known good deployment immediately
- Disable automatic deployments temporarily if needed

**Resolution:**
- Investigate failed deploy in Vercel build logs
- Fix root cause before re-enabling auto-deploy

### 3.4 P2 — Rate Limiter Fail-Closed

**Symptom:** All API requests return HTTP 429 even for legitimate users.

**Response Steps:**
```bash
# Step 1: Verify rate limiter is truly fail-closed
for i in $(seq 1 5); do
  curl -s -w "\n" -X POST https://luxyhub.vercel.app/api/validate \
    -H "Content-Type: application/json" \
    -d '{"key":"LUXY-ABCD-EFGH-IJKL"}'
done
# If all return 429: fail-closed confirmed

# Step 2: Check rate_limits table size
# Supabase Dashboard → SQL Editor:
SELECT COUNT(*) FROM rate_limits;
# If > 100,000 rows: cleanup cron not running

# Step 3: Run manual cleanup
curl -s -X POST https://luxyhub.vercel.app/api/cleanup \
  -H "Authorization: Bearer $CRON_SECRET"

# Step 4: If table is severely bloated, manual truncation:
# Supabase SQL Editor:
DELETE FROM rate_limits WHERE created_at < NOW() - INTERVAL '1 hour';
```

**Containment:**
- Run cleanup endpoint immediately
- Manually delete recent rate limit records if necessary
- Investigate why cron didn't run

**Resolution:**
- Fix cron job scheduling
- Reduce rate limit TTL temporarily if abuse not a concern
- Monitor table size for 24 hours

### 3.5 P2 — Work.ink Integration Failure

**Symptom:** `/api/generate-key` and `/api/verify-workink` return HTTP 403 or 500.

**Impact:** Users cannot generate new keys. Existing keys continue working.

**Response Steps:**
```bash
# Step 1: Verify Work.ink reachable
curl -s -I https://work.ink/api/verify

# Step 2: Check verification_logs for Work.ink errors
# Supabase SQL Editor:
SELECT * FROM verification_logs
WHERE event LIKE '%WORKINK%'
ORDER BY created_at DESC
LIMIT 20;

# Step 3: Test Work.ink flow directly
curl -s -X POST https://luxyhub.vercel.app/api/verify-workink \
  -H "Content-Type: application/json" \
  -d '{"token":"test"}'
```

**Containment:**
- `/api/validate` still works — existing users unaffected
- Post notice to Discord/status: "Key generation temporarily unavailable"
- Do NOT disable Work.ink requirement — maintain security

**Resolution:**
- Work.ink has no public status page
- Automatic recovery when Work.ink resolves their issue
- If outage > 4 hours, consider emergency bypass (HIGH RISK — requires security review)

### 3.6 P1 — Mass Key Leak / Security Incident

**Symptom:** Keys circulating publicly, unusual validation patterns, suspicious activity.

**Response Steps:**
```bash
# Step 1: Deactivate all active keys immediately
# Supabase SQL Editor:
UPDATE keys SET is_active = false WHERE is_active = true;

# Step 2: Run cleanup endpoint
curl -s -X POST https://luxyhub.vercel.app/api/cleanup \
  -H "Authorization: Bearer $CRON_SECRET"

# Step 3: Investigate source
SELECT * FROM used_workink_tokens ORDER BY used_at DESC LIMIT 50;
SELECT * FROM verification_logs
WHERE event = 'GENERATE_KEY_SUCCESS'
ORDER BY created_at DESC
LIMIT 50;

# Step 4: Check rate_limits for abuse patterns
SELECT ip, COUNT(*) as count
FROM rate_limits
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY ip
HAVING COUNT(*) > 100
ORDER BY count DESC;
```

**Containment:**
- Mass deactivate all keys
- Block abusive IPs in Cloudflare WAF if identifiable
- Increase rate limits temporarily

**Resolution:**
- All users must re-generate keys through Work.ink
- Patch any identified abuse vector before re-enabling
- Post-incident review required

### 3.7 P2 — Scheduled Job Failure

**Symptom:** Event queue backlog grows, alerts stop updating, or database cleanup tables grow without bound.

**Response Steps:**
```bash
# Event worker scheduler:
# 1. Verify GitHub Actions → Event Worker Scheduler runs every 5 minutes.
# 2. Confirm repository secrets:
#    EVENT_WORKER_URL=https://luxyhub.vercel.app/api/internal/event-worker
#    CRON_SECRET=<same value as Vercel CRON_SECRET>
# 3. Confirm the workflow response is HTTP 200 and includes worker stats.

# Cleanup cron:
# 4. Verify Vercel daily /api/cleanup cron remains configured from vercel.json.

# Manual cleanup test:
curl -s -X POST https://luxyhub.vercel.app/api/cleanup \
  -H "Authorization: Bearer $CRON_SECRET"

# Manual event worker test:
curl -s -X POST https://luxyhub.vercel.app/api/internal/event-worker \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Containment:**
- Run the event worker manually if queue backlog is growing.
- Run manual cleanup if retention tables are growing.
- Re-copy `CRON_SECRET` into both Vercel and GitHub Actions secrets if authentication fails.

**Resolution:**
- Restore the GitHub Actions event-worker workflow for queue processing.
- Restore the Vercel daily cleanup cron for retention cleanup.
- Do not use `https://www.luxyhub.space/api/internal/event-worker` for GitHub Actions; use the Vercel hostname to avoid Cloudflare challenges.

### 3.8 P1/P2 — Event Backlog Incident

**Symptom:** `queue_backlog_spike` alert fires, pending `event_logs` count grows, or creators report delayed webhook events.

**Response Steps:**

```bash
# Step 1: Run worker manually
curl -s -X POST https://luxyhub.vercel.app/api/internal/event-worker \
  -H "Authorization: Bearer $CRON_SECRET"
```

```sql
-- Step 2: Measure backlog
SELECT delivery_status, COUNT(*)
FROM event_logs
GROUP BY delivery_status;

-- Step 3: Inspect oldest pending events
SELECT id, script_id, event_type, retry_count, received_at, claimed_at, error_message
FROM event_logs
WHERE delivery_status = 'pending'
ORDER BY received_at ASC
LIMIT 20;

-- Step 4: Check active alerts
SELECT alert_type, severity, current_value, threshold_value, created_at
FROM alert_events
WHERE status = 'active'
ORDER BY created_at DESC;
```

**Containment:**

- If worker auth fails, rotate/fix `CRON_SECRET` and scheduler secrets.
- If worker succeeds but backlog remains, repeat worker runs at controlled intervals.
- If provider failures are driving retries, stop bulk replay and fix provider/webhook config first.
- If stale claims are older than 15 minutes, allow lease recovery or clear stale claims only after confirming no worker is active.

**Resolution:**

- Restore scheduler cadence.
- Drain pending queue.
- Resolve provider/config issues.
- Confirm alert auto-resolves after backlog drops below threshold.
- Follow `docs/operations/EVENT_QUEUE_RUNBOOK.md` for detailed replay/dead-letter handling.

### 3.9 P1/P2 — Build Failure Incident

**Symptom:** `delivery_builds` failures increase, creators cannot publish deliverable scripts, or `/api/delivery/session` returns `Delivery unavailable` for scripts that should be deliverable.

**Response Steps:**

```sql
-- Step 1: Build status distribution
SELECT build_status, COUNT(*)
FROM delivery_builds
GROUP BY build_status;

-- Step 2: Recent failures and stale builds
SELECT id, script_id, version_id, build_status, build_error_code, build_error_message, updated_at
FROM delivery_builds
WHERE build_status IN ('failed', 'pending', 'building')
ORDER BY updated_at DESC
LIMIT 50;
```

**Containment:**

- If caused by deployment, roll back to the last known good production deployment.
- If caused by missing payload secret, restore `DELIVERY_PAYLOAD_SECRET` and redeploy if required.
- If caused by bad source content, keep existing ready build active and have creator fix source.
- Do not invalidate previous ready builds unless a new ready build exists and has been validated.

**Resolution:**

- Rebuild affected current versions.
- Verify new rows are `ready` and have expected `encryption_key_id`.
- Test `/api/delivery/session` and `/api/delivery/fetch` for representative scripts.
- Follow `docs/operations/BUILD_OPERATIONS.md` for detailed recovery.

### 3.10 P1/P2 — Webhook Failure Incident

**Symptom:** `webhook_failure_burst` alert fires, events move to dead letter, or creator Discord notifications stop.

**Response Steps:**

```sql
-- Step 1: Check webhook counters
SELECT event, message, created_at
FROM verification_logs
WHERE event LIKE 'webhook.%'
ORDER BY created_at DESC
LIMIT 50;

-- Step 2: Check failed events with configs
SELECT e.id, e.script_id, e.retry_count, e.delivery_status, e.error_message, w.provider, w.enabled
FROM event_logs e
LEFT JOIN webhook_config w ON w.script_id = e.script_id
WHERE e.delivery_status IN ('pending', 'dead_letter')
ORDER BY e.received_at DESC
LIMIT 50;
```

**Containment:**

- If provider outage is confirmed, pause replay and communicate degraded webhook delivery.
- If a creator webhook URL is revoked/invalid, disable or update that config.
- Avoid mass replay while provider rate limits or outage continue.

**Resolution:**

- Restore provider config or wait for provider recovery.
- Replay dead letters in small batches.
- Confirm `webhook.delivery_success` counters resume.
- Follow `docs/operations/EVENT_QUEUE_RUNBOOK.md` for detailed dead-letter replay.

### 3.11 P1/Security — License Incident

**Symptom:** Suspected license leak, unexpected assignment growth, invalid owner access, license API isolation concern, or license dashboard exposing incorrect data.

**Response Steps:**

```sql
-- Step 1: License status distribution
SELECT status, COUNT(*)
FROM licenses
GROUP BY status;

-- Step 2: Largest assignment sets
SELECT l.id, l.script_id, l.creator_id, l.status, COUNT(a.id) AS assignments
FROM licenses l
LEFT JOIN license_assignments a ON a.license_id = l.id
GROUP BY l.id, l.script_id, l.creator_id, l.status
ORDER BY assignments DESC
LIMIT 50;

-- Step 3: Recent license audit records when available
SELECT actor_id, action, resource_type, resource_id, resource_slug, created_at
FROM audit_logs
WHERE resource_type LIKE '%license%'
ORDER BY created_at DESC
LIMIT 50;
```

**Containment:**

- Disable or revoke suspected leaked licenses.
- Preserve `audit_logs`, relevant `licenses`, `license_assignments`, and function logs.
- If owner isolation is suspected, stop related deploys and treat as a security incident.
- Do not delete license rows during investigation unless approved by incident lead.

**Resolution:**

- Verify RLS policies for `licenses` and `license_assignments`.
- Verify application services derive owner id from session, not client input.
- Rotate affected license keys by revoking old licenses and issuing new ones.
- Review assignment hashes and customer impact.
- Complete security post-incident review for isolation or leakage incidents.

### 3.12 P1/P2 — Internal Alert Routing Failure

**Symptom:** `alert_events` rows are created but Discord/internal alert notifications do not arrive.

**Response Steps:**

```sql
SELECT alert_type, severity, status, message, created_at, resolved_at
FROM alert_events
ORDER BY created_at DESC
LIMIT 50;
```

**Containment:**

- Use the operations dashboard or SQL as source of truth while routing is degraded.
- Manually notify on-call for high/critical active alerts.

**Resolution:**

- Verify `INTERNAL_ALERT_DISCORD_WEBHOOK` in Vercel production.
- Rotate Discord webhook if revoked or exposed.
- Run `/api/internal/event-worker` or `/api/internal/check-alerts` with `CRON_SECRET` to validate alert evaluation.

---

## 4. Communication Templates

### 4.1 Discord/Social — P0 Service Outage

```
🚨 LuxyHub is experiencing a service outage.

Affected: Key validation and script delivery
Status: Investigating
ETA: We'll provide updates here

Our team is working to restore service. Thank you for your patience.
```

### 4.2 Discord/Social — P1 Degraded Service

```
⚠️ LuxyHub is experiencing degraded service.

Affected: Key generation temporarily unavailable
Status: Existing keys continue to work

We're investigating and will update shortly.
```

### 4.3 Discord/Social — Incident Resolved

```
✅ LuxyHub service has been restored.

All systems operational. Thank you for your patience during this incident.

If you experience any issues, please contact support.
```

---

## 5. Post-Incident Review

Conduct within 48 hours of incident resolution. Document in `INCIDENT_REPORTS/`.

### Review Template

```markdown
# Incident Report — [YYYY-MM-DD]

## Summary
[One-line description]

## Timeline
[UTC times for each event]
- HH:MM — Detection (how detected)
- HH:MM — Response started
- HH:MM — Root cause identified
- HH:MM — Resolution applied
- HH:MM — Service restored
- Total downtime: [X] minutes

## Root Cause
[Detailed technical explanation]

## Impact
- Users affected: [N]
- Keys invalidated: [N]
- Revenue impact: [if any]

## Resolution
[Steps taken to resolve]

## Prevention
[Changes to prevent recurrence]
- [ ] Action item 1
- [ ] Action item 2

## Lessons Learned
[What went well, what could improve]
```

---

## 6. Monitoring & Alerting

### 6.1 Alerts Configured

| Alert | Source | Threshold | Destination |
|-------|--------|-----------|-------------|
| API Health Check Fail | Better Stack / Uptime Kuma | 2 failures in 5 min | Discord / Email |
| Website Down | Better Stack / Uptime Kuma | 2 failures in 5 min | Discord / Email |
| Validate API Error Rate | Better Stack | > 5% in 5 min | Discord / Email |
| Supabase DB Status | Supabase Dashboard | Connection failure | Email |
| SSL Certificate Expiry | Cloudflare | < 30 days | Email |
| Vercel Deploy Failure | Vercel | On failure | Email |
| Queue Backlog Spike | `alert_events` / event worker | Pending events >= configured threshold | Internal Discord / Operations dashboard |
| Dead Letter Spike | `alert_events` / event worker | Dead letters >= configured threshold | Internal Discord / Operations dashboard |
| Invalid Signature Spike | `alert_events` / event worker | Invalid signatures >= configured threshold | Internal Discord / Security lead |
| Replay Attack Spike | `alert_events` / event worker | Replay attempts >= configured threshold | Internal Discord / Security lead |
| Webhook Failure Burst | `alert_events` / event worker | Provider failures >= configured threshold | Internal Discord / Operations dashboard |
| Auth Failure Spike | `alert_events` / event worker | Auth failures >= configured threshold | Internal Discord / Security lead |
| License Incident | Audit/API reports | Owner isolation, leak, or abnormal assignment growth | Security lead / Incident lead |

### 6.2 Health Check Endpoints

```bash
# Primary health check
curl https://luxyhub.vercel.app/api/health
# Expected: {"status":"ok","timestamp":"..."}

# Validate API functional check
curl -s -X POST https://luxyhub.vercel.app/api/validate \
  -H "Content-Type: application/json" \
  -d '{"key":"LUXY-HEALTH-CHECK-KEY-RESERVED"}'
# Expected: HTTP 403 (not 500 — 500 means DB issue)

# Supabase connectivity (indirect)
# If validate returns proper JSON (not 500, not connection error), DB is connected
```

### 6.3 Alert Escalation

| Alert | First Responder | Escalate After |
|-------|----------------|----------------|
| P0 — Service Down | On-Call | 15 minutes |
| P1 — Core Degraded | On-Call | 1 hour |
| P2 — Partial Degraded | On-Call | 4 hours |
| P3 — Minor | Next business day | N/A |

---

## 7. Recovery Runbooks

### 7.1 Database Restore

```bash
# Supabase Dashboard → Database → Backups
# 1. Select restore point
# 2. Initiate restore (creates new database)
# 3. Verify tables:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';
# Expected: keys, used_workink_tokens, rate_limits, verification_logs, key_usage

# 4. Re-apply RLS (backups may not include policies):
# Run migrations/001_enable_rls.sql in SQL Editor
```

### 7.2 Environment Variable Recovery

1. Retrieve from secure password manager
2. Set in Vercel Dashboard → Settings → Environment Variables
3. Redeploy application
4. Verify: `curl https://luxyhub.vercel.app/api/health`

### 7.3 CRON_SECRET Rotation

```bash
# 1. Generate new secret
openssl rand -hex 32

# 2. Update Vercel env var:
# Vercel Dashboard → Settings → Environment Variables → CRON_SECRET

# 3. Update GitHub Actions repository secret:
# Settings → Secrets and variables → Actions → CRON_SECRET

# 4. Confirm EVENT_WORKER_URL remains:
# https://luxyhub.vercel.app/api/internal/event-worker

# 5. Redeploy Vercel so server routes receive the new CRON_SECRET

# 6. Verify old secret rejected:
curl -s -X POST https://luxyhub.vercel.app/api/internal/event-worker \
  -H "Authorization: Bearer <old-secret>"
# Expected: HTTP 401

# 7. Verify new secret accepted:
curl -s -X POST https://luxyhub.vercel.app/api/internal/event-worker \
  -H "Authorization: Bearer <new-secret>"
# Expected: HTTP 200

# 8. Verify cleanup also accepts the new secret:
curl -s -X POST https://luxyhub.vercel.app/api/cleanup \
  -H "Authorization: Bearer <new-secret>"
# Expected: HTTP 200
```

### 7.4 SUPABASE_SERVICE_ROLE_KEY Rotation

1. Supabase Dashboard → Project Settings → API
2. Generate new service_role JWT
3. Update `SUPABASE_SERVICE_ROLE_KEY` in Vercel env vars
4. Redeploy immediately
5. Verify: `curl https://luxyhub.vercel.app/api/health`

### 7.5 Delivery Payload Secret Recovery

1. Restore or rotate `DELIVERY_PAYLOAD_SECRET` in Vercel.
2. Set `DELIVERY_PAYLOAD_KEY_ID` to the expected non-secret generation id.
3. Redeploy if required.
4. Rebuild current deliverable script versions.
5. Verify `delivery_builds.encryption_key_id` and `build_status = 'ready'`.
6. Test `/api/delivery/session` and `/api/delivery/fetch` for known scripts.

### 7.6 Event Queue Recovery

1. Restore `CRON_SECRET` and scheduler configuration.
2. Run `/api/internal/event-worker` manually.
3. Inspect pending/dead-letter counts.
4. Fix webhook/provider root causes.
5. Replay dead letters in small batches after root cause is fixed.
6. Confirm `queue_backlog_spike` and `dead_letter_spike` alerts resolve.

### 7.7 License Incident Recovery

1. Disable or revoke affected licenses.
2. Preserve logs and database rows for investigation.
3. Verify owner-scoped access for affected creator accounts.
4. Issue replacement licenses when appropriate.
5. Document affected scripts, customers, and remediation.

---

## 8. Key Contacts & Resources

### Infrastructure
| Service | Status Page | Dashboard |
|---------|------------|-----------|
| Vercel | `https://www.vercel-status.com` | `https://vercel.com/dashboard` |
| Supabase | `https://status.supabase.com` | `https://supabase.com/dashboard` |
| Cloudflare | `https://www.cloudflarestatus.com` | `https://dash.cloudflare.com` |

### Project Resources
| Resource | Location |
|----------|----------|
| Source Code | `github.com/erastushs/luxy-hub` |
| Deployment Checklist | `../deployment/DEPLOYMENT_CHECKLIST.md` |
| Backup Strategy | `../archive/deployment/BACKUP_STRATEGY.md` |
| API Documentation | `../archive/integration/API_SPEC.md` |
| Integration Docs | `../archive/integration/API_INTEGRATION.md` |
| Database Schema | `schema.sql` |
| RLS Migration | `migrations/001_enable_rls.sql` |
| Database Docs | `docs/database/SCHEMA.md` |
| RLS Policy Docs | `docs/database/RLS_POLICIES.md` |
| Event Queue Runbook | `docs/operations/EVENT_QUEUE_RUNBOOK.md` |
| Build Operations Runbook | `docs/operations/BUILD_OPERATIONS.md` |
| Secret Rotation Runbook | `docs/operations/SECRET_ROTATION.md` |
| Backup/DR Runbook | `docs/operations/BACKUP_DR.md` |

---

## 9. Emergency Procedures Checklist

For P0/P1 incidents, follow this checklist in order:

- [ ] **Detect & Confirm** — Verify incident via health endpoint and manual test
- [ ] **Classify Severity** — P0, P1, P2, P3 per Section 1 definitions
- [ ] **Notify** — Post to Discord/status if user-facing
- [ ] **Contain** — Rollback, deactivate, or isolate as needed
- [ ] **Identify Root Cause** — Check logs, dashboards, dependencies
- [ ] **Resolve** — Apply fix per response playbook
- [ ] **Verify** — Run operational verification (DEPLOYMENT_CHECKLIST.md Section 8)
- [ ] **Communicate Resolution** — Post resolution notice
- [ ] **Document** — Write incident report within 48 hours

---

## 10. Testing Incidents

### 10.1 Quarterly Fire Drills

Test these scenarios quarterly:

1. **Simulated Supabase outage** — Verify application behavior
2. **Simulated Work.ink outage** — Verify key validation unaffected
3. **Rate limiter fail-closed test** — Verify cleanup restores service
4. **CRON_SECRET rotation test** — Verify rotation procedure works
5. **Database restore test** — Verify backup integrity and RLS re-application
6. **Event backlog drill** — Disable scheduler in a non-production environment and verify backlog recovery
7. **Build failure drill** — Force a safe failed build in a non-production environment and verify rebuild recovery
8. **Webhook failure drill** — Use an invalid test webhook and verify dead-letter/replay procedure
9. **License incident tabletop** — Verify revoke/disable, evidence preservation, and owner isolation checks

### 10.2 Test Commands

```bash
# Simulate rate limiter stress
for i in $(seq 1 100); do
  curl -s -X POST https://luxyhub.vercel.app/api/validate \
    -H "Content-Type: application/json" \
    -d '{"key":"LUXY-TEST-ONLY-XXXX"}' &
done
wait
# Verify cleanup resets counters
```
