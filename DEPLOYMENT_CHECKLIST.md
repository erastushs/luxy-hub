# LuxyHub — Production Deployment Checklist

Last updated: 2026-06-07

---

## 1. Pre-Deployment Verification

Run these in the project root before deploying.

| # | Check | Command | Expected |
|---|-------|---------|----------|
| 1.1 | Build passes | `npm run build` | EXIT 0, all 14 pages generated |
| 1.2 | Lint passes | `npm run lint` | 0 errors, 0 warnings |
| 1.3 | TypeScript passes | `npx tsc --noEmit` | No errors |
| 1.4 | Security audit reviewed | Review audit report | All Critical/High fixed |
| 1.5 | API docs match implementation | `diff API_SPEC.md` vs routes | No "wrapped in `data`", no HTTP 404 for validate |
| 1.6 | `schema.sql` applied to Supabase | Check in Supabase Dashboard | 5 tables exist |
| 1.7 | RLS migration applied | Run verification query in section 3.4 | All policies `USING (false)` enabled |
| 1.8 | No `.env` files tracked by git | `git ls-files .env*` | No output |
| 1.9 | CRON_SECRET generated | Generate via `openssl rand -hex 32` | 64-character hex string |

---

## 2. Environment Variables

### 2.1 Production Variables — Vercel Dashboard

| Variable | Required | Secret | Description | Verification |
|----------|----------|--------|-------------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | No | Supabase project URL | `echo $NEXT_PUBLIC_SUPABASE_URL` returns `https://*.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | **Yes** | Supabase service role JWT | `curl -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/"` returns JSON |
| `CRON_SECRET` | Yes | **Yes** | Cleanup endpoint bearer token | Must be 32+ character random string |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | No | Fallback if service role missing | Only used when `SUPABASE_SERVICE_ROLE_KEY` not set |

### 2.2 Deprecated Variables — Remove from Vercel

| Variable | Status | Reason |
|----------|--------|--------|
| `LOOTLABS_URL` | **Unused** | Present in `.env.local` but referenced nowhere in codebase |
| `NEXT_PUBLIC_SITE_URL` | **Unused** | Present in `.env.local` but referenced nowhere in codebase |

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
2. Paste content of `migrations/001_enable_rls.sql` → Run

### 3.2 Verify Tables Exist

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('keys', 'used_workink_tokens', 'rate_limits', 'verification_logs', 'key_usage');
```

**Expected:** 5 rows returned.

### 3.3 Verify Indexes

```sql
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
AND indexname IN (
  'idx_used_workink_tokens_used_at',
  'idx_rate_limits_ip_endpoint_created_at',
  'idx_verification_logs_event_created_at',
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
AND tablename IN ('keys', 'used_workink_tokens', 'rate_limits', 'verification_logs', 'key_usage');
```

**Expected:** All 5 return `rowsecurity = true`.

### 3.5 Verify RLS Policies

```sql
SELECT tablename, policyname, cmd, permissive, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Expected:** 5 policies, each on a different table, with `qual = (false)`.

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
| `content-security-policy` | Contains `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'` |
| `x-content-type-options` | `nosniff` |
| `x-frame-options` | `DENY` |
| `referrer-policy` | `strict-origin-when-cross-origin` |
| `strict-transport-security` | `max-age=31536000; includeSubDomains` |
| `permissions-policy` | `camera=(), microphone=(), geolocation=()` |
| `access-control-allow-origin` | `*` (API routes only) |

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

### 4.5 CORS Headers — Verify

```bash
curl -I -X OPTIONS https://luxyhub.vercel.app/api/validate \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST"
```

**Expected:** HTTP 204, headers include `access-control-allow-origin: *`, `access-control-allow-methods: GET, POST, OPTIONS`.

### 4.6 Key Validation Oracle — Verify (Anti-Pattern Check)

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
| Bot Fight Mode | **On** (blocks basic bots) |
| Security Level | **Medium** |
| Browser Integrity Check | **On** |
| Hotlink Protection | Off (API needs cross-origin access) |

### 5.5 Cloudflare Rate Limiting (Optional)

Cloudflare rate limiting complements the application-level rate limiter:

| Rule | Path | Threshold | Period | Action |
|------|------|-----------|--------|--------|
| API Protection | `/api/*` | 100 requests | 10 seconds | Challenge (JS/CAPTCHA) |
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

Mark as production: `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.

### 6.3 Domains

1. Vercel Dashboard → Project → Settings → Domains
2. Add custom domain: `luxyhub.vercel.app` (auto-assigned) + any custom domains
3. Verify DNS resolves to Vercel after Cloudflare configuration

### 6.4 Cron Job

Vercel does not natively support cron triggers. Use one of these approaches:

**Option A: Vercel Cron Jobs (recommended)**
Create `vercel.json`:
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
Configure in Vercel Dashboard → Project → Settings → Cron Jobs. Add header:
```
Authorization: Bearer <CRON_SECRET>
```

**Option B: GitHub Actions (alternative)**
```yaml
name: Database Cleanup
on:
  schedule:
    - cron: '0 0 * * *'
jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -s -X POST https://luxyhub.vercel.app/api/cleanup \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

### 6.5 Build Verification

After deploying, check **Vercel Dashboard → Deployments → Production**:
- No build errors
- All routes listed (12 routes)
- Edge middleware applied

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
- [ ] Hero section renders (image, typewriter animation)
- [ ] Featured Games section renders all cards
- [ ] Click game card → modal opens
- [ ] Game modal closes on backdrop click and X button
- [ ] Changelog section shows entries
- [ ] "Load More" button increments visible changelog entries
- [ ] FAQ accordion toggles on click
- [ ] "Copy Script" button copies script loader to clipboard
- [ ] Discord link opens in new tab
- [ ] Navigate to `/get-key` — page renders with Work.ink link
- [ ] Mobile menu opens/closes correctly

**2. API Check**
- [ ] `GET /api/health` → 200 `{"status":"ok",...}`
- [ ] `POST /api/validate` with valid key → 200 `{"success":true}`
- [ ] `POST /api/validate` with invalid key → 403 `{"success":false,"message":"Invalid key"}`
- [ ] `POST /api/validate` without body → 400
- [ ] `POST /api/verify-workink` with missing token → 400
- [ ] `POST /api/generate-key` with missing token → 400

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
- [ ] Section 4.5 — CORS headers present
- [ ] Section 4.6 — no key enumeration via distinct status codes

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
| **Code Quality** | Build passes | ✅ PASS | EXIT 0, 14 pages |
| | Lint clean | ✅ PASS | 0 errors, 0 warnings |
| | TypeScript strict | ✅ PASS | No type errors |
| **Security** | RLS enabled | ✅ PASS | 5 tables, `USING (false)` |
| | Security headers | ✅ PASS | 7 headers via middleware |
| | CSP configured | ✅ PASS | Restrictive but allows Next.js |
| | CORS for API | ✅ PASS | `*` for API routes only |
| | Rate limiting | ✅ PASS | INSERT-first, fail-closed |
| | Key crypto | ✅ PASS | `crypto.getRandomValues()` |
| | Unified error codes | ✅ PASS | No key enumeration oracle |
| | Body size limits | ✅ PASS | 64 KB via middleware |
| | CRON_SECRET validated | ✅ PASS | Panics if undefined |
| | Input validation | ✅ PASS | Token length + key format regex |
| **Infrastructure** | Vercel configured | ⚠️ PENDING | Env vars must be set |
| | Supabase configured | ⚠️ PENDING | Schema + RLS must be run |
| | Cron job scheduled | ⚠️ PENDING | Cleanup needs scheduling |
| | Custom domain | ⚠️ PENDING | Cloudflare DNS |
| | Uptime monitoring | ⚠️ PENDING | Not yet configured |
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
| Infrastructure readiness | 40% |
| Operational readiness | 20% |
| Documentation readiness | 100% |
| **Overall** | **71%** |

### Required Before Go-Live

1. [ ] Set all environment variables in Vercel (Section 2)
2. [ ] Run `schema.sql` and `migrations/001_enable_rls.sql` in Supabase (Section 3)
3. [ ] Configure custom domain in Cloudflare + Vercel (Sections 5-6)
4. [ ] Schedule cleanup cron job (Section 6.4)
5. [ ] Enable Supabase PITR backups (Section 3.6)
6. [ ] Set up uptime monitoring (Section 7)
7. [ ] Generate `CRON_SECRET` (`openssl rand -hex 32`) and set in Vercel
8. [ ] Run complete operational verification (Section 8)
9. [ ] Run post-deployment verification (Section 10)

### Go / No-Go

**RECOMMENDATION: Conditional Go — deploy after completing the 9 items above.**

The codebase is production-ready. All security findings (Critical + High) have been fixed. The remaining work is infrastructure configuration (Vercel, Supabase, Cloudflare, monitoring), not code changes.
