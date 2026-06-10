# LuxyHub CDN — Migration Guide

Date: 2026-06-07
Phase: 2C — Production Verification

---

## 1. Overview

This guide documents the migration from GitHub Raw URLs to LuxyHub CDN for script delivery.

### Current State
```
Roblox Executor → GitHub Raw (raw.githubusercontent.com) → Script
```

### Target State
```
Roblox Executor → LuxyHub CDN (luxyhub.vercel.app/api/scripts/:slug/raw) → Script
```

### Future State (when cdn.luxyhub.space is configured)
```
Roblox Executor → LuxyHub CDN (cdn.luxyhub.space/raw/:slug) → Script
```

---

## 2. Migration Strategy

### Phase 1: Upload Scripts to CDN
1. For each script currently hosted on GitHub Raw, create a CDN entry via `POST /api/scripts`
2. Verify content matches via `GET /api/scripts/:slug/raw`
3. Test in a development Roblox executor

### Phase 2: Dual-Host (Transition Period)
1. Set visibility to `public` or `unlisted` on CDN
2. Update script loaders to try CDN first, fall back to GitHub Raw
3. Monitor download analytics (`GET /api/scripts/:slug/stats`)
4. Verify no increase in error rates

### Phase 3: Cut Over
1. Once analytics confirm stable delivery, switch loaders to CDN-only
2. Remove GitHub Raw fallback
3. Optionally archive or delete GitHub Raw copies

### Phase 4: Decommission
1. GitHub Raw URLs are no longer referenced
2. New script updates go exclusively through CDN
3. Version history maintained via CDN auto-versioning

---

## 3. Step-by-Step Script Migration

### 3.1 Upload Script
```bash
curl -s -X POST https://luxyhub.vercel.app/api/scripts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d '{
    "slug": "bloxatlas",
    "name": "BloxAtlas",
    "description": "Universal Roblox ESP and aimbot",
    "visibility": "public",
    "content": "'"$(cat bloxatlas.lua | jq -Rs .)"'"
  }'
```

### 3.2 Verify Content
```bash
# Compare CDN output with local file
diff <(curl -s https://luxyhub.vercel.app/api/scripts/bloxatlas/raw) bloxatlas.lua
```

### 3.3 Update Loader URLs

**Before (GitHub Raw):**
```lua
loadstring(game:HttpGet('https://raw.githubusercontent.com/user/repo/main/bloxatlas.lua'))()
```

**After (LuxyHub CDN):**
```lua
loadstring(game:HttpGet('https://luxyhub.vercel.app/api/scripts/bloxatlas/raw'))()
```

**Dual-Host Transition Pattern:**
```lua
local CDN_BASE = "https://luxyhub.vercel.app/api/scripts"
local GITHUB_BASE = "https://raw.githubusercontent.com/user/repo/main"

local function loadScript(slug, filename)
    -- Try CDN first
    local success, result = pcall(function()
        return syn.request({
            Url = CDN_BASE .. "/" .. slug .. "/raw",
            Method = "GET",
        })
    end)

    if success and result.StatusCode == 200 then
        return result.Body
    end

    -- Fall back to GitHub Raw
    local fallbackSuccess, fallbackResult = pcall(function()
        return syn.request({
            Url = GITHUB_BASE .. "/" .. filename,
            Method = "GET",
        })
    end)

    if fallbackSuccess and fallbackResult.StatusCode == 200 then
        return fallbackResult.Body
    end

    return nil
end
```

---

## 4. Rollback Strategy

### 4.1 Emergency Rollback (Script Loader)

If CDN fails in production, existing loaders with dual-host logic automatically fall back to GitHub Raw. No code deployment needed.

If loaders are already CDN-only:
1. Revert script loader to GitHub Raw URL
2. Push update to users
3. Investigate CDN failure via `/api/health` and Vercel logs

### 4.2 CDN Degradation Behavior

| Failure Mode | Impact | Mitigation |
|-------------|--------|------------|
| Vercel function crash | Raw endpoint returns 500 | Retry with exponential backoff in loader |
| Supabase outage | All CDN endpoints 500 | Key validation also down — no scripts load |
| Rate limit hit (100/min) | Returns 429 | Loader respects Retry-After header |
| Slug renamed/deleted | Returns 404 | Invalid loaders error out, creator fixes slug |

### 4.3 Database Rollback

If CDN data is corrupted:
```bash
# Restore from Supabase backup (see BACKUP_STRATEGY.md §5.1)
# Then re-upload scripts:
curl -X POST https://luxyhub.vercel.app/api/scripts ... (each script)
```

---

## 5. Testing Strategy

### 5.1 Pre-Migration Testing
```bash
# 1. Upload test script
curl -s -X POST https://luxyhub.vercel.app/api/scripts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d '{"slug":"test-migration","name":"Test","visibility":"public","content":"print(1+1)"}'

# 2. Verify raw endpoint
curl -s https://luxyhub.vercel.app/api/scripts/test-migration/raw
# Expected: print(1+1)

# 3. Verify caching headers
curl -sI https://luxyhub.vercel.app/api/scripts/test-migration/raw
# Expected: Cache-Control: public, max-age=300, s-maxage=3600

# 4. Test private script protection
curl -s -X POST https://luxyhub.vercel.app/api/scripts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d '{"slug":"test-private","name":"Private","visibility":"private","content":"secret"}'

curl -s https://luxyhub.vercel.app/api/scripts/test-private/raw
# Expected: 403 "This script is private"

curl -s https://luxyhub.vercel.app/api/scripts/test-private/raw \
  -H "Authorization: Bearer $ADMIN_API_KEY"
# Expected: "secret"

# 5. Test auto-versioning
curl -s -X PATCH https://luxyhub.vercel.app/api/scripts/test-migration \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d '{"content":"print(2+2)"}'
# Expected: current_version_id changed, content updated

# 6. Verify stats tracking
curl -s https://luxyhub.vercel.app/api/scripts/test-migration/stats
# Expected: total_downloads > 0

# 7. Test rate limiting
for i in $(seq 1 110); do
  curl -s -o /dev/null -w "Request $i: HTTP %{http_code}\n" \
    https://luxyhub.vercel.app/api/scripts/test-migration/raw
done
# Expected: First 100 return 200, rest return 429

# 8. Clean up test scripts
curl -s -X DELETE https://luxyhub.vercel.app/api/scripts/test-migration \
  -H "Authorization: Bearer $ADMIN_API_KEY"
curl -s -X DELETE https://luxyhub.vercel.app/api/scripts/test-private \
  -H "Authorization: Bearer $ADMIN_API_KEY"
```

### 5.2 Roblox Executor Testing
1. Test with Synapse X, KRNL, Script-Ware
2. Test with Fluxus, Delta, CodeX
3. Verify HTTP/2 and TLS 1.2+ connectivity
4. Verify content-length header parsing works in all executors
5. Test `Retry-After` header parsing for rate limit handling

### 5.3 Load Testing
```bash
# Simulate 100 concurrent downloads
for i in $(seq 1 100); do
  curl -s -o /dev/null -w "IP$i: %{http_code}\n" \
    -H "x-forwarded-for: 10.0.0.$i" \
    https://luxyhub.vercel.app/api/scripts/bloxatlas/raw &
done
wait
```

---

## 6. Deployment Sequence

### 6.1 Before First Script Upload
1. [ ] Run `migrations/002_cdn_tables.sql` in Supabase SQL Editor
2. [ ] Set `ADMIN_API_KEY` in Vercel environment variables
3. [ ] Set `ANALYTICS_PEPPER` in Vercel environment variables (or fall back to `CRON_SECRET`)
4. [ ] Verify health endpoint: `curl https://luxyhub.vercel.app/api/health`
5. [ ] Verify CDN routes compiled: `npm run build`

### 6.2 Script Migration (per script)
1. [ ] Upload script via `POST /api/scripts`
2. [ ] Verify content via `GET /api/scripts/:slug/raw`
3. [ ] Set visibility to `public` or `unlisted`
4. [ ] Test download in Roblox executor
5. [ ] Update loader URLs in script installer
6. [ ] Monitor stats for 24 hours
7. [ ] Remove GitHub Raw fallback after stable period

### 6.3 Post-Migration
1. [ ] Verify cleanup cron purges `script_downloads` (check after 90 days)
2. [ ] Review analytics: `GET /api/scripts/:slug/stats` for each script
3. [ ] Update external documentation pointing to CDN URLs
4. [ ] Remove GitHub Raw references from README/website

---

## 7. URL Reference

### CDN URLs by Script Slug
```
Example: script slug = "bloxatlas"

Metadata:   https://luxyhub.vercel.app/api/scripts/bloxatlas
Raw:        https://luxyhub.vercel.app/api/scripts/bloxatlas/raw
Stats:      https://luxyhub.vercel.app/api/scripts/bloxatlas/stats
Directory:  https://luxyhub.vercel.app/api/scripts
```

### GitHub Raw → CDN Mapping
```
GitHub: raw.githubusercontent.com/user/repo/branch/bloxatlas.lua
CDN:    luxyhub.vercel.app/api/scripts/bloxatlas/raw

GitHub: raw.githubusercontent.com/user/repo/branch/esp.lua
CDN:    luxyhub.vercel.app/api/scripts/esp/raw
```

---

## 8. Troubleshooting

| Symptom | Cause | Solution |
|---------|-------|----------|
| Raw endpoint returns 404 | Script not found or deleted | Verify slug with `GET /api/scripts/:slug` |
| Raw endpoint returns 403 | Script is private | Add `Authorization: Bearer <ADMIN_API_KEY>` or change visibility |
| Raw endpoint returns 500 | Database or server error | Check Vercel logs, Supabase status |
| Stats show 0 downloads | Analytics pepper not configured | Set `ANALYTICS_PEPPER` env var |
| Content doesn't match GitHub | Wrong version uploaded | Re-upload correct content via `PATCH` |
| Loader times out | Rate limited or network issue | Check `Retry-After` header, add retry logic |
| Upload fails with 409 | Slug already exists | Use different slug or delete existing script first |
