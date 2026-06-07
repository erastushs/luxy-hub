# LuxyHub CDN — Architecture Review

Date: 2026-06-07
Status: Pre-Implementation Review
Phase: 1.5

---

## 1. Executive Summary

This document defines the complete architecture for the LuxyHub CDN MVP (Phase 2) before any code is written. Every design decision is derived from an audit of the existing codebase and must preserve all existing functionality.

### Non-Negotiables

1. **Zero changes to existing API routes** — `/api/validate`, `/api/generate-key`, `/api/verify-workink`, `/api/health`, `/api/cleanup` are frozen
2. **Service-role-only database access** — all queries go through `supabaseAdmin`, no anon client
3. **RLS deny-all pattern** — every new table follows the `_deny_all` policy for `anon, authenticated`
4. **Existing response format** — `{ success: true }` / `{ success: false, message: string }`
5. **Existing rate limiter integration** — INSERT-first fail-closed via `checkRateLimit()`
6. **Existing middleware unchanged** — CSP, CORS, HSTS, body limits, all preserved
7. **No breakage** — Work.ink flow, key generation, key validation must continue working

---

## 2. Storage Strategy

### Decision: Inline Text Storage in PostgreSQL

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **PostgreSQL `text` column** | No additional infra, simple, transactions, RLS | ~1GB max per field, no CDN edge caching | **SELECTED — MVP** |
| Supabase Storage | Large files, CDN, signed URLs | New infra, new SDK usage, bucket RLS config | Future (Phase 3+) |
| Cloudflare R2 | Edge performance, CDN, cheap | New external dependency, API complexity | Future (Phase 5+) |

**Rationale:** Roblox Lua scripts are small text files (rarely exceed 100KB). PostgreSQL's `text` type handles up to ~1GB per field. Inline storage keeps the MVP simple with zero new infrastructure. The middleware already enforces a 64KB body limit on POST routes, which aligns with expected script sizes. Migration to Supabase Storage or R2 is trivial in future phases — content is already structured with version history.

### Body Size Considerations

| Layer | Limit | Enforcement |
|-------|-------|-------------|
| Middleware | 64 KB (`content-length` check) | Pre-route — HTTP 413 |
| PostgreSQL `text` | ~1 GB theoretical | Database constraint |
| Practical max | 64 KB (limited by middleware) | Sufficient for Lua scripts |

---

## 3. Database Schema

### 3.1 Table: `scripts`

Core script metadata and content. Inline storage.

```sql
CREATE TABLE IF NOT EXISTS scripts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text DEFAULT '',
  content text NOT NULL,
  visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'private')),
  is_published boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scripts_slug
  ON scripts (slug);

CREATE INDEX IF NOT EXISTS idx_scripts_visibility_published
  ON scripts (visibility, is_published);
```

| Column | Type | Constraint | Purpose |
|--------|------|-----------|---------|
| `id` | `uuid` | PK, `gen_random_uuid()` | Internal identifier |
| `name` | `text` | NOT NULL | Human-readable display name |
| `slug` | `text` | NOT NULL, UNIQUE | URL-safe identifier (e.g. `bloxatlas`) |
| `description` | `text` | DEFAULT `''` | Short description for script directory |
| `content` | `text` | NOT NULL | Raw script content (Lua source) |
| `visibility` | `text` | NOT NULL, `'public'` or `'private'` | Access control — public or private |
| `is_published` | `boolean` | DEFAULT `false` | Published scripts appear in directory |
| `created_at` | `timestamptz` | DEFAULT `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | DEFAULT `now()` | Last update timestamp |

**Design Notes:**
- `slug` is the public-facing identity — used in URLs: `cdn.luxyhub.space/raw/{slug}`
- `visibility` and `is_published` are independent — a script can be `public` but `is_published = false` (unlisted) or `private` (requires authentication)
- No foreign key to a `users` table — creator identity comes in Phase 3 (Creator Dashboard). Admin API key identifies the uploader for now.
- `updated_at` is updated manually on PATCH (not via trigger) for explicit control

### 3.2 Table: `script_versions`

Version history for forward compatibility with Phase 4. Created now, features implemented later.

```sql
CREATE TABLE IF NOT EXISTS script_versions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  script_id uuid NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  version text NOT NULL,
  content text NOT NULL,
  changelog text,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(script_id, version)
);

CREATE INDEX IF NOT EXISTS idx_script_versions_script_id
  ON script_versions (script_id);

CREATE INDEX IF NOT EXISTS idx_script_versions_script_version
  ON script_versions (script_id, version);
```

| Column | Type | Constraint | Purpose |
|--------|------|-----------|---------|
| `id` | `uuid` | PK | Version identifier |
| `script_id` | `uuid` | FK → `scripts(id)`, CASCADE | Parent script |
| `version` | `text` | NOT NULL, UNIQUE per script | Semantic version (e.g. `1.0.0`) |
| `content` | `text` | NOT NULL | Full script content at this version |
| `changelog` | `text` | nullable | Release notes |
| `created_at` | `timestamptz` | DEFAULT `now()` | Version creation time |

**Design Notes:**
- `ON DELETE CASCADE` — deleting a script removes all its versions
- `UNIQUE(script_id, version)` — prevents duplicate version numbers for the same script
- Phase 2 MVP does NOT implement version CRUD. The raw endpoint always serves `scripts.content` (the "current" version). Versions are created as a side effect of updating a script (the old content is archived to `script_versions`).
- In Phase 4, version management becomes first-class with `GET /api/scripts/:slug/versions/:version/raw`

### 3.3 Table: `script_downloads`

Analytics tracking. Every raw endpoint hit logs a row here.

```sql
CREATE TABLE IF NOT EXISTS script_downloads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  script_id uuid NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  version_id uuid REFERENCES script_versions(id) ON DELETE SET NULL,
  ip text,
  user_agent text,
  downloaded_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_script_downloads_script_id
  ON script_downloads (script_id);

CREATE INDEX IF NOT EXISTS idx_script_downloads_downloaded_at
  ON script_downloads (downloaded_at);

CREATE INDEX IF NOT EXISTS idx_script_downloads_script_time
  ON script_downloads (script_id, downloaded_at);
```

| Column | Type | Constraint | Purpose |
|--------|------|-----------|---------|
| `id` | `uuid` | PK | Log entry |
| `script_id` | `uuid` | FK → `scripts(id)`, CASCADE | Which script was downloaded |
| `version_id` | `uuid` | FK → `script_versions(id)`, SET NULL | Which version (nullable — current content has no version row) |
| `ip` | `text` | nullable | Client IP for unique visitor counting |
| `user_agent` | `text` | nullable | User agent for platform stats |
| `downloaded_at` | `timestamptz` | DEFAULT `now()` | Download timestamp |

**Design Notes:**
- `ON DELETE SET NULL` for `version_id` — if a version is deleted, download records survive with null version
- IP is stored as plain text (not hashed) for analytics queries. This is consistent with existing `rate_limits` and `verification_logs` tables which also store raw IPs.
- `user_agent` enables platform-level analytics (e.g., "60% of downloads from Synapse X, 30% from KRNL")

### 3.4 Schema Summary

```text
scripts ──1:N── script_versions
   │
   └──1:N── script_downloads
              │
              └──?── script_versions (nullable FK)
```

Total new tables: 3
Total new indexes: 6

---

## 4. RLS Policy Design

### 4.1 Policy Pattern (Identical to Existing)

```sql
-- scripts
ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scripts_deny_all ON scripts;
CREATE POLICY scripts_deny_all
  ON scripts
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- script_versions
ALTER TABLE script_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS script_versions_deny_all ON script_versions;
CREATE POLICY script_versions_deny_all
  ON script_versions
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- script_downloads
ALTER TABLE script_downloads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS script_downloads_deny_all ON script_downloads;
CREATE POLICY script_downloads_deny_all
  ON script_downloads
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
```

### 4.2 Migration File

**Location:** `migrations/002_cdn_tables.sql` — creates all 3 tables + enables RLS

**Location:** `migrations/002_cdn_tables_rollback.sql` — drops policies + tables

Follows the exact pattern of `migrations/001_enable_rls.sql`:
- `BEGIN; / COMMIT;` transaction wrapper
- Section comments with table names
- Order: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` → `DROP POLICY IF EXISTS` → `CREATE POLICY ... FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)`

---

## 5. API Contract

### 5.1 Admin Authentication

Script management endpoints require an admin API key.

```
Header: Authorization: Bearer <ADMIN_API_KEY>
```

`ADMIN_API_KEY` is a new environment variable, separate from `CRON_SECRET`. This allows different scopes:
- `CRON_SECRET` → database cleanup only
- `ADMIN_API_KEY` → script management only

Fallback: If `ADMIN_API_KEY` is not set, fall back to `CRON_SECRET` so existing setups work without adding a new env var.

### 5.2 Route Map

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/scripts` | Bearer | Upload (create) a new script |
| `GET` | `/api/scripts` | None | List all public published scripts |
| `GET` | `/api/scripts/[slug]` | None | Get script metadata |
| `PATCH` | `/api/scripts/[slug]` | Bearer | Update script name/description/content/visibility |
| `DELETE` | `/api/scripts/[slug]` | Bearer | Delete script and all versions/downloads |
| `POST` | `/api/scripts/[slug]/publish` | Bearer | Toggle publish status |
| `GET` | `/api/scripts/[slug]/raw` | None | Get raw script content (text/plain) |
| `GET` | `/api/scripts/[slug]/stats` | None | Get download analytics |

### 5.3 Endpoint Specifications

#### `POST /api/scripts` — Upload Script

```
Request:
  Authorization: Bearer <ADMIN_API_KEY>
  Content-Type: application/json

  {
    "name": "BloxAtlas",
    "slug": "bloxatlas",
    "description": "Universal ESP and aimbot for Roblox",
    "content": "loadstring(game:HttpGet('...'))()",
    "visibility": "public"
  }

Success (201):
  {
    "success": true,
    "script": {
      "id": "uuid",
      "name": "BloxAtlas",
      "slug": "bloxatlas",
      "description": "Universal ESP and aimbot for Roblox",
      "visibility": "public",
      "is_published": false,
      "created_at": "2026-06-07T...",
      "updated_at": "2026-06-07T..."
    }
  }

Error (400):
  { "success": false, "message": "Name is required" }
  { "success": false, "message": "Slug is required" }
  { "success": false, "message": "Content is required" }
  { "success": false, "message": "Invalid visibility. Must be 'public' or 'private'" }
  { "success": false, "message": "Slug must be 3-64 alphanumeric characters (a-z, 0-9, hyphens)" }

Error (401):
  { "success": false, "message": "Unauthorized" }

Error (409):
  { "success": false, "message": "A script with this slug already exists" }

Error (429):
  { "success": false, "message": "Too many requests. Please try again later." }
  Retry-After: <seconds>
```

**Validation Rules:**
- `name`: required, 1-100 characters
- `slug`: required, 3-64 characters, regex `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` (lowercase alphanumeric, hyphens allowed between segments, no leading/trailing hyphens)
- `content`: required, non-empty, ≤ 62 KB (to fit within 64 KB middleware limit + JSON overhead)
- `visibility`: optional, defaults to `'public'`, must be `'public'` or `'private'`
- `description`: optional, defaults to `''`
- Rate limit: 30 uploads per hour per IP (new limit key: `SCRIPT_UPLOAD`)

#### `GET /api/scripts` — List Scripts

```
Request:
  GET /api/scripts?visibility=public&published=true&limit=20&offset=0

Success (200):
  {
    "success": true,
    "scripts": [
      {
        "id": "uuid",
        "name": "BloxAtlas",
        "slug": "bloxatlas",
        "description": "...",
        "visibility": "public",
        "is_published": true,
        "created_at": "...",
        "updated_at": "..."
      }
    ],
    "total": 42,
    "limit": 20,
    "offset": 0
  }
```

**Query Parameters:**
- `visibility`: filter by `'public'` or `'private'` (default: `'public'`)
- `published`: filter by `is_published` (default: `true`)
- `limit`: max results (default: 20, max: 100)
- `offset`: pagination offset (default: 0)

**Note:** The `content` field is omitted from list responses to reduce payload size.

#### `GET /api/scripts/[slug]` — Get Script Metadata

```
Request:
  GET /api/scripts/bloxatlas

Success (200) — public script:
  {
    "success": true,
    "script": {
      "id": "uuid",
      "name": "BloxAtlas",
      "slug": "bloxatlas",
      "description": "...",
      "visibility": "public",
      "is_published": true,
      "created_at": "...",
      "updated_at": "..."
    }
  }

Success (200) — private script with Bearer auth:
  Same as above, includes "content" field.

Error (404):
  { "success": false, "message": "Script not found" }
```

**Note:** `content` is only included when the request includes a valid `Authorization: Bearer <ADMIN_API_KEY>` header, or when the script is public (for the `/raw` endpoint, content is always returned — see below).

Actually, reconsidering: For CDN MVP, the metadata endpoint should NOT return content. Content lives exclusively on the `/raw` endpoint. This prevents accidental content exposure.

#### `PATCH /api/scripts/[slug]` — Update Script

```
Request:
  Authorization: Bearer <ADMIN_API_KEY>
  Content-Type: application/json

  {
    "name": "BloxAtlas v2",
    "description": "Updated description",
    "content": "loadstring(game:HttpGet('...'))()",  // triggers version archive
    "visibility": "public"
  }

Success (200):
  {
    "success": true,
    "script": {
      "id": "uuid",
      "name": "BloxAtlas v2",
      "slug": "bloxatlas",
      ...
      "updated_at": "2026-06-07T..."
    }
  }
```

**Behavior:**
- If `content` is provided and differs from current content, the OLD content is archived to `script_versions` before the update.
- All fields are optional — only provided fields are updated.
- `slug` cannot be changed (it's the permanent identity).
- Updating `visibility` to `'private'` on a published script automatically unpublishes it.

#### `DELETE /api/scripts/[slug]` — Delete Script

```
Request:
  Authorization: Bearer <ADMIN_API_KEY>
  DELETE /api/scripts/bloxatlas

Success (200):
  { "success": true, "message": "Script deleted" }

Error (404):
  { "success": false, "message": "Script not found" }
```

**Cascade:** Deleting a script removes all associated `script_versions` and `script_downloads` rows.

#### `POST /api/scripts/[slug]/publish` — Toggle Publish

```
Request:
  Authorization: Bearer <ADMIN_API_KEY>
  POST /api/scripts/bloxatlas/publish
  Content-Type: application/json

  {
    "publish": true
  }

Success (200):
  {
    "success": true,
    "script": {
      ...
      "is_published": true
    }
  }
```

**Constraints:**
- Private scripts (`visibility = 'private'`) cannot be published. Returns 400.
- `publish: false` unpublishes. Effectively sets `is_published = false`.

#### `GET /api/scripts/[slug]/raw` — Raw Content Endpoint

This is the critical endpoint — it replaces GitHub Raw.

```
Request:
  GET /api/scripts/bloxatlas/raw

Success (200):
  Content-Type: text/plain; charset=utf-8
  Cache-Control: public, max-age=300, s-maxage=3600

  <raw script content>

Error (404):
  { "success": false, "message": "Script not found" }
  Content-Type: application/json

Error (403):
  { "success": false, "message": "This script is private" }
  Content-Type: application/json
```

**Key Differences from Other Endpoints:**
1. Response body is **plain text** (`Content-Type: text/plain`), NOT JSON
2. Error responses remain JSON (for client compatibility)
3. **`Cache-Control` header** enables CDN/browser caching. Public scripts are cached for 5 minutes (browser) / 1 hour (shared cache). Private scripts are NOT cached (`Cache-Control: no-store`).
4. Rate limit: **100 requests per minute per IP** (higher than validate API since this replaces GitHub Raw which had no rate limits)
5. Downloads are tracked asynchronously (fire-and-forget insert to `script_downloads`)

**Private Script Behavior:**
- When `visibility = 'private'`, the raw endpoint returns 403 unless the request includes `Authorization: Bearer <ADMIN_API_KEY>`
- This enables private script distribution to authorized consumers in future phases

**Content Delivery Flow:**
```
Roblox Executor
  │
  ▼
GET /api/scripts/bloxatlas/raw
  │
  ▼
Middleware: Security headers, CORS, body limits
  │
  ▼
Rate limiter: checkRateLimit(ip, 'SCRIPT_RAW') — 100/min
  │
  ▼
Route handler:
  1. Look up script by slug
  2. Check visibility (public or bearer auth)
  3. Check is_published (must be published, or bearer auth)
  4. Fire-and-forget: insert into script_downloads
  5. Return content as text/plain
```

#### `GET /api/scripts/[slug]/stats` — Analytics

```
Request:
  GET /api/scripts/bloxatlas/stats

Success (200):
  {
    "success": true,
    "stats": {
      "slug": "bloxatlas",
      "total_downloads": 1523,
      "unique_ips": 847,
      "downloads_today": 42,
      "downloads_this_week": 287,
      "last_downloaded_at": "2026-06-07T18:30:00.000Z"
    }
  }
```

**Implementation:**
```sql
-- total_downloads
SELECT COUNT(*) FROM script_downloads WHERE script_id = $1;

-- unique_ips
SELECT COUNT(DISTINCT ip) FROM script_downloads WHERE script_id = $1;

-- downloads_today
SELECT COUNT(*) FROM script_downloads
WHERE script_id = $1 AND downloaded_at >= CURRENT_DATE;

-- downloads_this_week
SELECT COUNT(*) FROM script_downloads
WHERE script_id = $1 AND downloaded_at >= date_trunc('week', NOW());

-- last_downloaded_at
SELECT MAX(downloaded_at) FROM script_downloads WHERE script_id = $1;
```

No authentication required (public stats for public scripts).

---

## 6. Security Model

### 6.1 Access Matrix

| Operation | Public | Bearer Auth | Notes |
|-----------|--------|-------------|-------|
| List scripts (directory) | ✅ Published only | ✅ All | Paginated, no content |
| Get metadata | ✅ Public only | ✅ All | Content never returned |
| Get raw content | ✅ Published + public | ✅ All | text/plain response |
| Get stats | ✅ Public only | ✅ All | Public analytics |
| Upload script | ❌ | ✅ | Rate limited: 30/hour |
| Update script | ❌ | ✅ | Version archiving on content change |
| Delete script | ❌ | ✅ | Cascade deletes |
| Toggle publish | ❌ | ✅ | Private scripts cannot be published |
| Access private scripts | ❌ | ✅ | All endpoints |

### 6.2 Rate Limit Configuration

| Limit Key | Window | Max | Description |
|-----------|--------|-----|-------------|
| `SCRIPT_UPLOAD` | 3600s (1 hour) | 30 | Upload/create scripts |
| `SCRIPT_UPDATE` | 3600s (1 hour) | 60 | Update scripts |
| `SCRIPT_LIST` | 60s | 30 | List/directory endpoint |
| `SCRIPT_GET` | 60s | 60 | Get metadata endpoint |
| `SCRIPT_RAW` | 60s | 100 | Raw content delivery |
| `SCRIPT_STATS` | 60s | 30 | Analytics endpoint |

### 6.3 Schema Snippet for Rate Limiter

Added to `WINDOW_MS` and `MAX_REQUESTS` in `rate-limit-repository.ts`:

```typescript
const WINDOW_MS: Record<string, number> = {
  // ... existing entries ...
  SCRIPT_UPLOAD: 3_600_000,
  SCRIPT_UPDATE: 3_600_000,
  SCRIPT_LIST: 60_000,
  SCRIPT_GET: 60_000,
  SCRIPT_RAW: 60_000,
  SCRIPT_STATS: 60_000,
}

const MAX_REQUESTS: Record<string, number> = {
  // ... existing entries ...
  SCRIPT_UPLOAD: 30,
  SCRIPT_UPDATE: 60,
  SCRIPT_LIST: 30,
  SCRIPT_GET: 60,
  SCRIPT_RAW: 100,
  SCRIPT_STATS: 30,
}
```

### 6.4 Slug Validation

```
Regex: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
Min length: 3
Max length: 64

Valid:   "bloxatlas", "my-script", "esp-v2"
Invalid: "BLOXATLAS" (uppercase), "-myscript" (leading hyphen),
         "myscript-" (trailing hyphen), "my--script" (double hyphen),
         "a" (too short)
```

Slugs are URL-safe and SEO-friendly. They serve as the permanent public identity of a script.

### 6.5 Admin Auth Verification

```typescript
function verifyAdminAuth(request: NextRequest): boolean {
  const adminKey = process.env.ADMIN_API_KEY || process.env.CRON_SECRET
  if (!adminKey) return false
  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${adminKey}`
}
```

This mirrors the `CRON_SECRET` auth pattern in `/api/cleanup/route.ts` exactly.

---

## 7. Analytics Strategy

### 7.1 Data Collection

Every raw endpoint request fires a background insert to `script_downloads`:

```
Raw Endpoint Request
  │
  ▼
Lookup script by slug
  │
  ▼
Check visibility + auth
  │
  ▼
Fire-and-forget: insert into script_downloads (script_id, ip, user_agent)
  │ (non-blocking — does not delay the response)
  ▼
Return content as text/plain
```

Implementation pattern (mirrors `logEvent` in `logger.ts`):

```typescript
// In raw endpoint route handler:
trackDownload(scriptId, clientIP, userAgent).then(
  () => {},
  () => {}  // silent failure — analytics must never block delivery
)

async function trackDownload(scriptId: string, ip: string, userAgent: string | null) {
  await supabaseAdmin
    .from('script_downloads')
    .insert({ script_id: scriptId, ip, user_agent: userAgent })
}
```

### 7.2 Query Patterns

**Total downloads per script:**
```sql
SELECT COUNT(*) FROM script_downloads WHERE script_id = $1;
```

**Unique IPs (unique visitors):**
```sql
SELECT COUNT(DISTINCT ip) FROM script_downloads WHERE script_id = $1;
```

**Download trend (last 30 days):**
```sql
SELECT DATE(downloaded_at) as date, COUNT(*) as downloads
FROM script_downloads
WHERE script_id = $1 AND downloaded_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(downloaded_at)
ORDER BY date;
```

**Top scripts by downloads:**
```sql
SELECT s.slug, s.name, COUNT(*) as downloads
FROM script_downloads d
JOIN scripts s ON s.id = d.script_id
WHERE d.downloaded_at >= NOW() - INTERVAL '7 days'
GROUP BY s.slug, s.name
ORDER BY downloads DESC
LIMIT 10;
```

### 7.3 Data Retention

`script_downloads` rows are kept for analytics. The existing cleanup cron (`/api/cleanup`) should be extended to purge old download records:

```
Phase: Add to cleanup cron
Action: DELETE FROM script_downloads WHERE downloaded_at < NOW() - INTERVAL '90 days'
Limit: 10000 rows per run
```

---

## 8. File Structure

```
app/
├── api/
│   ├── health/          [EXISTING — UNCHANGED]
│   ├── validate/        [EXISTING — UNCHANGED]
│   ├── generate-key/    [EXISTING — UNCHANGED]
│   ├── verify-workink/  [EXISTING — UNCHANGED]
│   ├── cleanup/         [EXISTING — UNCHANGED]
│   └── scripts/
│       ├── route.ts                   → GET (list), POST (create)
│       └── [slug]/
│           ├── route.ts               → GET (metadata), PATCH (update), DELETE (delete)
│           ├── raw/
│           │   └── route.ts           → GET (raw content)
│           ├── stats/
│           │   └── route.ts           → GET (analytics)
│           └── publish/
│               └── route.ts           → POST (toggle publish)
│
├── lib/
│   ├── supabase.ts                    [EXISTING — UNCHANGED]
│   ├── rate-limiter.ts                [MODIFIED — add new limit keys]
│   ├── logger.ts                      [MODIFIED — add CDN log events]
│   ├── validators.ts                  [MODIFIED — add slug/content validators]
│   ├── key-generator.ts              [EXISTING — UNCHANGED]
│   ├── session-generator.ts          [EXISTING — UNCHANGED]
│   ├── repositories/
│   │   ├── key-repository.ts         [EXISTING — UNCHANGED]
│   │   ├── token-repository.ts       [EXISTING — UNCHANGED]
│   │   ├── rate-limit-repository.ts  [MODIFIED — add limit configs]
│   │   └── script-repository.ts      [NEW]
│   └── services/
│       ├── key-service.ts            [EXISTING — UNCHANGED]
│       ├── workink-service.ts        [EXISTING — UNCHANGED]
│       ├── security-service.ts       [EXISTING — UNCHANGED]
│       └── script-service.ts         [NEW]
│
├── middleware.ts                      [EXISTING — UNCHANGED]

migrations/
├── 001_enable_rls.sql                [EXISTING — UNCHANGED]
├── 001_enable_rls_rollback.sql       [EXISTING — UNCHANGED]
├── 002_cdn_tables.sql                [NEW]
└── 002_cdn_tables_rollback.sql       [NEW]

schema.sql                             [MODIFIED — append CDN tables]
```

### 8.1 Files Modified

| File | Change |
|------|--------|
| `schema.sql` | Append 3 new table definitions |
| `app/lib/rate-limiter.ts` | Re-export — no change needed (re-exports from rate-limit-repository) |
| `app/lib/repositories/rate-limit-repository.ts` | Add 6 new limit keys in `WINDOW_MS` and `MAX_REQUESTS` + add to `LimitKey` type |
| `app/lib/validators.ts` | Add `isValidSlug()`, `isValidVisibility()`, `isValidScriptContent()` |
| `app/lib/logger.ts` | Add new `LogEvent` union members: `SCRIPT_CREATED`, `SCRIPT_UPDATED`, `SCRIPT_DELETED`, `SCRIPT_DOWNLOADED` (optional — not critical for MVP) |
| `app/lib/repositories/rate-limit-repository.ts` | 6 new `WINDOW_MS` + `MAX_REQUESTS` entries |

### 8.2 Files Created

| File | Purpose |
|------|---------|
| `app/api/scripts/route.ts` | GET list + POST create |
| `app/api/scripts/[slug]/route.ts` | GET metadata + PATCH update + DELETE |
| `app/api/scripts/[slug]/raw/route.ts` | GET raw content |
| `app/api/scripts/[slug]/stats/route.ts` | GET analytics |
| `app/api/scripts/[slug]/publish/route.ts` | POST toggle publish |
| `app/lib/repositories/script-repository.ts` | Database access layer (findBySlug, insert, update, delete, countDownloads, etc.) |
| `app/lib/services/script-service.ts` | Business logic (archive version on update, slug validation, publish checks) |
| `migrations/002_cdn_tables.sql` | Create 3 tables + enable RLS |
| `migrations/002_cdn_tables_rollback.sql` | Drop RLS + drop tables |

---

## 9. Migration Path from GitHub Raw

### Current State
```
Roblox Executor
  │
  ▼
loadstring(game:HttpGet('https://raw.githubusercontent.com/user/repo/main/script.lua'))()
  │
  ▼
GitHub Raw serves content
```

### Target State (Phase 2)
```
Roblox Executor
  │
  ▼
loadstring(game:HttpGet('https://cdn.luxyhub.space/raw/bloxatlas'))()
  │
  ▼
LuxyHub CDN serves content
```

### Migration Steps (for script authors)
1. Upload script to LuxyHub CDN (`POST /api/scripts`)
2. Verify raw endpoint works (`GET /api/scripts/bloxatlas/raw`)
3. Update script loader URLs in scripts from `raw.githubusercontent.com/...` to `cdn.luxyhub.space/raw/...`
4. (Future Phase 3) Self-service via Creator Dashboard

### Domain Architecture (Phase 2 MVP)

Since Phase 2 MVP runs on the same Vercel deployment (before DNS subdomain split):

```
luxyhub.vercel.app/api/scripts/:slug/raw
```

In future phases when `cdn.luxyhub.space` is configured:
```
cdn.luxyhub.space/raw/:slug  →  proxies to  luxyhub.vercel.app/api/scripts/:slug/raw
```

The `/api/scripts/*` path prefix ensures no collision with existing routes and works immediately on the current deployment.

---

## 10. Compatibility Verification

### 10.1 No Existing API Conflicts

| Existing Route | CDN Route | Conflict? |
|----------------|-----------|-----------|
| `/api/health` | — | ✅ No |
| `/api/validate` | — | ✅ No |
| `/api/generate-key` | — | ✅ No |
| `/api/verify-workink` | — | ✅ No |
| `/api/cleanup` | — | ✅ No |
| — | `/api/scripts` | ✅ No |
| — | `/api/scripts/[slug]` | ✅ No |
| — | `/api/scripts/[slug]/raw` | ✅ No |
| — | `/api/scripts/[slug]/stats` | ✅ No |
| — | `/api/scripts/[slug]/publish` | ✅ No |

### 10.2 No Existing Database Conflicts

| Existing Table | CDN Table | Conflict? |
|----------------|-----------|-----------|
| `keys` | `scripts` | ✅ No — different names, no FK crossing |
| `used_workink_tokens` | `script_versions` | ✅ No |
| `rate_limits` | `script_downloads` | ✅ No |
| `verification_logs` | — | ✅ No |
| `key_usage` | — | ✅ No |

### 10.3 No Existing Library Conflicts

| Existing File | Change | Risk |
|---------------|--------|------|
| `rate-limit-repository.ts` | Add 6 entries to `WINDOW_MS`/`MAX_REQUESTS` | Low — additive only, existing entries unchanged |
| `validators.ts` | Add 3 new validation functions | Low — additive only |
| `logger.ts` | Add new LogEvent members | Low — additive, optional |
| `supabase.ts` | None | None |

### 10.4 Middleware Compatibility

The raw endpoint returns `text/plain` instead of `application/json`. The middleware:
- Adds CORS headers: ✅ Compatible — these are generic headers
- Adds security headers: ✅ Compatible — CSP/frame/HSTS apply to text responses without issue
- Body size check: ✅ Compatible — only applies to POST, raw endpoint is GET
- No modifications needed to middleware

---

## 11. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| **No user authentication system** — admin API key is a single shared secret | Medium | Phase 3 (Creator Dashboard) introduces proper auth. For MVP, admin key is sufficient for 1-2 creators. Rotate key quarterly. |
| **Script content > 64KB** — middleware blocks large payloads | Low | Document 62KB content limit (64KB minus JSON overhead). Lua scripts rarely exceed this. If needed, Phase 5 (Vault) introduces Supabase Storage with no middleware limit. |
| **`script_downloads` table growth** — high-traffic scripts generate many rows | Medium | Extend `/api/cleanup` to purge records older than 90 days. Table uses integer indexes for fast COUNT queries. |
| **Raw endpoint abuse** — script scraping, DDoS via script delivery | Medium | Rate limit 100/min per IP. Cloudflare WAF handles volumetric attacks. Future: Cloudflare cache absorbs repeated requests. |
| **Version archive infinite growth** — every content update creates a version row | Low | Limit 100 versions per script. Version content is text (small). Cleanup can purge versions older than 1 year. |
| **Centralized SPOF** — single Vercel deployment serves all scripts | Medium | Acceptable for MVP. Phase 5 (Vault) introduces signed URLs with edge caching. Cloudflare CDN in front reduces origin load. |
| **Breaking the Key System** — CDN implementation accidentally modifies key validation path | Critical | Zero changes to existing routes. New code in isolated files. Rate limiter additions are additive only. Build + lint + typecheck verify no regressions. |

---

## 12. Implementation Sequence

### Step 1: Database Migration
1. Create `migrations/002_cdn_tables.sql`
2. Create `migrations/002_cdn_tables_rollback.sql`
3. Append 3 tables to `schema.sql`
4. Run migration verification queries

### Step 2: Library Layer
1. Add validators: `isValidSlug()`, `isValidVisibility()`, `isValidScriptContent()`
2. Add rate limit configs: 6 new entries in `rate-limit-repository.ts`
3. Create `script-repository.ts`: `findBySlug()`, `findAll()`, `insertScript()`, `updateScript()`, `deleteScript()`, `countDownloads()`, `getStats()`, `insertVersion()`
4. Create `script-service.ts`: `createScript()`, `updateScript()`, `deleteScript()`, `togglePublish()`, `getRawContent()`, `getStats()`

### Step 3: API Routes
1. `POST /api/scripts` + `GET /api/scripts`
2. `GET /api/scripts/[slug]` + `PATCH /api/scripts/[slug]` + `DELETE /api/scripts/[slug]`
3. `POST /api/scripts/[slug]/publish`
4. `GET /api/scripts/[slug]/raw`
5. `GET /api/scripts/[slug]/stats`

### Step 4: Cleanup Integration
1. Extend `/api/cleanup` to purge old `script_downloads`

### Step 5: Verification
1. `npm run lint`
2. `npx tsc --noEmit`
3. `npm run build`
4. Regression: verify all existing API routes still work
5. Migration: verify tables created and RLS enabled
6. Functional: upload script → get raw → verify content → verify stats

---

## 13. Conclusion

**Decision: APPROVED for implementation.**

The CDN architecture:
- Uses existing patterns (service-role DB, RLS deny-all, INSERT-first rate limiting)
- Adds zero modifications to existing API routes
- Creates isolated new code that cannot break the Key System
- Stores scripts inline in PostgreSQL (adequate for Lua scripts)
- Tracks analytics via fire-and-forget inserts
- Provides a clear migration path from GitHub Raw
- Architects for future phases (version table created now, features in Phase 4)

**Next Action:** Begin Step 1 — Database Migration.
