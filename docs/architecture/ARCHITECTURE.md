# LuxyHub Architecture

Last updated: 2026-06-11
Status: Current implementation after Creator Dashboard V1, secure delivery, Phase 6 loader integration, Analytics V1, Phase 8 Event Platform production verification, and Phase 7A license foundation closeout. Phase 7B Runtime License Enforcement is the active planning track.

## Overview

LuxyHub is a Next.js 16 application that currently provides:

- Public website pages and key flow pages
- Work.ink-backed key generation and validation APIs
- Script CDN metadata, upload, raw delivery, and analytics APIs
- Creator Dashboard V1 for script management, analytics, versions, and profile management
- Secure loader delivery with delivery builds and one-time delivery sessions
- Phase 7A license foundation, license management dashboard, and license analytics dashboard
- Supabase-backed authentication, ownership enforcement, RLS, Turnstile login protection, rate limiting, and audit logging

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
├── /dashboard/scripts/[slug]/webhooks
├── /dashboard/scripts/[slug]/events
├── /dashboard/scripts/[slug]/events/[eventId]
├── /dashboard/scripts/[slug]/events/dead-letter
├── /dashboard/scripts/[slug]/analytics/events
├── /dashboard/scripts/[slug]/security
├── /dashboard/admin/alerts
├── /dashboard/licenses
├── /dashboard/licenses/analytics
├── /dashboard/analytics
├── /dashboard/versions
├── /dashboard/versions/[slug]
├── /dashboard/versions/[slug]/[versionId]
├── /dashboard/profile
├── /api/loader/[slug]
├── /api/delivery/session
├── /api/delivery/fetch
├── /api/events/report
├── /api/internal/event-worker
├── /api/internal/check-alerts
├── /api/cleanup
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

`/login` provides email/password login through Supabase Auth. The login form includes Cloudflare Turnstile and submits the Turnstile token with the credentials. Registration, password reset UI, and OAuth providers are not implemented in V1.

### Creator Dashboard

Dashboard routes are served under `www.luxyhub.space/dashboard` within the main application.

Implemented dashboard sections:

- `/dashboard` — dashboard home with analytics overview cards
- `/dashboard/scripts` — script listing with search, visibility filter, pagination, desktop table, and mobile cards
- `/dashboard/scripts/new` — create script form
- `/dashboard/scripts/[slug]/edit` — edit script metadata form
- `/dashboard/scripts/[slug]/webhooks` — Discord webhook configuration and test
- `/dashboard/scripts/[slug]/events` — event history, detail, and dead-letter operations with replay
- `/dashboard/scripts/[slug]/analytics/events` — event analytics: overview, trends, provider health, queue health, platform security signals
- `/dashboard/scripts/[slug]/security` — security dashboard: platform-wide signal monitoring, risk assessment, anomaly detection
- `/dashboard/admin/alerts` — admin-only internal alert dashboard with active/resolved views and severity filters
- `/dashboard/licenses` — license management: create, enable, disable, revoke, assignments, filters, search, sorting, selection UI
- `/dashboard/licenses/analytics` — license analytics: status cards, distribution, recent licenses, recent assignments
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
Cloudflare Turnstile widget issues single-use token
  |
  v
Server Action verifies token with Cloudflare siteverify
  |
  v
Failed-login rate limit check by IP and hashed email bucket
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
- `app/lib/auth/turnstile.ts` — server-side Turnstile siteverify integration
- `app/lib/supabase/server.ts` — request-scoped Supabase SSR client
- `app/lib/supabase/proxy.ts` — proxy-layer session refresh and redirects
- `app/actions/auth.ts` — login/logout Server Actions

Turnstile tokens are single-use. After a failed login action, the login widget resets and clears the hidden token field so the next attempt receives a fresh token.

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
- Loader and delivery APIs: `/api/loader/[slug]`, `/api/delivery/session`, `/api/delivery/fetch`
- License APIs: `/api/licenses`, `/api/licenses/[id]/enable`, `/api/licenses/[id]/disable`, `/api/licenses/[id]/revoke`, `/api/licenses/[id]/assignments`, `/api/licenses/[id]/assignments/[assignmentId]`

Dashboard UI primarily uses Server Components and Server Actions. The dashboard API routes exist for programmatic access and are still protected by session auth, rate limits, service-layer validation, and ownership checks.
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
- `delivery_builds`
- `delivery_sessions`
- `webhook_config`
- `event_logs`
- `alert_events`
- `licenses`
- `license_assignments`

Security posture:

- RLS is enabled across the schema, including `alert_events`.
- `scripts` and `script_versions` have owner-aware policies.
- Operational tables (`verification_logs`, `event_logs`, `alert_events`, `rate_limits`, `key_usage`, `used_workink_tokens`, `delivery_sessions`) have deny-all policies for `anon` and `authenticated`; Supabase service-role access only.
- `webhook_config` is owner-aware with service-role compatibility; one config per script.
- Application services use Supabase admin access with explicit auth and ownership checks.
- `delivery_sessions.session_token_hash` stores SHA-256 hashes, never raw delivery tokens.
- `delivery_sessions.event_secret` is generated per delivery session, persisted server-side, and returned only to the runtime alongside the raw session token for HMAC event signing; session token hashes remain server-only.
- Queue worker polls `event_logs` via `POST /api/internal/event-worker` (CRON_SECRET auth). Production scheduling uses GitHub Actions every 5 minutes against `https://luxyhub.vercel.app/api/internal/event-worker`; this avoids Cloudflare Bot Fight Mode challenges on the public custom domain. Uses `event_logs.claimed_at` leases to prevent overlapping workers from processing the same pending event concurrently.
- Alert evaluation runs inline after queue processing — no dedicated alert cron.
- Bulk dead-letter replay is capped at 100 events per operation; remaining events must be replayed in subsequent batches.
## Script Delivery State


Raw script delivery remains available through:

```text
GET /api/scripts/[slug]/raw
```

This endpoint returns raw script content for public and unlisted scripts. Private raw reads require `Authorization: Bearer <ADMIN_API_KEY>`. Authenticated creator/session access is used for management and owner-scoped APIs; cron secrets are not accepted for admin raw reads.

Secure loader delivery is also implemented:

```text
GET /api/loader/[slug]
  |
  v
Lua bootstrap POSTs /api/delivery/session
  |
  v
Temporary session_token, event_secret, expires_in = 60
  |
  v
Lua bootstrap POSTs /api/delivery/fetch
  |
  v
Server hashes token with SHA-256, validates ready build, consumes session once
  |
  v
Runtime payload response with event_secret and Cache-Control: no-store
```

Delivery sessions are only issued for public or unlisted scripts with a ready inline encrypted delivery build for the current version. `/api/delivery/session` and `/api/delivery/fetch` return the per-session `event_secret` needed to sign `/api/events/report` payloads. `/api/delivery/fetch` consumes the session before returning the runtime payload; reused, expired, malformed, or missing sessions return `Invalid delivery session`.

Delivery builds are created automatically after script creation, content version creation, and visibility publish actions. Build payloads use the current `delivery-build-v1` and `inline-json-v1` formats with AES-256-GCM payload packaging, gzip compression, and SHA-256 integrity fields. The current loader executes the server-produced runtime payload with `loadstring`.

Phase 7A added `scripts.access_mode` as a separate concern from `scripts.visibility`:

| Concern | Values | Purpose |
|---|---|---|
| `visibility` | `public`, `unlisted`, `private` | Discoverability and whether a script can be publicly addressed by slug |
| `access_mode` | `public`, `key_required`, `license_required` | Delivery authorization requirement |

Approved Phase 7 authorization boundary:

- Authorization occurs only during `POST /api/delivery/session`.
- Authorization must not occur during delivery fetch, payload delivery, runtime execution, or event reporting.
- `public` creates a delivery session immediately when the script/build is deliverable.
- `key_required` reuses the existing Work.ink key ecosystem.
- `license_required` uses premium creator-generated licenses and assignment/device limits.

Phase 7A implemented the license foundation, creator license lifecycle management, assignment create/remove workflows, and dashboard analytics. Phase 7B will harden runtime license enforcement, assignment capacity, customer identifier handling, loader credential forwarding, license counters, and runtime audit trail behavior.

## Analytics Architecture

Analytics V1 source of truth:

- `script_executions` for secure delivery execution counts.
- `script_downloads` remains historical/raw CDN download telemetry for legacy raw delivery analytics.

Dashboard analytics includes:

- Portfolio overview counts
- 7-day and 30-day download trends
- Top scripts by downloads
- Per-script analytics API response

Analytics V1 is complete. Current analytics queries use owner-scoped service/repository access and cached execution counters where implemented. Future performance work can still consolidate query shapes or add short-TTL owner-scoped caching, but this is not a Phase 7 blocker.

## Audit Logging

The audit system records creator-sensitive script actions:

- `script.created`
- `script.updated`
- `script.deleted`
- `script.visibility_changed`

Audit logging is fire-and-forget. Audit failures must not block user operations.

## Rate Limiting

Rate limits are stored in the `rate_limits` table and enforced fail-closed. Each route uses an endpoint-specific key such as `VALIDATE`, `SCRIPT_RAW`, `DASHBOARD_SCRIPTS_LIST`, or `DASHBOARD_VERSIONS_GET`.

Login uses a failed-attempt limiter that records only failed Supabase login attempts after Turnstile succeeds:

- IP bucket: 5 failed attempts per 5 minutes per IP
- Email bucket: 10 failed attempts per 15 minutes per normalized email
- Email bucket identifiers are SHA-256 hashes using `ANALYTICS_PEPPER`; raw email addresses are not stored in `rate_limits`
- Successful login clears the email failure bucket. IP failure rows expire naturally through the time window and cleanup job.

Loader delivery rate limits:

- `LOADER_BOOTSTRAP`: 60 requests per minute per IP
- `DELIVERY_SESSION`: 20 requests per minute per IP
- `DELIVERY_FETCH`: 40 requests per minute per IP

## Deployment Requirements

Completed infrastructure:

- Cloudflare public traffic protection, DNS, and SSL/TLS.
- Vercel deployment for the single Next.js app.
- GitHub Actions scheduler invokes `https://luxyhub.vercel.app/api/internal/event-worker` every 5 minutes.
- Required GitHub repository secrets: `EVENT_WORKER_URL=https://luxyhub.vercel.app/api/internal/event-worker` and `CRON_SECRET`.
- Vercel daily cron remains for `/api/cleanup`.

Pending infrastructure:

- Better Stack, Uptime Kuma, or equivalent external monitoring stack.
- External monitoring alert routing and status page maturity.

Cloudflare operational note: do not use `https://www.luxyhub.space/api/internal/event-worker` for GitHub Actions. Cloudflare Bot Fight Mode or challenge rules can block Actions traffic before it reaches Vercel. No Cloudflare bypass rule is required because the scheduler uses the Vercel hostname directly.

The worker route must receive `Authorization: Bearer <CRON_SECRET>`. A dedicated `/api/internal/check-alerts` cron is not required because the event worker runs `checkAlerts()` after `processEventQueue()`.

## Security Status

Implemented:

- Cloudflare Turnstile on `/login`
- Server-side Turnstile verification before password authentication
- Automatic Turnstile reset after failed login actions to avoid stale single-use token reuse
- Failed-login IP and hashed-email rate limiting
- Supabase session validation for dashboard pages and Server Actions
- Ownership validation for script, version, analytics, and build operations
- Admin and cron secret separation: `ADMIN_API_KEY` is not replaced by `CRON_SECRET`
- Public API response minimization for public script list/detail responses
- Database-backed API rate limiting with fail-closed behavior
- Security headers in `proxy.ts`, including CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy, and Cloudflare Turnstile frame/connect/script allowances
- CORS allowlist behavior for sensitive API paths
- Private raw delivery responses use `Cache-Control: no-store`
- Loader and delivery responses use `Cache-Control: no-store`
- Delivery sessions use SHA-256 token hashes, 60-second TTL, and consume-once validation

Future improvements:

- CSP nonce migration to remove broad inline script/style allowances
- Dependency updates when stable security fixes are available
- Security monitoring and alerting for authentication and delivery anomalies
- Login anomaly detection beyond local failed-attempt counters
- Phase 7 authorization monitoring for access mode, Work.ink key, and license-required session attempts

## Architecture Decisions

Accepted Architecture Decision Records are stored in `docs/architecture/decisions/`.

Current accepted decisions:

- `decisions/ADR-001-delivery-session-authorization-boundary.md` — delivery sessions are the server-side authorization boundary before one-time payload fetch.
- `decisions/ADR-002-postgres-backed-event-queue.md` — runtime events use a PostgreSQL-backed queue instead of Redis or an external broker at current scale.
- `decisions/ADR-003-github-actions-event-worker-scheduler.md` — GitHub Actions schedules the event worker against the Vercel hostname.
- `decisions/ADR-004-inline-alert-evaluation.md` — internal alerts are evaluated inline after worker execution, with no separate alert scheduler.
- `decisions/ADR-005-build-automation-failure-model.md` — source mutations and derived delivery build generation have separate failure and recovery behavior.
- `decisions/ADR-006-verification-logs-as-monitoring-counters.md` — monitoring counters originate from `verification_logs` and runtime event tables until a dedicated metrics system is justified.
- `decisions/ADR-007-webhook-credential-storage-risk.md` — current webhook credential storage risks are accepted with operational mitigations and rotation processes.
- `decisions/ADR-008-payload-secret-fallback-policy.md` — payload encryption prefers `DELIVERY_PAYLOAD_SECRET` with documented fallback and rotation implications.
- `decisions/ADR-009-license-authorization-model.md` — `scripts.access_mode` is the accepted license/key/public delivery authorization model; Phase 7B implementation and hardening are complete.

## Roadmap Alignment

Current program:

- Release Candidate Program: active.

Completed phases:

- Phase 4.1 — UI Polish: complete
- Phase 4.2 — Performance Review: complete
- Phase 4.3 — Documentation Review: complete
- Phase 4.4 — Production Hardening: complete
- Phase 5 — Secure Script Delivery: complete
- Phase 6 — Loader Integration: complete
- Phase 7A — License Foundation and Dashboard: complete
- Phase 7B — Runtime License Enforcement: complete
- Analytics V2 — complete
- Testing Expansion — complete
- Operational Hardening — complete
- Phase 8 — Event Reporting & Webhook Platform: complete / 100%, production verified, and Roblox verified (database foundation, HMAC reporting API, replay and timestamp validation, queue worker with claim leases, dead-letter handling, Discord provider, dashboard webhook management, event operations, analytics dashboard, security dashboard, internal alerts, GitHub Actions scheduler, event retention cleanup, monitoring counters, and RLS hardening). Telegram and Slack providers, webhook encryption at rest, nonce atomicity improvements, and durable audit event stream expansion are deferred future enhancements and accepted risks, not Phase 8 blockers.

Future ordering:

1. Release Candidate Validation
2. Production rollout review
3. Phase 9 — Internal Operations & Release Workflow
4. Phase 10 — Scale & Infrastructure (Optional)

Deprecated roadmap assumptions removed from current architecture:

- Separate `dashboard.luxyhub.space`, `api.luxyhub.space`, `cdn.luxyhub.space`, and `vault.luxyhub.space` services are not implemented.
- Marketplace architecture is not part of the current roadmap.
- Phase 7A access modes and premium license management foundation are implemented; Phase 7B runtime enforcement and hardening are complete — see `PHASE7_LICENSE_ARCHITECTURE.md` and `../phases/phase7/PHASE_7B_DESIGN.md`.
