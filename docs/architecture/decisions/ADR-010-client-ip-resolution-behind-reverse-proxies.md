# ADR-010: Client IP Resolution Behind Reverse Proxies

## Status

Accepted

## Date

2026-06-24

## Context

LuxyHub production is deployed behind Cloudflare and may also receive forwarded headers from upstream hosting or reverse proxy layers. Rate limiting, analytics, abuse detection, and audit logs depend on resolving the real client IP rather than a Cloudflare or reverse proxy IP.

A production incident showed that requests were bucketed by Cloudflare proxy IPs because the application did not prioritize `CF-Connecting-IP`, selected the last value from `X-Forwarded-For`, and nginx did not restore Cloudflare Real IP.

## Decision

Client IP resolution shall always prioritize:

1. `CF-Connecting-IP`
2. `X-Vercel-Forwarded-For`
3. `X-Forwarded-For`
4. `X-Real-IP`
5. Localhost fallback

The application must trim whitespace, ignore empty values, and return only a single IP. For comma-separated forwarded headers, the first non-empty trimmed value is the client IP.

Infrastructure behind Cloudflare must restore the real client IP using `real_ip_header CF-Connecting-IP`, `real_ip_recursive on`, and Cloudflare `set_real_ip_from` trusted proxy ranges.

## Reason

Production is deployed behind Cloudflare. Using proxy IPs causes incorrect:

- Rate limiting.
- Analytics.
- Abuse detection.
- Audit logs.

## Consequences

Positive consequences:

- Rate-limit buckets represent real clients instead of shared Cloudflare proxy IPs.
- Analytics and abuse detection use the same client identity model as rate limiting.
- Audit logs are more useful for incident review.

Operational consequences:

- Cloudflare deployments must keep both application header priority and nginx Real IP settings aligned.
- Incorrect Cloudflare Real IP configuration can still produce incorrect IP attribution even when application parsing is correct.

## Related Documents

- `docs/phases/phase7/README.md`
- `docs/phases/phase7/PHASE_7D_OPERATIONAL_RUNBOOK.md`
- `docs/architecture/ARCHITECTURE.md`
