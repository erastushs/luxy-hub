# Phase 6F - Loader Runtime Validation

Status: Completed validation design
Date: 2026-06-08
Scope: Documentation and audit only. No key systems, license validation, build cryptography changes, delivery session redesign, payload format redesign, code changes, migrations, or APIs.

## 1. Summary

Phase 6F validates the real execution path conceptually and identifies the current production blockers.

The server-side secure delivery path works through tests:

```text
script_versions.content
  -> delivery_builds
  -> delivery_sessions
  -> delivery API
  -> loader bootstrap
```

The real executor path is not yet proven:

```text
loader bootstrap
  -> runtime adapter
  -> decrypt
  -> gunzip
  -> execute
```

Current execution blocker:

```text
_G.LuxyHubRuntimeAdapterV1 does not exist in production
```

Secondary critical blocker:

```text
decryptAes256Gcm receives envelope + AAD, but no loader-side key material strategy exists
```

No compatibility is claimed for Solara, Xeno, Swift, or Delta.

## 2. Proof-of-Execution Flow

Target real-world flow:

```text
Upload Script
  |
  v
Build
  |
  v
Create Delivery Session
  |
  v
Fetch Payload
  |
  v
Load Bootstrap
  |
  v
Runtime Adapter
  |
  v
Validate Hash + Context
  |
  v
Decrypt AES-256-GCM with AAD
  |
  v
Gunzip
  |
  v
Execute
```

Current status by step:

| Step | Current Status | Notes |
|------|----------------|-------|
| Upload script | Implemented | Dashboard Lua/TXT upload writes to `script_versions.content`. |
| Build | Implemented | Phase 6C auto-build creates ready `delivery_builds`. |
| Create session | Implemented | Phase 5C one-time token API exists. |
| Fetch payload | Implemented | Phase 6D returns payload and safe context. |
| Load bootstrap | Implemented | `/api/loader/[slug]` returns Lua bootstrap. |
| Runtime adapter | Blocked | `_G.LuxyHubRuntimeAdapterV1` is not packaged or installed. |
| Payload hash validation | Designed | Requires adapter SHA-256. |
| Decrypt | Blocked | Requires AES-GCM primitive and key material strategy. |
| Gunzip | Blocked | Requires gzip primitive or bundled decompressor. |
| Execute | Blocked until prior steps pass | Requires `execute` adapter or `loadstring` fallback. |

Exactly where execution currently blocks:

1. If the executor lacks POST-capable `request`, the bootstrap fails before delivery session creation.
2. If POST and JSON work, the bootstrap can request a session and fetch payload.
3. The first guaranteed LuxyHub runtime blocker is inside `Runtime.consume()`, when `_G.LuxyHubRuntimeAdapterV1` is missing or incomplete.
4. If a placeholder adapter is supplied, decryption still blocks because no production loader-side key material contract exists.

## 3. Runtime Distribution Strategy

### Option A: Bootstrap -> Fetch Runtime

Flow:

```text
loader snippet
  -> bootstrap
  -> fetch runtime package
  -> verify runtime package
  -> install runtime
  -> fetch payload
  -> execute
```

Advantages:

- Smaller first bootstrap.
- Runtime can be versioned and served separately.
- Executor-specific runtime packages can be selected later.
- Large crypto/gzip libraries do not bloat the initial bootstrap.

Tradeoffs:

- Adds another HTTP dependency before payload execution.
- Requires runtime package integrity validation.
- Requires another endpoint or static asset path.
- More moving pieces during executor debugging.
- More ways to fail in environments with limited request support.

### Option B: Embedded Runtime

Flow:

```text
loader snippet
  -> /api/loader/[slug]
  -> embedded runtime + adapter package
  -> fetch session
  -> fetch payload
  -> execute
```

Advantages:

- No additional runtime fetch.
- Matches the current Phase 6D loader endpoint shape.
- Loader snippets keep receiving the latest runtime because `/api/loader/[slug]` is fetched each run.
- Avoids adding new APIs for runtime distribution.
- Easier to validate in fragile executor environments.

Tradeoffs:

- Bootstrap size increases once crypto/gzip packages are embedded.
- Runtime update requires deploying `/api/loader/[slug]`.
- Executor-specific branches can make the bootstrap harder to read.
- Very large pure-Luau crypto may create parse/runtime overhead.

### Recommendation

Use Option B: Embedded Runtime for `loader-runtime-v1`.

Reasoning:

- The current creator-facing snippet already fetches `/api/loader/[slug]` dynamically.
- Embedding avoids introducing another network hop or new API during validation.
- Fewer executor primitives are required before the runtime can start.
- This keeps Phase 6D delivery sessions and payload formats unchanged.

Reserve Option A for a future runtime package service only if embedded crypto/gzip size becomes unacceptable. If Option A is introduced later, the bootstrap must pin the runtime package by version and hash before evaluating it.

## 4. Runtime Packaging Plan

Production runtime package:

```text
loader-runtime-v1
  |
  +-- bootstrap shell
  +-- runtime core
  +-- adapter interface
  +-- executor compatibility shim
  +-- primitive implementations or native bindings
      |
      +-- sha256
      +-- aes-256-gcm
      +-- gzip
      +-- base64
      +-- execute
```

### 4.1 SHA-256 Strategy

Preferred order:

1. Use a verified executor-native SHA-256 primitive if it exists and passes test vectors.
2. Otherwise embed an audited pure-Luau SHA-256 implementation.

Validation requirements:

- `sha256("abc")` must equal the standard SHA-256 digest.
- Hashing the exact fetched payload string must match `context.payload_sha256`.
- The implementation must not reserialize JSON or normalize line endings.

### 4.2 AES-GCM Strategy

Required behavior:

- AES-256-GCM.
- 12-byte IV.
- 16-byte authentication tag.
- AAD exactly:

```text
payload_format_version:version_id:source_sha256
```

Preferred order:

1. Use a verified executor-native AES-GCM primitive if it supports AAD and tag validation.
2. Otherwise package an audited Luau AES-256-GCM implementation.

Do not replace AES-GCM.

Open key-material decision:

- The current build pipeline derives the AES key from server-side secret material.
- The current Lua adapter contract does not receive a key or wrapped key.
- Embedding the server secret would compromise every payload protected by that secret if extracted.

Phase 6G must define a loader-side key material strategy before real decryption can be validated. That strategy must preserve the existing AES-GCM and AAD contracts unless a future phase intentionally versions the payload format.

### 4.3 Gzip Strategy

Preferred order:

1. Use a verified executor-native gzip/inflate primitive if available.
2. Otherwise embed an audited pure-Luau gzip decompressor.

Validation requirements:

- Decompress gzip data produced by the current Node build pipeline.
- Return UTF-8 Luau source text.
- Reject malformed gzip data without partial execution.

Do not replace gzip in `inline-json-v1`.

### 4.4 Base64 Strategy

The decrypt adapter must decode:

```text
envelope.iv
envelope.tag
envelope.data
```

Preferred order:

1. Use a verified executor-native `base64decode` primitive if available.
2. Otherwise embed a compact base64 decoder inside the runtime package.

## 5. Executor Compatibility Review

Evidence level:

- Roblox official docs establish stable platform concepts such as `HttpService` and Luau globals.
- sUNC documents executor-environment functions such as `request`, `loadstring`, and `base64decode`, but also states that not every original UNC function is tested.
- Executor-specific public pages are mostly marketing or community-maintained. They are not enough to claim LuxyHub support.

Compatibility table:

| Executor | Request API Evidence | `loadstring` Evidence | HttpService JSON Assumption | AES-GCM/Gzip Evidence | Current LuxyHub Support Claim |
|----------|----------------------|------------------------|-----------------------------|------------------------|-------------------------------|
| Solara | Not verified from primary technical docs. Public page mentions sUNC/UNC FAQ but no primitive details. | Not verified by LuxyHub. | Assumed only if Roblox `HttpService` is available in executor context. | No evidence found. | Not supported / not verified. |
| Xeno | Third-party pages claim UNC support and broad script compatibility, but no verified POST primitive matrix. | Third-party pages mention loadstring execution. | Assumed only if runtime can call `game:GetService("HttpService")`. | No evidence found. | Not supported / not verified. |
| Swift | Public pages describe script execution and note API reference is not complete or coming later. | Not verified by LuxyHub. | Assumed only if Roblox service access works in executor context. | No evidence found. | Not supported / not verified. |
| Delta | Public pages claim script execution and broad UNC support, but no adapter primitive details. | Community/examples commonly use `loadstring(game:HttpGet(...))`. | Assumed only if Roblox service access works in executor context. | No evidence found. | Not supported / not verified. |

Minimum compatibility requirements for any executor:

- Can load the dashboard snippet.
- Can POST JSON to LuxyHub delivery endpoints.
- Can decode delivery JSON.
- Can install `_G.LuxyHubRuntimeAdapterV1`.
- Can compute SHA-256 over exact payload string.
- Can AES-256-GCM decrypt with AAD and tag verification.
- Can gzip-decompress.
- Can execute recovered source exactly once.

## 6. Minimal Real-World Validation Procedure

Test source:

```lua
print("LUXY TEST")
```

Expected behavior after production adapter exists:

```text
LUXY TEST
```

Expected current behavior:

- If the executor cannot load the bootstrap, no delivery request occurs.
- If the executor lacks POST-capable `request`, the bootstrap fails with the uniform loader error.
- If request and JSON work, session/fetch may succeed.
- The runtime then fails with the uniform loader error because `_G.LuxyHubRuntimeAdapterV1` is missing.
- If a partial adapter is installed, failures move to hash, decrypt, gzip, or execute depending on which primitive is missing.

### 6.1 Setup

1. Create a script with a dedicated validation slug, for example:

```text
luxy-runtime-test
```

2. Upload or paste:

```lua
print("LUXY TEST")
```

3. Confirm dashboard build status is `Ready`.
4. Copy the loader snippet:

```lua
loadstring(game:HttpGet("https://www.luxyhub.space/api/loader/luxy-runtime-test"))()
```

5. Record:

```text
executor name
executor version
platform
Roblox client version
date/time
LuxyHub build id
LuxyHub version id
```

### 6.2 Preflight Checks

Before running the loader, run a small local diagnostic in the executor:

```lua
local requestImpl = (syn and syn.request)
  or http_request
  or request
  or (http and http.request)

print("Luxy request:", type(requestImpl))
print("Luxy loadstring:", type(loadstring))

local okJson = pcall(function()
  local HttpService = game:GetService("HttpService")
  local encoded = HttpService:JSONEncode({ ok = true })
  local decoded = HttpService:JSONDecode(encoded)
  return decoded.ok == true
end)

print("Luxy HttpService JSON:", okJson)
print("Luxy adapter:", type(_G.LuxyHubRuntimeAdapterV1))
```

Expected current preflight:

```text
Luxy adapter: nil
```

That confirms the current production blocker.

### 6.3 Loader Run

Run:

```lua
loadstring(game:HttpGet("https://www.luxyhub.space/api/loader/luxy-runtime-test"))()
```

Expected current result:

```text
LuxyHub loader failed
```

Expected future result with a complete adapter:

```text
LUXY TEST
```

### 6.4 Failure Modes To Record

| Failure Point | Expected Symptom | Meaning |
|---------------|------------------|---------|
| Top-level `HttpGet` unavailable | Bootstrap never loads | Executor cannot use current snippet style. |
| No POST `request` function | Uniform loader failure before session | Executor cannot call delivery APIs. |
| JSON encode/decode failure | Uniform loader failure after HTTP response | HttpService access or response shape issue. |
| Missing adapter | Uniform loader failure after fetch | Current known LuxyHub runtime blocker. |
| SHA mismatch | Uniform loader failure before decrypt | Payload changed, wrong hash, or adapter hashing mismatch. |
| AES-GCM failure | Uniform loader failure during decrypt | Wrong key material, wrong AAD, invalid tag, or crypto bug. |
| Gzip failure | Uniform loader failure after decrypt | Decompressor incompatible or corrupted plaintext. |
| `loadstring`/execute failure | Uniform loader failure at execution | Source compile/runtime issue or executor execution limitation. |

## 7. Validation Evidence Template

Use this template for each executor run:

```text
Executor:
Executor version:
Platform:
Roblox client version:
Date:
Script slug:
Build id:
Payload format:
Build version:

Preflight:
- request function:
- HttpService JSON:
- loadstring:
- adapter:

Loader result:
- Session request:
- Fetch request:
- Payload hash:
- Decrypt:
- Gunzip:
- Execute:

Observed output:
Observed errors:
Screenshots/logs:
Support claim:
```

Support claim must remain `Not verified` until the full path prints `LUXY TEST` from a ready LuxyHub build without manual source exposure.

## 8. Security Review

- No raw source delivery behavior changed.
- No delivery session behavior changed.
- No build cryptography changed.
- No keys or licenses were implemented.
- No executor support is claimed.
- The runtime remains a client-side execution environment, not DRM.
- A real adapter will place recovered source in memory. A hostile executor or client can still inspect it.
- Embedding any server-wide decryption secret in the adapter would weaken all payloads using that secret.

## 9. Next Actions

Recommended Phase 6G work:

1. Define loader-side AES key material strategy.
2. Decide whether `execute` is mandatory in the adapter contract.
3. Standardize binary representation for adapter functions.
4. Build a production `LuxyHubRuntimeAdapterV1` package.
5. Run real executor preflight on Solara, Xeno, Swift, and Delta.
6. Run `print("LUXY TEST")` through real build/session/fetch/loader execution.
7. Record executor support only after full validation.

## 10. External References Reviewed

- Roblox HttpService reference: https://create.roblox.com/docs/reference/engine/classes/HttpService
- Roblox Luau globals reference: https://create.roblox.com/docs/reference/engine/globals/LuaGlobals
- sUNC documentation: https://docs.sunc.su/
- sUNC request documentation: https://docs.sunc.su/Miscellaneous/
- sUNC loadstring documentation: https://docs.sunc.su/Closures/loadstring/
- sUNC base64decode documentation: https://docs.sunc.su/Encoding/base64decode/
- Solara public page reviewed as weak executor-specific evidence: https://getsolara.dev/
- Xeno public and third-party pages reviewed as weak executor-specific evidence.
- Swift public pages reviewed as weak executor-specific evidence.
- Delta public pages reviewed as weak executor-specific evidence.
