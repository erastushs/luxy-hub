# Security Validation Report

Last updated: 2026-06-08

## Scope

Validated against the current LuxyHub implementation in this repository after dashboard, secure delivery, Turnstile, and login rate-limit hardening.

## Findings

- Supabase session authentication protects dashboard pages, Server Actions, and creator write APIs.
- `/login` requires Cloudflare Turnstile, verified server-side before password authentication.
- Failed login attempts are rate limited after Turnstile by IP and hashed email bucket.
- `ADMIN_API_KEY` is required for private raw script reads; `CRON_SECRET` is not accepted as an admin fallback.
- `/api/cleanup` requires `CRON_SECRET` and does not accept `ADMIN_API_KEY` as a substitute.
- Script ownership is enforced from the server session; `creator_id` is never accepted from client payloads.
- Public script list/detail responses minimize data and omit internal IDs, owner IDs, current version IDs, and content.
- Delivery sessions store SHA-256 token hashes, expire after 60 seconds, and are consumed once before runtime payload delivery.
- Loader and delivery responses use `Cache-Control: no-store`.
- Rate limiting is active for public APIs, dashboard APIs, loader/delivery APIs, and failed login attempts.
- Security headers and sensitive-path CORS controls are applied in `proxy.ts`.
- RLS is enabled on current application tables; operational tables remain service-role-only for browser users.

## Notes

- Raw script delivery remains available for public and unlisted scripts.
- Private raw script access remains admin-bearer only.
- License, entitlement, marketplace, and paid-access controls are not implemented.
- CSP currently allows inline script/style and should move to nonce-based policy when practical.

## Validation Evidence

- `app/actions/auth.ts`
- `app/lib/auth/turnstile.ts`
- `app/lib/auth/admin-auth.ts`
- `app/lib/auth/session-auth.ts`
- `app/lib/auth/ownership.ts`
- `app/lib/repositories/rate-limit-repository.ts`
- `app/api/scripts/**`
- `app/api/loader/[slug]/route.ts`
- `app/api/delivery/session/route.ts`
- `app/api/delivery/fetch/route.ts`
- `proxy.ts`
- `schema.sql`
- `migrations/001_enable_rls.sql` through `migrations/007_delivery_sessions.sql`

## Result

Code-level security controls are present for the implemented feature set. Live production confirmation is still required for deployed environment variables, Supabase migration state, Cloudflare Turnstile configuration, and operational monitoring.
