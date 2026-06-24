# LuxyHub V1 Production Deployment Guide

Status: Canonical V1 production deployment guide  
Last updated: 2026-06-24

This guide replaces outdated deployment instructions for the current LuxyHub V1 implemented scope. It is documentation only and does not change runtime behavior.

## Production Scope

Expected production systems:

- Delivery: loader bootstrap, delivery session creation, delivery fetch, delivery builds, one-time session consumption.
- Analytics: key validation logs, script download analytics, event analytics, license analytics, security monitoring signals.
- Event Platform: signed event reporting, database-backed queue, Discord delivery, dead-letter handling, internal alerts, GitHub Actions worker scheduler.
- License Foundation: license schema, license lifecycle APIs, assignment APIs, license management dashboard, license analytics dashboard.
- Phase 7B Backend Key Monetization: provider foundation, premium keys, access modes, provider hardening, key management refinement, key type alignment, device limits, and custom device limits.
- Phase 7C Production Runtime Performance: metadata-only delivery build readiness reads, optimized event write projections, improved cleanup batching, and safe expired session pruning.
- Phase 7D/7E.1 rate-limit shadow runtime: PostgreSQL authoritative, Valkey shadow, `RATE_LIMIT_MODE=shadow`, healthy production status, 100% parity, and canary disabled.

Runtime popup key validation, Phase 7E.2 production canary, Valkey authoritative runtime, PostgreSQL rate-limit retirement, database decoupling, analytics aggregation, and premium runtime license hardening are planned or deferred separately and are not part of this deployment guide.

## 1. Environment Setup

Configure production environment variables before deploying. The canonical variable reference is `docs/operations/ENVIRONMENT_VARIABLES.md`.

Required Vercel variables:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key for SSR auth clients and proxy session refresh. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role database access for server-side repositories and operational tables. |
| `CRON_SECRET` | Bearer token for cleanup, event worker, and manual alert checks. |
| `ADMIN_API_KEY` | Admin bearer token for private raw script reads. |
| `ANALYTICS_PEPPER` | Pepper for analytics and login-failure hashing. |
| `TURNSTILE_SECRET_KEY` | Server-side Cloudflare Turnstile verification secret. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Public Cloudflare Turnstile site key for `/login`. |

Required GitHub Actions repository secrets:

| Secret | Expected Value |
|---|---|
| `EVENT_WORKER_URL` | `https://luxyhub.vercel.app/api/internal/event-worker` |
| `CRON_SECRET` | Same value as Vercel `CRON_SECRET`. |

Optional Vercel variables:

| Variable | Purpose |
|---|---|
| `DELIVERY_PAYLOAD_SECRET` | Explicit payload encryption secret. Falls back to `SUPABASE_SERVICE_ROLE_KEY` if unset. |
| `DELIVERY_PAYLOAD_KEY_ID` | Non-secret key identifier stored in delivery payload metadata. |
| `NEXT_PUBLIC_SITE_URL` | Trusted origin used by sensitive CORS checks when different from request origin. |
| `INTERNAL_ALERT_DISCORD_WEBHOOK` | Optional internal Discord webhook for alert notifications. |

## 2. Supabase Setup

1. Create or select the production Supabase project.
2. Confirm the project URL and anon/service-role keys are copied into Vercel.
3. Enable Point-in-Time Recovery or the strongest backup tier available for the production plan.
4. Apply `schema.sql` first if this is a fresh database.
5. Apply migrations in order as listed in section 3.
6. Verify RLS is enabled after migrations.

Do not expose the service-role key to browser code, client bundles, public documentation examples, or GitHub Actions logs.

## 3. Migration Execution

For a fresh production database, run `schema.sql`, then apply the migration chain in order. Rollback files are retained for incident response but are not part of the forward migration chain.

Forward migration chain:

```text
001_enable_rls.sql
002_cdn_tables.sql
003_profiles.sql
004_script_ownership.sql
005_audit_logs.sql
006_delivery_builds.sql
007_delivery_sessions.sql
008_event_platform.sql
009_event_platform_hardening.sql
010_internal_alerts.sql
011_alert_events_rls.sql
012_script_executions.sql
013_license_schema_foundation.sql
```

Current expected production tables include:

```text
keys
used_workink_tokens
rate_limits
verification_logs
key_usage
scripts
script_versions
script_downloads
profiles
audit_logs
delivery_builds
delivery_sessions
webhook_config
event_logs
alert_events
script_executions
licenses
license_assignments
```

Verification query:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'keys',
  'used_workink_tokens',
  'rate_limits',
  'verification_logs',
  'key_usage',
  'scripts',
  'script_versions',
  'script_downloads',
  'profiles',
  'audit_logs',
  'delivery_builds',
  'delivery_sessions',
  'webhook_config',
  'event_logs',
  'alert_events',
  'script_executions',
  'licenses',
  'license_assignments'
)
ORDER BY table_name;
```

Expected result: 18 rows.

RLS verification query:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'keys',
  'used_workink_tokens',
  'rate_limits',
  'verification_logs',
  'key_usage',
  'scripts',
  'script_versions',
  'script_downloads',
  'profiles',
  'audit_logs',
  'delivery_builds',
  'delivery_sessions',
  'webhook_config',
  'event_logs',
  'alert_events',
  'script_executions',
  'licenses',
  'license_assignments'
)
ORDER BY tablename;
```

Expected result: every returned row has `rowsecurity = true`.

Policy verification query:

```sql
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Expected result: owner-aware policies exist for creator-owned tables, and service-role/deny-all style policies protect operational tables from browser roles.

## 4. Vercel Deployment

Pre-deploy local checks:

```bash
npm run lint
npm run build
```

Deployment requirements:

1. Production branch is connected to Vercel.
2. All required Vercel variables from section 1 are present in the production environment.
3. `vercel.json` includes daily cleanup cron:

```json
{
  "crons": [
    {
      "path": "/api/cleanup",
      "schedule": "0 0 * * *"
    }
  ]
}
```

4. Deploy to Vercel.
5. Confirm `/api/health` returns `200`.
6. Confirm the deployed application can reach Supabase by running functional smoke tests below.

## 5. GitHub Actions Scheduler

Production event processing uses GitHub Actions every 5 minutes.

Workflow file:

```text
.github/workflows/event-worker.yml
```

Required repository secrets:

```text
EVENT_WORKER_URL=https://luxyhub.vercel.app/api/internal/event-worker
CRON_SECRET=<same value as Vercel CRON_SECRET>
```

Operational rules:

- Use the Vercel hostname for `EVENT_WORKER_URL`.
- Do not use `https://www.luxyhub.space/api/internal/event-worker` for GitHub Actions because Cloudflare Bot Fight Mode can challenge scheduler traffic.
- `CRON_SECRET` must match the Vercel production value exactly.
- The event worker route calls `processEventQueue()` and then runs `checkAlerts()` inline.
- `/api/internal/check-alerts` is retained for manual/debug/post-incident checks and is not independently scheduled.

Manual scheduler verification:

```bash
curl -s -X POST https://luxyhub.vercel.app/api/internal/event-worker \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"
```

Expected result: HTTP `200` with `success: true` and event worker counters.

## 6. Cloudflare Configuration

Cloudflare is used for the public custom domain and Turnstile.

Required checks:

1. `www.luxyhub.space` routes to the Vercel production deployment.
2. Cloudflare Turnstile has the production hostname configured.
3. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` match the Cloudflare Turnstile site.
4. GitHub Actions event worker traffic uses `https://luxyhub.vercel.app`, not the Cloudflare-fronted hostname.
5. No Cloudflare bypass rule is required for the event worker when the Vercel hostname is used.

Security headers and CORS are set in `proxy.ts`. Sensitive CORS paths use trusted origins; non-sensitive API paths may return wildcard CORS.

## 7. Event Worker Verification

After deployment and GitHub Actions secret setup:

1. Run the workflow manually with `workflow_dispatch`.
2. Confirm the job logs show HTTP `200`.
3. Confirm the response body includes `success: true`.
4. Confirm event dashboard queue health does not show a growing pending backlog.
5. Confirm internal alert dashboard does not show unexpected unresolved scheduler or queue alerts.

Manual alert check:

```bash
curl -s -X POST https://luxyhub.vercel.app/api/internal/check-alerts \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected result: HTTP `200` with `success: true`, `triggered`, and `resolved` counters.

## 8. Analytics Verification

Verify analytics systems through functional behavior:

1. Run a key validation request with an invalid key and confirm the endpoint returns a controlled `4xx`, not `500`.
2. Fetch a public or unlisted raw script and confirm script download analytics are recorded.
3. Open dashboard analytics and verify portfolio cards load for the authenticated creator.
4. Open event analytics for a script and verify queue/provider/security sections render.
5. Confirm `ANALYTICS_PEPPER` is set in production and not using development fallback behavior.

Example key validation smoke test:

```bash
curl -s -X POST https://www.luxyhub.space/api/validate \
  -H "Content-Type: application/json" \
  -d '{"key":"INVALID"}'
```

Expected result: controlled JSON response with `success: false`, not a platform error.

## 9. License Verification

License Foundation verification requires an authenticated creator session.

Dashboard checks:

1. Open `/dashboard/licenses`.
2. Create a license for an owned script.
3. Confirm the raw license key is shown at creation time.
4. Enable, disable, and revoke status actions return successful UI state updates.
5. Create and remove a license assignment.
6. Open `/dashboard/licenses/analytics` and verify status cards and recent activity load.

API checks require authenticated Supabase session cookies and should use browser/dev tooling or an authenticated client. License APIs are session-auth protected and owner-scoped.

Expected behavior:

- Non-owned `script_id` values return `Script not found`.
- Non-owned license IDs return `License not found`.
- Assignment customer identifiers are accepted as raw input but stored according to service hashing behavior.

## 10. Production Smoke Tests

Run these after production deployment.

### Health

```bash
curl -i https://www.luxyhub.space/api/health
```

Expected: HTTP `200`, JSON `status: ok`.

### Key Validation

```bash
curl -i -X POST https://www.luxyhub.space/api/validate \
  -H "Content-Type: application/json" \
  -d '{"key":"INVALID"}'
```

Expected: controlled JSON `4xx`, not `500`.

### Loader Bootstrap

```bash
curl -i https://www.luxyhub.space/api/loader/<script-slug>
```

Expected for an existing deliverable script: HTTP `200`, `text/plain`, `Cache-Control: no-store`.

### Delivery Session

```bash
curl -i -X POST https://www.luxyhub.space/api/delivery/session \
  -H "Content-Type: application/json" \
  -d '{"slug":"<script-slug>"}'
```

Expected for a deliverable public script: HTTP `200` with `session_token`, `event_secret`, and `expires_in`.

### Delivery Fetch

```bash
curl -i -X POST https://www.luxyhub.space/api/delivery/fetch \
  -H "Content-Type: application/json" \
  -d '{"session_token":"<session_token>"}'
```

Expected: HTTP `200` with `runtime_payload`, build metadata, and `event_secret`.

Repeat the same delivery fetch with the same token.

Expected: controlled rejection such as `Invalid delivery session`.

### Event Worker

```bash
curl -i -X POST https://luxyhub.vercel.app/api/internal/event-worker \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"
```

Expected: HTTP `200`, `success: true`.

### Cleanup Authorization

```bash
curl -i -X POST https://www.luxyhub.space/api/cleanup
```

Expected: HTTP `401`.

```bash
curl -i -X POST https://www.luxyhub.space/api/cleanup \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected: HTTP `200`, `Cleanup completed`.

## Deployment Completion Criteria

A production deployment is complete when:

- Required Vercel variables are set.
- Required GitHub Actions secrets are set.
- Supabase migrations through `013_license_schema_foundation.sql` are applied.
- Expected production tables exist and RLS is enabled.
- Vercel deployment is live.
- `/api/health` succeeds.
- Delivery session/fetch smoke tests succeed for a known deliverable script.
- GitHub Actions event worker workflow succeeds manually and on schedule.
- Dashboard analytics, event platform views, and license dashboard load for an authenticated creator.
