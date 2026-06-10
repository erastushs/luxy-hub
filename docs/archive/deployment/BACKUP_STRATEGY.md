# LuxyHub — Backup Strategy & Disaster Recovery

Last updated: 2026-06-07

---

## 1. Strategy Overview

| Asset | Backup Method | Retention | RPO | RTO |
|-------|--------------|-----------|-----|-----|
| **Supabase Database** | Daily snapshots + PITR | 7 days (14 with PITR) | 24 hours (snapshot) / seconds (PITR) | < 1 hour |
| **Source Code** | GitHub (`erastushs/luxy-hub`) | Forever | Last push | Instant |
| **Environment Variables** | 1Password / encrypted vault | Manual rotation | Manual | < 1 hour |
| **Supabase Schema** | `schema.sql` + migration files in repo | Forever | As-committed | < 30 min |
| **Supabase RLS** | `migrations/001_enable_rls.sql` in repo | Forever | As-committed | < 5 min |
| **Cloudflare Config** | `../../deployment/DEPLOYMENT_CHECKLIST.md` Section 5 (documented) | Forever | As-documented | < 30 min |
| **Vercel Config** | `../../deployment/DEPLOYMENT_CHECKLIST.md` Sections 2+6 (documented) | Forever | As-documented | < 15 min |

---

## 2. Database Backups (Supabase)

### 2.1 Automated Backups

**Provider:** Supabase Managed Backups

**Configuration:**
- Supabase Dashboard → Database → Backups
- Daily snapshots: **Enabled**
- Point-in-Time Recovery (PITR): **Enabled** (requires Pro plan)

**Verification Procedure:**
```sql
-- 1. Verify backup status
-- Supabase Dashboard → Database → Backups
-- Expected: Shows "Healthy" with recent snapshot timestamp

-- 2. List recent backups
-- Via Supabase Dashboard → Database → Backups → Backup History

-- 3. Monthly test restore (see Section 5.1)
```

### 2.2 Backup Schedule

| Type | Frequency | Retention | Notes |
|------|-----------|-----------|-------|
| Daily Snapshot | Every 24 hours | 7 days | Automatic, managed by Supabase |
| PITR | Continuous | 7 days | Pro plan only — seconds of granularity |
| Manual Export | Before schema changes | 90 days | Run `pg_dump` before migrations |

### 2.3 Manual Backup (Pre-Migration)

Before running any schema modification:

```bash
# 1. Export full schema
pg_dump --schema-only \
  "postgresql://postgres:<DB_PASSWORD>@<SUPABASE_HOST>:6543/postgres" \
  > backups/schema_$(date +%Y%m%d_%H%M%S).sql

# 2. Export full data (if Pro plan — 500MB+)
pg_dump --data-only \
  "postgresql://postgres:<DB_PASSWORD>@<SUPABASE_HOST>:6543/postgres" \
  > backups/data_$(date +%Y%m%d_%H%M%S).sql

# 3. Export only keys table (most critical)
pg_dump --data-only --table=keys \
  "postgresql://postgres:<DB_PASSWORD>@<SUPABASE_HOST>:6543/postgres" \
  > backups/keys_$(date +%Y%m%d_%H%M%S).sql
```

**Note:** `pg_dump` requires Supabase database password, found in Supabase Dashboard → Project Settings → Database.

### 2.4 What Backups Cover

| Table | Backed Up | Criticality | Notes |
|-------|-----------|-------------|-------|
| `keys` | Yes | **Critical** | Active keys lost = all users need re-generation |
| `used_workink_tokens` | Yes | Medium | Token replay protection — can be rebuilt |
| `rate_limits` | Yes | Low | Ephemeral data — cleared by cleanup cron |
| `verification_logs` | Yes | Low | Audit trail — nice to have |
| `key_usage` | Yes | Low | Analytics — can be rebuilt |

---

## 3. Source Code Backups

### 3.1 Primary Backup

**Repository:** `github.com/erastushs/luxy-hub`

Git is inherently backed up through:
- Local clone(s)
- GitHub remote (primary)
- Any CI/CD pipeline clones

### 3.2 Git Backup Best Practices

```bash
# Ensure all work is pushed to remote
git push origin main

# Verify remote has latest
git ls-remote origin main

# Mirror the entire repository (including all branches/tags)
git clone --mirror https://github.com/erastushs/luxy-hub.git backups/luxy-hub-mirror
```

### 3.3 Tag Deployment Points

```bash
# Tag every production deployment
git tag -a "prod-$(date +%Y%m%d)" -m "Production deploy $(date)"
git push origin --tags
```

---

## 4. Environment Variables Backup

### 4.1 Critical Variables

These MUST be stored in a secure password manager:

| Variable | Storage | Rotation |
|----------|---------|----------|
| `SUPABASE_SERVICE_ROLE_KEY` | 1Password / Bitwarden / LastPass | Rotate quarterly |
| `CRON_SECRET` | 1Password / Bitwarden / LastPass | Rotate quarterly |
| `NEXT_PUBLIC_SUPABASE_URL` | 1Password / Bitwarden / LastPass | Fixed |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 1Password / Bitwarden / LastPass | Per Supabase docs |

### 4.2 Backup Procedure

```bash
# Export Vercel env vars to encrypted file
# (Run this manually from Vercel Dashboard)

# 1. Vercel Dashboard → Settings → Environment Variables
# 2. Screenshot or copy each variable
# 3. Store in password manager under "LuxyHub Production"
# 4. Label each with: name, last rotated, rotation schedule
```

### 4.3 Verification

Every quarter, verify:
- [ ] All 4 variables present in password manager
- [ ] Values match what's set in Vercel (test `/api/health` returns 200)
- [ ] Rotate `CRON_SECRET` (see `../../operations/INCIDENT_RESPONSE.md` Section 7.3)
- [ ] Rotate `SUPABASE_SERVICE_ROLE_KEY` (see `../../operations/INCIDENT_RESPONSE.md` Section 7.4)

---

## 5. Disaster Recovery Scenarios

### 5.1 Scenario: Complete Database Loss

**Cause:** Supabase project deletion, corruption, or catastrophic failure.

**Recovery Steps (PITR):**
```
1. Supabase Dashboard → Database → Backups
2. Select "Point-in-Time Recovery"
3. Choose recovery point (last known good state)
4. Initiate restore — creates new database
5. After restore completes:
   a. Verify tables exist (DEPLOYMENT_CHECKLIST.md Section 3.2)
   b. Re-apply RLS (migrations/001_enable_rls.sql)
   c. Verify RLS (DEPLOYMENT_CHECKLIST.md Section 3.4)
   d. Test key validation:
      curl -X POST https://luxyhub.vercel.app/api/validate \
        -H "Content-Type: application/json" \
        -d '{"key":"<known-active-key>"}'
6. Update Vercel env vars if connection string changed
7. Redeploy if env vars changed
```

**Recovery Steps (Daily Snapshot):**
```
1. Supabase Dashboard → Database → Backups
2. Select latest daily snapshot
3. Initiate restore
4. Follow same verification steps as PITR above
```

**Data Loss Assessment:**
- With PITR: seconds of data loss
- With daily snapshot: up to 24 hours of data loss
- Lost data: recent key generations, verifications, rate limit records
- Impact: Users who generated keys in last 24 hours need re-generation

### 5.2 Scenario: Accidental Data Deletion

**Cause:** Manual SQL error, migration rollback failure, bug in cleanup endpoint.

**Recovery Steps:**
```
1. Identify deletion scope:
   -- Check what was deleted
   SELECT COUNT(*) FROM keys WHERE is_active = true;
   -- Compare to known baseline

2. If PITR available:
   -- Restore to point before deletion
   -- Follow PITR recovery in Section 5.1

3. If PITR not available, manual recovery:
   -- List affected keys from verification_logs:
   SELECT DISTINCT key_snippet FROM verification_logs
   WHERE created_at BETWEEN 'start' AND 'end'
   AND event IN ('GENERATE_KEY_SUCCESS', 'VALIDATE_SUCCESS');
   -- Communicate to affected users
```

### 5.3 Scenario: Vercel Account Loss

**Cause:** Account suspension, billing issue, project deletion.

**Recovery Steps:**
```
1. Create new Vercel account or restore existing
2. Create new project, link to github.com/erastushs/luxy-hub
3. Set all environment variables from password manager backup
4. Configure custom domain:
   - Vercel Dashboard → Project → Settings → Domains
   - Add: luxyhub.space
5. Update Cloudflare DNS records (DEPLOYMENT_CHECKLIST.md Section 5.1)
6. Verify deployment: curl https://luxyhub.vercel.app/api/health
```

### 5.4 Scenario: GitHub Repository Loss

**Cause:** Repo deletion, GitHub outage, organization removal.

**Recovery Steps:**
```
1. If local clone exists:
   cd /path/to/local/clone
   git remote add origin https://github.com/erastushs/luxy-hub.git
   git push --all origin
   git push --tags origin

2. If no local clone, restore from mirror:
   git clone backups/luxy-hub-mirror luxy-hub-restored
   cd luxy-hub-restored
   git remote add origin https://github.com/erastushs/luxy-hub.git
   git push --all origin

3. Verify in GitHub: all branches, tags, and files present
4. Reconnect Vercel project to restored repo
```

### 5.5 Scenario: Ransomware / Malicious Deploy

**Cause:** Compromised credentials, malicious PR merged.

**Recovery Steps:**
```
1. Contain immediately:
   -- Revoke suspicious credentials
   -- Rollback latest deploy: Vercel Dashboard → Promote previous deploy

2. Assess scope:
   -- Review git log for unauthorized commits
   -- Review files modified by suspicious commits

3. Recover:
   -- Reset to last known good commit:
   git reset --hard <known-good-commit-sha>
   git push --force-with-lease origin main

4. Rotate all secrets:
   -- SUPABASE_SERVICE_ROLE_KEY
   -- CRON_SECRET
   -- GitHub personal access tokens
   -- Vercel API tokens

5. Redeploy clean build
```

---

## 6. RLS Policy Backup

### 6.1 Verification

RLS policies are source-controlled in `migrations/001_enable_rls.sql`. Every database restore must re-apply:

```bash
# After any database restore, run:
# Supabase SQL Editor → Paste migrations/001_enable_rls.sql → Run

# Then verify:
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('keys', 'used_workink_tokens', 'rate_limits', 'verification_logs', 'key_usage');
# Expected: All 5 return rowsecurity = true
```

### 6.2 Policy Audit

Every month, verify RLS policies match source control:

```sql
-- Compare against migrations/001_enable_rls.sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
-- Expected: 5 policies, each with qual = (false)
```

---

## 7. Backup Monitoring

### 7.1 Automated Checks

| Check | Frequency | Method | Alert |
|-------|-----------|--------|-------|
| Supabase backup success | Daily | Supabase Dashboard | Email if failed |
| PITR active | Daily | Supabase Dashboard | Email if disabled |
| `schema.sql` in sync | Weekly | Compare against live schema | Manual review |
| `migrations/001_enable_rls.sql` in sync | Monthly | Compare against pg_policies | Manual review |
| Environment variables backed up | Quarterly | Verify in password manager | Manual checklist |

### 7.2 Scheduled Verification

```bash
# Run monthly to verify backup integrity:

# 1. Verify database connectivity
curl https://luxyhub.vercel.app/api/health

# 2. Test key validation (DB query works)
curl -X POST https://luxyhub.vercel.app/api/validate \
  -H "Content-Type: application/json" \
  -d '{"key":"LUXY-AAAA-AAAA-AAAA"}'
# Expected: HTTP 403 (not 500)

# 3. Verify schema file matches live DB
# Manual: Compare schema.sql against Supabase Dashboard table view

# 4. Verify RLS is enabled
# Manual: Run SQL query from Section 6.1
```

---

## 8. Backup Storage Matrix

| Backup | Location | Encrypted | Off-Site |
|--------|----------|-----------|----------|
| Supabase DB (daily) | Supabase infrastructure | At rest | Yes |
| Supabase DB (PITR) | Supabase infrastructure | At rest | Yes |
| Source code (GitHub) | GitHub.com | At rest | Yes |
| Source code (local) | Developer machines | Disk-level | Yes (multi-device) |
| Environment variables | 1Password/Bitwarden | End-to-end | Yes |
| Schema SQL | `schema.sql` in repo | N/A | Yes (GitHub + clones) |
| RLS migration | `migrations/001_enable_rls.sql` | N/A | Yes (GitHub + clones) |
| Cloudflare config | Documented in `../../deployment/DEPLOYMENT_CHECKLIST.md` | N/A | Yes (GitHub + clones) |
| Vercel config | Documented in `../../deployment/DEPLOYMENT_CHECKLIST.md` | N/A | Yes (GitHub + clones) |

---

## 9. Retention Policy

| Data | Retention | Cleanup |
|------|-----------|---------|
| Database backups (Supabase) | 7 days (14 with PITR) | Automatic |
| Source code history | Forever | Manual (never delete tags) |
| Environment values (current) | Forever | Manual rotation |
| Environment values (previous) | 90 days after rotation | Manual delete from password manager |
| Manual pg_dump exports | 90 days | Manual cleanup: `rm backups/schema_* backups/data_* backups/keys_*` |
| Old deployment tags | 1 year | `git tag -d prod-<old>` and `git push origin :prod-<old>` |

---

## 10. Quick-Reference Recovery Commands

```bash
# === DATABASE RESTORE ===
# Restore from Supabase Dashboard → Database → Backups
# After restore, re-apply RLS:
# Run migrations/001_enable_rls.sql in Supabase SQL Editor

# === VERIFY RESTORE ===
# Check tables:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';
# Check RLS:
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true;
# Check keys:
SELECT COUNT(*) FROM keys WHERE is_active = true;

# === ENV VAR RECOVERY ===
# 1. Open password manager → LuxyHub Production
# 2. Copy each variable to Vercel Dashboard → Settings → Env Vars
# 3. Redeploy

# === CODE RECOVERY ===
# Restore from GitHub:
git clone https://github.com/erastushs/luxy-hub.git
# Or from mirror:
git clone backups/luxy-hub-mirror luxy-hub

# === VERCEL RECOVERY ===
# Create new project → Import from GitHub
# Add env vars → Deploy
# Add custom domain → Verify DNS
```

---

## 11. Annual DR Test

Once per year, perform a full disaster recovery test:

1. **Database** — Restore Supabase DB from 7-day-old snapshot
2. **Environment** — Recover env vars from password manager only
3. **Code** — Clone fresh from GitHub, build, deploy
4. **DNS** — Verify Cloudflare and Vercel DNS configuration
5. **Validate** — Run full operational verification (DEPLOYMENT_CHECKLIST.md Section 8)

**Success Criteria:** All checks in DEPLOYMENT_CHECKLIST.md Section 8 pass after recovery.
