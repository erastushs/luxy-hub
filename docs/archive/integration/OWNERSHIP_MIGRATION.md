# Ownership Migration

Status: Phase 3B migration strategy
Last updated: 2026-06-07

## Current Ownership Model
Before Phase 3B, script management was effectively admin-owned:
- write APIs used `ADMIN_API_KEY`
- `scripts.creator_id` existed but could be null
- no foreign key connected `scripts.creator_id` to `auth.users.id`
- service code could accept optional ownership values
- RLS on `scripts` and `script_versions` used deny-all policies for anon/authenticated roles
- all real database operations used the service-role client

## Target Ownership Model
Phase 3B moves creator identity to Supabase Auth:
```text
scripts.creator_id -> auth.users.id
```

Target rules:
- authenticated creator is the only source of ownership for creator write operations
- `creator_id` never comes from request JSON, query params, or client-controlled values
- new scripts are created with `creator_id = authenticated_user.id`
- updates, deletes, publish changes, and stats use owner-scoped lookups
- `script_versions` access is inherited from parent `scripts`
- `script_downloads` remains service-role-only

## Migration Approach
Migration file:
- `migrations/004_script_ownership.sql`

Rollback file:
- `migrations/004_script_ownership_rollback.sql`

The migration is intentionally safe for non-clean production data:
- it does not require all existing `scripts.creator_id` values to be non-null
- it adds `fk_scripts_creator` as `NOT VALID`
- existing null legacy rows remain valid
- future non-null `creator_id` values must reference `auth.users(id)`
- validation can be run later after orphan checks are clean

## Pre-Deployment Checks
Run before applying the migration:
```sql
select count(*) as total_scripts from scripts;

select count(*) as unowned_scripts
from scripts
where creator_id is null;

select s.id, s.slug, s.creator_id
from scripts s
left join auth.users u on u.id = s.creator_id
where s.creator_id is not null
  and u.id is null;
```

Expected:
- unowned scripts may exist and are allowed during migration
- orphaned non-null `creator_id` rows should be reviewed before constraint validation

## Deployment Order
1. Deploy Phase 3A if not already deployed.
2. Apply `migrations/003_profiles.sql` if not already applied.
3. Apply `migrations/004_script_ownership.sql`.
4. Deploy application code that derives ownership from authenticated sessions.
5. Verify new script creation assigns `creator_id` from the session.
6. Run cross-account isolation tests.
7. Backfill or claim legacy unowned scripts if needed in a separate controlled operation.
8. Validate FK constraint only after orphan checks are clean:
```sql
alter table scripts validate constraint fk_scripts_creator;
```

## Rollback Strategy
If production issues occur:
1. Revert application deployment to the previous admin-managed version.
2. Run `migrations/004_script_ownership_rollback.sql`.
3. Confirm owner policies are removed:
```sql
select policyname, tablename
from pg_policies
where tablename in ('scripts', 'script_versions')
order by tablename, policyname;
```
4. Confirm FK is removed:
```sql
select conname
from pg_constraint
where conname = 'fk_scripts_creator';
```

Rollback does not delete scripts, versions, downloads, or profiles.

## Production Notes
- `script_downloads` must remain service-role-only.
- Existing legacy scripts with `creator_id = null` will not be manageable by creator session routes until assigned to an owner.
- Do not make `scripts.creator_id` `NOT NULL` until all legacy scripts are claimed or intentionally archived.
