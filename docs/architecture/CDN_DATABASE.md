# LuxyHub CDN — Database Reference

Date: 2026-06-07
Phase: 2A — CDN Database Foundation
Status: IN PROGRESS

---

## 1. Entity Relationship Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                         scripts                              │
│──────────────────────────────────────────────────────────────│
│ PK  id                  uuid        gen_random_uuid()       │
│ UNI slug                text        NOT NULL                 │
│     name                text        NOT NULL                 │
│     description         text        DEFAULT ''               │
│ CHK visibility          text        'public'|'private'|     │
│                                      'unlisted'              │
│     creator_id          uuid        NULL  ──► (future users) │
│ FK  current_version_id  uuid        NULL  ──► version(id)    │
│     created_at          timestamptz DEFAULT now()            │
│     updated_at          timestamptz DEFAULT now()            │
│──────────────────────────────────────────────────────────────│
│ INDEXES: slug, visibility, creator_id                        │
│ RLS: deny_all ON anon, authenticated                         │
└────────────┬──────────────────────────┬─────────────────────┘
             │                          │
             │ 1:N                  1:N │
             │ ON DELETE CASCADE    ON DELETE CASCADE
             ▼                          ▼
┌─────────────────────────┐  ┌─────────────────────────────────┐
│    script_versions      │  │      script_downloads           │
│─────────────────────────│  │─────────────────────────────────│
│ PK  id        uuid      │  │ PK  id            uuid          │
│ FK  script_id uuid      │◄─│ FK  script_id     uuid          │
│     version   text      │  │ FK  version_id    uuid    NULL  │
│     content   text      │  │     ip_hash       text          │
│     changelog text NULL │  │     user_agent_hash text  NULL  │
│     created_at timestamptz│ │     created_at   timestamptz   │
│─────────────────────────│  │─────────────────────────────────│
│ UNIQUE: (script_id, version)│ INDEXES: script_id, created_at, │
│ INDEXES: script_id,        │          (script_id, created_at)│
│          (script_id,version)│ RLS: deny_all                   │
│ RLS: deny_all               └─────────────────────────────────┘
└─────────────────────────┘
             ▲
             │ ON DELETE SET NULL
             │ fk_scripts_current_version
             │
┌────────────┴─────────────────────────────────────────────────┐
│ scripts.current_version_id ──► script_versions(id)           │
│ When a version row is deleted, current_version_id → NULL     │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Table Descriptions

### 2.1 `scripts`

Central table for script metadata and ownership. One row per script.

| Column | Type | Default | Nullable | Purpose |
|--------|------|---------|----------|---------|
| `id` | `uuid` | `gen_random_uuid()` | No (PK) | Internal immutable identifier |
| `slug` | `text` | — | No (UNIQUE) | URL-safe public identity, e.g. `bloxatlas` |
| `name` | `text` | — | No | Human-readable display name |
| `description` | `text` | `''` | Yes | Short description — appears in directory cards |
| `visibility` | `text` | `'private'` | No (CHECK) | Access model: `public`, `private`, or `unlisted` |
| `creator_id` | `uuid` | — | Yes | Owner reference — NULL until Phase 3 (Creator Dashboard) |
| `current_version_id` | `uuid` | — | Yes | FK to active version. NULL until first upload. SET NULL on version delete. |
| `created_at` | `timestamptz` | `now()` | No | Creation timestamp |
| `updated_at` | `timestamptz` | `now()` | No | Last metadata update timestamp |

**Visibility Behavior:**
```text
public    → Raw endpoint serves content without auth, listed in directory
private   → Raw endpoint requires Bearer auth, NOT listed in directory
unlisted  → Raw endpoint serves without auth, NOT listed in directory (share via direct link)
```

**`creator_id` Phase Planning:**
- Phase 2A: Column exists, always NULL
- Phase 3: Populated via Creator Dashboard auth (Supabase `auth.users.id`)
- Phase 3: FK constraint added: `REFERENCES auth.users(id)`
- Phase 3: RLS policies updated: `USING (creator_id = auth.uid())` for `authenticated` role

**`updated_at` Management:**
- Updated explicitly in `PATCH /api/scripts/[slug]` handler
- No PostgreSQL trigger — explicit control ensures `updated_at` reflects only metadata changes, not version content updates

### 2.2 `script_versions`

Immutable append-only version history. Every content change creates a new row. The old content is preserved for rollback and version history.

| Column | Type | Default | Nullable | Purpose |
|--------|------|---------|----------|---------|
| `id` | `uuid` | `gen_random_uuid()` | No (PK) | Version identifier |
| `script_id` | `uuid` | — | No (FK) | Parent script — CASCADE delete |
| `version` | `text` | — | No (UNIQUE per script) | Semantic version string, e.g. `1.0.0` |
| `content` | `text` | — | No | Full script content at this version |
| `changelog` | `text` | — | Yes | Markdown release notes |
| `created_at` | `timestamptz` | `now()` | No | Version creation timestamp |

**Version Lifecycle:**
```
POST /api/scripts (new script)
  → Creates script row + script_versions row (version "1.0.0")
  → Sets scripts.current_version_id = new version.id

PATCH /api/scripts/bloxatlas { content: "<new>" }
  → Creates new script_versions row (version "1.0.1" or next)
  → Updates scripts.current_version_id = new version.id
  → Old version row remains as history

DELETE /api/scripts/bloxatlas
  → CASCADE deletes all script_versions rows
  → CASCADE deletes all script_downloads rows
```

**Phase 2 Behavior:** Auto-versioning only. First upload creates `1.0.0`. Subsequent content changes auto-increment the patch number (`1.0.1`, `1.0.2`, ...).

**Phase 4 Enhancement:** Full semantic versioning with `major.minor.patch`, manual version bumps, changelog editor, rollback support.

### 2.3 `script_downloads`

Analytics table tracking every raw endpoint request. **No Personally Identifiable Information (PII) is stored — all identifiers are SHA-256 hashed with a secret pepper.**

| Column | Type | Default | Nullable | Purpose |
|--------|------|---------|----------|---------|
| `id` | `uuid` | `gen_random_uuid()` | No (PK) | Log entry |
| `script_id` | `uuid` | — | No (FK) | Which script — CASCADE delete |
| `version_id` | `uuid` | — | Yes (FK) | Which version — SET NULL on delete |
| `ip_hash` | `text` | — | No | SHA-256(client_ip + ANALYTICS_PEPPER) |
| `user_agent_hash` | `text` | — | Yes | SHA-256(user_agent + ANALYTICS_PEPPER) or NULL |
| `created_at` | `timestamptz` | `now()` | No | Download timestamp |

**PII Protection Details:**
- `ip_hash` = `SHA256(trimmed_ip + ":" + ANALYTICS_PEPPER)`
- `user_agent_hash` = `SHA256(user_agent + ":" + ANALYTICS_PEPPER)` if UA present, NULL otherwise
- `ANALYTICS_PEPPER` is a server-side environment variable — never stored in the database
- Fallback: if `ANALYTICS_PEPPER` not set, fall back to `CRON_SECRET`
- Same IP + same pepper = same hash → enables `COUNT(DISTINCT ip_hash)` for unique visitors
- Rainbow table resistance: SHA-256 alone is reversible for IPv4 (2^32 → 2.3 min). Adding a secret pepper makes precomputation infeasible.

**Insertion Pattern (fire-and-forget):**
```typescript
// Non-blocking — never delays script delivery
trackDownload({ script_id, version_id, ip_hash, user_agent_hash }).then(
  () => {},
  () => {} // Silent failure — analytics never blocks CDN
)
```

---

## 3. Index Strategy

### 3.1 Index Summary

| Table | Index Name | Columns | Type | Purpose |
|-------|-----------|---------|------|---------|
| `scripts` | `scripts_pkey` | `id` | PK (B-tree) | Primary key lookups |
| `scripts` | `scripts_slug_key` | `slug` | UNIQUE (B-tree) | Slug lookup for raw/stats endpoints |
| `scripts` | `idx_scripts_slug` | `slug` | B-tree | Redundant with UNIQUE — retained for explicit naming |
| `scripts` | `idx_scripts_visibility` | `visibility` | B-tree | Filter directory listings by visibility |
| `scripts` | `idx_scripts_creator_id` | `creator_id` | B-tree | Dashboard queries (Phase 3) |
| `script_versions` | `script_versions_pkey` | `id` | PK (B-tree) | Primary key + `current_version_id` FK lookups |
| `script_versions` | `script_versions_script_id_version_key` | `(script_id, version)` | UNIQUE (B-tree) | Prevent duplicate versions |
| `script_versions` | `idx_script_versions_script_id` | `script_id` | B-tree | List all versions for a script |
| `script_versions` | `idx_script_versions_script_version` | `(script_id, version)` | B-tree | Redundant with UNIQUE — retained for explicit naming |
| `script_downloads` | `script_downloads_pkey` | `id` | PK (B-tree) | Primary key |
| `script_downloads` | `idx_script_downloads_script_id` | `script_id` | B-tree | Stats per script |
| `script_downloads` | `idx_script_downloads_created_at` | `created_at` | B-tree | Time-range cleanup queries |
| `script_downloads` | `idx_script_downloads_script_time` | `(script_id, created_at)` | B-tree | Per-script time-series stats |

### 3.2 Query Coverage

| Query | Index Used | Type |
|-------|-----------|------|
| `GET /api/scripts/:slug` | `scripts_slug_key` (UNIQUE) | Index scan → single row |
| `GET /api/scripts?visibility=public` | `idx_scripts_visibility` | Index scan |
| `GET /api/scripts/:slug/raw` | `scripts_slug_key` | Index scan → single row |
| `GET /api/scripts/:slug/stats` | `idx_script_downloads_script_time` | Index-only scan for COUNT |
| `SELECT * FROM script_versions WHERE script_id = $1` | `idx_script_versions_script_id` | Index scan |
| Cleanup: `DELETE FROM script_downloads WHERE created_at < ...` | `idx_script_downloads_created_at` | Index scan |
| Dashboard: `SELECT * FROM scripts WHERE creator_id = $1` | `idx_scripts_creator_id` | Index scan (Phase 3) |

### 3.3 Performance Notes
- `idx_script_downloads_script_time` covers the most common analytics query pattern: `SELECT COUNT(*) WHERE script_id = $1 AND created_at > ...`
- `scripts_slug_key` (UNIQUE) is the most critical index — every CDN request hits it
- All indexes are standard B-tree (default PostgreSQL type), no GIN or GiST needed
- No partial indexes used — simplicity over micro-optimization for MVP

---

## 4. RLS Strategy

### 4.1 Current (Phase 2)

All 3 CDN tables use the **identical deny-all pattern** as existing tables:

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY <table>_deny_all
  ON <table>
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
```

**Effect:** Anon and authenticated roles cannot SELECT, INSERT, UPDATE, or DELETE any row. All queries must use the `service_role` key (`supabaseAdmin`).

**Why:** No user authentication exists yet. `service_role` is the only trusted identity. This is consistent with all 5 existing tables.

### 4.2 Future (Phase 3+)

When Creator Dashboard and user authentication are introduced:

#### `scripts` — Owner-Only Access for Authenticated Users
```sql
-- Allow creators to see and manage their own scripts
CREATE POLICY scripts_select_own ON scripts
  FOR SELECT TO authenticated
  USING (creator_id = auth.uid());

CREATE POLICY scripts_insert_own ON scripts
  FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY scripts_update_own ON scripts
  FOR UPDATE TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY scripts_delete_own ON scripts
  FOR DELETE TO authenticated
  USING (creator_id = auth.uid());

-- Keep deny_all for anon (public users should never write scripts)
-- Keep service_role bypass for admin operations
```

#### `script_versions` — Inherited Ownership
```sql
-- Authenticated users can read versions of their own scripts
CREATE POLICY script_versions_select_own ON script_versions
  FOR SELECT TO authenticated
  USING (
    script_id IN (
      SELECT id FROM scripts WHERE creator_id = auth.uid()
    )
  );

-- Insert check: only for owned scripts
CREATE POLICY script_versions_insert_own ON script_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    script_id IN (
      SELECT id FROM scripts WHERE creator_id = auth.uid()
    )
  );
```

#### `script_downloads` — Service Role Only (Forever)
Downloads remain service-role-only because:
- No user context in download events
- Analytics queries run server-side
- No benefit to exposing download records to individual creators via RLS

### 4.3 Migration Path

```
Phase 2A: All 3 tables → deny_all (service role only)
Phase 3:   scripts → add owner policies for authenticated
           script_versions → add inherited-owner policies
           script_downloads → stays deny_all
Phase 5:   scripts → add vault policies (premium access tokens)
```

No data migration needed. RLS policies are metadata-only changes.

---

## 5. Naming Conventions

All CDN tables follow the exact conventions established by the Key System schema:

| Convention | Example | Exists In |
|------------|---------|-----------|
| Table names: `snake_case` plural | `script_versions` | `keys`, `rate_limits` |
| PK: `id uuid DEFAULT gen_random_uuid()` | `id` | All existing tables |
| Timestamps: `timestamp with time zone` | `created_at` | All existing tables |
| FK pattern: `REFERENCES <table>(id) ON DELETE <action>` | `REFERENCES scripts(id) ON DELETE CASCADE` | N/A (no existing FKs) |
| Index names: `idx_<table>_<columns>` | `idx_scripts_slug` | `idx_rate_limits_ip_endpoint_created_at` |
| Policy names: `<table>_deny_all` | `scripts_deny_all` | `keys_deny_all` |
| CHECK constraints: inline | `CHECK (visibility IN (...))` | N/A (no existing CHECK constraints) |

---

## 6. Migration File Reference

| File | Size | Purpose |
|------|------|---------|
| `migrations/002_cdn_tables.sql` | ~100 lines | Create 3 tables + 8 indexes + RLS + FK constraint |
| `migrations/002_cdn_tables_rollback.sql` | ~25 lines | Drop FK → disable RLS → drop tables (CASCADE) |

**Execution Order:**
1. `schema.sql` — creates tables (for fresh database setups)
2. `migrations/001_enable_rls.sql` — enables RLS on Key System tables
3. `migrations/002_cdn_tables.sql` — creates CDN tables with RLS already enabled

**Run in Supabase SQL Editor:**
```
1. schema.sql          → Run
2. 001_enable_rls.sql  → Run
3. 002_cdn_tables.sql  → Run
```

**Verification Queries:**
```sql
-- Verify all 8 tables exist (5 key system + 3 CDN)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'keys', 'used_workink_tokens', 'rate_limits', 'verification_logs', 'key_usage',
  'scripts', 'script_versions', 'script_downloads'
);
-- Expected: 8 rows

-- Verify RLS enabled on all 8 tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('keys', 'used_workink_tokens', 'rate_limits', 'verification_logs', 'key_usage', 'scripts', 'script_versions', 'script_downloads');
-- Expected: 8 rows, all rowsecurity = true

-- Verify CDN indexes
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
AND indexname IN (
  'idx_scripts_slug',
  'idx_scripts_visibility',
  'idx_scripts_creator_id',
  'idx_script_versions_script_id',
  'idx_script_versions_script_version',
  'idx_script_downloads_script_id',
  'idx_script_downloads_created_at',
  'idx_script_downloads_script_time'
);
-- Expected: 8 rows

-- Verify RLS policies on CDN tables
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('scripts', 'script_versions', 'script_downloads');
-- Expected: 3 rows, all qual = (false)

-- Verify FK constraint on current_version_id
SELECT conname FROM pg_constraint
WHERE conname = 'fk_scripts_current_version';
-- Expected: 1 row
```

---

## 7. Future Integration Points

### 7.1 Creator Dashboard (Phase 3)
- `scripts.creator_id` ← `auth.users.id` on script creation
- Dashboard queries: `SELECT * FROM scripts WHERE creator_id = $1`
- RLS update: swap `deny_all` for `USING (creator_id = auth.uid())` on `scripts` and `script_versions`
- Add FK: `ALTER TABLE scripts ADD CONSTRAINT fk_scripts_creator FOREIGN KEY (creator_id) REFERENCES auth.users(id)`

### 7.2 Access Modes, Keys, and Licenses (Phase 7 — Planned)
- Add `scripts.access_mode` with default `public` after Phase 7 documentation approval.
- Supported access modes: `public`, `key_required`, `license_required`.
- Keep `visibility` (`public`, `unlisted`, `private`) separate from `access_mode`.
- Reuse the existing Work.ink key system for `access_mode = key_required`.
- Add `licenses` table for creator-owned hashed premium license keys, nullable `expires_at`, lifecycle state, and assignment limits.
- Add `license_assignments` table for hashed generic customer identifiers and assignment state.
- Gate authorization only during `POST /api/delivery/session`; do not add authorization logic to delivery fetch, payload delivery, runtime execution, event reporting, marketplace purchases, paid visibility, or creator earnings tables in Phase 7.

### 7.3 LuxyHub Vault (Phase 5)
- `scripts.visibility = 'private'` scripts become vault-protected
- Vault delivers content via signed URLs with expiry
- `script_downloads.ip_hash` provides abuse detection (rate limit per hash)
- New table: `vault_access_tokens` — signed, expiring tokens for private script access

### 7.4 Script Versioning (Phase 4)
- `script_versions` table is already built — no schema changes needed
- API: `GET /api/scripts/:slug/versions` — list versions
- API: `GET /api/scripts/:slug/versions/:version/raw` — serve specific version
- Rollback: update `current_version_id` to point to a previous version
- New column (optional): `script_versions.is_active` BOOLEAN — mark deprecated/rolled-back versions

---

## 8. Migration Consistency Check

### 8.1 Migration File vs schema.sql

| Element | `migrations/002_cdn_tables.sql` | `schema.sql` | Match? |
|---------|-------------------------------|-------------|--------|
| `scripts` table | Lines 17-37 | Lines 58-70 | ✅ Identical |
| `scripts` indexes | Lines 39-46 | Lines 72-79 | ✅ Identical |
| `scripts` RLS | Lines 48-56 | Not in schema.sql (runs separately) | ✅ Correct |
| `script_versions` table | Lines 61-76 | Lines 82-93 | ✅ Identical |
| `script_versions` indexes | Lines 78-85 | Lines 95-100 | ✅ Identical |
| `script_versions` RLS | Lines 87-95 | Not in schema.sql (runs separately) | ✅ Correct |
| `fk_scripts_current_version` | Lines 100-103 | Lines 103-106 | ✅ Identical |
| `script_downloads` table | Lines 108-122 | Lines 109-120 | ✅ Identical |
| `script_downloads` indexes | Lines 124-131 | Lines 122-129 | ✅ Identical |
| `script_downloads` RLS | Lines 133-141 | Not in schema.sql (runs separately) | ✅ Correct |

All table and index definitions are identical between the migration file and `schema.sql`. The migration file additionally includes RLS policy setup and FK constraint.
