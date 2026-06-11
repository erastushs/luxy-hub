# LuxyHub — Monitoring Architecture

Last updated: 2026-06-11

Status: External monitoring plan. Better Stack, Uptime Kuma, status page, and external alert routing are pending infrastructure; Vercel deployment and the GitHub Actions event-worker scheduler are already implemented.
---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Monitoring Layer                  │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Better Stack │  │ Uptime Kuma  │  │ Vercel     │ │
│  │ (SaaS)       │  │ (Self-Hosted)│  │ Analytics  │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘ │
│         │                 │                 │        │
│         ▼                 ▼                 ▼        │
│  ┌──────────────────────────────────────────────┐   │
│  │              Alerting Routes                   │   │
│  │  Discord  │  Email  │  SMS  │  Webhook       │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                   Application Layer                  │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Website  │  │ API      │  │ Health   │          │
│  │ luxyhub. │  │ /api/    │  │ Endpoint │          │
│  │ space    │  │ validate │  │ /api/    │          │
│  │          │  │          │  │ health   │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                     │
│  ┌──────────────────────────────────────────┐       │
│  │            Supabase PostgreSQL            │       │
│  └──────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────┘
```

Current implementation note: the production event scheduler is GitHub Actions → `POST https://luxyhub.vercel.app/api/internal/event-worker` → `processEventQueue()` → `checkAlerts()`. External monitors may check the public user-facing domain, but the scheduler must use the Vercel hostname to avoid Cloudflare Bot Fight Mode challenges. No Cloudflare bypass rule is required.

---

## 2. Health Endpoint

### 2.1 Implementation

**Location:** `app/api/health/route.ts`

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-06-07T00:00:00.000Z"
}
```

**HTTP Status Codes:**
| Code | Meaning | Response |
|------|---------|----------|
| 200 | Healthy | All services operational |
| 500 | Unhealthy | Application error |

The health endpoint is intentionally lightweight — it confirms the Vercel function is running and can respond. It does NOT check database connectivity to avoid coupling the health check to database availability (which would cause false alarms).

### 2.2 Database Health (Indirect)

Database health is monitored indirectly through functional API checks:

```bash
# If this returns proper JSON (not 500, not connection error), DB is healthy
curl -s -X POST https://luxyhub.vercel.app/api/validate \
  -H "Content-Type: application/json" \
  -d '{"key":"LUXY-HEALTH-CHECK-KEY-RESERVED"}'
# Expected: HTTP 403 {"success":false,"message":"Invalid key"}
# 403 means DB query worked — key just doesn't exist
# 500 means DB or application issue
```

### 2.3 Deep Health (Future Enhancement)

A `/api/health/deep` endpoint could be added in future phases for:
- Database connectivity check via `SELECT 1`
- Work.ink API connectivity check
- Response time tracking per dependency

---

## 3. Better Stack Configuration (Pending)

### 3.1 Setup

Better Stack (formerly Logtail) is the recommended pending SaaS option for uptime monitoring, status pages, and incident management.

**Account Setup:**
1. Create account at `https://betterstack.com`
2. Create a team: "LuxyHub"
3. Add uptime monitors (see 3.2)
4. Configure alert destinations (see 3.3)
5. Set up status page (see 3.4)

### 3.2 Uptime Monitors

| # | Monitor Name | Type | URL | Method | Interval | Timeout | Regions |
|---|-------------|------|-----|--------|----------|---------|---------|
| 1 | Website Health | HTTP | `https://www.luxyhub.space` | GET | 60s | 10s | 3+ regions |
| 2 | API Health | HTTP | `https://www.luxyhub.space/api/health` | GET | 60s | 10s | 3+ regions |
| 3 | API Validate | HTTP | `https://www.luxyhub.space/api/validate` | POST | 5min | 30s | 3+ regions |
| 4 | Event Worker Scheduler | GitHub Actions | `https://luxyhub.vercel.app/api/internal/event-worker` | POST | 5min | 540s | GitHub Actions |

**Monitor Configuration Details:**

**Monitor 1 — Website Health**
```
URL: https://luxyhub.vercel.app
Method: GET
Expected Status: 200
Response Time Alert: > 2000ms
SSL Expiry Alert: < 30 days
Assertions:
  - HTTP status is 200
  - Response body contains "LuxyHub"
```

**Monitor 2 — API Health**
```
URL: https://luxyhub.vercel.app/api/health
Method: GET
Expected Status: 200
Response Time Alert: > 2000ms
Assertions:
  - HTTP status is 200
  - Response body contains "status":"ok"
  - Response body contains "timestamp"
  - Response time < 1000ms
```

**Monitor 3 — API Validate (Functional)**
```
URL: https://luxyhub.vercel.app/api/validate
Method: POST
Headers:
  Content-Type: application/json
Body: {"key":"LUXY-HEALTH-CHECK-KEY-RESERVED"}
Expected Status: 403  (NOT 500 — 500 means DB issue)
Assertions:
  - HTTP status is 403
  - Response body contains "success":false
  - Response body contains "Invalid key"
```

**Monitor 4 — API Verify Work.ink**
```
URL: https://luxyhub.vercel.app/api/verify-workink
Method: POST
Headers:
  Content-Type: application/json
Body: {"token":"health-check-token"}
Expected Status: Any (4xx/5xx expected for invalid tokens)
Assertions:
  - Response body is valid JSON
  - Response body contains "success"
```
**Note:** This monitor validates the endpoint is reachable and returns proper JSON. It does NOT require a valid Work.ink token.

### 3.3 Alert Destinations

Better Stack → Settings → Alert Destinations:

| # | Destination | Method | Priority |
|---|------------|--------|----------|
| 1 | Discord Webhook | Webhook (webhook URL) | P0, P1 |
| 2 | Email | Email (on-call address) | P0, P1 |
| 3 | SMS (optional) | Twilio/SMS integration | P0 only |

**Discord Webhook Setup:**
```
1. Discord Server → Channel Settings → Integrations → Webhooks
2. Create webhook: "LuxyHub Alerts"
3. Channel: #alerts or #incidents
4. Copy webhook URL
5. Add to Better Stack → Alert Destinations
```

### 3.4 Status Page

Better Stack → Status Pages → Create:

**Page Configuration:**
- Subdomain: `status.luxyhub.space` (or Better Stack's domain)
- Branding: LuxyHub logo
- Components: Website, API, Key System, CDN (future)

**Auto-Incident Creation:**
- When a monitor fails, Better Stack automatically:
  - Creates an incident
  - Updates the status page
  - Sends alerts via configured destinations

### 3.5 Alert Escalation Policy

| Incident State | Duration | Action |
|---------------|----------|--------|
| Detected | 0 min | Alert sent to Discord + Email |
| Acknowledged | 5 min | If not acknowledged → send to SMS |
| Unresolved | 15 min | Escalate to secondary contact |
| Unresolved | 30 min | Escalate to all contacts |
| Unresolved | 60 min | Repeat escalation every 30 min |

---

## 4. Uptime Kuma Configuration

### 4.1 Overview

Uptime Kuma is a self-hosted alternative or complement to Better Stack. Use one or both.

**Deployment Options:**
- VPS (same VPS as future Docker deployments)
- Dedicated monitoring VM
- Raspberry Pi / home lab

### 4.2 Docker Deployment

```bash
# On a VPS or server:
docker run -d \
  --name uptime-kuma \
  --restart=always \
  -p 3001:3001 \
  -v uptime-kuma-data:/app/data \
  louislam/uptime-kuma:1

# Access at: http://<server-ip>:3001
```

### 4.3 Monitor Configuration

| # | Monitor Name | Type | URL | Heartbeat | Retries |
|---|-------------|------|-----|-----------|---------|
| 1 | LuxyHub Website | HTTP(s) | `https://www.luxyhub.space` | 60s | 3 |
| 2 | API Health | HTTP(s) | `https://www.luxyhub.space/api/health` | 60s | 3 |
| 3 | Validate API | HTTP(s) (Keyword) | `https://www.luxyhub.space/api/validate` — POST with JSON body | 300s | 2 |
| 4 | Supabase API | HTTP(s) | `https://<PROJECT_REF>.supabase.co/rest/v1/` | 300s | 3 |

**Monitor 3 — Keyword Monitor (API Validate):**

In Uptime Kuma, configure as "HTTP(s) - Keyword":
```
URL: https://luxyhub.vercel.app/api/validate
Method: POST
Content-Type: application/json
Body: {"key":"LUXY-HEALTH-CHECK-KEY-RESERVED"}
Keyword: "Invalid key"
Expected: HTTP response contains "Invalid key"
```

This confirms:
1. Endpoint is reachable
2. Returns proper JSON
3. Database query executed (403 = DB reachable; 500 = DB issue)

### 4.4 Notification Providers

| Provider | Use Case | Configuration |
|----------|----------|---------------|
| Discord | Primary alerts | Webhook URL |
| Email (SMTP) | Backup alerts | SMTP server config |
| Gotify | Self-hosted push | Gotify server URL + token |
| Ntfy | Self-hosted push | Ntfy server URL + topic |

**Discord Notification Setup in Uptime Kuma:**
```
Settings → Notifications → Setup Notification
1. Type: Discord
2. Name: "LuxyHub Alerts"
3. Discord Webhook URL: <from Discord server settings>
4. Apply to all monitors
```

### 4.5 Status Pages

Uptime Kuma has a built-in status page:
```
Settings → Status Page
1. Enable: Yes
2. Slug: "luxyhub"
3. Public URL: http://<uptime-kuma-server>:3001/status/luxyhub
```

---

## 5. Vercel Monitoring

### 5.1 Built-in Monitoring

Vercel provides these at no additional cost:
- **Deployment Logs:** Build output, function logs, error traces
- **Web Analytics:** Page views, referrers, device info (requires `@vercel/analytics`)
- **Speed Insights:** Web Vitals (LCP, CLS, INP, FID) (requires `@vercel/speed-insights`)

### 5.2 Function Logging

View Vercel function logs:
```
Vercel Dashboard → Project → Functions → Select function → Logs
```

The codebase already uses `console.error` for critical failures:
- Cleanup endpoint: logs per-table cleanup errors
- Function logs include timestamps and request IDs

### 5.3 Log Drains (Future Enhancement)

For production logging at scale:
```
Vercel Dashboard → Project → Settings → Log Drains
→ Add: Better Stack Logtail (or Datadog, Loggly, etc.)
```

This forwards ALL function logs to a centralized logging service.

---

## 6. Supabase Monitoring

### 6.1 Built-in Monitoring

Supabase Dashboard provides:
- **Database Health:** CPU, memory, connections, IOPS
- **API Usage:** Request count, error rates
- **Auth Usage:** Sign-ups, active users
- **Reports:** Custom query performance reports

### 6.2 Monitoring Queries

Run these weekly in Supabase SQL Editor:

```sql
-- 1. Database size
SELECT pg_size_pretty(pg_database_size(current_database()));

-- 2. Table sizes
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS total_size,
  n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC;

-- 3. Rate limit table health
SELECT 
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 minute') AS last_minute,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') AS last_hour
FROM rate_limits;

-- 4. Active key count
SELECT 
  COUNT(*) AS active_keys,
  COUNT(*) FILTER (WHERE expires_at < NOW()) AS expired_active
FROM keys
WHERE is_active = true;

-- 5. Recent errors in verification_logs
SELECT event, COUNT(*) as count
FROM verification_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY event
ORDER BY count DESC;

-- 6. Key generation success rate (last 24h)
SELECT 
  COUNT(*) FILTER (WHERE event = 'GENERATE_KEY_SUCCESS') AS successes,
  COUNT(*) FILTER (WHERE event = 'GENERATE_KEY_FAILED') AS failures,
  COUNT(*) FILTER (WHERE event = 'GENERATE_KEY_SUCCESS')::float / 
    NULLIF(COUNT(*), 0) * 100 AS success_rate_pct
FROM verification_logs
WHERE created_at > NOW() - INTERVAL '24 hours';
```

### 6.3 Supabase Alerts (Dashboard)

**Supabase Dashboard → Settings → Notifications:**
- Database usage exceeds threshold
- API requests approaching limits
- Authentication anomalies
- Backup failures

---

## 7. Alerting Strategy

### 7.1 Alert Severity Matrix

| Alert | Source | Severity | Response |
|-------|--------|----------|----------|
| `/api/health` returns 5xx | Better Stack / Uptime Kuma | **P0** | Immediate investigation — deploy failure or Vercel outage |
| Website 5xx for all routes | Better Stack / Uptime Kuma | **P0** | Rollback last deploy or check Vercel status |
| Validate API returns 500 | Better Stack / Uptime Kuma | **P0** | Supabase connectivity issue — check DB status |
| Validate API response > 2s | Better Stack / Uptime Kuma | **P1** | Database perf degradation — check Supabase metrics |
| Health check response > 2s | Better Stack / Uptime Kuma | **P1** | Cold start or function throttling |
| Verify Work.ink endpoint fails | Better Stack / Uptime Kuma | **P2** | Work.ink may be down — key gen degraded, validation OK |
| SSL certificate < 30 days | Better Stack / Cloudflare | **P2** | Renew or verify auto-renewal |
| Rate limit table > 100k rows | Manual / Cron | **P2** | Cleanup cron not running — run manually |
| Active keys > 10,000 | Manual SQL | **P3** | Key generation abuse — review verification_logs |
| Database > 80% capacity | Supabase Dashboard | **P3** | Plan for optimization or upgrade |

### 7.1.1 Internal Alerts

Internal application alerts are persisted in `alert_events` and evaluated by `checkAlerts()` after each `/api/internal/event-worker` run. High and critical internal alerts are routed to `INTERNAL_ALERT_DISCORD_WEBHOOK` when configured.

| Alert Type | Source | Low | Medium | High | Critical | Primary Response |
|------------|--------|-----|--------|------|----------|------------------|
| `queue_backlog_spike` | Pending `event_logs` count | 100 | 500 | 1000 | 5000 | Run event worker, inspect provider failures, drain backlog |
| `dead_letter_spike` | Dead-letter `event_logs` count | 10 | 50 | 100 | 500 | Group dead letters by script/error, fix config/provider, replay carefully |
| `invalid_signature_spike` | `verification_logs.event = 'event.invalid_signature'` | 20 | 50 | 100 | 500 | Investigate runtime signing, possible abuse, recent loader changes |
| `replay_attack_spike` | `verification_logs.event = 'event.replay_attempt'` | 5 | 10 | 50 | 100 | Treat as security signal, inspect sessions/nonces, escalate if widespread |
| `webhook_failure_burst` | `verification_logs.event = 'webhook.provider_failure'` | 10 | 30 | 100 | 500 | Check Discord/provider status and creator webhook configs |
| `auth_failure_spike` | `verification_logs.event = 'event.auth_failure'` | 30 | 100 | 500 | 1000 | Check expired sessions, bad clients, bot traffic, possible attack |

Alert lifecycle:

- One active alert per alert type is deduplicated.
- Alerts resolve automatically when the current value falls below the threshold stored on the active alert.
- Alert records are internal operational data and are service-role-only through RLS.

### 7.1.2 Alert Routing

| Severity | Route | Response Target | Notes |
|----------|-------|-----------------|-------|
| Critical | Discord internal alert webhook, on-call/incident lead | Immediate | Open incident, assess P0/P1 impact |
| High | Discord internal alert webhook, on-call | 30 minutes | Triage and begin mitigation |
| Medium | Operations dashboard/review, optional Discord summary | Same business day | Watch trend and fix root cause |
| Low | Operations dashboard/review | Next review window | Track for tuning or cleanup |

Routing rules:

- External uptime monitors remain the primary detector for website/API outages.
- Internal alerts are the primary detector for event queue, webhook, and event security degradation.
- If internal alert routing fails but `alert_events` rows are created, monitoring is degraded but alert persistence still works.
- If both external and internal alerts fire, classify by user impact and data/security risk, not by number of alerts.

### 7.1.3 Event Backlog Response

Use `docs/operations/EVENT_QUEUE_RUNBOOK.md` for the full runbook.

Immediate checks:

```sql
SELECT delivery_status, COUNT(*)
FROM event_logs
GROUP BY delivery_status;
```

```sql
SELECT id, script_id, event_type, retry_count, received_at, claimed_at, error_message
FROM event_logs
WHERE delivery_status = 'pending'
ORDER BY received_at ASC
LIMIT 20;
```

Response summary:

- Confirm GitHub Actions/Vercel Cron is calling `POST /api/internal/event-worker` every 5 minutes.
- Manually run the worker with `CRON_SECRET`.
- If events are retrying, inspect provider failures and `webhook_config`.
- If claims are stale, wait for 15-minute lease recovery or clear stale claims only after confirming no worker is active.
- Do not bulk replay dead letters until provider/config issues are fixed.

### 7.1.4 Build Failure Response

Use `docs/operations/BUILD_OPERATIONS.md` for the full runbook.

Immediate checks:

```sql
SELECT build_status, COUNT(*)
FROM delivery_builds
GROUP BY build_status;
```

```sql
SELECT id, script_id, version_id, build_status, build_error_code, build_error_message, updated_at
FROM delivery_builds
WHERE build_status IN ('failed', 'pending', 'building')
ORDER BY updated_at DESC
LIMIT 50;
```

Response summary:

- `empty_source`: creator/source issue; update source and rebuild.
- `missing_payload_secret`: environment issue; restore secret, redeploy if needed, rebuild.
- Stale `pending`/`building`: inspect function logs and trigger manual rebuild after confirming no active build.
- Secret rotation delivery failures: rebuild current deliverable versions under active `DELIVERY_PAYLOAD_SECRET` and `DELIVERY_PAYLOAD_KEY_ID`.

### 7.1.5 Webhook Failure Response

Use `docs/operations/EVENT_QUEUE_RUNBOOK.md` for the full runbook.

Immediate checks:

```sql
SELECT event, message, created_at
FROM verification_logs
WHERE event LIKE 'webhook.%'
ORDER BY created_at DESC
LIMIT 50;
```

Response summary:

- Check Discord/provider status.
- Verify `webhook_config.enabled` and provider URL for affected script.
- Replace revoked/invalid webhook URLs.
- Replay dead letters only after the provider/config issue is resolved.

### 7.1.6 License Incident Response

License foundation monitoring is focused on owner isolation, invalid/revoked access attempts, abnormal assignment growth, and dashboard/API health.

Immediate checks:

```sql
SELECT status, COUNT(*)
FROM licenses
GROUP BY status;
```

```sql
SELECT l.script_id, l.status, COUNT(a.id) AS assignments
FROM licenses l
LEFT JOIN license_assignments a ON a.license_id = l.id
GROUP BY l.script_id, l.status
ORDER BY assignments DESC
LIMIT 50;
```

Response summary:

- Suspected leaked license: disable or revoke affected license, inspect assignments, review audit logs.
- Incorrect owner access: treat as security incident, preserve logs, stop related deploys, verify RLS and service ownership checks.
- Assignment abuse: disable affected license, inspect `customer_identifier_hash` patterns, review API logs.
- License dashboard/API outage: verify auth/session, Supabase service role, and license table RLS policies.

### 7.2 Quiet Hours Policy

| Time (UTC) | P0 | P1 | P2 | P3 |
|------------|-----|-----|-----|-----|
| 00:00–06:00 (Low traffic) | Alert as normal | Escalate only after 15 min | Hold until 08:00 | Next business day |
| 06:00–18:00 (Normal) | Alert as normal | Alert as normal | Alert as normal | Next business day |
| 18:00–00:00 | Alert as normal | Escalate only after 30 min | Hold until 08:00 | Next business day |

### 7.3 Noise Reduction

- **Debounce period:** 2 minutes — don't re-alert within 2 minutes of same incident
- **Auto-resolve:** After 3 consecutive successful checks
- **Dependency alerts:** Don't alert on API validate if health check is also failing (root cause is Vercel/Supabase)

---

## 8. Dashboard Metrics

### 8.1 Key Metrics to Track

| Metric | Source | Target |
|--------|--------|--------|
| Website uptime | Better Stack / Uptime Kuma | > 99.9% |
| API uptime | Better Stack / Uptime Kuma | > 99.9% |
| API p50 response time | Better Stack / Vercel Analytics | < 200ms |
| API p95 response time | Better Stack / Vercel Analytics | < 500ms |
| API p99 response time | Better Stack / Vercel Analytics | < 1000ms |
| Validate success rate | SQL Query (Section 6.2) | > 95% |
| Key gen success rate | SQL Query (Section 6.2) | > 90% |
| Rate limit 429 rate | Vercel Logs | < 5% |
| Error rate | Vercel Logs | < 1% |
| Database connection failures | Vercel Function Logs | 0 |

### 8.2 Weekly Health Report

Run these queries weekly and record:

```sql
-- Active users (unique IPs that validated a key in last 7 days)
SELECT COUNT(DISTINCT ip) as weekly_active_users
FROM verification_logs
WHERE event = 'VALIDATE_SUCCESS'
AND created_at > NOW() - INTERVAL '7 days';

-- Keys generated this week
SELECT COUNT(*) as keys_generated_this_week
FROM verification_logs
WHERE event = 'GENERATE_KEY_SUCCESS'
AND created_at > NOW() - INTERVAL '7 days';

-- Validations this week
SELECT COUNT(*) as validations_this_week
FROM verification_logs
WHERE event = 'VALIDATE_SUCCESS'
AND created_at > NOW() - INTERVAL '7 days';

-- Rate limited requests this week
SELECT COUNT(*) as rate_limited_this_week
FROM verification_logs
WHERE event = 'RATE_LIMITED'
AND created_at > NOW() - INTERVAL '7 days';
```

---

## 9. Future Monitoring Enhancements (Phase 2+)

### 9.1 Application Performance Monitoring (APM)
- Integrate Better Stack APM for function-level tracing
- Track database query performance
- Monitor memory usage per function invocation

### 9.2 Business Metrics
- CDN bandwidth usage
- Script download counts
- Unique script users
- Premium script access patterns

### 9.3 Security Monitoring
- Failed validation rate anomalies
- Unusual IP patterns
- Geographic access anomalies
- Token replay attempt detection

### 9.4 Grafana Dashboard (Advanced)
```
For large-scale monitoring:
├── Supabase PostgreSQL data source
├── Vercel metrics API
├── Better Stack metrics
└── Custom application metrics
```

---

## 10. Quick Reference

### 10.1 Health Check Commands

```bash
# Basic health
curl https://luxyhub.vercel.app/api/health

# Functional API check
curl -s -X POST https://luxyhub.vercel.app/api/validate \
  -H "Content-Type: application/json" \
  -d '{"key":"LUXY-HEALTH-CHECK-KEY-RESERVED"}'

# Work.ink endpoint reachable
curl -s -X POST https://luxyhub.vercel.app/api/verify-workink \
  -H "Content-Type: application/json" \
  -d '{"token":"health-check-token"}'
```

### 10.2 Monitoring URLs

| Service | URL |
|---------|-----|
| Better Stack | `https://betterstack.com/` |
| Uptime Kuma (if self-hosted) | `http://<server>:3001` |
| Vercel Analytics | `https://vercel.com/dashboard` |
| Supabase Dashboard | `https://supabase.com/dashboard` |

### 10.3 Alert Configuration Checklist

- [ ] Better Stack account created and configured
- [ ] 4 uptime monitors configured (Section 3.2)
- [ ] Discord webhook added as alert destination
- [ ] Email alert destination configured
- [ ] Optional: Uptime Kuma deployed and configured
- [ ] Status page published
- [ ] Escalation policy documented (Section 3.5)
- [ ] Quiet hours policy configured
- [ ] Weekly health report scheduled
- [ ] Supabase dashboard notifications enabled
