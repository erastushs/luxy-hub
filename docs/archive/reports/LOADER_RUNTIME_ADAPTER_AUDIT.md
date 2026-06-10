# Loader Runtime Adapter Audit

Status: Completed audit
Date: 2026-06-08
Scope: Documentation only. No key systems, license validation, build cryptography changes, delivery session redesign, payload format redesign, code changes, migrations, or APIs.

## 1. Summary

The Phase 6D production loader path is structurally present:

```text
GET /api/loader/[slug]
  -> Lua bootstrap
  -> POST /api/delivery/session
  -> POST /api/delivery/fetch
  -> payload + context
  -> loader-runtime-v1
```

The real executor path is not production-executable yet because the Lua runtime depends on a global executor adapter:

```lua
_G.LuxyHubRuntimeAdapterV1
```

No production adapter currently exists.

Primary findings:

- The bootstrap requires executor HTTP POST support, JSON encode/decode, global state, payload hashing, AES-256-GCM decryption with AAD, gzip decompression, and source execution.
- The current Lua bootstrap hard-fails if `sha256`, `decryptAes256Gcm`, or `gunzip` are missing.
- `execute` is documented as an adapter function in Phase 6D, but the current bootstrap treats it as optional and falls back to `loadstring(source)()`.
- The adapter decryption function receives `{ envelope, aad }` only. There is no explicit loader-side key material or key derivation contract.
- Because the build pipeline encrypts with a server-side secret-derived AES key, real client-side decryption is blocked until the runtime package defines how the adapter obtains compatible key material.

## 2. Runtime Contract

Current bootstrap file:

```text
app/lib/loader/loader-bootstrap.ts
```

Current TypeScript reference runtime:

```text
app/lib/loader/loader-runtime-v1.ts
```

Runtime version:

```text
loader-runtime-v1
```

Supported build compatibility:

```text
payload_format_version = inline-json-v1
build_version = delivery-build-v1
encryption_scheme = aes-256-gcm:v1
compression = gzip
```

AAD must remain exactly:

```text
payload_format_version:version_id:source_sha256
```

Example:

```text
inline-json-v1:version-uuid-1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
```

## 3. Bootstrap Dependencies

The generated loader assumes the executor environment can provide:

| Capability | Current Usage | Required For |
|------------|---------------|--------------|
| `game:GetService("HttpService")` | `JSONEncode`, `JSONDecode` | POST body encoding and response decoding |
| `syn.request` or `http_request` or `request` or `http.request` | POST requests | Delivery session and payload fetch |
| `_G` | `_G.LuxyHubLoaderRuntimeV1`, `_G.LuxyHubRuntimeAdapterV1` | Runtime and adapter sharing |
| `loadstring` | Dashboard snippet and runtime fallback | Loading bootstrap and optional execution fallback |
| Network access to LuxyHub origin | `POST /api/delivery/session`, `POST /api/delivery/fetch` | Payload retrieval |

The dashboard snippet still uses:

```lua
loadstring(game:HttpGet("https://www.luxyhub.space/api/loader/[slug]"))()
```

That top-level `HttpGet` is an executor convention, not enough by itself. The Phase 6D bootstrap needs POST-capable request support after the bootstrap is loaded.

## 4. Adapter Function Requirements

The adapter table should be treated as the production boundary between LuxyHub's versioned runtime and executor-specific primitives.

```lua
_G.LuxyHubRuntimeAdapterV1 = {
  sha256 = function(payload) end,
  decryptAes256Gcm = function(params) end,
  gunzip = function(bytes) end,
  execute = function(source) end
}
```

### 4.1 `sha256(payload)`

Input:

```text
payload: string
```

Required behavior:

- Hash the exact payload string returned by `/api/delivery/fetch`.
- Use UTF-8/string bytes exactly as received, without JSON reserialization.
- Return a lowercase 64-character SHA-256 hex digest.

Output:

```text
"0123...abcd" // 64 lowercase hex characters
```

Failure behavior:

- Return no digest or raise an adapter error.
- Runtime should fail closed if the digest does not exactly match `context.payload_sha256`.

### 4.2 `decryptAes256Gcm(params)`

Input:

```lua
{
  envelope = {
    v = "inline-json-v1",
    alg = "aes-256-gcm:v1",
    kid = "...",
    compression = "gzip",
    iv = "...",
    tag = "...",
    data = "..."
  },
  aad = "inline-json-v1:<version_id>:<source_sha256>"
}
```

Required behavior:

- Base64-decode `iv`, `tag`, and `data`.
- Use AES-256-GCM.
- Authenticate the exact AAD string.
- Verify the 16-byte GCM tag.
- Return decrypted compressed bytes only after authentication succeeds.

Output:

```text
compressed bytes accepted by gunzip()
```

Current blocker:

- The current params do not include a key, wrapped key, derived secret, or other loader-side key material.
- The server build pipeline derives the AES key from server-side secret material.
- A production adapter cannot decrypt real payloads safely until the runtime package defines a compatible key-material strategy.

### 4.3 `gunzip(bytes)`

Input:

```text
compressed bytes from decryptAes256Gcm()
```

Required behavior:

- Decompress gzip data produced by Node `gzipSync(..., { level: 9 })`.
- Return a Lua source string.
- Preserve source bytes as UTF-8 text after decompression.

Output:

```text
source: string
```

Failure behavior:

- Fail closed on invalid gzip data.
- Do not attempt partial execution.

### 4.4 `execute(source)`

Input:

```text
source: string
```

Recommended behavior:

- Execute recovered source exactly once.
- Return the result from the executor's execution primitive if available.
- Avoid logging or writing recovered source.

Current implementation nuance:

- Phase 6D documentation lists `execute` as part of the adapter table.
- The current Lua bootstrap does not require `execute`; it falls back to:

```lua
local chunk = loadstring(source)
return chunk()
```

Production recommendation:

- Treat `execute` as required for executor-specific adapters.
- Keep the fallback only as a development aid, or document it as a compatibility fallback with known risk.

## 5. Delivery Inputs Consumed By Runtime

The runtime consumes the Phase 6D fetch response:

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

Validation order:

```text
response shape
  -> payload_format_version
  -> build_version
  -> context fields
  -> payload_sha256
  -> payload envelope
  -> AES-GCM decrypt with AAD
  -> gunzip
  -> execute
```

The runtime must not request or read `script_versions.content`.

## 6. Executor Assumptions

The bootstrap assumes the executor can:

- Load a remote script through the creator-facing one-line loader snippet.
- Send JSON POST requests to the LuxyHub origin.
- Decode JSON responses.
- Maintain a global adapter table for the current session.
- Run binary-safe string operations for encrypted and compressed bytes.
- Execute recovered Luau source.

These assumptions are not verified for Solara, Xeno, Swift, or Delta.

The public sUNC documentation is useful for vocabulary because it documents `request`, `loadstring`, `base64decode`, and executor environment concepts. It is not a compatibility certificate for LuxyHub. sUNC also notes that not every original UNC function is tested.

## 7. Contract Gaps

| Gap | Impact | Required Next Decision |
|-----|--------|------------------------|
| No production adapter package exists | Real executor runs fail at `_G.LuxyHubRuntimeAdapterV1` lookup or primitive validation | Build adapter package plan before claiming support |
| No loader-side AES key material contract | Even a crypto-capable adapter cannot decrypt real payloads | Define key material or wrapping strategy without changing AES-GCM/AAD |
| `execute` required by docs but optional in code | Ambiguous support expectations | Decide whether production adapters must provide `execute` |
| Binary representation unspecified | AES and gzip may disagree on string vs byte-array handling | Standardize adapter byte representation |
| No diagnostic mode | Uniform loader failure protects internals but slows validation | Add a local-only validation checklist and executor log template |
| Executor support unverified | Compatibility claims would be misleading | Run real executor validation matrix |

## 8. Production Adapter Acceptance Checklist

Before any executor is marked supported:

- [ ] Adapter table exists before loader bootstrap calls `Runtime.consume`.
- [ ] `sha256("abc")` matches the standard SHA-256 test vector.
- [ ] `sha256(payload)` matches `context.payload_sha256` for an actual fetched payload.
- [ ] AES-256-GCM test vector passes with AAD.
- [ ] GCM tag failure rejects before decompression.
- [ ] Gzip test vector decompresses to the expected source string.
- [ ] Recovered `print("LUXY TEST")` source executes exactly once.
- [ ] Missing adapter fails closed.
- [ ] Tampered payload fails before decrypt.
- [ ] Reused delivery session token fails.
- [ ] Executor name, version, platform, date, and adapter implementation are recorded.

## 9. External References Reviewed

- Roblox HttpService reference: https://create.roblox.com/docs/reference/engine/classes/HttpService
- Roblox Luau globals reference: https://create.roblox.com/docs/reference/engine/globals/LuaGlobals
- sUNC documentation: https://docs.sunc.su/
- sUNC request documentation: https://docs.sunc.su/Miscellaneous/
- sUNC loadstring documentation: https://docs.sunc.su/Closures/loadstring/
- sUNC base64decode documentation: https://docs.sunc.su/Encoding/base64decode/

Executor-specific public pages were treated as weak evidence only. Marketing claims about UNC percentages, script hubs, or broad script execution do not prove LuxyHub compatibility.
