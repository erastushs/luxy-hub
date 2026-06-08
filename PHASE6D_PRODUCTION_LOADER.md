# Phase 6D - Production Loader

Status: Implemented
Date: 2026-06-08
Scope: First production loader flow only. No license systems, key validation, customer management, HWID systems, anti-tamper systems, build cryptography changes, AES-GCM replacement, gzip replacement, or delivery session redesign.

## 1. Summary

Phase 6D completes the first secure loader path:

```text
GET /api/loader/[slug]
  |
  v
bootstrap Lua
  |
  v
POST /api/delivery/session
  |
  v
POST /api/delivery/fetch
  |
  v
payload + safe decryption context
  |
  v
loader-runtime-v1
  |
  v
validate -> decrypt -> decompress -> execute
```

The loader endpoint returns bootstrap code only. It never embeds encrypted payloads, raw source, encryption keys, delivery session internals, or build secrets.

## 2. Endpoint Catalog

### GET `/api/loader/[slug]`

Returns Lua bootstrap code for a public loader entrypoint.

Response:

```text
Content-Type: text/plain; charset=utf-8
Cache-Control: no-store
```

Bootstrap responsibilities:

- request a one-time delivery session for the script slug
- fetch the encrypted payload
- validate delivery context shape
- validate `payload_format_version`
- validate `build_version`
- build the AES-GCM AAD string
- invoke `loader-runtime-v1`

### POST `/api/delivery/fetch`

Phase 6D extends the existing fetch response with safe context:

```json
{
  "payload": "...",
  "context": {
    "build_id": "...",
    "version_id": "...",
    "source_sha256": "...",
    "payload_sha256": "..."
  },
  "payload_format_version": "inline-json-v1",
  "build_version": "delivery-build-v1"
}
```

The response does not expose source content, encryption keys, session token hashes, delivery session records, stack traces, or dashboard-only fields.

## 3. Bootstrap Flow

```text
Executor loads /api/loader/[slug]
  |
  v
bootstrap resolves executor HTTP request function
  |
  v
POST /api/delivery/session { slug }
  |
  v
receive short-lived session_token
  |
  v
POST /api/delivery/fetch { session_token }
  |
  v
validate response + context
  |
  v
AAD = payload_format_version:version_id:source_sha256
  |
  v
Runtime.consume(payload, context, aad)
```

The bootstrap installs `loader-runtime-v1` if it is not already present. The runtime expects an executor adapter table for environment-specific primitives:

```lua
_G.LuxyHubRuntimeAdapterV1 = {
  sha256 = function(payload) end,
  decryptAes256Gcm = function(params) end,
  gunzip = function(bytes) end,
  execute = function(source) end
}
```

The runtime contract is intentionally versioned so future loader runtimes and executor adapters can coexist.

## 4. Runtime Flow

Version:

```text
loader-runtime-v1
```

Responsibilities:

1. Validate payload response shape.
2. Validate `payload_sha256` before decrypting.
3. Validate `payload_format_version = inline-json-v1`.
4. Validate `build_version = delivery-build-v1`.
5. Build AAD exactly as:

```text
payload_format_version:version_id:source_sha256
```

6. Decrypt the AES-256-GCM envelope.
7. Gzip-decompress the decrypted bytes.
8. Execute recovered source.

The TypeScript runtime test implementation lives in:

```text
app/lib/loader/loader-runtime-v1.ts
```

The Lua bootstrap installs a runtime with the same contract. Executor-specific crypto and gzip adapters must be validated per executor before claiming support.

## 5. AAD Standard

The AES-GCM authenticated additional data format remains unchanged from Phase 5B:

```text
payload_format_version
:
version_id
:
source_sha256
```

Example:

```text
inline-json-v1:version-uuid-1:64-char-source-sha256
```

Phase 6D does not modify build pipeline cryptography. The builder and runtime must use the same AAD string or decryption fails.

## 6. Payload Lifecycle

Build time:

```text
script_versions.content
  |
  v
normalize
  |
  v
gzip
  |
  v
AES-256-GCM envelope
  |
  v
delivery_builds.payload_ciphertext
delivery_builds.source_sha256
delivery_builds.payload_sha256
```

Delivery time:

```text
delivery session token
  |
  v
ready delivery_builds row
  |
  v
payload + safe context
```

Loader time:

```text
validate context
  |
  v
validate payload hash
  |
  v
validate compatibility
  |
  v
decrypt using AAD
  |
  v
decompress
  |
  v
execute
```

## 7. Compatibility Matrix

| Runtime | Build Version | Payload Format | Encryption | Compression | Status |
|---------|---------------|----------------|------------|-------------|--------|
| `loader-runtime-v1` | `delivery-build-v1` | `inline-json-v1` | `aes-256-gcm:v1` | `gzip` | Supported by tests |

Future versions should add new runtime implementations instead of changing v1 behavior in place.

## 8. Executor Validation Procedure

Do not claim executor support until this workflow is run on that executor.

Target executors:

- Solara
- Xeno
- Swift
- Delta

Validation workflow:

1. Publish a small public test script.
2. Confirm Phase 6C creates a ready build.
3. Load `GET /api/loader/[slug]` from the executor.
4. Confirm HTTP POST works for both delivery endpoints.
5. Confirm JSON encode/decode works for request and response bodies.
6. Confirm runtime adapter can compute SHA-256 over the exact payload string.
7. Confirm runtime adapter can AES-256-GCM decrypt with AAD.
8. Confirm runtime adapter can gzip-decompress decrypted bytes.
9. Confirm recovered source executes once.
10. Confirm reused session token is rejected.
11. Confirm tampered payload hash is rejected before decrypt.
12. Record executor version, date, and adapter APIs used.

Known status:

| Executor | Support Claim |
|----------|---------------|
| Solara | Not verified |
| Xeno | Not verified |
| Swift | Not verified |
| Delta | Not verified |

## 9. Future License Integration Points

Phase 6D does not implement licenses or keys.

Future Phase 7 integration points:

- before `POST /api/delivery/session` returns a token
- inside delivery session creation after script/build lookup
- inside bootstrap before requesting a session, if a public key field is required later

Licensing should authorize session creation. It should not change payload encryption format, AAD format, or runtime compatibility rules.

## 10. Security Review

- No raw source is returned by delivery or loader endpoints.
- `/api/loader/[slug]` returns bootstrap code only.
- `/api/delivery/fetch` returns encrypted payload plus safe context only.
- Session tokens remain one-time and short-lived.
- Raw session tokens are still never stored.
- Payload integrity is validated before decrypt.
- Unsupported build or payload format versions fail closed.
- AES-GCM and gzip behavior are unchanged.
- Runtime execution is not DRM; hostile clients can still inspect memory after decrypt.

## 11. Test Coverage

Added:

```text
__tests__/loader-api.test.ts
__tests__/loader-runtime-v1.test.ts
```

Extended:

```text
__tests__/delivery-api.test.ts
__tests__/delivery-session-service.test.ts
__tests__/delivery-payload-consumer.test.ts
```

Validated:

- loader bootstrap generation
- fetch context correctness
- AAD generation
- payload hash validation
- payload decrypt/decompress execution path
- invalid payload/hash rejection
- unsupported build version rejection
- no payload embedded in bootstrap

Latest validation:

```text
npx vitest run: 15 test files passed, 124 tests passed
npm run lint: 0 errors, 5 existing warnings
npm run build: passed
```

## 12. Remaining Work for Phase 7

- License and key management.
- Entitlement-gated delivery session creation.
- Production executor adapter verification.
- Operational telemetry for loader failures without logging payloads or session tokens.
