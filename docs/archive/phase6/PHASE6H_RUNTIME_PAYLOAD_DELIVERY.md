# Phase 6H - Runtime Payload Delivery

Status: Implemented
Date: 2026-06-08
Scope: Runtime payload delivery only. No key systems, license validation, build encryption behavior changes, encrypted storage removal, migrations, or delivery session redesign.

## 1. Summary

Phase 6H moves AES-GCM decryption and gzip decompression from the Roblox loader runtime to the server-side delivery boundary.

Storage remains encrypted:

```text
script_versions.content
  -> normalize
  -> gzip
  -> AES-256-GCM envelope
  -> delivery_builds.payload_ciphertext
```

Delivery now returns a runtime payload after a one-time delivery session is validated:

```text
POST /api/delivery/session
  -> short-lived session token
POST /api/delivery/fetch
  -> validate session
  -> load encrypted build
  -> verify encrypted payload hash
  -> decrypt server-side
  -> decompress server-side
  -> return runtime-v1 payload
```

The production loader no longer depends on executor-side AES-GCM, gzip, SHA-256, AAD construction, or `_G.LuxyHubRuntimeAdapterV1`.

## 2. Architecture

### 2.1 Build Storage

Unchanged:

```text
delivery_builds.payload_storage_kind = inline_encrypted
delivery_builds.payload_ciphertext = AES-256-GCM JSON envelope
delivery_builds.payload_sha256 = hash of encrypted envelope
delivery_builds.source_sha256 = normalized source hash for decrypt AAD
```

The build pipeline still owns:

- normalization
- gzip compression
- AES-256-GCM encryption
- payload hash generation
- ready/failed/invalidated lifecycle

No build cryptography behavior changed in Phase 6H.

### 2.2 Runtime Payload Delivery

New runtime delivery utility:

```text
app/lib/delivery/runtime-payload.ts
```

Responsibilities:

- verify encrypted payload hash against `delivery_builds.payload_sha256`
- validate the inline JSON encrypted envelope
- decrypt with the existing server-side payload secret and AAD contract
- gzip-decompress the decrypted bytes
- return runtime-v1 payload metadata

Runtime format:

```text
runtime-v1
```

## 3. Request Flow

```text
Loader
  |
  | POST /api/delivery/session { slug }
  v
Delivery Session Service
  |
  | find ready encrypted build
  | create one-time session
  v
Loader receives session_token
  |
  | POST /api/delivery/fetch { session_token }
  v
Delivery Session Service
  |
  | validate token hash
  | reject expired/reused tokens
  | load ready encrypted build
  | atomically consume session
  | create runtime payload from encrypted build
  v
Loader receives runtime payload
  |
  v
loadstring(runtime_payload)()
```

Sessions remain:

- short-lived
- one-time use
- token-hash-only in database
- service-role-only
- deny-all RLS

## 4. Response Schemas

### 4.1 Session Response

Unchanged:

```json
{
  "session_token": "...",
  "expires_in": 60
}
```

### 4.2 Runtime Payload Fetch Response

Current Phase 6H response:

```json
{
  "runtime_payload": "print(\"LUXY TEST\")",
  "build_version": "delivery-build-v1",
  "version_id": "version-uuid-1",
  "runtime_format_version": "runtime-v1"
}
```

Not returned:

- encryption keys
- session internals
- `payload_ciphertext`
- encrypted payload envelope
- `source_sha256`
- `payload_sha256`
- delivery session row
- stack traces

Failure response remains uniform:

```json
{
  "success": false,
  "message": "Invalid delivery session"
}
```

## 5. Loader Changes

The generated bootstrap from:

```text
GET /api/loader/[slug]
```

now performs:

```text
request session
  -> fetch runtime payload
  -> validate runtime response shape
  -> execute runtime_payload
```

Removed production loader dependencies:

- `_G.LuxyHubRuntimeAdapterV1`
- `sha256`
- `decryptAes256Gcm`
- `gunzip`
- AAD generation
- encrypted payload envelope parsing

The loader still requires:

- ability to fetch the bootstrap
- POST-capable request function
- `HttpService:JSONEncode`
- `HttpService:JSONDecode`
- `loadstring`

## 6. Backward Compatibility Review

### Old Phase 6D Path

```text
POST /api/delivery/fetch
  -> encrypted payload
  -> context { build_id, version_id, source_sha256, payload_sha256 }
  -> payload_format_version
  -> build_version
```

Loader behavior:

```text
validate payload hash
build AAD
decrypt AES-GCM
gunzip
execute
```

This path is superseded for production execution because real executor crypto/gzip portability and key material were unresolved.

### New Phase 6H Path

```text
POST /api/delivery/fetch
  -> runtime_payload
  -> build_version
  -> version_id
  -> runtime_format_version
```

Loader behavior:

```text
validate runtime response
execute runtime_payload
```

Reference loader behavior was updated to consume the runtime payload shape.

The encrypted payload consumer utilities remain available for server-side build artifact validation and runtime payload generation.

## 7. Runtime Versioning

Runtime format:

```text
runtime-v1
```

Compatibility matrix:

| Runtime Format | Build Version | Build Payload Format | Delivery Behavior | Status |
|----------------|---------------|----------------------|-------------------|--------|
| `runtime-v1` | `delivery-build-v1` | `inline-json-v1` | server decrypt + decompress | Current |

Future strategy:

1. Add a new runtime format, for example `runtime-v2`, without changing `runtime-v1`.
2. Teach the loader bootstrap to validate the expected runtime format.
3. Keep delivery build formats independent from runtime response formats.
4. Add compatibility selection only when multiple runtime formats are intentionally supported.

## 8. Security Review

Storage security retained:

- `delivery_builds` still stores encrypted payloads.
- No source column was added to `delivery_builds`.
- Build artifacts remain service-role-only.
- Payload integrity is checked before decrypting.
- Build failures remain sanitized.

Delivery security retained:

- One-time sessions are still required.
- Expired sessions are rejected.
- Reused sessions are rejected.
- Successful responses remain `Cache-Control: no-store`.
- Uniform fetch errors remain in place.
- Future license/key checks can still gate session creation or fetch.

Tradeoff accepted:

- Authorized clients now receive runtime source directly after session validation.
- This is honest about the real threat model: a client that can execute code can also dump code.
- The practical protection remains session gating, rate limiting, future entitlement checks, build invalidation, and future build-time obfuscation.

No keys are shipped to the loader.

## 9. Test Coverage

Updated:

```text
__tests__/delivery-api.test.ts
__tests__/delivery-session-service.test.ts
__tests__/loader-api.test.ts
__tests__/loader-runtime-v1.test.ts
__tests__/delivery-payload-consumer.test.ts
```

Added:

```text
__tests__/runtime-payload-delivery.test.ts
```

Validated:

- encrypted build decrypts server-side
- encrypted payload hash is verified before runtime delivery
- runtime payload response excludes ciphertext and source/payload hashes
- delivery fetch returns `runtime_payload`, `build_version`, `version_id`, and `runtime_format_version`
- loader bootstrap no longer references AES-GCM, gzip, SHA-256, or AAD
- loader runtime executes runtime payload
- expired sessions are rejected
- reused sessions are rejected
- failed runtime payload generation returns a uniform session error

Latest validation:

```text
npx vitest run: 17 test files passed, 130 tests passed
npm run lint: 0 errors, 4 existing warnings
npm run build: passed
```

## 10. Remaining Work

- Validate the simplified loader against real executors.
- Add future build-time obfuscation before public production cutover if stronger anti-copy friction is required.
- Keep license/key systems deferred until Phase 7.
