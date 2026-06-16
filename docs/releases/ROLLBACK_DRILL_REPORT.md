# Rollback Drill Report

Timestamp: 2026-06-16T13:48:58+09:00

## Scope

This drill validates the rollback plan for the RC hardening sprint:

- Schema rollback readiness for runtime license enforcement migration 014.
- Application rollback compatibility for raw script delivery hardening.
- Runtime delivery rollback impact after delivery payload-secret isolation.
- Executable database validation path for disposable test databases.

No production deployment, production database, or production secret was modified.

## Steps Executed

1. Reviewed `migrations/014_runtime_license_enforcement.sql` and `migrations/014_runtime_license_enforcement_rollback.sql`.
2. Added executable conditional integration coverage in `__tests__/rls-integration.test.ts` using `TEST_DATABASE_URL` and `psql`.
3. Verified production build succeeds with migration files and runtime code present.
4. Verified raw endpoint remains backward-compatible as a route but now enforces access-mode authorization for non-admin callers.
5. Verified delivery payload-secret behavior fails fast in production when `DELIVERY_PAYLOAD_SECRET` is missing and no longer falls back to `SUPABASE_SERVICE_ROLE_KEY`.
6. Verified docs and deployment checklist now describe the hardened rollback/secret expectations.

## Disposable Database Execution

The repository now contains an executable integration test path:

```bash
TEST_DATABASE_URL=postgres://... npx vitest run __tests__/rls-integration.test.ts
```

If `TEST_DATABASE_URL` is unset, the test is skipped to avoid mutating non-disposable databases.

## Observed Issues

- No disposable Postgres URL was available in the local audit environment, so live SQL apply/rollback execution was not performed in this workspace.
- Migration 015 requires `pgcrypto` to compute legacy free-key SHA-256 lookup hashes during migration.
- Existing encrypted delivery payloads must be rebuilt if `DELIVERY_PAYLOAD_SECRET` changes.

## Rollback Notes

- Application rollback can keep `/api/scripts/[slug]/raw` available because hardening preserved the route and only tightened authorization.
- If reverting delivery secret isolation, do not reintroduce `SUPABASE_SERVICE_ROLE_KEY` fallback in production without explicit security acceptance.
- If reverting key/license hash migrations, ensure no newly generated HMAC/scrypt-only records are orphaned by older application code.

## Final Verdict

Conditional pass for release-candidate hardening documentation and executable rollback path.

Final production approval still requires running `__tests__/rls-integration.test.ts` against an isolated disposable database or a documented release-environment equivalent.
