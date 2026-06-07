# Phase 3C.2 Analytics Aggregation APIs

Status: Implemented
Last updated: 2026-06-08

## Purpose
Phase 3C.2 creates creator-safe analytics aggregation APIs using `script_downloads` as the canonical event source. `script_downloads` remains service-role-only — creators never directly access raw download events. All analytics are aggregated server-side with ownership enforcement.

## Scope

Included:
- Portfolio-level analytics overview (total scripts, downloads by time window)
- Per-script aggregated analytics (downloads today/7d/30d)
- Download trends (time-series by day for 7d/30d windows)
- Centralized analytics service layer
- Ownership enforcement at repository layer
- Performance-optimized aggregate queries (no N+1 patterns)
- Unit tests for ownership isolation and aggregation guarantees

Not included:
- Dashboard UI / React components / charts
- Analytics UI / pages
- Marketplace features
- Organizations
- API token systems
- Raw download event exposure
- Materialized views (V1 acceptable with live aggregates)

---

## Endpoint Catalog

Base: `/api/dashboard`

### GET /api/dashboard/analytics/overview

Portfolio-level aggregated analytics for the authenticated creator.

**Auth:** Session required (`requireAuth()`)
**Rate limit:** `DASHBOARD_ANALYTICS_OVERVIEW` (30 req/60s)

**Response 200:**
```json
{
  "success": true,
  "overview": {
    "total_scripts": 5,
    "published_scripts": 3,
    "private_scripts": 2,
    "total_downloads": 1000,
    "downloads_today": 50,
    "downloads_7d": 300,
    "downloads_30d": 800
  }
}
```

**Ownership:** All counts scoped to `creator_id = actor.id`.

### GET /api/dashboard/scripts/[slug]/stats

Aggregated analytics for a single owned script.

**Auth:** Session required (`requireAuth()`)
**Rate limit:** `DASHBOARD_ANALYTICS_STATS` (30 req/60s)

**Response 200:**
```json
{
  "success": true,
  "analytics": {
    "slug": "my-script",
    "total_downloads": 200,
    "downloads_today": 10,
    "downloads_7d": 60,
    "downloads_30d": 150,
    "last_downloaded_at": "2026-06-01T12:00:00.000Z"
  }
}
```

**Response 404:** Returns 404 for non-owned scripts (existence not exposed).

### GET /api/dashboard/analytics/downloads

Time-series download trends aggregated by day.

**Auth:** Session required (`requireAuth()`)
**Rate limit:** `DASHBOARD_ANALYTICS_DOWNLOADS` (30 req/60s)

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `range` | string | yes | `last_7_days`, `7d`, `7`, `last_30_days`, `30d`, or `30` |
| `slug` | string | no | Scope to a single script; if omitted, returns portfolio-level trends |

**Response 200 (portfolio-level):**
```json
{
  "success": true,
  "trends": {
    "points": [
      { "day": "2026-06-01", "downloads": 10 },
      { "day": "2026-06-02", "downloads": 15 },
      { "day": "2026-06-03", "downloads": 0 }
    ]
  }
}
```

**Points are guaranteed:** Every day in the range has an entry (0 for days with no downloads).

---

## Aggregation Model

```
script_downloads (service-role-only)
  │
  │ aggregate queries via supabaseAdmin
  │
  ├─ getCreatorAnalyticsOverview()
  │   │
  │   ├─ SELECT scripts WHERE creator_id = ownerId
  │   ├─ COUNT(script_downloads) IN (owned script IDs)
  │   │   ├─ total
  │   │   ├─ today  (created_at >= YYYY-MM-DD)
  │   │   ├─ 7d    (created_at >= now - 7 days)
  │   │   └─ 30d   (created_at >= now - 30 days)
  │   └─ returns CreatorAnalyticsOverview
  │
  ├─ getScriptAnalyticsForOwner(slug, ownerId)
  │   │
  │   ├─ findScriptBySlugForOwner(slug, ownerId)
  │   ├─ COUNT(script_downloads) WHERE script_id = X
  │   │   ├─ total / today / 7d / 30d
  │   └─ returns ScriptAnalytics
  │
  └─ getDownloadTrendsForOwner(ownerId, rangeDays)
      │
      ├─ SELECT scripts WHERE creator_id = ownerId
      ├─ SELECT created_at FROM script_downloads
      │   WHERE script_id IN (owned IDs)
      │   AND created_at >= (now - rangeDays)
      ├─ bucket by day in application code
      ├─ fill gaps with 0 values
      └─ returns DownloadTrendsResult
```

---

## Ownership Model

All analytics endpoints enforce ownership at the repository layer:

1. **Overview** — queries only scripts where `creator_id = ownerId`, then downloads filtered to those script IDs
2. **Per-script stats** — uses `findScriptBySlugForOwner(slug, ownerId)` — returns null for foreign scripts
3. **Download trends** — same pattern: script IDs scoped to owner, then downloads filtered

No analytics endpoint ever queries `script_downloads` without first scoping to the creator's owned script IDs.

### Isolation Guarantees

Creator A **cannot**:
- See Creator B's script counts, download totals, or trends
- See analytics for any script they don't own
- Access raw download events in any form

All violations return either empty results (overview returns zeros) or 404 (per-script returns not found).

---

## Architecture

### Repository Layer (`app/lib/repositories/script-repository.ts`)

New types:
- `ScriptAnalytics` — per-script aggregated analytics
- `CreatorAnalyticsOverview` — portfolio-level overview
- `DownloadTrendPoint` — single day data point
- `DownloadTrendsResult` — collection of trend points

New functions:

| Function | Purpose |
|----------|---------|
| `getCreatorAnalyticsOverview(ownerId)` | Portfolio aggregate: counts, downloads by window |
| `getScriptAnalyticsForOwner(slug, ownerId)` | Per-script aggregate with ownership check |
| `getDownloadTrendsForOwner(ownerId, rangeDays)` | Portfolio-level daily trends |
| `getScriptDownloadTrendsForOwner(slug, ownerId, rangeDays)` | Per-script daily trends |

### Service Layer (`app/lib/services/analytics-service.ts`)

Thin service layer that delegates to repository functions. Handles:
- Range parameter parsing (`last_7_days` → 7, `30d` → 30)
- Input validation
- Error normalization (returns discriminated union result types)
- Ownership is enforced implicitly by repository queries that filter by `creator_id`

### Route Layer

All routes follow the standard Phase 3C pattern:
1. `requireAuth()` — session validation
2. Rate limit check
3. Call analytics service
4. Return JSON response

Routes contain zero business logic — just auth, rate limiting, and response formatting.

---

## Performance Review

### Query Design
- Overview: 1 script query + up to 4 `COUNT` queries with `.in()` filter (bounded by number of owned scripts)
- Per-script stats: 1 `findScriptBySlugForOwner` + up to 4 `COUNT` queries on single script_id
- Trends: 1 script query + 1 `SELECT created_at` query, in-memory bucket aggregation

### No N+1 Patterns
- Overview uses `.in('script_id', scriptIds)` — single query per time window regardless of script count
- Trends use `.in('script_id', scriptIds)` — single query for all download timestamps
- Per-script stats use single `.eq('script_id', scriptId)` — exactly 1 query per time window

### V1 Acceptable
- Live aggregate queries with bounded time windows (7d, 30d)
- `idx_scripts_creator_id` index covers the script lookup queries
- `script_downloads.script_id` and `script_downloads.created_at` columns used for filtering

### Future Optimization Triggers
- Large `script_downloads` volume (>1M rows)
- Slow date-bucketed queries across many scripts
- Rising creator count (>100 active creators)

Future options (not needed yet):
- Materialized daily aggregation table
- Scheduled rollups per script/day
- Cached creator analytics snapshots

---

## Security Review

| Check | Status |
|-------|--------|
| `script_downloads` remains service-role-only | Pass — all queries use `supabaseAdmin`, no direct creator access |
| No raw download events exposed | Pass — all responses are counts or date-bucketed aggregates |
| Ownership enforced on all queries | Pass — repository layer always filters by `creator_id` before accessing downloads |
| Cross-account isolation | Pass — validated by 3 cross-account isolation tests |
| No IP hash exposure | Pass — analytics responses contain only counts, never `ip_hash` |
| No user agent exposure | Pass — no response type includes `user_agent_hash` |
| Session authentication | Pass — `requireAuth()` on all analytics endpoints |
| Rate limiting | Pass — all 3 endpoints have rate limits |
| Fail-closed error handling | Pass — all 500 paths return generic messages |

---

## Testing

Tests in `__tests__/analytics-apis.test.ts` (17 tests, all passing):

### getOverview
- Returns analytics overview for creator
- Passes correct ownerId to repository
- Returns overview scoped to creator only

### getScriptStats
- Returns analytics for owned script
- Returns 404 for foreign script analytics
- Passes correct ownerId and slug to repository

### getDownloadTrends
- Returns portfolio-level trends for last_7_days
- Returns portfolio-level trends for last_30_days
- Returns script-level trends when slug provided
- Returns 404 for foreign script trends
- Rejects invalid range parameter
- Accepts shorthand range formats (7d, 30)

### Cross-account isolation
- Creator A cannot access Creator B analytics overview
- Creator A cannot access Creator B script analytics
- Creator A cannot access Creator B download trends

### Aggregation guarantees
- Never returns raw download events (no ip_hash, user_agent_hash)
- Trends only expose day-level aggregation (no created_at, ip_hash)

Run with:
```bash
npx vitest run
```
Overall: 42 tests across 2 files, all passing.

---

## Files Created
- `app/lib/services/analytics-service.ts` — Centralized analytics service
- `app/api/dashboard/analytics/overview/route.ts` — Portfolio overview endpoint
- `app/api/dashboard/analytics/downloads/route.ts` — Download trends endpoint
- `app/api/dashboard/scripts/[slug]/stats/route.ts` — Per-script stats endpoint
- `__tests__/analytics-apis.test.ts` — 17 analytics tests
- `PHASE3C_ANALYTICS_APIS.md` — This document

## Files Modified
- `app/lib/repositories/script-repository.ts` — Added 4 analytics aggregation functions + 4 new types
- `app/lib/repositories/rate-limit-repository.ts` — Added 3 analytics rate limit keys

---

## All Phase 3C Endpoints

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/dashboard/scripts` | Session | List creator's scripts (paginated, filterable) |
| POST | `/api/dashboard/scripts` | Session | Create script |
| GET | `/api/dashboard/scripts/[slug]` | Session | Get script detail |
| PATCH | `/api/dashboard/scripts/[slug]` | Session | Update script |
| DELETE | `/api/dashboard/scripts/[slug]` | Session | Delete script |
| GET | `/api/dashboard/scripts/[slug]/stats` | Session | Per-script analytics |
| GET | `/api/dashboard/analytics/overview` | Session | Portfolio analytics overview |
| GET | `/api/dashboard/analytics/downloads` | Session | Download time-series trends |

---

## Remaining Work for Phase 3C.3 (Version History APIs)

- [ ] `GET /api/dashboard/scripts/[slug]/versions` — List versions for owned script
- [ ] `GET /api/dashboard/scripts/[slug]/versions/[version]` — Get specific version detail
- [ ] Ownership enforcement on version queries
- [ ] Version rollback support

(End of file)
