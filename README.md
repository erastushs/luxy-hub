# LuxyHub

LuxyHub is a Next.js 16 application for Roblox script distribution, key validation, and creator dashboard operations. The current implementation runs as a single App Router application on `www.luxyhub.space` with Supabase Auth, Supabase Postgres, secure delivery sessions, and defense-in-depth security controls.

## Current Features

- Public landing, key acquisition, token verification, and API docs pages
- Work.ink-backed key generation and replay-protected token verification
- Creator Dashboard for scripts, analytics, versions, delivery builds, and profile management
- Backend key monetization infrastructure with Work.ink/free keys, premium keys, key type alignment, and device limits through `/api/validate`
- Supabase email/password login protected by Cloudflare Turnstile
- Server-side Turnstile verification before authentication
- Failed-login rate limiting by IP and hashed email bucket
- Session-based script ownership and dashboard access control
- Public script metadata APIs with minimized response fields
- Raw script delivery for public and unlisted scripts
- Secure loader bootstrap with one-time delivery sessions for ready public/unlisted builds
- SHA-256 hashed delivery session tokens, consume-once validation, and 60-second TTL
- Security headers, CORS controls, API body limits, route rate limiting, and cleanup retention jobs
- Production runtime performance optimizations for delivery build metadata reads, event write projections, cleanup batching, and safe expired session pruning
- Phase 7D/7E.1 rate-limit shadow runtime with PostgreSQL authoritative, Valkey shadow comparison, production health reporting, and Cloudflare-aware client IP resolution

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Supabase Auth and Postgres
- Cloudflare Turnstile
- Vitest

## Getting Started

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Required Environment Variables

Production requires:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_API_KEY=
CRON_SECRET=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
ANALYTICS_PEPPER=
```

Additional delivery payload configuration is optional:

```env
DELIVERY_PAYLOAD_SECRET=
DELIVERY_PAYLOAD_KEY_ID=
NEXT_PUBLIC_SITE_URL=
```

Operational monitoring uses a separate token:

```env
LUXY_MONITOR_TOKEN=
```

`ADMIN_API_KEY` is used only for admin-bearer access to private raw script reads. `CRON_SECRET` protects `/api/cleanup`, `/api/internal/event-worker`, and `/api/internal/check-alerts`; cron secrets are not accepted for admin access. `LUXY_MONITOR_TOKEN` is only for operational monitoring endpoints and is not part of the creator auth flow.

## Authentication Flow

```text
User
  -> /login form
  -> Cloudflare Turnstile widget
  -> server-side Turnstile verification
  -> failed-login rate limit check
  -> Supabase signInWithPassword()
  -> Supabase session cookies
  -> /dashboard
```

After a failed login action, the Turnstile widget resets automatically so the next attempt uses a fresh single-use token.

## Secure Delivery Flow

```text
Loader
  -> GET /api/loader/[slug]
  -> POST /api/delivery/session
  -> short-lived session_token
  -> POST /api/delivery/fetch
  -> SHA-256 token hash lookup
  -> consume-once session validation
  -> no-store runtime payload response
```

Delivery session tokens are never stored raw. The database stores SHA-256 hashes, and sessions expire after 60 seconds or after the first successful fetch.

## Project Structure

```text
app/
├── actions/              Server Actions for auth, scripts, profile, builds
├── api/                  Route Handlers
├── dashboard/            Creator Dashboard pages and components
├── lib/                  Auth, services, repositories, loader, delivery logic
├── login/                Login page and Turnstile widget
├── docs/api              API documentation page
└── globals.css           Tailwind v4 CSS-first theme

migrations/               Supabase migrations and rollbacks
schema.sql                Consolidated schema reference
__tests__/                Vitest test suite
```

## Verification

```bash
npm run lint
npx vitest run
npm run build
```

## Current Runtime

| Area | Current Production State |
|---|---|
| PostgreSQL | Authoritative |
| Valkey | Shadow |
| Health | Healthy |
| Parity | 100% |
| Runtime mode | `RATE_LIMIT_MODE=shadow` |
| Canary | Disabled |
| Rollback | Immediate PostgreSQL via `RATE_LIMIT_MODE=postgres` |

Production is deployed behind Cloudflare. Rate-limit client IP resolution prioritizes `CF-Connecting-IP`, then `X-Vercel-Forwarded-For`, `X-Forwarded-For`, and `X-Real-IP`, with `127.0.0.1` as the local fallback.

## Documentation

- `docs/README.md` — documentation index and source-of-truth map
- `docs/architecture/ARCHITECTURE.md` — current system architecture
- `docs/api/REFERENCE.md` — current API reference and response shapes
- `docs/runtime/SECURE_DELIVERY.md` — current secure delivery runtime behavior
- `docs/runtime/EVENT_QUEUE.md` — current event queue/runtime behavior
- `docs/runtime/BUILD_PIPELINE.md` — current build pipeline runtime behavior
- `docs/roadmap/TODO.md` — current roadmap, completed phases, and planned Phase 7E.2 canary scope
- `docs/deployment/DEPLOYMENT_CHECKLIST.md` — deployment and production validation
- `docs/architecture/ARCHITECTURE.md` — secure delivery design and implementation notes
- `docs/archive/integration/DASHBOARD_USER_GUIDE.md` — creator dashboard usage

## License

This project is provided for educational and personal use only.
