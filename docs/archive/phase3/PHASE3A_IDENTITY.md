# Phase 3A Identity Foundation

Status: Implemented backend identity foundation only
Last updated: 2026-06-07

## Purpose
Phase 3A establishes the backend identity layer required for the future Creator Dashboard. It introduces creator profiles, reusable server-side session validation, and a minimal creator/admin role model while remaining compatible with Phase 3B ownership enforcement.

## Scope
Included:
- Supabase Auth as creator identity source of truth
- `profiles` table and migration
- reusable server-side auth utilities
- profile repository and service layer
- creator/admin role model
- documentation and roadmap updates

Not included:
- dashboard pages
- React components
- authentication UI screens
- organizations
- collaboration
- API tokens
- marketplace functionality
- Phase 3B ownership enforcement

## Auth Architecture
Identity source:
- Supabase `auth.users`

Application metadata source:
- `profiles`

Runtime model:
- Browser signs in through future `login.luxyhub.space`
- Supabase issues session cookies / JWT-backed session state
- Server-side code reads the auth cookie and validates the user through Supabase
- Application code provisions or loads a `profiles` row for the authenticated user
- Role enforcement occurs server-side only

## Session Flow
```text
Creator signs in
  |
  v
Supabase Auth creates session
  |
  v
Request reaches Next.js server
  |
  v
createSupabaseServerClient()
  |
  |-- reads Supabase auth cookie
  |-- attaches Authorization bearer token when present
  v
supabase.auth.getUser()
  |
  v
getCurrentUser()
  |
  |-- load existing profile
  |-- or auto-provision profile from auth user metadata/email
  v
requireAuth() / requireRole()
```

## Profiles Schema
Implemented in `migrations/003_profiles.sql` and reflected in `schema.sql`.

```sql
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text not null,
  avatar_url text,
  role text not null default 'creator' check (role in ('creator', 'admin')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
```

Additional index:
```sql
create index if not exists idx_profiles_role on profiles (role);
```

RLS posture in Phase 3A:
- `profiles` uses the same deny-all pattern as the existing Phase 2 service-role tables
- creator-facing per-user profile RLS is deferred to a later auth-aware phase

## Role Model
Supported roles in V1:
- `creator`
- `admin`

Rules:
- `creator` is the default database role
- role is never accepted from client input
- role validation is server-side only
- role checks use trusted profile data loaded by the server

## Implemented Utilities

### `createSupabaseServerClient()`
Location:
- `app/lib/supabase.ts`

Purpose:
- create a request-scoped Supabase client using the current request cookies
- attach bearer authorization only from trusted server-side cookie parsing

### `getCurrentUser()`
Location:
- `app/lib/auth/session-auth.ts`

Purpose:
- validate the current session on the server
- return `null` when no valid authenticated user exists
- auto-provision a profile if the user exists in Supabase Auth but not yet in `profiles`

### `requireAuth()`
Location:
- `app/lib/auth/session-auth.ts`

Purpose:
- enforce authenticated access for future dashboard APIs
- throw `AuthError(401)` if no valid session exists

### `requireRole()`
Location:
- `app/lib/auth/session-auth.ts`

Purpose:
- enforce server-side role authorization
- throw `AuthError(403)` if the authenticated user lacks the required role

## Profile Model

### Repository
Location:
- `app/lib/repositories/profile-repository.ts`

Capabilities:
- fetch profile by user id
- upsert profile
- surface unique username conflicts

### Service
Location:
- `app/lib/services/profile-service.ts`

Capabilities:
- load profile
- ensure profile exists
- validate display name and username
- normalize fallback display name from auth email when needed

## Security Assumptions
- Supabase Auth is the only source of identity truth
- session validation happens server-side only
- no local-storage trust model is used for authorization
- role never comes from request JSON or query params
- `profiles` provisioning is performed by trusted server code only
- raw profile rows remain service-role-managed until user-specific RLS is introduced

## Future OAuth Compatibility
Phase 3A is compatible with future OAuth without redesigning the identity model.

Why:
- identity remains anchored to `auth.users.id`
- `profiles.id` is already a stable foreign key to `auth.users`
- provider-specific metadata can continue to flow through Supabase `user_metadata`
- display name and avatar bootstrap logic already reads auth metadata when available

No OAuth providers are implemented in this phase.

## Verification Guidance
Phase 3A verification should confirm:
- profile creation flow works for an authenticated Supabase user
- `getCurrentUser()` returns `null` without a valid session
- `requireAuth()` rejects unauthenticated requests with `401`
- `requireRole('admin')` rejects non-admin users with `403`
- duplicate usernames are rejected at the database layer

## Phase 3B Compatibility
Phase 3A intentionally prepares the next phase without implementing ownership yet.

Phase 3B can now safely add:
- `scripts.creator_id` foreign key to `auth.users(id)`
- creator-bound script creation using authenticated session identity
- owner-based RLS policies on `scripts` and `script_versions`
- creator-safe analytics endpoints based on owned scripts
