# Phase 3B Ownership Enforcement

Status: Implemented backend ownership enforcement only
Last updated: 2026-06-07

## Purpose
Phase 3B moves LuxyHub script management from shared admin ownership to authenticated creator ownership. Supabase Auth remains the identity source, and script ownership is anchored on `scripts.creator_id -> auth.users.id`.

## Scope
Included:
- migration-safe ownership foreign key
- owner-based RLS policy design for `scripts` and `script_versions`
- centralized ownership helpers
- server-derived script ownership assignment
- owner-scoped update, delete, publish, metadata, and stats access
- cross-account isolation validation plan and code-level results

Not included:
- dashboard pages
- React components
- auth screens
- analytics UI
- marketplace features
- organizations
- API tokens
- premium features

## Ownership Architecture
```text
Supabase Auth
  |
  v
auth.users.id
  |
  | owns
  v
scripts.creator_id
  |
  | inherited ownership
  v
script_versions.script_id

script_downloads stays service-role-only and is exposed only through owner-filtered aggregate APIs.
```

## Ownership Source Of Truth
The owner of a script is the authenticated Supabase user:
```text
scripts.creator_id = authenticated_user.id
```

Rules:
- `creator_id` is never accepted from client payloads
- `creator_id` is never read from query params
- `creator_id` is assigned server-side only
- state-changing script operations require a valid session
- cross-account access returns `404 Script not found` to avoid exposing existence

## Database Model
Implemented migration:
- `migrations/004_script_ownership.sql`

Rollback migration:
- `migrations/004_script_ownership_rollback.sql`

Target relationship:
```sql
alter table scripts
  add constraint fk_scripts_creator
  foreign key (creator_id) references auth.users(id)
  on delete set null
  not valid;
```

`NOT VALID` is intentional for production safety:
- existing legacy rows can remain unowned during migration
- new non-null `creator_id` values are enforced
- final validation can run after orphan checks and backfills

## RLS Model

### `scripts`
Authenticated owner policies:
- owner can select
- owner can insert
- owner can update
- owner can delete

Policy basis:
```sql
creator_id = auth.uid()
```

### `script_versions`
Ownership is inherited from parent `scripts` rows.

Policy basis:
```sql
exists (
  select 1
  from scripts
  where scripts.id = script_versions.script_id
    and scripts.creator_id = auth.uid()
)
```

Allowed owner actions:
- select versions for owned scripts
- insert versions for owned scripts

Version rows remain immutable in application behavior.

### `script_downloads`
No creator RLS policies are added.

Rationale:
- raw analytics rows contain operational telemetry
- creator dashboard analytics must be aggregate-only
- access remains through service-role-backed, owner-filtered queries

## Ownership Helper Layer
Implemented:
- `app/lib/auth/ownership.ts`

Helpers:
- `getOwnedScript(slug, ownerId)`
- `assertScriptOwner(slug, ownerId)`
- `requireOwnership(user, slug)`

Behavior:
- deny by default
- non-owned script lookups return null or throw `OwnershipError`
- ownership failures map to `404 Script not found`
- no duplicate ownership logic should be added in future APIs

## Script Creation Binding
Script creation now requires a session-derived owner.

Flow:
```text
POST /api/scripts
  |
  v
requireAuth()
  |
  v
actor.id
  |
  v
createScript({ ..., creatorId: actor.id })
  |
  v
scripts.creator_id = actor.id
```

The request body may contain arbitrary fields, but `creator_id` is ignored and never passed to the service.

## Creator API Preparation
Existing script APIs were prepared for creator ownership without redesigning endpoint contracts:
- `POST /api/scripts` now requires session auth and binds `creator_id` from `requireAuth()`
- `PATCH /api/scripts/[slug]` requires session auth and updates only owned scripts
- `DELETE /api/scripts/[slug]` requires session auth and deletes only owned scripts
- `POST /api/scripts/[slug]/publish` requires session auth and updates only owned scripts
- `GET /api/scripts/[slug]/stats` requires session auth and returns owner-filtered analytics only
- `GET /api/scripts/[slug]` preserves public metadata behavior for anonymous users, but authenticated users are resolved through owner-scoped access

## Creator Isolation Model
Creator A cannot:
- read Creator B dashboard-context script metadata
- update Creator B scripts
- delete Creator B scripts
- change Creator B visibility
- access Creator B analytics

Creator B cannot perform the same operations against Creator A resources.

All owner-specific operations filter by `creator_id = actor.id` before mutating or aggregating data.

## Cross-Account Isolation Validation

### Code-Level Validation Results
Passed by implementation review:
- `POST /api/scripts` derives `creatorId` from `requireAuth()` and never from request body
- `updateScript()` uses `assertScriptOwner()` and owner-scoped repository update
- `deleteScript()` uses `assertScriptOwner()` and owner-scoped repository delete
- `changeVisibility()` uses `assertScriptOwner()` and owner-scoped repository update
- `getStats()` uses `getScriptStatsForOwner()`
- `script_downloads` has no owner RLS policy and remains service-role-only

### Production Validation Steps
Use two real Supabase Auth users: Creator A and Creator B.

1. Creator A creates script `creator-a-test`.
2. Creator B creates script `creator-b-test`.
3. Creator A attempts to update `creator-b-test`.
4. Creator A attempts to delete `creator-b-test`.
5. Creator A attempts to publish `creator-b-test`.
6. Creator A attempts to read stats for `creator-b-test`.
7. Repeat all inverse checks with Creator B against `creator-a-test`.

Expected result for cross-account attempts:
- HTTP `404`
- body includes `success: false`
- script data is not returned
- no mutation occurs

## Security Assumptions
- Supabase Auth is the identity source of truth
- server-side session validation is required for all creator management operations
- creator role is loaded server-side from trusted profile data
- client-supplied ownership data is ignored
- service-role remains available for operational CDN delivery and maintenance
- legacy unowned scripts require a controlled claim/backfill process before creator management

## Future Marketplace Compatibility
The ownership model remains compatible with future marketplace phases because:
- script ownership is anchored to stable `auth.users.id`
- analytics remain independent of monetization
- `script_downloads` can feed future revenue calculations without exposing raw telemetry
- organizations can later be introduced as a separate ownership/membership layer without changing the V1 creator identity source
- licensing and entitlement tables can reference `scripts.id` and `auth.users.id`

## Remaining Work For Phase 3C
- add dedicated creator API response contracts if needed
- add version history creator endpoint
- add creator-safe script list endpoint for "My Scripts"
- add aggregated creator analytics endpoints
- add audit logging for state-changing script operations
- perform live two-creator production isolation validation
