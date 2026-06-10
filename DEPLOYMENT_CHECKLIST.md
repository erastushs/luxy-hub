# LuxyHub — Production Deployment Checklist

Last updated: 2026-06-08

---

## 1. Pre-Deployment Verification

Run these in the project root before deploying.

| # | Check | Command | Expected |
|---|-------|---------|----------|
| 1.1 | Build passes | `npm run build` | EXIT 0, all routes generated |
| 1.2 | Lint passes | `npm run lint` | 0 errors; existing warnings reviewed |
| 1.3 | TypeScript passes | `npx tsc --noEmit` | No errors |
| 1.4 | Security audit reviewed | Review audit report | All Critical/High fixed |
| 1.5 | API docs match implementation | `diff API_SPEC.md` vs routes | No "wrapped in `data`", no HTTP 404 for validate |
| 1.6 | `schema.sql` and migrations applied to Supabase | Check in Supabase Dashboard | Current tables exist |
| 1.7 | RLS migrations applied | Run verification query in section 3.4 | Owner policies and deny-all policies enabled |
| 1.8 | No `.env` files tracked by git | `git ls-files .env*` | No output |
| 1.9 | CRON_SECRET generated | Generate via `openssl rand -hex 32` | 64-character hex string |
| 1.10 | Turnstile configured | Cloudflare dashboard + Vercel env | Site key and secret set |

---

## 2. Environment Variables

### 2.1 Production Variables — Vercel Dashboard

| Variable | Required | Secret | Description | Verification |
|----------|----------|--------|-------------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | No | Supabase project URL | `echo $NEXT_PUBLIC_SUPABASE_URL` returns `https://*.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | No | Supabase anon key for SSR auth clients and proxy session refresh | Login and dashboard session refresh work |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | **Yes** | Supabase service role JWT | `curl -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/"` returns JSON |
| `ADMIN_API_KEY` | Yes | **Yes** | Admin bearer for private raw script reads only | Private raw reads reject missing/wrong key |
| `CRON_SECRET` | Yes | **Yes** | Cleanup endpoint bearer token | Must be 32+ character random string |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Yes | No | Cloudflare Turnstile public site key for `/login` | Login page renders Turnstile widget |
| `TURNSTILE_SECRET_KEY` | Yes | **Yes** | Server-side Cloudflare Turnstile verification secret | Login rejects missing/invalid Turnstile tokens |
| `ANALYTICS_PEPPER` | Yes | **Yes** | Pepper for analytics hashes and login email failure buckets | Set to a strong random value |

Optional variables:

| Variable | Required | Secret | Description |
|----------|----------|--------|-------------|
| `DELIVERY_PAYLOAD_SECRET` | No | **Yes** | Explicit payload encryption secret; falls back to `SUPABASE_SERVICE_ROLE_KEY` |
| `DELIVERY_PAYLOAD_KEY_ID` | No | No | Non-secret key identifier stored in delivery payload metadata |
| `NEXT_PUBLIC_SITE_URL` | No | No | Trusted origin used by sensitive CORS checks when different from request origin |

### 2.2 Deprecated Variables — Remove from Vercel

| Variable | Status | Reason |
|----------|--------|--------|
| `LOOTLABS_URL` | **Unused** | Present in `.env.local` but referenced nowhere in codebase |

### 2.3 Validation Procedure

```bash
# After setting variables in Vercel, trigger a deploy and verify:
curl -s https://luxyhub.vercel.app/api/health
# Expected: {"status":"ok","timestamp":"..."}

curl -s -X POST https://luxyhub.vercel.app/api/validate \
  -H "Content-Type: application/json" \
  -d '{"key":"INVALID"}'
# Expected: {"success":false,"message":"Invalid key"}

# If you see 5xx errors, check Vercel function logs for missing env vars
```

---

## 3. Supabase Setup

### 3.1 Run Schema

Open **Supabase Dashboard → SQL Editor** and run these in order:

1. Paste content of `schema.sql` → Run
2. Apply migrations in order: `001_enable_rls.sql` through `007_delivery_sessions.sql`

### 3.2 Verify Tables Exist

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
  'delivery_sessions'
);
```

**Expected:** 12 rows returned.

### 3.3 Verify Indexes

```sql
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
AND indexname IN (
  'idx_used_workink_tokens_used_at',
  'idx_rate_limits_ip_endpoint_created_at',
  'idx_verification_logs_event_created_at',
  'idx_scripts_slug',
  'idx_scripts_creator_id',
  'idx_script_versions_script_id',
  'idx_script_downloads_script_id_created_at',
  'idx_profiles_username',
  'idx_audit_logs_actor_created_at',
  'idx_delivery_builds_version_status',
  'idx_delivery_sessions_token_hash',
  'keys_key_key',
  'keys_pkey',
  'used_workink_tokens_pkey',
  'rate_limits_pkey',
  'verification_logs_pkey',
  'key_usage_pkey'
);
```

**Expected:** All indexes present.

### 3.4 Verify RLS Is Enabled

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
  'delivery_sessions'
);
```

**Expected:** All 12 return `rowsecurity = true`.

### 3.5 Verify RLS Policies

```sql
SELECT tablename, policyname, cmd, permissive, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Expected:** deny-all policies on service-role-only tables plus owner-scoped policies on `scripts` and `script_versions`.

### 3.6 Enable Supabase Backups

1. Supabase Dashboard → Database → Backups
2. Enable **Point-in-Time Recovery** (PITR) — required for production
3. Verify backup frequency (typically daily snapshots)

---

## 4. Security Checklist

### 4.1 Security Headers — Verify via curl

```bash
curl -I https://luxyhub.vercel.app/api/health
```

Look for these headers in the response:

| Header | Expected Value |
|--------|---------------|
| `content-security-policy` | Contains `default-src 'self'`, Cloudflare Turnstile script/connect/frame allowances, and `frame-ancestors 'none'` |
| `x-content-type-options` | `nosniff` |
| `x-frame-options` | `DENY` |
| `referrer-policy` | `strict-origin-when-cross-origin` |
| `strict-transport-security` | `max-age=31536000; includeSubDomains` |
| `permissions-policy` | `camera=(), microphone=(), geolocation=()` |
| `access-control-allow-origin` | `*` for non-sensitive API routes; trusted origin only for sensitive paths |

### 4.2 Rate Limiting — Verify via load test

```bash
# Send 35 requests to /api/validate (limit: 30/min)
for i in $(seq 1 35); do
  curl -s -o /dev/null -w "Request $i: HTTP %{http_code}\n" \
    -X POST https://luxyhub.vercel.app/api/validate \
    -H "Content-Type: application/json" \
    -d '{"key":"LUXY-ABCD-EFGH-IJKL"}'
done
```

**Expected:** First 30 return HTTP 403 (invalid key), requests 31-35 return HTTP 429 (rate limited).

### 4.3 Body Size Limit — Verify

```bash
curl -s -X POST https://luxyhub.vercel.app/api/validate \
  -H "Content-Type: application/json" \
  -H "Content-Length: 100000" \
  -d '{"key":"LUXY-ABCD-EFGH-IJKL"}'
```

**Expected:** HTTP 413 `{"success":false,"message":"Payload too large"}`

### 4.4 CRON_SECRET Verification

```bash
# Without auth — should be 401
curl -s -X POST https://luxyhub.vercel.app/api/cleanup
# Expected: {"success":false,"message":"Unauthorized"} HTTP 401

# With wrong auth — should be 401
curl -s -X POST https://luxyhub.vercel.app/api/cleanup \
  -H "Authorization: Bearer wrong-secret"
# Expected: {"success":false,"message":"Unauthorized"} HTTP 401
```

### 4.5 ADMIN_API_KEY Separation — Verify

`ADMIN_API_KEY` and `CRON_SECRET` must be different secrets. Cron bearer tokens are not accepted for admin raw reads.

```bash
curl -s https://luxyhub.vercel.app/api/scripts/private-slug/raw \
  -H "Authorization: Bearer $CRON_SECRET"
# Expected: HTTP 403 {"success":false,"message":"This script is private"}

curl -s https://luxyhub.vercel.app/api/scripts/private-slug/raw \
  -H "Authorization: Bearer $ADMIN_API_KEY"
# Expected: HTTP 200 text/plain for an existing private script
```

### 4.6 CORS Headers — Verify

```bash
curl -I -X OPTIONS https://luxyhub.vercel.app/api/validate \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST"
```

**Expected:** HTTP 204. Non-sensitive API paths may return `access-control-allow-origin: *`; sensitive paths return the trusted origin only.

### 4.7 Key Validation Oracle — Verify (Anti-Pattern Check)

```bash
# Non-existent key and expired key should return identical responses
curl -s -X POST https://luxyhub.vercel.app/api/validate \
  -H "Content-Type: application/json" \
  -d '{"key":"LUXY-AAAA-AAAA-AAAA"}'

# A previously valid but expired key — should be identical response
curl -s -X POST https://luxyhub.vercel.app/api/validate \
  -H "Content-Type: application/json" \
  -d '{"key":"LUXY-BBBB-BBBB-BBBB"}'
```

**Expected:** Both return `{"success":false,"message":"Invalid key"}` with HTTP 403. No distinction between "not found" and "expired".

### 4.8 Login Turnstile and Rate Limiting — Verify

- `/login` renders the Cloudflare Turnstile widget when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set.
- Server Action login rejects missing or invalid `cf-turnstile-response`.
- Failed login attempts are rate limited after Turnstile succeeds:
  - 5 failed attempts per 5 minutes per IP
  - 10 failed attempts per 15 minutes per hashed email bucket
- After a failed login, the widget resets and obtains a fresh single-use token.

### 4.9 Secure Delivery — Verify

```bash
curl -I https://luxyhub.vercel.app/api/loader/public-slug
# Expected: HTTP 200, Content-Type: text/plain, Cache-Control: no-store

curl -s -X POST https://luxyhub.vercel.app/api/delivery/session \
  -H "Content-Type: application/json" \
  -d '{"slug":"public-slug"}'
# Expected: {"session_token":"...","expires_in":60} for a public/unlisted script with a ready build

curl -s -X POST https://luxyhub.vercel.app/api/delivery/fetch \
  -H "Content-Type: application/json" \
  -d '{"session_token":"<session_token>"}'
# Expected: runtime_payload/build_version/version_id/runtime_format_version, Cache-Control: no-store

curl -s -X POST https://luxyhub.vercel.app/api/delivery/fetch \
  -H "Content-Type: application/json" \
  -d '{"session_token":"<same_session_token>"}'
# Expected: HTTP 403 {"success":false,"message":"Invalid delivery session"}
```

---

## 5. Cloudflare Configuration

### 5.1 DNS Records

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | `@` (or `luxyhub.vercel.app`) | `cname.vercel-dns.com` | Yes (orange cloud) |
| CNAME | `www` | `cname.vercel-dns.com` | Yes (orange cloud) |

If using a custom domain (`luxyhub.space`):

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | `@` | `cname.vercel-dns.com` | Yes |
| CNAME | `www` | `cname.vercel-dns.com` | Yes |

### 5.2 SSL/TLS

| Setting | Value |
|---------|-------|
| SSL mode | **Full (strict)** |
| Always Use HTTPS | **On** |
| Minimum TLS Version | **TLS 1.2** |

### 5.3 Caching Rules

| Path | Cache Level | TTL |
|------|------------|-----|
| `/_next/static/*` | Cache Everything | 1 year |
| `/LH.webp`, `/LH2.webp`, `/bg.webp`, `*.webp` | Cache Everything | 30 days |
| `/api/*` | **Bypass Cache** | — |

Create a Page Rule:
```
URL: luxyhub.vercel.app/api/*
Setting: Cache Level → Bypass
```

### 5.4 Security Settings

| Setting | Recommendation |
|---------|---------------|
| Bot Fight Mode | **On** for public user traffic |
| Security Level | **Medium** |
| Browser Integrity Check | **On** |
| Hotlink Protection | Off (API needs cross-origin access) |

Operational note: GitHub Actions scheduler traffic must not use the Cloudflare-fronted custom domain. Cloudflare Bot Fight Mode and challenge-based WAF/rate-limit rules can challenge non-browser GitHub Actions requests before they reach Vercel. The event worker scheduler uses `https://luxyhub.vercel.app/api/internal/event-worker` directly, so no Cloudflare bypass rule is required.

### 5.5 Turnstile

Create a Cloudflare Turnstile widget for the production login domain.

| Setting | Value |
|---------|-------|
| Widget type | Managed |
| Hostname | `www.luxyhub.space` and any production aliases |
| Site key | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` |
| Secret key | `TURNSTILE_SECRET_KEY` |

### 5.6 Cloudflare Rate Limiting (Optional)

Cloudflare rate limiting complements the application-level rate limiter for public browser/API traffic. Do not point GitHub Actions scheduler traffic at Cloudflare-fronted URLs.

| Rule | Path | Threshold | Period | Action |
|------|------|-----------|--------|--------|
| API Protection | `/api/*` | 100 requests | 10 seconds | Challenge |
| Validation Protection | `/api/validate` | 200 requests | 1 minute | Challenge |

---

## 6. Vercel Configuration

### 6.1 Project Settings

| Setting | Value |
|---------|-------|
| Framework Preset | **Next.js** |
| Build Command | `npm run build` |
| Output Directory | `.next` |
| Install Command | `npm install` |
| Node.js Version | 20.x or 22.x (LTS) |
| Root Directory | `/` |

### 6.2 Environment Variables

Add all variables from section 2.1 in **Vercel Dashboard → Project → Settings → Environment Variables**.

Mark as production secrets: `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_API_KEY`, `CRON_SECRET`, `TURNSTILE_SECRET_KEY`, `ANALYTICS_PEPPER`, and `DELIVERY_PAYLOAD_SECRET` when used.

### 6.3 Domains

1. Vercel Dashboard → Project → Settings → Domains
2. Add custom domain: `luxyhub.vercel.app` (auto-assigned) + any custom domains
3. Verify DNS resolves to Vercel after Cloudflare configuration

### 6.4 Scheduled Jobs

Production scheduler architecture:

```text
GitHub Actions
  ↓
POST https://luxyhub.vercel.app/api/internal/event-worker
  ↓
processEventQueue()
  ↓
checkAlerts()
```

Required GitHub Actions secrets:

| Secret | Value |
|--------|-------|
| `EVENT_WORKER_URL` | `https://luxyhub.vercel.app/api/internal/event-worker` |
| `CRON_SECRET` | Same value as Vercel `CRON_SECRET` |

The event worker route requires `Authorization: Bearer <CRON_SECRET>`. Use the Vercel hostname for the scheduler; do not use `https://www.luxyhub.space/api/internal/event-worker` because Cloudflare can challenge GitHub Actions traffic. No Cloudflare bypass rule is required.

`vercel.json` retains only the daily cleanup cron:

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

### 6.5 Build Verification

After deploying, check **Vercel Dashboard → Deployments → Production**:
- No build errors
- All routes listed
- Proxy applied

---

## 7. Monitoring & Alerting

### 7.1 Uptime Monitor (Recommended: Better Stack / Uptime Kuma)

| Monitor | URL | Interval | Alert on |
|---------|-----|----------|----------|
| Website | `https://luxyhub.vercel.app` | 60s | HTTP != 200 |
| API Health | `https://luxyhub.vercel.app/api/health` | 60s | Response != `{"status":"ok",...}` |
| Validate API | `POST /api/validate` with known key | 5min | HTTP != 200 |
| Work.ink Flow | `POST /api/verify-workink` with test token | 15min | HTTP >= 500 |

### 7.2 Health Endpoint Monitoring

```bash
# Expected: HTTP 200, JSON with status:"ok" and valid ISO timestamp
curl -s https://luxyhub.vercel.app/api/health | python3 -m json.tool
```

### 7.3 Vercel Monitoring

1. Vercel Dashboard → Analytics → enable
2. Set up **Vercel Log Drains** to forward logs to your logging service
3. Set up **Vercel Error Monitoring** alerts for function crashes

### 7.4 Supabase Monitoring

1. Supabase Dashboard → Reports → enable Database Health
2. Review **API Usage** weekly for unusual patterns
3. Monitor `rate_limits` table size — if it grows beyond 100k rows, the cleanup cron may not be running

### 7.5 Alert Destinations

Configure alerts through your monitoring provider for:
- Response time > 2s
- Error rate > 5%
- Health check failures > 2 in 5 minutes
- SSL certificate expiry (30 days warning)

---

## 8. Operational Verification

Run these commands after deployment. Replace `luxyhub.vercel.app` with your actual domain.

### 8.1 Health Endpoint

```bash
curl -s https://luxyhub.vercel.app/api/health
```

### 8.2 Validate Invalid Key

```bash
curl -s -X POST https://luxyhub.vercel.app/api/validate \
  -H "Content-Type: application/json" \
  -d '{"key":"LUXY-ABCD-EFGH-IJKL"}'
# Expected: HTTP 403 {"success":false,"message":"Invalid key"}
```

### 8.3 Validate Missing Key

```bash
curl -s -X POST https://luxyhub.vercel.app/api/validate \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: HTTP 400 {"success":false,"message":"Key is required"}
```

### 8.4 Validate Empty Body

```bash
curl -s -X POST https://luxyhub.vercel.app/api/validate \
  -H "Content-Type: application/json"
# Expected: HTTP 500 or 400 (body parsing error)
```

### 8.5 Verify Work.ink — Invalid Token

```bash
curl -s -X POST https://luxyhub.vercel.app/api/verify-workink \
  -H "Content-Type: application/json" \
  -d '{"token":"invalid-token"}'
# Expected: HTTP 403 depending on Work.ink response
```

### 8.6 Verify Work.ink — Missing Token

```bash
curl -s -X POST https://luxyhub.vercel.app/api/verify-workink \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: HTTP 400 {"success":false,"message":"Token required"}
```

### 8.7 Generate Key — Missing Token

```bash
curl -s -X POST https://luxyhub.vercel.app/api/generate-key \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: HTTP 400 {"success":false,"message":"Work.ink verification token required"}
```

### 8.8 Generate Key — Invalid Token

```bash
curl -s -X POST https://luxyhub.vercel.app/api/generate-key \
  -H "Content-Type: application/json" \
  -d '{"token":"some-fake-token"}'
# Expected: HTTP 403 (token rejected by Work.ink)
```

### 8.9 Cleanup — No Auth

```bash
curl -s -X POST https://luxyhub.vercel.app/api/cleanup
# Expected: HTTP 401 {"success":false,"message":"Unauthorized"}
```

### 8.10 Rate Limiting — Verify 429

```bash
for i in $(seq 1 35); do
  echo -n "Request $i: "
  curl -s -o /dev/null -w "%{http_code}" \
    -X POST https://luxyhub.vercel.app/api/validate \
    -H "Content-Type: application/json" \
    -d '{"key":"LUXY-ABCD-EFGH-IJKL"}'
  echo ""
done
# Expected: 30 × 403, then 5 × 429
```

### 8.11 Database Connectivity

```bash
# Indirect test — if validate returns proper JSON (not 500), DB is connected
curl -s -X POST https://luxyhub.vercel.app/api/validate \
  -H "Content-Type: application/json" \
  -d '{"key":"LUXY-ABCD-EFGH-IJKL"}'
# Expected: HTTP 403 {"success":false,"message":"Invalid key"}
# If HTTP 500, check Supabase connection
```

---

## 9. Backup & Recovery

### 9.1 Supabase Backups

| Item | Status |
|------|--------|
| Daily snapshots enabled | [ ] Confirm in Supabase Dashboard → Database → Backups |
| PITR enabled (if paid plan) | [ ] Recommended for production |
| Backup retention period | [ ] 7 days minimum |

### 9.2 Environment Variable Backup

Store production env vars in a secure password manager (1Password, LastPass, Bitwarden):
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`

### 9.3 Code Backup

- Repository: `github.com/erastushs/luxy-hub`
- Git remote: `origin/main`

### 9.4 Recovery Procedure

**Scenario: Corrupted database**
1. Go to Supabase Dashboard → Database → Backups
2. Restore to nearest point-in-time snapshot
3. Re-run `migrations/001_enable_rls.sql` (RLS is not included in some backup formats)

**Scenario: Vercel deploy failure**
1. Roll back to last successful deploy: Vercel Dashboard → Deployments → [previous] → Promote to Production

**Scenario: Compromised CRON_SECRET**
1. Generate new secret: `openssl rand -hex 32`
2. Update `CRON_SECRET` in Vercel environment variables
3. Update `CRON_SECRET` in cron job configuration
4. Redploy application

---

## 10. Post-Deployment Verification

### Step-by-step:

**1. Website Check**
- [ ] Open `https://luxyhub.vercel.app` in browser
- [ ] Public landing page renders
- [ ] Navigate to `/get-key` — page renders with Work.ink link
- [ ] Navigate to `/docs/api` — API documentation page renders
- [ ] Navigate to `/login` — Turnstile widget renders
- [ ] Unauthenticated `/dashboard` redirects to `/login`

**2. API Check**
- [ ] `GET /api/health` → 200 `{"status":"ok",...}`
- [ ] `POST /api/validate` with valid key → 200 `{"success":true}`
- [ ] `POST /api/validate` with invalid key → 403 `{"success":false,"message":"Invalid key"}`
- [ ] `POST /api/validate` without body → 400
- [ ] `POST /api/verify-workink` with missing token → 400
- [ ] `POST /api/generate-key` with missing token → 400
- [ ] `GET /api/loader/[slug]` for ready public/unlisted build → 200 text/plain with `Cache-Control: no-store`
- [ ] `POST /api/delivery/session` for ready public/unlisted build → `session_token` and `expires_in: 60`
- [ ] Reusing the same delivery token in `/api/delivery/fetch` → 403 `Invalid delivery session`

**3. Database Check**
- [ ] Run SQL verification queries from section 3
- [ ] Insert test key: `curl POST /api/verify-workink` with real Work.ink token
- [ ] Validate test key: `curl POST /api/validate` → 200
- [ ] Verify key appears in `keys` table via Supabase Dashboard

**4. Security Check**
- [ ] Section 4.1 — all security headers present
- [ ] Section 4.2 — rate limiting triggers 429
- [ ] Section 4.3 — body size limit triggers 413
- [ ] Section 4.4 — cleanup endpoint protected
- [ ] Section 4.5 — admin and cron secrets are separated
- [ ] Section 4.6 — CORS headers present
- [ ] Section 4.7 — no key enumeration via distinct status codes
- [ ] Section 4.8 — Turnstile and login failed-attempt rate limits work
- [ ] Section 4.9 — secure delivery sessions are consume-once and no-store

**5. Monitoring Check**
- [ ] Uptime monitor shows green
- [ ] Health endpoint returns 200

---

## 11. Incident Response

### 11.1 API Outage (validate returns 500)

1. Check Vercel Dashboard → Functions → Logs for errors
2. Check Supabase Dashboard for database status
3. Verify `SUPABASE_SERVICE_ROLE_KEY` is valid in Vercel env vars
4. If `service_role` key expired: generate new in Supabase → Project Settings → API
5. Roll back to last good deployment if needed

### 11.2 Supabase Outage

1. Check `https://status.supabase.com/`
2. Application behavior during outage: all API routes return HTTP 500
3. Rate limiter is fail-closed — requests will be denied until DB recovers
4. Recovery: automatic when Supabase comes back online
5. No manual intervention required (stateless Vercel functions)

### 11.3 Vercel Outage

1. Check `https://www.vercel-status.com/`
2. No application-level workaround (hosting is fully on Vercel)
3. DNS failover: if you have a secondary deployment provider, update Cloudflare DNS

### 11.4 Work.ink Outage

1. Work.ink has no public status page
2. Symptoms: `/api/verify-workink` and `/api/generate-key` return HTTP 403 or 500
3. `/api/validate` continues working — existing keys still valid
4. Users cannot generate new keys during outage
5. Recovery: automatic when Work.ink API recovers

### 11.5 Rate Limiter Failure

1. Symptoms: all requests return HTTP 429 (fail-closed)
2. Check `rate_limits` table in Supabase — may need manual cleanup
3. Run cleanup endpoint: `curl -X POST /api/cleanup -H "Authorization: Bearer <CRON_SECRET>"`
4. If table is severely bloated, manually truncate old records:
   ```sql
   DELETE FROM rate_limits WHERE created_at < NOW() - INTERVAL '1 day';
   ```

### 11.6 Key System Incident — Mass Key Leak

1. Run cleanup endpoint to deactivate all expired keys: `POST /api/cleanup`
2. Manually deactivate all currently active keys if needed:
   ```sql
   UPDATE keys SET is_active = false WHERE is_active = true;
   ```
3. All users will need to generate new keys through Work.ink
4. Post-incident: investigate token replay logs in `used_workink_tokens` and `verification_logs`

---

## 12. Production Readiness Score

### Assessment Matrix

| Category | Item | Status | Notes |
|----------|------|--------|-------|
| **Code Quality** | Build passes | ✅ PASS | EXIT 0, all routes generated |
| | Lint clean | ✅ PASS | 0 errors; warnings reviewed |
| | TypeScript strict | ✅ PASS | No type errors |
| **Security** | RLS enabled | ✅ PASS | 12 tables, deny-all plus owner policies |
| | Security headers | ✅ PASS | Headers via `proxy.ts` |
| | CSP configured | ✅ PASS | Allows Next.js, Vercel analytics, Supabase, and Turnstile |
| | CORS for API | ✅ PASS | `*` for non-sensitive routes; trusted origin for sensitive routes |
| | Rate limiting | ✅ PASS | INSERT-first, fail-closed |
| | Login protection | ✅ PASS | Turnstile plus failed-attempt IP/email buckets |
| | Secure delivery | ✅ PASS | Hashed token, TTL, consume-once, no-store |
| | Key crypto | ✅ PASS | `crypto.getRandomValues()` |
| | Unified error codes | ✅ PASS | No key enumeration oracle |
| | Body size limits | ✅ PASS | 64 KB via `proxy.ts` |
| | CRON_SECRET validated | ✅ PASS | Missing secret returns 500; wrong bearer returns 401 |
| | ADMIN_API_KEY separated | ✅ PASS | Cron secrets are not accepted for admin raw reads |
| | Input validation | ✅ PASS | Token length + key format regex |
| **Infrastructure** | Cloudflare configured | ✅ PASS | DNS, SSL/TLS, Turnstile, and public traffic protection documented |
| | Vercel deployment | ✅ PASS | Next.js app deployed on Vercel |
| | GitHub Actions event scheduler | ✅ PASS | 5-minute worker cadence via `EVENT_WORKER_URL` |
| | Vercel cleanup cron | ✅ PASS | Daily `/api/cleanup` cron retained in `vercel.json` |
| | Uptime monitoring | ⚠️ PENDING | Better Stack / Uptime Kuma / external monitoring stack not yet configured |
| | Backups enabled | ⚠️ PENDING | Supabase PITR |
| **Documentation** | API reference | ✅ PASS | API_SPEC.md synced |
| | Integration guide | ✅ PASS | API_INTEGRATION.md synced |
| | Deployment checklist | ✅ PASS | This document |
| **Known Risks** | Supabase single-region | ℹ️ RISK | No multi-region failover |
| | Vercel single-region | ℹ️ RISK | No edge failover |
| | Work.ink dependency | ℹ️ RISK | Key gen breaks if Work.ink down |
| | No request logging | ℹ️ RISK | Only Supabase logs (no external log drain) |
| | No alerting configured | ⚠️ RISK | Must set up before production |

### Scoring

| Metric | Score |
|--------|-------|
| Code readiness | 100% |
| Security readiness | 95% |
| Infrastructure readiness | 80% |
| Operational readiness | 70% |
| Documentation readiness | 100% |
| **Overall** | **89%** |

### Remaining Infrastructure Work

Completed infrastructure:

- [x] Cloudflare
- [x] DNS
- [x] SSL/TLS
- [x] Vercel deployment
- [x] GitHub Actions scheduler for the event worker

Pending infrastructure:

1. [ ] Set up Better Stack, Uptime Kuma, or equivalent external monitoring stack.
2. [ ] Enable Supabase PITR backups if the production plan requires point-in-time restore.
3. [ ] Run complete operational verification (Section 8) after any production environment change.
4. [ ] Run post-deployment verification (Section 10) after each deployment.

### Go / No-Go

**RECOMMENDATION: Go for current implemented scope.** Phase 8 Event Platform is complete and scheduled by GitHub Actions. Remaining work is external monitoring and backup maturity, not Phase 8 feature completion.
