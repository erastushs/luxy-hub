# CDN Production Test Plan

## Purpose
This document is a human-executable validation checklist for confirming the CDN MVP against a real deployed environment before Phase 3 begins.

## Scope
Validate the deployed CDN stack end to end:
- Supabase schema and migrations
- Upload/create flow
- Raw content delivery
- Analytics recording and hashing
- Publish visibility behavior
- Rate limiting
- Cleanup behavior
- Migration rollback and restore

## Assumptions
- Production deployment is reachable at `https://YOUR_DEPLOYED_DOMAIN`
- Supabase project credentials are available to the operator
- `ADMIN_API_KEY` or the configured admin bearer token is available for admin-only routes
- `CRON_SECRET` is available for cleanup validation
- The deployed database is isolated enough to use test rows safely

## Test Data
Use unique test values for each run:
- `slug`: `cdn-test-<timestamp>`
- `name`: `CDN Test Script`
- `description`: `Validation script for production testing`
- `visibility`: `private`
- `content`: `console.log('cdn validation')`

## 1. Supabase Verification

### Goal
Verify the CDN schema, indexes, foreign keys, RLS, and policies exist in the deployed database.

### Execute Migrations
Run the CDN migrations in order:
```sql
-- 001_enable_rls.sql
-- then
-- 002_cdn_tables.sql
```

If the database already has the schema, confirm the migration is idempotent by re-running it in a staging clone first.

### Verify Tables
```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('scripts', 'script_versions', 'script_downloads');
```

Expected result:
- `scripts`
- `script_versions`
- `script_downloads`

Pass criteria:
- All 3 tables are present.

Fail criteria:
- Any table is missing.

### Verify Indexes
```sql
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('scripts', 'script_versions', 'script_downloads')
order by tablename, indexname;
```

Expected indexes:
- `idx_scripts_slug`
- `idx_scripts_visibility`
- `idx_scripts_creator_id`
- `idx_script_versions_script_id`
- `idx_script_versions_script_version`
- `idx_script_downloads_script_id`
- `idx_script_downloads_created_at`
- `idx_script_downloads_script_time`

Pass criteria:
- All expected indexes exist.

Fail criteria:
- Any expected index is missing.

### Verify Foreign Keys
```sql
select tc.table_name, tc.constraint_name, tc.constraint_type
from information_schema.table_constraints tc
where tc.table_schema = 'public'
  and tc.table_name in ('scripts', 'script_versions', 'script_downloads')
  and tc.constraint_type = 'FOREIGN KEY'
order by tc.table_name, tc.constraint_name;
```

Expected foreign keys:
- `script_versions.script_id -> scripts.id`
- `scripts.current_version_id -> script_versions.id`
- `script_downloads.script_id -> scripts.id`
- `script_downloads.version_id -> script_versions.id`

Pass criteria:
- All expected foreign keys exist.

Fail criteria:
- Any foreign key is missing or references the wrong table/column.

### Verify RLS
```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('scripts', 'script_versions', 'script_downloads')
order by tablename;
```

Expected result:
- `rowsecurity = true` for all three tables.

Pass criteria:
- RLS enabled on all three tables.

Fail criteria:
- Any table has RLS disabled.

### Verify Policies
```sql
select pol.polname, c.relname as table_name
from pg_policy pol
join pg_class c on c.oid = pol.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('scripts', 'script_versions', 'script_downloads')
order by c.relname, pol.polname;
```

Expected result:
- `scripts_deny_all`
- `script_versions_deny_all`
- `script_downloads_deny_all`

Pass criteria:
- All deny-all policies exist.

Fail criteria:
- Any expected policy is missing.

---

## 2. Upload Test

### Goal
Verify script creation, version creation, and slug uniqueness.

### Request
```bash
curl -i -X POST "https://YOUR_DEPLOYED_DOMAIN/api/scripts" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{
    "slug":"cdn-test-<timestamp>",
    "name":"CDN Test Script",
    "description":"Validation script for production testing",
    "visibility":"private",
    "content":"console.log(\"cdn validation\")"
  }'
```

### Expected Results
- HTTP `201`
- JSON response includes `success: true`
- `script.slug` matches the submitted slug
- `script.current_version_id` is not null

### Verify Version Creation
Run SQL:
```sql
select s.slug, s.current_version_id, v.version, v.content, v.created_at
from scripts s
join script_versions v on v.id = s.current_version_id
where s.slug = 'cdn-test-<timestamp>';
```

Expected result:
- One script row
- One matching version row
- Initial version is `1.0.0`

Pass criteria:
- Script exists and current version is linked.

Fail criteria:
- No version row exists or `current_version_id` is null.

### Verify Slug Uniqueness
Repeat the same POST request with the same slug.

Expected results:
- HTTP `409`
- Response indicates slug conflict / already exists

Pass criteria:
- Duplicate slug is rejected.

Fail criteria:
- Duplicate slug is accepted.

---

## 3. Raw Endpoint Test

### Goal
Verify raw content delivery, content integrity, and cache headers.

### Request
```bash
curl -i "https://YOUR_DEPLOYED_DOMAIN/api/scripts/cdn-test-<timestamp>/raw"
```

### Expected Results
- HTTP `200`
- `Content-Type: text/plain; charset=utf-8`
- `Cache-Control: public, max-age=300, s-maxage=3600`
- Body content exactly matches uploaded content

### Content Integrity Check
Compare the response body to the original text:
- `console.log("cdn validation")`

Pass criteria:
- Raw response content matches exactly.
- Cache headers are present.

Fail criteria:
- Content is altered, truncated, or missing cache headers.

---

## 4. Analytics Test

### Goal
Verify download tracking records hashed identifiers only and never stores raw IP or raw user agent.

### Trigger Downloads
Run multiple raw requests:
```bash
curl -s "https://YOUR_DEPLOYED_DOMAIN/api/scripts/cdn-test-<timestamp>/raw" > /dev/null
curl -s "https://YOUR_DEPLOYED_DOMAIN/api/scripts/cdn-test-<timestamp>/raw" > /dev/null
```

### Verify Analytics Rows
```sql
select id, script_id, version_id, ip_hash, user_agent_hash, created_at
from script_downloads
where script_id = (
  select id from scripts where slug = 'cdn-test-<timestamp>'
)
order by created_at desc;
```

Expected result:
- One or more rows exist after triggering downloads
- `ip_hash` is populated
- `user_agent_hash` may be populated or null depending on request source

### Verify Hashes Only
Check that the table columns contain hashes, not raw values.

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'script_downloads'
order by ordinal_position;
```

Expected result:
- `ip_hash` and `user_agent_hash` are text columns used for hashed identifiers

### Verify No Raw IP Storage
```sql
select count(*) as raw_ip_matches
from script_downloads
where ip_hash in ('127.0.0.1', '::1', '0.0.0.0');
```

Expected result:
- `0`

### Verify No Raw User-Agent Storage
```sql
select count(*) as raw_ua_matches
from script_downloads
where user_agent_hash in (
  'Mozilla/5.0',
  'curl/8.0.0',
  'PostmanRuntime/7.0'
);
```

Expected result:
- `0`

Pass criteria:
- Rows are created.
- Hash columns are populated.
- No obvious raw IP or raw user agent strings are stored.

Fail criteria:
- No download rows are created.
- Raw identifiers are stored.

---

## 5. Publish Test

### Goal
Verify visibility transitions for public, private, and unlisted scripts.

### Make Public
```bash
curl -i -X POST "https://YOUR_DEPLOYED_DOMAIN/api/scripts/cdn-test-<timestamp>/publish" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"visibility":"public"}'
```

Expected result:
- HTTP `200`
- `success: true`
- Script visibility becomes `public`

### Make Private
```bash
curl -i -X POST "https://YOUR_DEPLOYED_DOMAIN/api/scripts/cdn-test-<timestamp>/publish" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"visibility":"private"}'
```

Expected result:
- HTTP `200`
- Script visibility becomes `private`

### Make Unlisted
```bash
curl -i -X POST "https://YOUR_DEPLOYED_DOMAIN/api/scripts/cdn-test-<timestamp>/publish" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"visibility":"unlisted"}'
```

Expected result:
- HTTP `200`
- Script visibility becomes `unlisted`

### Visibility Access Expectations
- `public`: visible in list endpoints and accessible by slug
- `private`: not visible in public list endpoints; raw access requires admin auth
- `unlisted`: accessible by slug but should not appear in public list endpoints

Pass criteria:
- Each visibility transition succeeds and behaves as expected.

Fail criteria:
- Visibility does not persist or access behavior is incorrect.

---

## 6. Rate Limit Test

### Goal
Verify throttling is active for upload, raw, and metadata routes.

### Upload Limit Test
Send repeated authenticated POST requests to `/api/scripts` until throttled.

Expected result:
- Eventually HTTP `429`
- `Retry-After` header present

### Metadata Limit Test
Send repeated GET requests to `/api/scripts/cdn-test-<timestamp>` until throttled.

Expected result:
- Eventually HTTP `429`
- `Retry-After` header present

### Raw Endpoint Limit Test
Send repeated GET requests to `/api/scripts/cdn-test-<timestamp>/raw` until throttled.

Expected result:
- Eventually HTTP `429`
- `Retry-After` header present

Pass criteria:
- Each endpoint enforces a rate limit and returns `429` when exceeded.

Fail criteria:
- No throttling occurs.

---

## 7. Cleanup Test

### Goal
Verify the cleanup route removes old analytics rows and preserves recent rows.

### Create Old Analytics Rows
Insert a synthetic old row directly in the database for testing.

```sql
insert into script_downloads (script_id, version_id, ip_hash, user_agent_hash, created_at)
values (
  (select id from scripts where slug = 'cdn-test-<timestamp>'),
  (select current_version_id from scripts where slug = 'cdn-test-<timestamp>'),
  'old-ip-hash',
  'old-ua-hash',
  now() - interval '91 days'
);
```

### Create Recent Analytics Rows
```sql
insert into script_downloads (script_id, version_id, ip_hash, user_agent_hash, created_at)
values (
  (select id from scripts where slug = 'cdn-test-<timestamp>'),
  (select current_version_id from scripts where slug = 'cdn-test-<timestamp>'),
  'recent-ip-hash',
  'recent-ua-hash',
  now() - interval '1 day'
);
```

### Run Cleanup
```bash
curl -i -X POST "https://YOUR_DEPLOYED_DOMAIN/api/cleanup" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected result:
- HTTP `200`
- `success: true`

### Verify Deletion
```sql
select ip_hash, created_at
from script_downloads
where script_id = (
  select id from scripts where slug = 'cdn-test-<timestamp>'
)
order by created_at asc;
```

Expected result:
- Old row older than retention window is deleted
- Recent row remains

Pass criteria:
- Old rows are removed and recent rows remain.

Fail criteria:
- Cleanup removes recent rows or leaves old rows in place.

---

## 8. Rollback Test

### Goal
Verify that the migration can be rolled back and restored.

### Rollback Migration
Run:
```sql
-- 002_cdn_tables_rollback.sql
```

Expected result:
- CDN tables are removed
- Related policies, indexes, and foreign keys are removed

Pass criteria:
- Rollback completes successfully in a controlled environment.

Fail criteria:
- Rollback fails or leaves partial schema artifacts.

### Restore Migration
Run:
```sql
-- 002_cdn_tables.sql
```

Expected result:
- CDN tables, indexes, foreign keys, and RLS policies are restored

Pass criteria:
- Schema returns to the expected CDN state.

Fail criteria:
- Restore migration fails or does not fully recreate schema.

---

## Final Pass/Fail Decision

### Pass if all are true
- Supabase schema verification passes
- Upload flow passes
- Raw endpoint passes
- Analytics rows and hashing pass
- Publish visibility behavior passes
- Rate limiting passes
- Cleanup behavior passes
- Rollback and restore pass

### Fail if any are true
- Any schema object is missing
- Any endpoint returns an unexpected status or payload
- Raw data or unhashed identifiers are stored
- Rate limits do not trigger
- Cleanup deletes the wrong rows
- Rollback/restore does not complete cleanly

## Operator Note
Record each command output and SQL result set during execution. If any single step fails, classify the CDN MVP as `NO-GO` until the failure is resolved and re-validated.
