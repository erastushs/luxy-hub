# Migration Validation Report

## Scope
Validated against the current repository migrations and schema definitions for the CDN stack.

## Findings
- `migrations/002_cdn_tables.sql` defines `scripts`, `script_versions`, and `script_downloads` tables.
- The migration defines indexes for all three tables.
- Foreign keys are defined:
  - `script_versions.script_id -> scripts.id ON DELETE CASCADE`
  - `scripts.current_version_id -> script_versions.id ON DELETE SET NULL`
  - `script_downloads.script_id -> scripts.id ON DELETE CASCADE`
  - `script_downloads.version_id -> script_versions.id ON DELETE SET NULL`
- Row Level Security is enabled on all CDN tables.
- Deny-all policies exist for `anon` and `authenticated` roles on all CDN tables.
- `002_cdn_tables_rollback.sql` removes policies, disables RLS, drops the FK, and drops tables in reverse order.

## Migration Drift Check
- `schema.sql` contains the same CDN table definitions as `migrations/002_cdn_tables.sql`.
- The schema file still embeds the Phase 2 CDN section rather than importing migrations, so drift should be checked in a real database by comparing DDL output after applying both sources.
- No code-level drift is visible between the CDN section of `schema.sql` and `002_cdn_tables.sql`.

## Verification SQL
```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('scripts', 'script_versions', 'script_downloads');

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('scripts', 'script_versions', 'script_downloads');

select tc.table_name, tc.constraint_name, tc.constraint_type
from information_schema.table_constraints tc
where tc.table_schema = 'public'
  and tc.table_name in ('scripts', 'script_versions', 'script_downloads');

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('scripts', 'script_versions', 'script_downloads');

select pol.polname, c.relname as table_name
from pg_policy pol
join pg_class c on c.oid = pol.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('scripts', 'script_versions', 'script_downloads');
```

## Status
- Database shape validated from source.
- Live production database execution was not available in this workspace.
