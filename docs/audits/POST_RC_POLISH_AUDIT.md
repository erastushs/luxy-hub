# Post-RC Polish Audit

Date: 2026-06-12

Scope: UX, documentation, configuration, maintainability, free-key format review, get-key security review, profile settings review, and repository cleanup audit.

## Free Key Format Review

Target format reviewed:

```text
LUXY-FREE-XXXX-XXXX-XXXX
```

Current implementation:

- Generator emits `LUXY-FREE-XXXX-XXXX-XXXX` for new free keys.
- Validator accepts centralized current and legacy free-key regex constants.
- Free keys are stored raw in `keys.key`.
- Premium licenses use a separate `LUXY-PREM-XXXX-XXXX-XXXX` format and hashed storage path.
- Current UI labels the flow as free key generation but does not show the target `LUXY-FREE` format.

Migration plan:

1. Add central constants for target and legacy free-key formats.
2. Generate only `LUXY-FREE-XXXX-XXXX-XXXX` for new free keys.
3. Validate target and legacy formats for at least 24-48 hours because current keys expire after 24 hours.
4. Add telemetry distinguishing target and legacy validations.
5. Fix unique-collision handling so duplicate insert attempts are not treated as success.
6. Add additive schema support for format metadata and optional key hashing before enforcing database constraints.

Compatibility plan:

- Do not rewrite active legacy keys.
- Accept legacy `LUXY-XXXX-XXXX-XXXX` during the compatibility window.
- Leave premium `LUXY-PREM` license behavior unchanged.
- Remove legacy acceptance only after active legacy traffic reaches zero.

Risk assessment:

- P0: Target format migration requires continued dual validation until legacy traffic reaches zero.
- P0: Free-key generation paths must remain uniformly protected through the shared generation service.
- P1: Raw free-key storage should be replaced with a hashed lookup design for new keys.
- P2: UI copy should explain shown-once behavior and the active format after migration.

## Get-Key Security Review

Current protections:

- API generation routes validate Work.ink tokens.
- API generation routes apply IP-based rate limiting.
- Used Work.ink tokens are stored to block replay.
- Key validation rejects inactive or expired keys.
- Delivery session routes are rate limited.

Missing protections:

- `/verify-token` previously directly verified Work.ink and created keys without reusing the API rate-limit path. RC-FINAL routes it through the shared protected generation service.
- `/verify-token` now logs the same key-generation analytics/security events as API routes.
- IP extraction now uses the same rate-limiter helper path.
- Malformed JSON handling in key-generation API routes can return generic 500 behavior.
- Key usage is recorded as a safe best-effort verification log on successful key-required delivery authorization.

## Free Key Analytics Review

Tracked after RC-FINAL:

- Generation: `KEY_GENERATED` with client IP, key snippet, generation source, and current free-key format.
- Generation rate limits: `RATE_LIMITED` with client IP and route/source context.
- Work.ink rejection: `VERIFY_WORKINK_FAILED` or `TOKEN_ALREADY_USED` with client IP and token snippet.
- Verification success/failure: `VALIDATE_SUCCESS` and `VALIDATE_FAILED` include legacy/current format telemetry when the submitted key matches a free-key format.
- Key usage: `KEY_USED` is logged after successful key-required delivery authorization, with format telemetry only.

Still missing or deferred:

- Raw free-key storage remains unchanged; hashed lookup design is deferred to a schema-backed migration.
- Key usage logs do not attach script/session identifiers to avoid delivery behavior changes in RC-FINAL.
- Expiry-specific analytics are inferred from validation failure and cleanup, not emitted as a dedicated lifecycle event.

Recommendations:

- P0: Route `/verify-token` through the same protected generation policy or add equivalent rate limiting/logging there.
- P0: Standardize client IP extraction through the existing helper.
- P1: Add free-key lifecycle events for generation, rejection, validation, expiry, and rate limit.
- P1: Record key usage on successful validation/delivery authorization.
- P2: Add UI wording for expiration and shown-once behavior.

## Profile Settings Review

Current fields:

- Editable: display name, username, password.
- Now visible/editable from existing model: avatar URL.
- Visible read-only: email, role, user ID, member since, last updated.

Risk fixed in polish:

- Profile edits could clear `avatar_url` because the field existed in the data model but was omitted from the form action. The profile form now includes avatar URL.

## Config Findings

Centralized config added under `app/config/`:

- `env.ts` - typed environment accessors and required/optional helpers.
- `platform.ts` - site URL, pagination, analytics, and profile constants.
- `runtime.ts` - delivery session and event-reporting runtime constants.
- `delivery.ts` - delivery-session constants.
- `licenses.ts` - license/customer defaults.
- `analytics.ts` - analytics config re-export.

Remaining config consolidation:

- P1: Rate limit windows and request quotas moved to `app/config/rate-limits.ts`.
- P1: Analytics pepper and delivery payload secret use moved to `app/config/env.ts` for server-side app call sites.
- P2: Cleanup retention windows and delete batch sizes moved to `app/config/cleanup.ts`.
- P2: Cron secret bearer validation helper remains a candidate for shared helper extraction.
- P2: Internal alert thresholds.
- P2: UI validation length constants.

Remaining env migration candidates after RC-FINAL:

- `app/config/env.ts` remains the canonical `process.env` entry point.
- `app/login/page.tsx` still reads `NEXT_PUBLIC_TURNSTILE_SITE_KEY` directly because it is a Client Component and should use a future public-client config boundary.
- `proxy.ts` still reads `NEXT_PUBLIC_SITE_URL` directly because middleware/proxy runtime safety should be validated separately.
- Test files continue to mutate `process.env` for scenario isolation.
- Standalone scripts under `scripts/` keep direct env access outside the app runtime.

## Repository Cleanup Audit

KEEP:

- `AGENTS.md` - active agent/project rules.
- `CLAUDE.md` - compatibility shim to `AGENTS.md`.
- Root `README.md` - onboarding entry point.
- `docs/README.md` - documentation map.
- `docs/api/`, `docs/runtime/`, `docs/database/`, `docs/operations/`, `docs/releases/`.

ARCHIVE OR REFRESH:

- `docs/architecture/CDN_DATABASE.md` - overlaps current database docs and contains stale planning language.
- `docs/audits/ARCHITECTURE_COMPLIANCE_REPORT.md` - historical/superseded audit.
- `docs/phases/phase8/active/PHASE8_EVENT_PLATFORM_ARCHITECTURE.md` - states canonical contract lives elsewhere.

REMOVE ONLY WHEN SAFE:

- `.next/` - generated build/dev output, local only.

Do not remove archived API, dashboard, or secure delivery docs until inbound current-doc links are replaced and current replacements are complete.

## Remaining Work By Priority

P0:

- Implement protected `/verify-token` generation path parity. Completed in RC-FINAL.
- Implement free-key target format with dual-format compatibility and tests. Completed in RC-FINAL.

P1:

- Add hashed free-key storage design and migration.
- Add key lifecycle analytics and usage recording.
- Finish linking all dashboard/docs routes to the knowledge-base pages.

P2:

- Complete config/env consolidation for all hardcoded limits.
- Archive or refresh stale current docs after link audit.
- Update UI copy after free-key format migration is approved.
