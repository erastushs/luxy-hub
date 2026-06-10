# Creator Dashboard Architecture

Status: Phase 3 Historical Planning Document — Superseded by ARCHITECTURE.md
Last updated: 2026-06-08

> This document was the pre-implementation architecture plan for the Creator Dashboard.
> The current architecture after implementation is maintained in `../../architecture/ARCHITECTURE.md`.
> The entire document describes the planned design that preceded actual development.
> Domain topology, subdomain model, and marketplace compatibility sections reflect Phase 3 planning intent, not current state.

## Purpose
This document defines the production-ready architecture for the LuxyHub creator platform before implementation begins. It covers identity, ownership, database changes, API boundaries, analytics design, and security rules for the Creator Dashboard without creating UI, pages, React components, or migrations.

## Domain Topology
```text
www.luxyhub.space        -> Public website, docs, public script directory
login.luxyhub.space      -> Authentication entry point
dashboard.luxyhub.space  -> Creator dashboard application
api.luxyhub.space        -> Authenticated platform APIs
cdn.luxyhub.space        -> Raw script delivery and public CDN endpoints
vault.luxyhub.space      -> Future premium/private secure delivery
```

## Architecture Diagram
```text
Creator Browser
  |
  | 1. Sign in
  v
login.luxyhub.space
  |
  | Supabase Auth session issuance
  v
Secure session cookie / JWT
  |
  | 2. Navigate to dashboard
  v
dashboard.luxyhub.space
  |
  | 3. Authenticated API calls
  v
api.luxyhub.space
  |
  |-- session validation
  |-- ownership validation
  |-- service layer
  |-- audit logging
  v
Supabase Postgres
  |
  |-- scripts
  |-- script_versions
  |-- script_downloads
  |-- profiles          [new]
  |-- audit_logs        [new]
  |-- api_tokens        [future v2]
  |-- organizations     [future v2]
  v
cdn.luxyhub.space
  |
  | public/unlisted/private delivery rules
  v
End users / loaders
```

## Current Database Audit

### Existing Tables Relevant to Dashboard
- `scripts`
  - Already contains the correct core fields for dashboard V1: `id`, `slug`, `name`, `description`, `visibility`, `creator_id`, `current_version_id`, `created_at`, `updated_at`
  - `idx_scripts_creator_id` already exists and is the main query index for "My Scripts"
- `script_versions`
  - Already supports immutable version history for upload, edit, history views, and future rollback workflows
- `script_downloads`
  - Already supports creator analytics through server-side aggregation
  - Must remain service-role-only at the table level
- `keys`
  - Not required for Dashboard V1 auth or script management
  - Relevant later for Vault/Key integration workflows
- `used_workink_tokens`
  - Not required for Dashboard V1
- `rate_limits`
  - Already usable for dashboard API protection, but currently keyed by IP and endpoint only

### What Is Missing for Dashboard Functionality
- Creator identity model linked to `auth.users`
- Profile data for display name, avatar, and creator settings
- Ownership-enforcing foreign key from `scripts.creator_id` to `auth.users.id`
- Dashboard-specific audit logging for creator actions
- Session-based authenticated API boundary replacing shared admin bearer auth for creator operations
- Aggregation strategy for creator analytics dashboards
- Permissions model for future admins, teams, and organizations

## Authentication Architecture

### Decision
Use Supabase Auth as the identity system for Creator Dashboard V1.

### Why Supabase Auth Fits
- Native integration with existing Supabase database and RLS model
- Supports email/password login now
- Supports session cookies and JWT-backed server validation
- Supports future OAuth providers without redesigning database ownership
- Supports custom claims / app metadata for role expansion later

### Authentication Requirements Mapping
- Creator accounts: handled by `auth.users`
- Email login: supported in V1
- Session handling: Supabase session cookie for browser auth, verified server-side on dashboard/API requests
- Role support: use app metadata / profile role field for `creator` and future `admin`
- Future admin support: reserve elevated service behaviors and role-based API checks now

### User Model
Use Supabase `auth.users` as the source of truth for identity.

Add a first-party `profiles` table for application metadata.

Proposed V1 shape:
```text
auth.users
  id uuid primary key
  email
  created_at
  app_metadata
  user_metadata

profiles
  id uuid primary key references auth.users(id)
  username text unique nullable
  display_name text not null
  avatar_url text nullable
  role text not null default 'creator'
  created_at timestamptz
  updated_at timestamptz
```

### Roles
V1 roles:
- `creator`
- `admin`

Role source strategy:
- Primary operational role should be derived from trusted server-side metadata, not client input
- `profiles.role` can mirror the assigned application role for query convenience
- Authorization must validate against trusted session claims or a server-validated profile lookup

### Session Handling
Recommended flow:
1. User signs in on `login.luxyhub.space`
2. Supabase sets session state
3. `dashboard.luxyhub.space` makes authenticated requests using session cookies / access token
4. `api.luxyhub.space` validates session on every creator action
5. Service layer resolves `auth.uid()` equivalent user identity
6. Ownership checks and RLS policies constrain database access

### Ownership Model
V1 ownership is single-owner per script.
- `scripts.creator_id = auth.users.id`
- Each script belongs to exactly one creator in V1
- `script_versions` inherit ownership from the parent `scripts` row
- `script_downloads` remain non-user-owned operational analytics rows and are accessed only through server-side aggregation

This keeps V1 simple and avoids premature collaboration tables.

## Permissions Model

### V1 Permissions
Creators can:
- view their own scripts
- create scripts owned by themselves
- update their own scripts
- delete their own scripts
- change visibility on their own scripts
- view analytics for their own scripts
- view version history for their own scripts

Creators cannot:
- access other creators' scripts
- access raw `script_downloads` rows directly
- assign ownership to another user
- elevate their own role

Admins can, in the future:
- inspect any creator account
- inspect any script
- perform moderation or recovery actions
- view audit logs across the platform

### Enforcement Layers
Use defense in depth:
- session validation at API boundary
- ownership checks in service layer
- RLS policies in the database
- server-side analytics aggregation only
- audit logs for state-changing actions

## Dashboard Database Proposal

### V1 Necessary Tables Only

#### 1. `profiles`
Purpose:
- store creator-facing profile data not suitable for `auth.users`
- provide display information for dashboard and future public creator pages

Why necessary:
- dashboard needs creator metadata beyond auth identity
- future marketplace will need a canonical creator profile record

Proposed columns:
```text
id uuid primary key references auth.users(id)
username text unique nullable
display_name text not null
avatar_url text nullable
role text not null default 'creator'
created_at timestamptz default now()
updated_at timestamptz default now()
```

#### 2. `audit_logs`
Purpose:
- record creator-sensitive state changes for security, support, and future compliance

Why necessary:
- dashboard introduces self-service destructive and visibility-changing actions
- current verification logs are not designed for creator action history

Proposed columns:
```text
id uuid primary key default gen_random_uuid()
actor_user_id uuid references auth.users(id)
entity_type text not null
entity_id uuid nullable
action text not null
metadata jsonb not null default '{}'
ip_hash text nullable
created_at timestamptz default now()
```

Recommended initial actions:
- `script.created`
- `script.updated`
- `script.deleted`
- `script.visibility_changed`
- `script.version_created`
- `auth.login`
- `auth.logout`

### V2 Tables, Not Needed for V1

#### `organizations`
Needed only when teams and shared ownership ship.
Do not add in V1.

#### `organization_members`
Needed only when organizations exist.
Do not add in V1.

#### `api_tokens`
Needed only when creator-scoped machine access is introduced.
Do not add in V1.

### Existing Table Changes Proposed Later
Do not migrate yet, but plan for:
- `scripts.creator_id` foreign key to `auth.users(id)`
- RLS policy changes on `scripts` and `script_versions`
- optional `updated_by` style metadata only if audit logs are insufficient

## Versioned Feature Plan

### Version 1 Dashboard
Scope:
- Login
- My Scripts
- Upload Script
- Edit Script
- Delete Script
- Publish Script
- Visibility Management
- Download Analytics
- Version History

Backend architecture for V1:
- session-authenticated creator APIs
- server-side ownership validation
- RLS owner policies on `scripts` and `script_versions`
- server-side analytics aggregation from `script_downloads`
- audit log writes on every state-changing operation

### Version 2 Dashboard
Scope:
- Teams
- Organizations
- API Tokens
- Collaboration

Required future additions:
- `organizations`
- `organization_members`
- `api_tokens`
- permission expansion from owner-only to role-based collaboration

### Version 3 Dashboard
Scope:
- Marketplace
- Revenue
- Licensing
- Premium Features

Required future additions:
- pricing/licensing tables
- purchase tables
- entitlement checks
- payout/revenue accounting
- public creator profile enhancements

## API Interaction Model

### Domain Responsibility Split
- `dashboard.luxyhub.space`
  - creator UI only
  - no public content responsibilities
- `login.luxyhub.space`
  - auth initiation and recovery flows
- `api.luxyhub.space`
  - authenticated creator APIs
  - session validation
  - ownership-aware CRUD
  - analytics aggregation responses
- `cdn.luxyhub.space`
  - public script content delivery
  - analytics capture
  - no dashboard UI logic

### V1 API Strategy
Keep the existing script service concepts, but change the auth boundary for creator-facing operations.

Recommended API behavior evolution:
- creator dashboard calls authenticated APIs on `api.luxyhub.space`
- session identity is resolved server-side
- create/update/delete/publish flows automatically bind to the authenticated creator
- `creator_id` is never accepted from the client
- analytics endpoints return aggregated creator-safe metrics only

### Existing Endpoint Compatibility
Current script APIs can be preserved conceptually, but V1 implementation should separate concerns:
- public CDN reads remain public on CDN/API domains as appropriate
- creator management writes become session-authenticated creator endpoints
- service-role-only admin fallback can remain for internal operational tasks

## Analytics Dashboard Design

### Existing Data Source
Use `script_downloads` as the canonical event table.

### V1 Dashboard Metrics
Per script:
- total downloads
- unique visitors by `ip_hash`
- downloads today
- downloads last 7 days
- downloads last 30 days
- last downloaded at

Portfolio level:
- total scripts
- total downloads across owned scripts
- top scripts by downloads
- recent activity trend
- visibility split by script count

### Recommended Charts
V1 charts should be aggregation-driven and simple:
- line chart: downloads over time by day
- bar chart: top scripts by downloads
- stacked bar or donut: scripts by visibility
- KPI cards: total downloads, unique visitors, active scripts, last 24h downloads

### Aggregation Strategy
Do not expose raw `script_downloads` rows directly to creators.

Use server-side aggregation queries:
- aggregate by `script_id`
- aggregate by date bucket using `date_trunc('day', created_at)`
- unique visitors by `count(distinct ip_hash)`
- join through `scripts` filtered by `creator_id`

Example query patterns:
```sql
select s.id, s.slug, s.name, count(d.id) as total_downloads
from scripts s
left join script_downloads d on d.script_id = s.id
where s.creator_id = $1
group by s.id, s.slug, s.name
order by total_downloads desc;

select date_trunc('day', d.created_at) as day, count(*) as downloads
from script_downloads d
join scripts s on s.id = d.script_id
where s.creator_id = $1
  and d.created_at >= now() - interval '30 days'
group by day
order by day asc;

select count(distinct d.ip_hash) as unique_visitors
from script_downloads d
join scripts s on s.id = d.script_id
where s.creator_id = $1;
```

### Performance Considerations
Current schema is acceptable for V1, but analytics queries must be designed carefully.

V1 acceptable approach:
- live aggregate queries for creator dashboards with bounded time windows
- default time ranges: 7, 30, 90 days
- paginate script lists separately from analytics summaries

Future optimization triggers:
- large `script_downloads` volume
- slow date-bucketed queries across many scripts
- rising creator count

Future optimization options, not needed yet:
- materialized daily aggregation table
- scheduled rollups per script/day
- cached creator analytics snapshots

## Security Review

### Creator Ownership Validation
Required rule:
- no creator can read, update, publish, delete, or inspect analytics for another creator's script

Enforcement model:
1. session identifies authenticated user
2. database row ownership is bound by `scripts.creator_id`
3. all script and version queries filter by owner
4. analytics queries join through owned scripts only
5. raw event tables remain service-role-only

### Database Security Model
Target RLS evolution:
- `scripts`
  - authenticated users can select/insert/update/delete only rows where `creator_id = auth.uid()`
- `script_versions`
  - authenticated users can select/insert only rows whose parent script is owned by `auth.uid()`
  - update/delete should remain tightly controlled because versions are immutable by design
- `script_downloads`
  - remain deny-all for `authenticated`
  - accessible only via service-role-backed aggregate queries

### Dashboard Authorization
Use server-side route guards for:
- authenticated access to dashboard app
- role checks for admin-only functions
- redirection away from dashboard when no valid session exists

### API Protection
- creator write endpoints require valid session
- client must never choose `creator_id`
- service layer should derive actor identity from session, not payload
- all state changes should emit audit logs
- all creator APIs should retain rate limiting, tuned separately from public CDN endpoints if needed

### Session Security
- use secure HTTP-only cookies where supported by Supabase SSR flow
- verify session on server for every privileged request
- short-lived access token with refresh rotation handled by Supabase
- no local-storage-only trust model for sensitive creator operations

### Audit Logging
Log at least:
- who performed the action
- what entity changed
- when it changed
- what action occurred
- minimal structured metadata for support/debugging

Audit logs should be append-only at the application level.

## Future Marketplace Compatibility
The dashboard architecture must not block later monetization.

V1 decisions that preserve compatibility:
- single canonical creator identity via `auth.users`
- `profiles` as application metadata layer
- script ownership anchored on `creator_id`
- analytics modeled as event data independent of pricing or entitlement
- audit logs designed generically by actor/entity/action

Marketplace-safe expansion path:
- add pricing/licensing tables without changing core script ownership
- attach organizations later as an alternate ownership or management layer
- add API tokens later without changing browser session auth
- add Vault entitlements later without redesigning download analytics

## Implementation Roadmap

### Phase 3A: Identity Foundation
- introduce Supabase Auth for creator accounts
- add `profiles` table
- link creators to `auth.users`
- define `creator` and `admin` role semantics

### Phase 3B: Ownership Enforcement
- add `scripts.creator_id` foreign key to `auth.users(id)`
- update script creation flow to bind ownership from session
- add RLS owner policies for `scripts` and `script_versions`
- keep `script_downloads` service-role-only

### Phase 3C: Creator API Layer
- replace shared admin auth for creator flows with session auth
- create dashboard-safe script CRUD endpoints or adapt existing endpoints behind creator-aware auth
- add creator analytics aggregation endpoints
- add version history retrieval endpoint

### Phase 3D: Security and Auditability
- add `audit_logs`
- write audit entries for all state changes
- validate creator isolation with production tests
- verify admin override paths separately

### Phase 3E: Dashboard UI Implementation
- build dashboard pages and components only after architecture and database changes are approved

## Final Recommendations
- V1 should ship with Supabase Auth, `profiles`, and `audit_logs`
- V1 should not ship `organizations` or `api_tokens`
- `script_downloads` should remain operational data, never directly user-readable
- ownership must be enforced by both API logic and RLS before dashboard UI work begins
- dashboard, login, API, CDN, and vault should remain on separate subdomains exactly as planned
