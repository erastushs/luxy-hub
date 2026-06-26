# LuxyHub V1 Environment Variables

Status: Canonical V1 environment variable reference  
Last updated: 2026-06-11

This document describes production environment variables and GitHub Actions secrets used by LuxyHub V1. It is documentation only and does not change runtime behavior.

## Summary

Required variables and secrets:

| Name | Required | Location |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Vercel |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Vercel |
| `CRON_SECRET` | Yes | Vercel and GitHub Actions |
| `EVENT_WORKER_URL` | Yes | GitHub Actions |
| `ADMIN_API_KEY` | Yes | Vercel |
| `ANALYTICS_PEPPER` | Yes | Vercel |
| `TURNSTILE_SECRET_KEY` | Yes | Vercel |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Yes | Vercel |

Optional variables:

| Name | Required | Location |
|---|---|---|
| `DELIVERY_PAYLOAD_SECRET` | No | Vercel |
| `DELIVERY_PAYLOAD_KEY_ID` | No | Vercel |
| `NEXT_PUBLIC_SITE_URL` | No | Vercel |
| `INTERNAL_ALERT_DISCORD_WEBHOOK` | No | Vercel |

## Delivery Session Variables

| Name | Required | Location |
|---|---|---|
| `DELIVERY_SESSION_MODE` | No | Vercel |
| `DELIVERY_SESSION_TTL_SECONDS` | No | Vercel |
| `DELIVERY_SESSION_CANARY_PERCENT` | No | Vercel |

## Required Variables

### `NEXT_PUBLIC_SUPABASE_URL`

Purpose: Public Supabase project URL used by Supabase SSR clients and auth/session refresh.

Required/Optional: Required.

Used by:

- `app/lib/supabase.ts`
- `app/lib/supabase/server.ts`
- `app/lib/supabase/proxy.ts`
- `app/api/auth/callback/route.ts`

Security considerations:

- This is public by design because it is prefixed with `NEXT_PUBLIC_`.
- It must point to the production Supabase project in production.

Rotation guidance:

- Usually changes only when moving to a different Supabase project.
- Update Vercel production variable and redeploy.
- Verify login, dashboard session refresh, and API database access after change.

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Purpose: Public Supabase anon key used by Supabase SSR clients and auth/session refresh.

Required/Optional: Required.

Used by:

- `app/lib/supabase.ts`
- `app/lib/supabase/server.ts`
- `app/lib/supabase/proxy.ts`
- `app/api/auth/callback/route.ts`

Security considerations:

- Public by design because it is prefixed with `NEXT_PUBLIC_`.
- RLS policies must protect data accessible through anon/authenticated roles.

Rotation guidance:

- Rotate in Supabase if project keys are regenerated.
- Update Vercel and redeploy.
- Verify login, dashboard, and public API behavior.

### `SUPABASE_SERVICE_ROLE_KEY`

Purpose: Server-side service-role access for repositories, operational tables, cleanup, delivery, events, licenses, and dashboard service operations.

Required/Optional: Required.

Used by:

- `app/lib/supabase.ts`
- Server-side repositories and services through `supabaseAdmin`.
- Delivery payload encryption fallback when `DELIVERY_PAYLOAD_SECRET` is unset.

Security considerations:

- Highly sensitive. Never expose to browser code or public logs.
- Bypasses RLS when used server-side, so application-level ownership checks remain mandatory.
- If used as delivery payload secret fallback, rotating this key can affect payload decryption unless delivery builds are rebuilt with the new effective secret.

Rotation guidance:

- Prefer setting `DELIVERY_PAYLOAD_SECRET` before rotating service-role keys to decouple database access from payload encryption.
- Rotate in Supabase, update Vercel, redeploy.
- Verify database-backed APIs, auth dashboard pages, delivery build/fetch, event worker, cleanup, and license APIs.
- Rebuild delivery payloads if the effective delivery payload secret changed.

### `CRON_SECRET`

Purpose: Shared bearer token for internal operational endpoints.

Required/Optional: Required.

Used by:

- `POST /api/cleanup`
- `POST /api/internal/event-worker`
- `POST /api/internal/check-alerts`
- `.github/workflows/event-worker.yml` as a GitHub Actions secret.

Security considerations:

- Sensitive. Treat as an operational credential.
- Must be different from `ADMIN_API_KEY`.
- Must not be printed directly in CI logs.

Rotation guidance:

- Generate a strong random value, for example a 32-byte or longer random secret.
- Update Vercel `CRON_SECRET` and GitHub Actions `CRON_SECRET` together.
- Redeploy Vercel after updating.
- Run manual checks against `/api/internal/event-worker`, `/api/internal/check-alerts`, and `/api/cleanup`.

### `EVENT_WORKER_URL`

Purpose: GitHub Actions target URL for the event queue worker.

Required/Optional: Required for production event processing.

Used by:

- `.github/workflows/event-worker.yml`

Expected production value:

```text
https://luxyhub.vercel.app/api/internal/event-worker
```

Security considerations:

- Not secret by itself, but stored as a GitHub Actions secret for operational consistency.
- Should use the Vercel hostname to avoid Cloudflare Bot Fight Mode challenges on the public custom domain.

Rotation guidance:

- Update when the production Vercel project hostname changes.
- Run the GitHub Actions workflow manually after updating.
- Verify HTTP `200` and `success: true`.

### `ADMIN_API_KEY`

Purpose: Admin bearer token for private raw script reads.

Required/Optional: Required.

Used by:

- `app/lib/auth/admin-auth.ts`
- Private raw script delivery authorization.

Security considerations:

- Sensitive. Keep separate from `CRON_SECRET`.
- Do not use for internal cron routes.
- Do not expose in browser code or logs.

Rotation guidance:

- Generate a new strong random value.
- Update Vercel and redeploy.
- Verify private raw reads reject the old key and accept the new key.

### `ANALYTICS_PEPPER`

Purpose: Pepper for hashing analytics identifiers and login-failure buckets.

Required/Optional: Required.

Used by:

- `app/lib/repositories/script-repository.ts`
- `app/lib/repositories/rate-limit-repository.ts`

Security considerations:

- Sensitive. Protects hashed IP/user-agent/email-derived buckets from easy precomputation.
- Changing it breaks continuity for distinct-visitor and bucket correlation across the rotation boundary.

Rotation guidance:

- Rotate only when necessary or after suspected exposure.
- Update Vercel and redeploy.
- Expect analytics continuity changes after rotation.
- Verify rate limiting and analytics still function.

### `TURNSTILE_SECRET_KEY`

Purpose: Server-side Cloudflare Turnstile verification secret for login protection.

Required/Optional: Required.

Used by:

- `app/lib/auth/turnstile.ts`

Security considerations:

- Sensitive. Never expose to client code.
- Must match the configured Cloudflare Turnstile site.

Rotation guidance:

- Rotate in Cloudflare Turnstile dashboard.
- Update Vercel and redeploy.
- Verify `/login` accepts valid Turnstile tokens and rejects missing/invalid tokens.

### `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

Purpose: Public Cloudflare Turnstile site key rendered on `/login`.

Required/Optional: Required.

Used by:

- `app/login/page.tsx`

Security considerations:

- Public by design because it is prefixed with `NEXT_PUBLIC_`.
- Must match the production hostname and `TURNSTILE_SECRET_KEY` configuration.

Rotation guidance:

- Update when Cloudflare Turnstile site key changes.
- Update Vercel and redeploy.
- Verify the login widget renders and login works.

## Optional Variables

### `DELIVERY_PAYLOAD_SECRET`

Purpose: Explicit secret used for delivery payload encryption/decryption.

Required/Optional: Optional, but recommended for production secret separation.

Used by:

- `app/lib/services/delivery-build-service.ts`
- `app/lib/delivery/payload-consumer.ts`

Security considerations:

- Sensitive. Must be strong and stable across build and fetch operations.
- If unset, delivery payload encryption falls back to `SUPABASE_SERVICE_ROLE_KEY`.
- Setting this variable decouples payload encryption from database service-role key rotation.

Rotation guidance:

- Add or rotate alongside `DELIVERY_PAYLOAD_KEY_ID`.
- Rebuild delivery payloads after changing the effective secret.
- Verify `/api/delivery/session` and `/api/delivery/fetch` for known deliverable scripts.
- Keep rollback plan for payloads built with the previous secret.

### `DELIVERY_PAYLOAD_KEY_ID`

Purpose: Non-secret identifier stored in delivery payload metadata to identify the active payload encryption key generation.

Required/Optional: Optional.

Used by:

- `app/lib/services/delivery-build-service.ts`

Security considerations:

- Not secret.
- Should not reveal secret material.
- Useful for tracking payload rebuilds after secret rotation.

Rotation guidance:

- Change when rotating `DELIVERY_PAYLOAD_SECRET`.
- Use a clear non-secret value such as `v2` or a date-based key ID.
- Rebuild delivery payloads and verify delivery fetch.

### `NEXT_PUBLIC_SITE_URL`

Purpose: Trusted origin used by sensitive CORS checks when different from the request origin.

Required/Optional: Optional.

Used by:

- `proxy.ts`

Security considerations:

- Public by design because it is prefixed with `NEXT_PUBLIC_`.
- Must be a trusted production origin.
- Incorrect values can affect sensitive CORS responses.

Rotation guidance:

- Update when production domain changes.
- Redeploy and verify CORS behavior for `/api/validate`, `/api/cleanup`, and private raw reads.

### `INTERNAL_ALERT_DISCORD_WEBHOOK`

Purpose: Optional Discord webhook URL for internal alert notifications.

Required/Optional: Optional.

Used by:

- `app/lib/services/internal-alert-service.ts`

Security considerations:

- Sensitive. Discord webhook URLs allow posting to the target channel.
- Keep out of logs and client-visible bundles.
- If unset, internal alerts can still be recorded without Discord notification behavior.

Rotation guidance:

- Rotate by creating a new Discord webhook URL and replacing the Vercel variable.
- Delete the old webhook in Discord.
- Redeploy if required by the hosting environment.
- Run `/api/internal/check-alerts` with `CRON_SECRET` and verify expected notification behavior when an alert condition exists.

## Delivery Session Variables

### `DELIVERY_SESSION_MODE`

Purpose: Runtime mode for delivery session storage backend.

Required/Optional: Optional. Defaults to `postgres`.

Supported values: `postgres`, `shadow`, `valkey_canary`, `valkey`.

Used by:

- `app/lib/delivery-session/config.ts`

Security considerations:

- Not secret. Controls which backend stores delivery session data.
- `valkey` mode: sessions stored in Valkey with TTL-based expiration. PostgreSQL is not written to.
- `postgres` mode: sessions stored in PostgreSQL (legacy behavior).
- `shadow` mode: PostgreSQL authoritative, Valkey shadow comparison for parity analysis.
- `valkey_canary` mode: deterministic percentage-based rollout to Valkey, fallback to PostgreSQL.

### `DELIVERY_SESSION_TTL_SECONDS`

Purpose: Delivery session TTL in seconds.

Required/Optional: Optional. Defaults to 60.

Valid range: 1–3600.

Used by:

- `app/lib/delivery-session/config.ts`
- `app/lib/delivery-session/valkey-adapter.ts`
- `app/lib/services/delivery-session-service.ts`

Security considerations:

- Controls how long a delivery session token remains valid.
- Must be long enough for the loader to complete a fetch, but short enough to limit replay window.
- The default 60 seconds is appropriate for most deployment scenarios.

### `DELIVERY_SESSION_CANARY_PERCENT`

Purpose: Percentage of traffic routed to Valkey in `valkey_canary` mode.

Required/Optional: Optional. Defaults to 0.

Valid range: 0–100.

Used by:

- `app/lib/delivery-session/config.ts`

Security considerations:

- Not secret. Controls canary rollout percentage.
- Set to 0 for no Valkey traffic, 100 for full canary, intermediate values for gradual rollout.
- Deterministic routing based on SHA-256 hash of request identifier ensures consistent routing per identifier.

## Validation Checklist

After setting or rotating variables:

1. Redeploy Vercel production.
2. Run `GET /api/health`.
3. Verify login with Turnstile.
4. Verify an invalid key validation request returns controlled JSON.
5. Verify loader bootstrap and delivery fetch for a known deliverable script.
6. Run the GitHub Actions event worker workflow manually.
7. Run `POST /api/internal/check-alerts` with `CRON_SECRET`.
8. Verify dashboard analytics, event operations, and license dashboard load for an authenticated creator.
