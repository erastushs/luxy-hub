# LuxyHub Environment Variables

Status: Canonical V1 environment variable reference
Last updated: 2026-06-29

This document describes every environment variable used by LuxyHub. It is documentation only and does not change runtime behavior.

## Architecture

```
Runtime State
    Rate Limiter → Valkey
    Delivery Session → Valkey

Persistent Data
    PostgreSQL
```

## Rollout Strategy

```
postgres
    ↓
shadow           (PostgreSQL authoritative, Valkey shadow comparison)
    ↓
valkey_canary    (Percentage rollout to Valkey, PostgreSQL fallback)
    ↓
valkey           (Valkey authoritative, Production)
```

Rollback always available via mode change:
```
RATE_LIMIT_MODE=postgres          # Immediate PostgreSQL rollback
DELIVERY_SESSION_MODE=postgres    # Immediate PostgreSQL rollback
```

---

## Application

| Variable | Purpose | Default | Required | Production | Valid Values |
| -------- | ------- | ------- | -------- | ---------- | ------------ |
| `NEXT_PUBLIC_SITE_URL` | Trusted origin for sensitive CORS checks | _none_ | No | Production domain | Valid HTTPS URL |

## Supabase

| Variable | Purpose | Default | Required | Production | Valid Values |
| -------- | ------- | ------- | -------- | ---------- | ------------ |
| `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase project URL for SSR clients | _none_ | Yes | Supabase project URL | Valid HTTPS URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key for SSR clients | _none_ | Yes | Supabase project anon key | Supabase JWT |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side service-role key for admin operations | _none_ | Yes | Supabase project service role key | Supabase JWT |

## Security

| Variable | Purpose | Default | Required | Production | Valid Values |
| -------- | ------- | ------- | -------- | ---------- | ------------ |
| `DELIVERY_PAYLOAD_SECRET` | Delivery payload encryption/decryption secret | Falls back to `SUPABASE_SERVICE_ROLE_KEY` | No | Strong random secret | Any string |
| `DELIVERY_PAYLOAD_KEY_ID` | Non-secret identifier for payload encryption key generation | Unset | No | `v2` or date-based key ID | Any string |
| `CRON_SECRET` | Bearer token for internal operational endpoints | _none_ | Yes | Strong random 32+ byte secret | Any string |
| `ADMIN_API_KEY` | Admin bearer token for private raw script reads | _none_ | Yes | Strong random secret, different from `CRON_SECRET` | Any string |
| `ANALYTICS_PEPPER` | Pepper for hashing analytics identifiers and login-failure buckets | _none_ | Yes | Strong random value | Any string |
| `INTERNAL_ALERT_DISCORD_WEBHOOK` | Discord webhook URL for internal alert notifications | Unset | No | Discord webhook URL | Valid Discord webhook URL |
| `EVENT_WORKER_URL` | GitHub Actions target URL for event queue worker | _none_ | Yes (for event processing) | `https://luxyhub.vercel.app/api/internal/event-worker` | Valid HTTPS URL |

## Cloudflare Turnstile

| Variable | Purpose | Default | Required | Production | Valid Values |
| -------- | ------- | ------- | -------- | ---------- | ------------ |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Public Turnstile site key for login widget | _none_ | Yes | Turnstile site key | Turnstile site key |
| `TURNSTILE_SECRET_KEY` | Server-side Turnstile verification secret | _none_ | Yes | Turnstile secret key | Turnstile secret key |

## Valkey

| Variable | Purpose | Default | Required | Production | Valid Values |
| -------- | ------- | ------- | -------- | ---------- | ------------ |
| `VALKEY_ENABLED` | Enable Valkey integration | `false` | Yes (for Valkey modes) | `true` | Boolean |
| `VALKEY_HOST` | Valkey connection host | _none_ | Yes when enabled | Valkey hostname or IP | Hostname or IP |
| `VALKEY_PORT` | Valkey connection port | `6379` | No | `6379` | 1–65535 |
| `VALKEY_DB` | Valkey database number | `0` | No | `0` | 0–15 |
| `VALKEY_TLS` | Enable TLS for Valkey connection | `false` | No | `true` (for managed Valkey) | Boolean |
| `VALKEY_PASSWORD` | Valkey authentication password | Unset | No | Valkey password | Any string |
| `VALKEY_CONNECT_TIMEOUT_MS` | Connection timeout in milliseconds | `1000` | No | `1000` | 1–30000 |
| `VALKEY_COMMAND_TIMEOUT_MS` | Command timeout in milliseconds | `1000` | No | `1000` | 1–30000 |

## Rate Limiter

| Variable | Purpose | Default | Required | Production | Valid Values |
| -------- | ------- | ------- | -------- | ---------- | ------------ |
| `RATE_LIMIT_MODE` | Rate limiter runtime backend mode | `postgres` | No | `valkey` | `postgres`, `shadow`, `valkey_canary`, `valkey` |
| `RATE_LIMIT_CANARY_PERCENT` | Percentage of traffic routed to Valkey in canary mode | `0` | No | Unset in production | 0–100 |

`RATE_LIMIT_CANARY_PERCENT` is only used when `RATE_LIMIT_MODE=valkey_canary`.

## Delivery Session

| Variable | Purpose | Default | Required | Production | Valid Values |
| -------- | ------- | ------- | -------- | ---------- | ------------ |
| `DELIVERY_SESSION_MODE` | Delivery session runtime backend mode | `postgres` | No | `valkey` | `postgres`, `shadow`, `valkey_canary`, `valkey` |
| `DELIVERY_SESSION_CANARY_PERCENT` | Percentage of traffic routed to Valkey in canary mode | `0` | No | Unset in production | 0–100 |
| `DELIVERY_SESSION_TTL_SECONDS` | Delivery session lifetime in seconds | `60` | No | `60` | 1–3600 |
| `DELIVERY_SESSION_TRACE` | Enable structured trace logging for delivery session diagnostics | `false` | No | `false` | `true`, `false` |

`DELIVERY_SESSION_CANARY_PERCENT` is only used when `DELIVERY_SESSION_MODE=valkey_canary`.
`DELIVERY_SESSION_TRACE` should be `false` in normal operation. Enable during rollout/debugging. Disable after production stabilization.

## Monitoring

| Variable | Purpose | Default | Required | Production | Valid Values |
| -------- | ------- | ------- | -------- | ---------- | ------------ |
| `LUXY_MONITOR_TOKEN` | Bearer token for operational monitoring endpoints | Unset | No (for monitoring) | Strong random token | Any string |

---

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
