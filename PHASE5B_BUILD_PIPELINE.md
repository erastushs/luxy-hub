# Phase 5B - Build Pipeline Foundation

Status: Implemented
Date: 2026-06-08
Scope: Backend build artifact foundation only. No loader, license, key, dashboard UI, or delivery API implementation.

## 1. Summary

Phase 5B adds the first secure delivery build pipeline. The source of truth remains `script_versions.content`, but source is transformed into a pre-built delivery artifact stored in `delivery_builds`.

Implemented flow:

```text
script_versions.content
  |
  v
normalize
  |
  v
gzip compress
  |
  v
AES-256-GCM encrypted JSON envelope
  |
  v
delivery_builds.payload_ciphertext
```

Payload storage is Postgres inline only. Object storage is intentionally not implemented.

## 2. Schema

Migration:

```text
migrations/006_delivery_builds.sql
migrations/006_delivery_builds_rollback.sql
```

Table:

```text
delivery_builds
  id uuid primary key
  script_id uuid references scripts(id) on delete cascade
  version_id uuid references script_versions(id) on delete cascade
  build_status text
  payload_storage_kind text default 'inline_encrypted'
  payload_ciphertext text
  payload_content_type text
  payload_byte_size integer
  source_sha256 text
  payload_sha256 text
  build_version text
  payload_format_version text
  encryption_scheme text
  encryption_key_id text
  invalidated_reason text
  build_error_code text
  build_error_message text
  metadata jsonb
  built_at timestamptz
  invalidated_at timestamptz
  created_at timestamptz
  updated_at timestamptz
```

V1 constraints:

- `payload_storage_kind` must be `inline_encrypted`.
- `build_status` must be `pending`, `building`, `ready`, `failed`, or `invalidated`.
- `source_sha256` must be a 64-character lowercase SHA-256 hex digest.
- `payload_sha256` must be null or a 64-character lowercase SHA-256 hex digest.
- Ready builds must have `payload_ciphertext`, `payload_sha256`, and `built_at`.

Indexes:

- `idx_delivery_builds_version_status`
- `idx_delivery_builds_script_status`
- `idx_delivery_builds_compatibility`
- `idx_delivery_builds_payload_sha256`
- `idx_delivery_builds_created_at`

## 3. Build Lifecycle

Successful build:

```text
get script_versions row
  |
  v
normalize source
  |
  v
create delivery_builds row as building
  |
  v
compress normalized source
  |
  v
encrypt compressed payload
  |
  v
hash encrypted payload
  |
  v
mark delivery_builds row ready
```

Failed build:

```text
create delivery_builds row as building
  |
  v
pipeline error
  |
  v
mark delivery_builds row failed
  |
  v
store sanitized error code/message only
```

Rebuild:

```text
find previous ready build
  |
  v
create and ready a new build
  |
  v
invalidate previous ready build
```

Invalidation:

```text
mark build_status = invalidated
set invalidated_reason
set invalidated_at
```

Failed rebuilds do not invalidate the previous ready build.

## 4. Repository Architecture

File:

```text
app/lib/repositories/delivery-build-repository.ts
```

Functions:

- `createBuild()` creates a building artifact row with source hash and compatibility metadata.
- `getBuildByVersion()` returns the newest build for a version.
- `getReadyBuild()` returns the newest ready inline build for a version.
- `markBuildReady()` stores encrypted payload data and marks the row ready.
- `markBuildFailed()` stores sanitized failure state with no payload.
- `markBuildInvalidated()` supports the service-level `invalidateBuild()` operation.

All repository access uses `supabaseAdmin`.

## 5. Service Architecture

File:

```text
app/lib/services/delivery-build-service.ts
```

Functions:

- `buildVersion(versionId)`
- `rebuildVersion(versionId)`
- `invalidateBuild(buildId, reason?)`

Pipeline constants:

- `DELIVERY_BUILD_VERSION = delivery-build-v1`
- `PAYLOAD_FORMAT_VERSION = inline-json-v1`
- `PAYLOAD_CONTENT_TYPE = application/vnd.luxyhub.delivery-payload.v1+json`
- `ENCRYPTION_SCHEME = aes-256-gcm:v1`

Secret source order:

1. `DELIVERY_PAYLOAD_SECRET`
2. `CRON_SECRET`
3. `SUPABASE_SERVICE_ROLE_KEY`
4. development-only fallback outside production

`DELIVERY_PAYLOAD_KEY_ID` is stored as metadata for future rotation tracking.

## 6. Security Review

- `delivery_builds` has deny-all RLS for `anon` and `authenticated`.
- Build repository access is service-role-only.
- No source column exists in `delivery_builds`.
- `payload_ciphertext` stores only the encrypted envelope.
- Build failure messages are sanitized and do not include source.
- Payload storage is constrained to `inline_encrypted`.
- Object storage is not implemented.
- No loader endpoints or delivery APIs were added.
- No license or key management logic was added.
- Dashboard UI was not modified.

## 7. Test Coverage

Files:

```text
__tests__/delivery-build-service.test.ts
__tests__/delivery-build-repository.test.ts
```

Validated:

- successful build
- failed build
- rebuild
- source and payload hash changes
- ready build retrieval
- invalidated build exclusion
- sanitized invalidation reason
- no source passed into build repository parameters
- no source visible in encrypted payload string during unit tests

## 8. Remaining Work for Phase 5C

- Apply migration 006 in Supabase.
- Add operational backfill for existing active versions.
- Decide whether builds should run synchronously or through a worker queue in production.
- Add build status observability for internal operators.
- Add delivery session design and secure payload retrieval endpoints.
- Define loader protocol and payload decryption behavior.
- Add build-aware analytics only after delivery endpoints exist.
- Add key rotation and mass rebuild procedures.
