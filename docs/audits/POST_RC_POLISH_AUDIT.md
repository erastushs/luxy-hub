# Post-RC Polish Audit

Date: 2026-06-12

Scope: UX, documentation, configuration, maintainability, free-key format review, get-key security review, profile settings review, and repository cleanup audit.

## Free Key Format Review

Target format reviewed:

```text
LUXY-FREE-XXXX-XXXX-XXXX
```

Current implementation:

- Generator emits `LUXY-XXXX-XXXX-XXXX`.
- Validator accepts `^LUXY-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$`.
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

- P0: Target format is not implemented and changing it without dual validation can break active keys.
- P0: Free-key generation paths are not uniformly protected.
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

- `/verify-token` directly verifies Work.ink and creates keys without reusing the API rate-limit path.
- `/verify-token` does not log the same key-generation analytics/security events as API routes.
- IP extraction is inconsistent between `/verify-token` and the rate-limiter helper.
- Malformed JSON handling in key-generation API routes can return generic 500 behavior.
- Key usage is not recorded on successful key-required delivery authorization.

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

- P1: Rate limit windows and request quotas.
- P1: Cron secret bearer validation helper.
- P1: Analytics pepper and delivery payload secret use in all call sites.
- P2: Cleanup retention windows and delete batch sizes.
- P2: Internal alert thresholds.
- P2: UI validation length constants.

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

- Implement protected `/verify-token` generation path parity.
- Implement free-key target format with dual-format compatibility and tests.

P1:

- Add hashed free-key storage design and migration.
- Add key lifecycle analytics and usage recording.
- Finish linking all dashboard/docs routes to the knowledge-base pages.

P2:

- Complete config/env consolidation for all hardcoded limits.
- Archive or refresh stale current docs after link audit.
- Update UI copy after free-key format migration is approved.
