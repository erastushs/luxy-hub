# LuxyHub CDN — Architecture Review

Date: 2026-06-07
Status: Phase 2 historical planning document — superseded by `../../architecture/ARCHITECTURE.md` and `../integration/API_SPEC.md`
Phase: 1.5 (Complete) → 2A (IN PROGRESS)

---

> Current implementation note (2026-06-08): this document preserves the Phase 2 CDN plan. The live system now uses Supabase session authentication for creator write APIs, owner-scoped service checks, Cloudflare Turnstile login protection, failed-login rate limiting, secure delivery builds, and one-time delivery sessions. Use `../../architecture/ARCHITECTURE.md`, `../integration/API_SPEC.md`, and `../../deployment/DEPLOYMENT_CHECKLIST.md` for current deployment and security behavior.

## 1. Executive Summary

This document defines the complete architecture for the LuxyHub CDN MVP (Phase 2). Every design decision is derived from an audit of the existing codebase and must preserve all existing functionality.

### Revision History

| Date | Change | Reason |
|------|--------|--------|
| 2026-06-07 v1 | Initial architecture | Phase 1.5 review |
| 2026-06-07 v2 | `visibility TEXT` replaces `is_published BOOLEAN`; add `creator_id`, `current_version_id`; hash IP/UA for PII protection | Phase 3 readiness, Vault/Marketplace compatibility |

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

**Rationale:** Roblox Lua scripts are small text files (rarely exceed 100KB). PostgreSQL's `text` type handles up to ~1GB per field. Inline storage keeps the MVP simple with zero new infrastructure. The middleware already enforces a 64KB body limit on POST routes, which aligns with expected script sizes.

---

## 3. Database Schema (FINAL)

### 3.1 Entity Relationship Diagram

```
┌──────────────────────┐
│       scripts        │
│──────────────────────│
│ id                PK │──┐
│ slug            UNIQ │  │        ┌──────────────────────────┐
│ name                 │  │        │    script_versions       │
│ description          │  │        │──────────────────────────│
│ visibility    CHECK  │  │    ┌──│ script_id      FK ────────│──┐
│  ('public',          │  │    │  │ version             UNIQ(per│  │
│   'private',         │  │    │  │ content                  script)
│   'unlisted')        │  │    │  │ changelog                │  │
│ creator_id     NULL  │  │    │  │ created_at               │  │
│ current_version_id ──│──┼────│──│──────────────────────────│  │
│ created_at           │  │    │                              │  │
│ updated_at           │  │    │                              │  │
└──────────────────────┘  │    └──────────────────────────────┘  │
        │                 │                                       │
        │                 │    ┌──────────────────────────┐       │
        │                 │    │    script_downloads      │       │
        │                 │    │──────────────────────────│       │
        └─────────────────│────│ script_id      FK ───────│───────┘
                          │    │ version_id     FK ───────│───────(nullable)
                          │    │ ip_hash                  │
                          │    │ user_agent_hash          │
                          │    │ created_at               │
                          │    └──────────────────────────┘
                          │
                          ▼
                   ON DELETE CASCADE:     ON DELETE SET NULL:
                   scripts → versions     downloads → versions
                   scripts → downloads    scripts → versions (current_version_id)
```

### 3.2 Table: `scripts`

Core script metadata. Ownership and version tracking built in from day one.

```sql
CREATE TABLE IF NOT EXISTS scripts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text DEFAULT '',
  visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('public', 'private', 'unlisted')),
  creator_id uuid,
  current_version_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scripts_slug ON scripts (slug);
CREATE INDEX IF NOT EXISTS idx_scripts_visibility ON scripts (visibility);
CREATE INDEX IF NOT EXISTS idx_scripts_creator_id ON scripts (creator_id);
```

| Column | Type | Constraint | Purpose |
|--------|------|-----------|---------|
| `id` | `uuid` | PK, `gen_random_uuid()` | Internal identifier |
| `slug` | `text` | NOT NULL, UNIQUE | URL-safe identifier (e.g. `bloxatlas`) |
| `name` | `text` | NOT NULL | Human-readable display name |
| `description` | `text` | DEFAULT `''` | Short description for script directory |
| `visibility` | `text` | NOT NULL, CHECK | Access model — `public`, `private`, or `unlisted` |
| `creator_id` | `uuid` | nullable | Foreign key to future `users` table (Phase 3). NULL = unclaimed/legacy scripts |
| `current_version_id` | `uuid` | nullable | FK to `script_versions(id)`. Points to the currently active version. NULL until first version is created. Will be SET NULL on version delete. |
| `created_at` | `timestamptz` | DEFAULT `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | DEFAULT `now()` | Last update timestamp |

**Visibility Model:**
| Value | Raw Endpoint | Directory Listing | Purpose |
|-------|-------------|-------------------|---------|
| `public` | ✅ Anyone | ✅ Listed | Free public scripts — the CDN default |
| `private` | ❌ Auth required | ❌ Not listed | Premium scripts, creator-private scripts — Vault-ready |
| `unlisted` | ✅ Anyone (no auth) | ❌ Not listed | "Secret" public scripts — share via direct link, invisible in directory |

**`creator_id` Strategy:**
- Phase 2 MVP: `NULL` — no auth system exists. `ADMIN_API_KEY` authorizes all operations.
- Phase 3: Populated via Creator Dashboard — `auth.users(id)` on Supabase.
- Migration risk: None. Adding the column now avoids a costly `ALTER TABLE` later.
- Index already created: `idx_scripts_creator_id` — enables efficient dashboard queries.

**`current_version_id` Strategy:**
- Points to the active version in `script_versions`.
- When a script is updated, a new version row is created and `current_version_id` is updated.
- Raw endpoint serves content from the version pointed to by `current_version_id`.
- Foreign key uses `ON DELETE SET NULL` — if a version is deleted, pointer becomes NULL (script has no active version).
- The FK to `script_versions` must be created via `ALTER TABLE` after `script_versions` table exists.

### 3.3 Table: `script_versions`

Immutable version history. Every content update creates a new row.

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
| `changelog` | `text` | nullable | Release notes (markdown) |
| `created_at` | `timestamptz` | DEFAULT `now()` | Version creation time |

**Design Notes:**
- `ON DELETE CASCADE` — deleting a script removes all its versions.
- `UNIQUE(script_id, version)` — prevents duplicate version numbers for the same script.
- Auto-versioning: First upload creates `1.0.0`. Subsequent content changes auto-increment (Phase 4).
- Phase 2 MVP: Versions are created as a side effect of uploading/updating. The raw endpoint serves `current_version_id` content.
- **After creating this table, the foreign key on `scripts.current_version_id` is added via ALTER TABLE:**
  ```sql
  ALTER TABLE scripts
    ADD CONSTRAINT fk_scripts_current_version
    FOREIGN KEY (current_version_id) REFERENCES script_versions(id)
    ON DELETE SET NULL;
  ```

### 3.4 Table: `script_downloads`

Analytics tracking. **No PII storage — hashed identifiers only.**

```sql
CREATE TABLE IF NOT EXISTS script_downloads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  script_id uuid NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  version_id uuid REFERENCES script_versions(id) ON DELETE SET NULL,
  ip_hash text NOT NULL,
  user_agent_hash text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_script_downloads_script_id
  ON script_downloads (script_id);
CREATE INDEX IF NOT EXISTS idx_script_downloads_created_at
  ON script_downloads (created_at);
CREATE INDEX IF NOT EXISTS idx_script_downloads_script_time
  ON script_downloads (script_id, created_at);
```

| Column | Type | Constraint | Purpose |
|--------|------|-----------|---------|
| `id` | `uuid` | PK | Log entry |
| `script_id` | `uuid` | FK → `scripts(id)`, CASCADE | Which script was downloaded |
| `version_id` | `uuid` | FK → `script_versions(id)`, SET NULL | Which version (nullable — survives version deletion) |
| `ip_hash` | `text` | NOT NULL | SHA-256 hash of client IP (unique visitor counting without storing raw IP) |
| `user_agent_hash` | `text` | nullable | SHA-256 hash of User-Agent (platform stats without storing raw UA strings) |
| `created_at` | `timestamptz` | DEFAULT `now()` | Download timestamp |

**PII Protection Strategy:**
- `ip_hash` = `SHA-256(client_ip + PEPPER)` where PEPPER is a server-side secret rotation key
- `user_agent_hash` = `SHA-256(user_agent + PEPPER)` 
- The pepper ensures hashes cannot be reversed via rainbow tables (SHA-256 alone is reversible for IPs)
- `ANALYTICS_PEPPER` is a new environment variable (rotatable, not committed)
- If `ANALYTICS_PEPPER` is not set, fall back to `CRON_SECRET`
- Unique visitor counting: `COUNT(DISTINCT ip_hash)` — same IP always produces same hash (until pepper rotation)
- **Note:** This is stricter than existing tables (`rate_limits`, `verification_logs` store raw IPs). Those are operational tables needed for abuse detection. `script_downloads` is pure analytics.

**Design Notes:**
- `ON DELETE SET NULL` for `version_id` — if a version is deleted, download records survive with null version
- `ON DELETE CASCADE` for `script_id` — if a script is deleted, its download history is purged
- User agent is nullable — some download clients (Roblox executors) may not send User-Agent headers

### 3.5 Schema Summary

```text
scripts ──1:N── script_versions
   │              ▲
   │              │ (current_version_id FK)
   │              │
   └──1:N── script_downloads
              │
              └──?── script_versions (nullable FK)
```

Total new tables: 3
Total new indexes: 8 (including `idx_scripts_creator_id` and `idx_scripts_visibility`)

---

## 4. RLS Policy Design

### 4.1 Migration Pattern (Identical to Existing)

```sql
ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scripts_deny_all ON scripts;
CREATE POLICY scripts_deny_all
  ON scripts
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

ALTER TABLE script_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS script_versions_deny_all ON script_versions;
CREATE POLICY script_versions_deny_all
  ON script_versions
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

ALTER TABLE script_downloads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS script_downloads_deny_all ON script_downloads;
CREATE POLICY script_downloads_deny_all
  ON script_downloads
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
```

All queries go through `supabaseAdmin` (service role). Anon/authenticated users are denied at the RLS level. This is the identical pattern used by all existing tables.

### 4.2 Migration Files

| File | Purpose |
|------|---------|
| `migrations/002_cdn_tables.sql` | Create 3 tables, indexes, constraints, RLS |
| `migrations/002_cdn_tables_rollback.sql` | Drop RLS policies, drop tables |

---

## 5. Authentication Strategy

### 5.1 Phase 2 MVP (Historical)

**`ADMIN_API_KEY`** — a single shared secret for all administrative operations.

```
Header: Authorization: Bearer <ADMIN_API_KEY>
Historical env var: ADMIN_API_KEY
```

Current implementation: `ADMIN_API_KEY` does not fall back to `CRON_SECRET`. Cron secrets are accepted only by `/api/cleanup`.

**⚠️ TEMPORARY — THIS IS NOT THE FINAL AUTH MODEL.**

This strategy is acceptable for Phase 2 because:
- 1-2 creators manually upload scripts
- No end-user accounts exist yet
- Dashboard authentication does not exist yet

**Limitations:**
- No audit trail per creator (all operations from same identity)
- No creator ownership validation
- No self-service script management
- Key rotation requires redeployment

### 5.2 Phase 3 Migration Path (Future)

| Phase 2 MVP | Phase 3 |
|-------------|---------|
| `ADMIN_API_KEY` → all operations | Session-based JWT from Supabase Auth |
| `creator_id = NULL` | `creator_id = auth.uid()` on create |
| No permission checks | RLS policies: `USING (creator_id = auth.uid())` for `authenticated` |
| Single admin key | Per-user API keys with scopes |
| `scripts` RLS: deny all + service role only | `scripts` RLS: `authenticated` can SELECT own scripts, `service_role` for admin ops |

**Migration Steps (Phase 3 implementation):**
1. Create `users` table synced with `auth.users`
2. Add `creator_id` foreign key to `scripts`: `ALTER TABLE scripts ADD CONSTRAINT fk_scripts_creator FOREIGN KEY (creator_id) REFERENCES auth.users(id)`
3. Update RLS policies on `scripts`:
   ```sql
   DROP POLICY IF EXISTS scripts_select_own ON scripts;
   CREATE POLICY scripts_select_own ON scripts
     FOR SELECT TO authenticated
     USING (creator_id = auth.uid());

   DROP POLICY IF EXISTS scripts_modify_own ON scripts;
   CREATE POLICY scripts_modify_own ON scripts
     FOR INSERT, UPDATE, DELETE TO authenticated
     USING (creator_id = auth.uid())
     WITH CHECK (creator_id = auth.uid());
   ```
4. Replace `verifyAdminAuth()` with `verifySessionAuth()` using Supabase `getUser()`
5. Deprecate `ADMIN_API_KEY` — keep as fallback for service role operations (cleanup, migrations)

**Database compatibility:** Zero schema changes required. `creator_id` already exists as `UUID NULL`. The FK constraint is additive — it doesn't break existing data.

---

## 6. API Contract (Unchanged from v1)

### 6.1 Route Map

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/scripts` | Bearer | Upload (create) a new script |
| `GET` | `/api/scripts` | None | List public scripts |
| `GET` | `/api/scripts/[slug]` | None/Bearer | Get script metadata |
| `PATCH` | `/api/scripts/[slug]` | Bearer | Update script name/description/content/visibility |
| `DELETE` | `/api/scripts/[slug]` | Bearer | Delete script and all versions/downloads |
| `POST` | `/api/scripts/[slug]/publish` | Bearer | Change visibility |
| `GET` | `/api/scripts/[slug]/raw` | None/Bearer | Get raw script content (text/plain) |
| `GET` | `/api/scripts/[slug]/stats` | None | Get download analytics |

### 6.2 Visibility-Based Access Matrix

| Operation | `public` | `private` | `unlisted` |
|-----------|----------|-----------|------------|
| List in directory | ✅ | ❌ | ❌ |
| Raw endpoint (no auth) | ✅ | ❌ 403 | ✅ |
| Raw endpoint (auth) | ✅ | ✅ | ✅ |
| Stats endpoint | ✅ | ❌ 404 | ✅ |
| Metadata endpoint | ✅ | ❌ 404 | ✅ |

### 6.3 Publish Endpoint Update

With the visibility model, the "publish" endpoint becomes a visibility changer:

```
POST /api/scripts/[slug]/publish
Authorization: Bearer <ADMIN_API_KEY>
Content-Type: application/json

{ "visibility": "public" }
```

Valid transitions:
- `private` → `public`
- `private` → `unlisted`  
- `public` → `private`
- `public` → `unlisted`
- `unlisted` → `public`
- `unlisted` → `private`

---

## 7. Security Model (Updated)

### 7.1 Access Matrix

| Operation | No Auth | Bearer Auth | Notes |
|-----------|---------|-------------|-------|
| List scripts | ✅ Public only | ✅ All | Paginated, no content |
| Get metadata | ✅ Public/unlisted only | ✅ All | Content never returned |
| Get raw content | ✅ Public/unlisted | ✅ All | text/plain response |
| Get stats | ✅ Public/unlisted only | ✅ All | Public analytics |
| Upload script | ❌ | ✅ | Rate limited: 30/hour |
| Update script | ❌ | ✅ | Version archiving on content change |
| Delete script | ❌ | ✅ | Cascade deletes |
| Change visibility | ❌ | ✅ | Any visibility ↔ any visibility |
| Access private scripts | ❌ | ✅ | All endpoints |

### 7.2 Rate Limit Configuration

| Limit Key | Window | Max | Description |
|-----------|--------|-----|-------------|
| `SCRIPT_UPLOAD` | 3600s (1 hour) | 30 | Upload/create scripts |
| `SCRIPT_UPDATE` | 3600s (1 hour) | 60 | Update scripts |
| `SCRIPT_LIST` | 60s | 30 | List/directory endpoint |
| `SCRIPT_GET` | 60s | 60 | Get metadata endpoint |
| `SCRIPT_RAW` | 60s | 100 | Raw content delivery |
| `SCRIPT_STATS` | 60s | 30 | Analytics endpoint |

---

## 8. Analytics Strategy (Updated for PII)

### 8.1 PII Protection

```
downloadRawContent()
   │
   ▼
ip_hash = SHA-256(clientIP + ANALYTICS_PEPPER)
ua_hash = userAgent ? SHA-256(userAgent + ANALYTICS_PEPPER) : null
   │
   ▼
supabaseAdmin.from('script_downloads').insert({
  script_id, version_id, ip_hash, user_agent_hash
})
   │
   ▼
Fire-and-forget (non-blocking)
```

### 8.2 Query Patterns

```sql
-- Total downloads
SELECT COUNT(*) FROM script_downloads WHERE script_id = $1;

-- Unique visitors (same IP always produces same hash)
SELECT COUNT(DISTINCT ip_hash) FROM script_downloads WHERE script_id = $1;

-- Download trend (30 days)
SELECT DATE(created_at) as date, COUNT(*) as downloads
FROM script_downloads
WHERE script_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date;

-- Top user agents (hashed — compare against known hashes offline)
SELECT user_agent_hash, COUNT(*) as count
FROM script_downloads
WHERE script_id = $1
GROUP BY user_agent_hash
ORDER BY count DESC
LIMIT 5;
```

### 8.3 Data Retention

Extend `/api/cleanup` to purge old download records:

```sql
DELETE FROM script_downloads WHERE created_at < NOW() - INTERVAL '90 days';
-- Limit 10000 per run
```

### 8.4 Pepper Rotation

When `ANALYTICS_PEPPER` is rotated:
- Historical hashes become non-matchable
- New hashes use the new pepper
- Unique visitor metrics reset on rotation day
- Rotation frequency: quarterly or on security incident
- Documented in `../../operations/INCIDENT_RESPONSE.md` Section 7.3 for CRON_SECRET rotation (same process)

---

## 9. File Structure

```
app/
├── api/
│   ├── health/          [EXISTING — UNCHANGED]
│   ├── validate/        [EXISTING — UNCHANGED]
│   ├── generate-key/    [EXISTING — UNCHANGED]
│   ├── verify-workink/  [EXISTING — UNCHANGED]
│   ├── cleanup/         [EXISTING — UNCHANGED]
│   └── scripts/         [NEW — Phase 2B]
│       ├── route.ts               → GET (list), POST (create)
│       └── [slug]/
│           ├── route.ts           → GET (metadata), PATCH (update), DELETE (delete)
│           ├── raw/route.ts       → GET (raw content)
│           ├── stats/route.ts     → GET (analytics)
│           └── publish/route.ts   → POST (change visibility)
│
├── lib/
│   ├── supabase.ts                      [EXISTING — UNCHANGED]
│   ├── rate-limiter.ts                  [MODIFY — add limit keys]
│   ├── validators.ts                    [MODIFY — add slug/content/visibility validators]
│   ├── repositories/
│   │   ├── rate-limit-repository.ts     [MODIFY — add configs]
│   │   └── script-repository.ts         [NEW]
│   └── services/
│       └── script-service.ts            [NEW]

migrations/
├── 001_enable_rls.sql                   [EXISTING]
├── 001_enable_rls_rollback.sql          [EXISTING]
├── 002_cdn_tables.sql                   [NEW — Phase 2A]
└── 002_cdn_tables_rollback.sql          [NEW — Phase 2A]

schema.sql                                [MODIFY — append CDN tables]
```

### Files Modified
| File | Change | Risk |
|------|--------|------|
| `schema.sql` | Append 3 table definitions + FK constraint | Low |
| `app/lib/rate-limiter.ts` | Re-export — no code change needed | None |
| `app/lib/repositories/rate-limit-repository.ts` | Add 6 limit configs to `WINDOW_MS`/`MAX_REQUESTS` | Low — additive only |

### Files Created (Phase 2A)
| File | Purpose |
|------|---------|
| `migrations/002_cdn_tables.sql` | Create 3 tables, 8 indexes, RLS, FK constraint |
| `migrations/002_cdn_tables_rollback.sql` | Drop FK, RLS policies, indexes, tables |
| `../../architecture/CDN_DATABASE.md` | ER diagram, table docs, index strategy, RLS strategy |

### Files Created (Phase 2B — Future)
| File | Purpose |
|------|---------|
| `app/api/scripts/route.ts` | GET list + POST create |
| `app/api/scripts/[slug]/route.ts` | GET metadata + PATCH update + DELETE |
| `app/api/scripts/[slug]/raw/route.ts` | GET raw content |
| `app/api/scripts/[slug]/stats/route.ts` | GET analytics |
| `app/api/scripts/[slug]/publish/route.ts` | POST change visibility |
| `app/lib/repositories/script-repository.ts` | Database access layer |
| `app/lib/services/script-service.ts` | Business logic |

---

## 10. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| **No user auth** — `ADMIN_API_KEY` is shared secret | Medium | Temporary for Phase 2. Phase 3 introduces Supabase Auth + creator ownership. Documented migration path. |
| **Script content > 64KB** — middleware blocks large payloads | Low | Document 62KB content limit. Phase 5 (Vault) uses Supabase Storage (no middleware limit). |
| **`script_downloads` table growth** | Medium | Extend cleanup cron to purge > 90 days. Indexed for efficient COUNT queries. |
| **Raw endpoint abuse** — DDoS via script delivery | Medium | Rate limit 100/min per IP. Cloudflare WAF handles volumetric attacks. Future: edge caching. |
| **Version archive infinite growth** | Low | Limit 100 versions per script. Cleanup can purge > 1 year old versions. |
| **Pepper rotation breaks analytics continuity** | Low | Acceptable trade-off for PII protection. Unique visitor metrics reset quarterly. |
| **`current_version_id` orphaned** — version deleted, pointer null | Low | `ON DELETE SET NULL` prevents FK violation. Raw endpoint checks for null and falls back. |
| **Breaking the Key System** | Critical | Zero changes to existing routes. Build + lint + typecheck verify. |

---

## 11. Migration Path from GitHub Raw

### Current State
```
Roblox Executor
  ↓
loadstring(game:HttpGet('https://raw.githubusercontent.com/user/repo/main/script.lua'))()
```

### Target State (Phase 2)
```
Roblox Executor
  ↓
loadstring(game:HttpGet('https://luxyhub.vercel.app/api/scripts/bloxatlas/raw'))()
```

### Future State (cdn.luxyhub.space configured)
```
Roblox Executor
  ↓
loadstring(game:HttpGet('https://cdn.luxyhub.space/raw/bloxatlas'))()
```

---

## 12. Implementation Sequence

### Phase 2A — Database Foundation (CURRENT)
- [x] Architecture review (CDN_ARCHITECTURE.md v2)
- [ ] `migrations/002_cdn_tables.sql` — UP migration
- [ ] `migrations/002_cdn_tables_rollback.sql` — DOWN migration
- [ ] Update `schema.sql`
- [ ] `../../architecture/CDN_DATABASE.md` — database documentation
- [ ] Update `../../roadmap/TODO.md`

### Phase 2B — CDN API Implementation
- [ ] Add validators: `isValidSlug()`, `isValidVisibility()`, `isValidScriptContent()`
- [ ] Add rate limit configs: 6 entries
- [ ] Create `script-repository.ts`
- [ ] Create `script-service.ts`
- [ ] Create 5 API route files
- [ ] Extend `/api/cleanup` for `script_downloads`

### Phase 2C — Verification & Integration
- [ ] Lint, TypeScript, build verification
- [ ] Schema verification (tables exist, RLS enabled, indexes present)
- [ ] Functional testing (upload → raw → stats → cleanup)
- [ ] Update `../integration/API_SPEC.md` with CDN endpoints
