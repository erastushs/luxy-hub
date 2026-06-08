# LuxyHub Architecture

Last updated: 2026-06-08
Status: Current implementation after Creator Dashboard V1 and Phase 4.2

## Overview

LuxyHub is a Next.js 16 application that currently provides:

- Public website pages and key flow pages
- Work.ink-backed key generation and validation APIs
- Script CDN metadata, upload, raw delivery, and analytics APIs
- Creator Dashboard V1 for script management, analytics, versions, and profile management
- Supabase-backed authentication, ownership enforcement, RLS, rate limiting, and audit logging

The current production architecture is a single Next.js application. Dedicated `dashboard`, `api`, `cdn`, or `vault` subdomains are not implemented.

## Current Route Topology

```text
www.luxyhub.space
├── /
├── /login
├── /get-key
├── /verify-token
├── /docs/api
├── /dashboard
├── /dashboard/scripts
├── /dashboard/scripts/new
├── /dashboard/scripts/[slug]/edit
├── /dashboard/analytics
├── /dashboard/versions
├── /dashboard/versions/[slug]
├── /dashboard/versions/[slug]/[versionId]
├── /dashboard/profile
└── /api/*
```

## Runtime Architecture

```text
Browser / Loader / Admin Client
  |
  v
Next.js 16 App Router
  |
  |-- Public pages
  |-- Login page
  |-- Dashboard Server Components
  |-- Server Actions
  |-- Route Handlers under /api
  |
  v
Service Layer
  |
  |-- auth/session validation
  |-- ownership validation
  |-- input validation
  |-- audit logging orchestration
  |
  v
Repository Layer
  |
  v
Supabase Postgres + Supabase Auth
```

## Frontend Architecture

### Public Application

Public routes provide the landing pages, key acquisition flow, token verification flow, and API documentation.

### Authentication UI

`/login` provides email/password login through Supabase Auth. Registration, password reset UI, and OAuth providers are not implemented in V1.

### Creator Dashboard

Dashboard routes are served under `www.luxyhub.space/dashboard` within the main application.

Implemented dashboard sections:

- `/dashboard` — dashboard home with analytics overview cards
- `/dashboard/scripts` — script listing with search, visibility filter, pagination, desktop table, and mobile cards
- `/dashboard/scripts/new` — create script form
- `/dashboard/scripts/[slug]/edit` — edit script metadata form
- `/dashboard/analytics` — portfolio analytics cards, 7-day/30-day SVG charts, top scripts table
- `/dashboard/versions` — script selector for version history
- `/dashboard/versions/[slug]` — paginated version history for one script
- `/dashboard/versions/[slug]/[versionId]` — version detail with content snapshot
- `/dashboard/profile` — profile view/edit, copy user ID, logout

### Component Model

- Pages and layouts are Server Components by default.
- Client Components are used only for interactivity such as forms, sidebar mobile state, modals, copy buttons, pagination, and local UI state.
- Server Actions handle dashboard mutations for auth, scripts, and profile updates.
- Dashboard pages fetch data server-side through services instead of making client-side Supabase calls.

## Next.js 16 Conventions

The project uses Next.js 16 App Router conventions:

- `proxy.ts` is used instead of the older `middleware.ts` convention.
- Route handlers live in `app/api/**/route.ts`.
- Server Actions live under `app/actions/`.
- Tailwind v4 uses CSS-first configuration through `app/globals.css`.
- Next.js docs in `node_modules/next/dist/docs/` must be checked before changing framework-sensitive code.

## Auth Model

Supabase Auth is the source of truth for creator identity.

Flow:

```text
User submits /login form
  |
  v
Server Action calls supabase.auth.signInWithPassword()
  |
  v
Supabase SSR cookies are set/refreshed
  |
  v
proxy.ts protects /dashboard routes
  |
  v
Dashboard layout calls getCurrentUser()
  |
  v
Profile is loaded or auto-provisioned
```

Authentication utilities:

- `app/lib/auth/session-auth.ts` — `getCurrentUser()`, `requireAuth()`
- `app/lib/supabase/server.ts` — request-scoped Supabase SSR client
- `app/lib/supabase/proxy.ts` — proxy-layer session refresh and redirects
- `app/actions/auth.ts` — login/logout Server Actions

## Ownership Model

Creator ownership is single-owner per script in V1.

Rules:

- `scripts.creator_id` references `auth.users.id`.
- Script creation derives `creator_id` from the authenticated server session.
- Client payloads never choose or override `creator_id`.
- Script update/delete/detail operations validate ownership server-side.
- Version access is gated through the parent script owner.
- Analytics queries join or filter through owner-scoped scripts.
- Non-owned and missing resources return not-found style responses to avoid existence leaks.

Ownership utilities:

- `app/lib/auth/ownership.ts`
- `assertScriptOwner()`
- `getOwnedScript()`
- `requireOwnership()`

## API Architecture

API routes are served by the same Next.js application under `/api/*`.

Implemented API groups:

- Key APIs: `/api/validate`, `/api/verify-workink`, `/api/generate-key`
- System APIs: `/api/health`, `/api/cleanup`, `/api/auth/callback`
- Public/session-aware script APIs: `/api/scripts`, `/api/scripts/[slug]`, `/api/scripts/[slug]/raw`, `/api/scripts/[slug]/stats`, `/api/scripts/[slug]/publish`
- Dashboard APIs: `/api/dashboard/scripts`, `/api/dashboard/scripts/[slug]`, `/api/dashboard/analytics/overview`, `/api/dashboard/analytics/downloads`, `/api/dashboard/scripts/[slug]/stats`, `/api/dashboard/scripts/[slug]/versions`, `/api/dashboard/scripts/[slug]/versions/[versionId]`

Dashboard UI primarily uses Server Components and Server Actions. The dashboard API routes exist for programmatic access and are still protected by session auth, rate limits, service-layer validation, and ownership checks.

## Database Architecture

Current tables:

- `keys`
- `used_workink_tokens`
- `rate_limits`
- `verification_logs`
- `key_usage`
- `scripts`
- `script_versions`
- `script_downloads`
- `profiles`
- `audit_logs`

Security posture:

- RLS is enabled across the schema.
- `scripts` and `script_versions` have owner-aware policies.
- Operational tables remain service-role-only for browser users.
- Application services use Supabase admin access with explicit auth and ownership checks.

## Script Delivery State

Current script delivery is implemented through:

```text
GET /api/scripts/[slug]/raw
```

This endpoint still returns raw script content for public/unlisted scripts and protected private scripts. Secure loader-first delivery, temporary delivery tokens, obfuscation, encryption, and anti-curl delivery architecture are planned for Phase 5 — Secure Script Delivery and Phase 6 — Loader Integration.

## Analytics Architecture

Analytics source of truth:

- `script_downloads`

Dashboard analytics includes:

- Portfolio overview counts
- 7-day and 30-day download trends
- Top scripts by downloads
- Per-script analytics API response

Current analytics queries are live aggregate queries. Phase 4.2 identified future performance work around top-script N+1 aggregation, SQL date bucketing, and possible short-TTL owner-scoped caching after query consolidation.

## Audit Logging

The audit system records creator-sensitive script actions:

- `script.created`
- `script.updated`
- `script.deleted`
- `script.visibility_changed`

Audit logging is fire-and-forget. Audit failures must not block user operations.

## Rate Limiting

Rate limits are stored in the `rate_limits` table and enforced fail-closed. Each route uses an endpoint-specific key such as `VALIDATE`, `SCRIPT_RAW`, `DASHBOARD_SCRIPTS_LIST`, or `DASHBOARD_VERSIONS_GET`.

## Roadmap Alignment

Current priorities:

- Phase 4.1 — UI Polish: complete
- Phase 4.2 — Performance Review: complete
- Phase 4.3 — Documentation Review: current
- Phase 4.4 — Production Hardening: next
- Phase 5 — Secure Script Delivery
- Phase 6 — Loader Integration
- Phase 7 — License & Key Management, only after loader requirements are finalized
- Phase 8 — Internal Operations & Release Workflow
- Phase 9 — Scale & Infrastructure (Optional)

Deprecated roadmap assumptions removed from current architecture:

- Separate `dashboard.luxyhub.space`, `api.luxyhub.space`, `cdn.luxyhub.space`, and `vault.luxyhub.space` services are not implemented.
- Marketplace architecture is not part of the current roadmap.
- License management is not the immediate next phase.
