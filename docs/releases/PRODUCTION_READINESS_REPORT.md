# Production Readiness Report

Timestamp: 2026-06-16T13:48:58+09:00

## Summary

The RC hardening sprint resolved the release-blocking raw delivery authorization bypass, corrected stale API documentation navigation, removed production delivery-secret fallback to `SUPABASE_SERVICE_ROLE_KEY`, introduced hashed free-key storage, hardened license key verification, added Server Actions for license mutations, and added executable validation coverage for docs links, raw delivery, rate-limit IP trust, environment hardening, and conditional RLS integration.

## Fixed Issues

| Finding | Status | Evidence |
|---|---|---|
| P0 raw script delivery bypass | Fixed | `/api/scripts/[slug]/raw` now passes key/license/customer data to `getRawContent`; `getRawContent` calls `authorizeDeliveryAccess` for non-admin callers. |
| P0 deprecated API docs route dead link | Fixed | Dashboard link now targets `/docs/reference/api`; repo test blocks references to the deprecated API docs route. |
| P1 rate-limit forwarding trust | Fixed | Client IP normalization trusts single `x-vercel-forwarded-for` and collapses untrusted chains to a shared bucket. |
| P1 free-key plaintext persistence | Fixed for new keys, migration path for existing keys | New keys store `key_hash`; migration 015 converts plaintext keys to legacy lookup hashes; validation upgrades to HMAC. |
| P1 license SHA-256 only hashes | Fixed with compatibility | New licenses store scrypt verifiers plus HMAC lookup hashes; legacy SHA-256 hashes upgrade after successful validation. |
| P1 delivery secret fallback | Fixed | `DELIVERY_PAYLOAD_SECRET` no longer falls back to `SUPABASE_SERVICE_ROLE_KEY`; production fails fast when missing. |
| License dashboard API mutations | Fixed for mutations | Creation, status changes, assignment create/remove now use Server Actions. |

## Tests Added

- `__tests__/raw-script-delivery.test.ts`
- `__tests__/rate-limit-trust-model.test.ts`
- `__tests__/env-hardening.test.ts`
- `__tests__/docs-link-integrity.test.ts`
- `__tests__/license-actions.test.ts`
- `__tests__/rls-integration.test.ts`

## Migration Notes

1. Apply `migrations/015_key_hash_hardening.sql`.
   - Requires `pgcrypto`.
   - Converts existing `keys.key` values into `legacy-sha256:` lookup hashes and clears plaintext keys.
   - Application upgrades legacy hashes to keyed HMAC on successful validation.
2. Apply `migrations/016_license_hash_hardening.sql`.
   - Adds `licenses.key_lookup_hash`.
   - Existing licenses continue validating through legacy SHA-256 lookup.
   - Application upgrades legacy license hashes to scrypt verifiers and HMAC lookup hashes on successful validation.
3. Configure production secrets before deploy:
   - `DELIVERY_PAYLOAD_SECRET`
   - `KEY_HASH_SECRET`
   - `LICENSE_HASH_SECRET`
   - Existing required Supabase, Turnstile, cron, admin, and analytics secrets.
4. Rebuild delivery payloads after any `DELIVERY_PAYLOAD_SECRET` rotation.

## Remaining Risks

- `TEST_DATABASE_URL` was not available in this local workspace, so live disposable database RLS/rollback execution remains a release-environment validation task.
- Existing license/free-key records only upgrade when successfully used after migrations.
- `/api/scripts/[slug]/raw` remains as a compatibility endpoint. It is hardened but should be migrated away from for new runtime integrations.
- CSP still permits `unsafe-inline` and `unsafe-eval`; this remains accepted for the current Next.js/Cloudflare Turnstile posture until nonce-based CSP work is scheduled.
- Audit logging remains best-effort and non-blocking.

## Validation Commands

Local validation executed in this workspace:

```bash
npm run lint
# PASS: 0 errors, 2 pre-existing test-file warnings

npm run build
# PASS: production build completed; Turbopack emitted an existing NFT trace warning for docs file tracing

npx vitest run
# PASS: 54 test files passed, 1 skipped; 582 tests passed, 2 skipped
```

Required database validation in a disposable environment:

```bash
TEST_DATABASE_URL=postgres://... npx vitest run __tests__/rls-integration.test.ts
```

## Security Assessment

The most severe release blocker is fixed: raw script delivery now respects configured access modes. Secret isolation and hash-storage posture are materially improved. Remaining risks are operational validation gaps and accepted hardening follow-ups, not known direct authorization bypasses.

## Go / No-Go Recommendation

Recommendation: Conditional Go for Production Ready Candidate after all local validation passes.

Production Ready requires one additional release-environment action: execute the disposable database RLS/rollback validation path or document equivalent DBA-run evidence.
