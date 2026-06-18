# Build Pipeline Runtime

Status: Documents current build behavior after completed Phase 7C production runtime performance optimizations. This file is documentation only.

Primary files:

- `app/lib/services/delivery-build-service.ts`
- `app/lib/services/build-automation-service.ts`
- `app/lib/services/build-operations-service.ts`
- `app/lib/repositories/delivery-build-repository.ts`
- `app/actions/builds.ts`
- `app/lib/services/script-service.ts`

## Pipeline Purpose

The build pipeline converts immutable script version source into encrypted delivery payloads stored in `delivery_builds`. Runtime delivery only selects ready builds matching the current build and payload format versions.

Current constants:

- Build version: `delivery-build-v1`
- Payload format version: `inline-json-v1`
- Payload content type: `application/vnd.luxyhub.delivery-payload.v1+json`
- Encryption scheme: `aes-256-gcm:v1`

## Source Mutation

Source mutations happen through dashboard server actions and script services:

- Script creation creates script metadata and an initial version.
- Script update may create a new immutable version when content changes.
- Script publication can trigger build automation.
- Manual rebuilds are performed through the build operations service and server action.

Operational rule:

- Source mutation must remain durable even if automatic build generation fails. `runAutoBuildForVersion()` catches unexpected failures so script changes are not rolled back solely because build automation failed.

## Build Generation

Function: `buildVersion(versionId)`.

Flow:

1. Validate `versionId` input.
2. Load `script_versions` row by id.
3. Normalize source by removing BOM, converting CRLF/CR to LF, and trimming trailing whitespace.
4. Compute `source_sha256` from normalized source.
5. Insert `delivery_builds` row with `build_status = 'pending'`.
6. Mark build `building`.
7. Reject empty normalized source.
8. Gzip-compress normalized source at level 9.
9. Encrypt compressed payload with AES-256-GCM using derived key from `DELIVERY_PAYLOAD_SECRET` or `SUPABASE_SERVICE_ROLE_KEY` fallback.
10. Bind encryption AAD to payload format version, version id, and source hash.
11. Serialize encrypted payload JSON containing version, algorithm, key id, compression, IV, tag, and data.
12. Compute `payload_sha256` of serialized ciphertext JSON.
13. Mark build `ready` with ciphertext, payload hash, byte size, and `built_at`.

Metadata handling:

- Build metadata is sanitized before storage.
- Sensitive keys such as source, plaintext, secret, key, token, and authorization are excluded.
- String metadata values are truncated.

## Build Validation

Database validation:

- `delivery_builds_ready_payload_required` prevents ready builds without ciphertext, payload hash, and `built_at`.
- Hash fields are constrained to SHA-256 hex format when present.
- `payload_storage_kind` is constrained to `inline_encrypted`.

Delivery-time build validation:

- Delivery session creation calls `getReadyBuildMetadata()` for the current version and expected build/payload versions, avoiding unnecessary `payload_ciphertext` reads.
- The metadata query still filters for non-null/non-empty `payload_ciphertext`, preserving ready-build semantics without selecting ciphertext.
- Fetch flow verifies ready status, inline encrypted storage, non-empty ciphertext, valid source hash, and valid payload hash.
- Build/script consistency is checked through session `script_id` and build `script_id`.

Dashboard validation:

- Build listing uses summary/dashboard select lists that omit `payload_ciphertext`.
- Rebuild operations require authenticated ownership of the script.

## Automatic Build Behavior

Function: `ensureAutoBuildForVersion(versionId, trigger)`.

Triggers:

- `script_created`
- `version_created`
- `script_published`

Skip reasons:

- `already_ready`: latest compatible build is ready.
- `already_running`: latest compatible build is pending or building.
- `failed_requires_manual_rebuild`: latest compatible build failed and manual intervention is required.

Behavior:

- If no compatible latest build exists or latest build is invalidated, run `buildVersion()`.
- If latest build is ready, pending, building, or failed, skip according to the reason above.
- Unexpected automatic build errors are swallowed by `runAutoBuildForVersion()` to avoid interrupting source mutations.

## Manual Rebuild

Manual rebuilds are exposed through dashboard operations and require authenticated ownership.

Flow:

1. Creator triggers rebuild for latest version.
2. Server action calls `requireAuth()`.
3. Build operation verifies ownership by slug and user id.
4. `rebuildVersion()` creates a new build.
5. If new build succeeds, previous ready compatible build metadata is used to invalidate the previous ready build as `superseded_by_rebuild` without loading old payload ciphertext.
6. Dashboard cache paths are revalidated and creator is redirected to build operations view.

Failure behavior:

- If new build fails, the failed row records sanitized error code/message where possible.
- Previous ready build is not invalidated when rebuild fails.
- If new build succeeds but invalidating previous build fails, operation returns a failure with the new build included for diagnostics.

## Failure Modes

### Missing Payload Secret

Condition:

- Production has neither `DELIVERY_PAYLOAD_SECRET` nor `SUPABASE_SERVICE_ROLE_KEY` available to build service.

Result:

- Build fails with `missing_payload_secret` and HTTP-style status `500`.

Recovery:

- Configure `DELIVERY_PAYLOAD_SECRET`.
- Set or confirm `DELIVERY_PAYLOAD_KEY_ID`.
- Rebuild affected versions.

### Empty Source

Condition:

- Source is empty after normalization.

Result:

- Build fails with `empty_source` and status `422`.

Recovery:

- Update script content.
- Rebuild latest version.

### Database Insert/Update Failure

Condition:

- Supabase write fails during build row creation or state transition.

Result:

- Build may not exist, may remain pending/building, or may fail to record failure state.

Recovery:

- Check Vercel logs and Supabase status.
- Retry manual rebuild after database recovers.
- Review stale pending/building rows in dashboard or SQL.

### Previous Build Invalidation Failure

Condition:

- `rebuildVersion()` creates a ready build but cannot invalidate the previous ready build.

Result:

- Operation returns failure even though the new build exists.
- Runtime `getReadyBuild()` orders by `built_at DESC`, so the newest ready build should be selected when available.

Recovery:

- Manually inspect ready builds for the version.
- Invalidate old ready build if required.
- Verify delivery fetch uses expected build.

### Secret Rotation Without Rebuild

Condition:

- Effective payload secret changes but ready builds were encrypted under the previous secret.

Result:

- Build rows may still be `ready`, but payload consumption can fail depending on runtime decryption requirements.

Recovery:

- Rebuild all deliverable script versions under the new secret.
- Verify `/api/delivery/session` and `/api/delivery/fetch` for known scripts.

## Operational Checks

Useful SQL checks:

```sql
SELECT build_status, COUNT(*)
FROM delivery_builds
GROUP BY build_status
ORDER BY build_status;
```

```sql
SELECT id, script_id, version_id, build_status, build_error_code, build_error_message, created_at, updated_at
FROM delivery_builds
WHERE build_status IN ('failed', 'pending', 'building')
ORDER BY updated_at DESC
LIMIT 50;
```

```sql
SELECT version_id, COUNT(*) AS ready_count
FROM delivery_builds
WHERE build_status = 'ready'
GROUP BY version_id
HAVING COUNT(*) > 1;
```

## Phase Boundary

This document does not define new build APIs, new payload formats, new encryption schemes, database decoupling, Redis/Valkey integration, premium license hardening, or planned runtime popup key validation behavior.
