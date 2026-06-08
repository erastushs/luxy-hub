# Phase 6G - Delivery Architecture Review

Status: Completed architecture review
Date: 2026-06-08
Scope: Documentation and architecture decision only. No production code, API changes, cryptography changes, migrations, runtime adapters, key systems, or license systems.

## 1. Summary

Phase 6G reviews whether the current LuxyHub secure delivery model is realistic for real-world Roblox executor environments.

Current implemented model:

```text
script_versions.content
  -> normalize
  -> gzip
  -> AES-256-GCM envelope
  -> delivery_builds.payload_ciphertext
  -> delivery API
  -> loader-side decrypt
  -> gunzip
  -> execute
```

Current blocker:

```text
The loader receives payload, version_id, source_sha256, and payload_sha256,
but does not receive decryption key material.
```

Finding:

Loader-side AES-GCM decryption is not a realistic production baseline for Roblox executors. It requires non-standard crypto and gzip primitives, a binary-safe runtime package, and a key-material strategy that would either expose the decryption key to the client or recreate server-side secret material in an untrusted environment.

Recommendation:

Keep encrypted delivery builds for storage security, but move AES-GCM decryption and gzip decompression to the server delivery boundary. The loader should receive a short-lived runtime payload after session validation and execute it. This preserves encrypted-at-rest build artifacts and session-based access control while removing unrealistic client-side crypto requirements.

## 2. Current Architecture

Current architecture:

```text
Encrypted Build
  |
  v
Delivery API
  |
  v
Loader Decrypt
  |
  v
Execute
```

Implemented properties:

- `delivery_builds.payload_ciphertext` stores an encrypted JSON envelope.
- The delivery API returns the encrypted payload plus safe context.
- The loader validates `payload_sha256`.
- The loader builds AAD as:

```text
payload_format_version:version_id:source_sha256
```

- The loader expects `_G.LuxyHubRuntimeAdapterV1`.
- The adapter is expected to provide `sha256`, `decryptAes256Gcm`, `gunzip`, and `execute`.

Current missing requirement:

```text
No loader-side key material is provided.
```

That means the loader cannot decrypt real payloads unless one of these future strategies is chosen:

- ship the server key to the loader
- derive the server key in the loader
- deliver a decryption key to the loader
- stop decrypting in the loader

## 3. Alternative Architecture

Alternative architecture:

```text
Encrypted Build
  |
  v
Delivery API
  |
  v
Server Decrypt
  |
  v
Runtime Payload
  |
  v
Execute
```

In this model:

- The build pipeline can still produce encrypted `delivery_builds`.
- The delivery service selects a ready build through the existing session flow.
- The server decrypts and decompresses the artifact after session validation.
- The server returns an executable runtime payload to the loader.
- The loader no longer needs AES-GCM, gzip, or key material.

The runtime payload should still be returned through a one-time, short-lived, no-store response. It should not revive the old unauthenticated raw endpoint.

Important honesty:

- If no build-time obfuscation exists, the runtime payload is effectively normalized source.
- This does not create client-side DRM.
- It does reduce implementation risk and aligns security claims with what can actually be enforced.

## 4. Tradeoff Comparison

| Area | Loader-Side Decrypt | Server-Side Decrypt |
|------|---------------------|---------------------|
| Storage security | Strong: encrypted build artifact at rest. | Strong: encrypted build artifact at rest remains. |
| Passive network scraping | Stronger if keys are not on the network, but only if loader can actually decrypt. | Relies on TLS, one-time sessions, and future entitlement gates. |
| Malicious client resistance | Weak: client eventually has source or key. | Weak: client receives executable source/runtime payload. |
| Executor requirements | High: SHA-256, AES-GCM with AAD, base64, gzip, binary-safe strings. | Low: HTTP, JSON, `loadstring` or adapter `execute`. |
| Key exposure risk | High if any key is shipped, derived, or delivered to the client. | Lower: payload secret stays server-side. |
| Operational complexity | High: runtime adapters, crypto packages, executor-specific bugs. | Moderate: server decrypt path, delivery response migration. |
| Failure diagnosability | Hard: uniform client failures and executor-specific primitives. | Easier: failures happen in server logs before runtime execution. |
| Compatibility with Solara/Xeno/Swift/Delta | Not verified; unlikely as a portable baseline. | More realistic baseline, still requires HTTP + execution validation. |
| Alignment with current build storage | Already aligned. | Aligned if encrypted build remains source artifact. |

## 5. Threat Model Review

### 5.1 Storage Security

Storage security protects source from accidental or unauthorized exposure while stored in infrastructure.

Current encrypted builds help prevent:

- Plain source leakage from `delivery_builds`.
- Accidental raw source exposure through build artifact queries.
- Backup or database export exposure of delivery artifacts.
- Dashboard build visibility accidentally showing source.
- Payload corruption going unnoticed, through `payload_sha256`.

Current encrypted builds do not prevent:

- Source access through `script_versions.content` by authorized server/dashboard paths.
- Compromise of service-role credentials.
- Compromise of the build service.
- Runtime extraction after execution.
- A valid creator intentionally copying their own source.

Conclusion:

Encrypted build artifacts are still valuable for storage security, even if the server performs delivery-time decryption.

### 5.2 Delivery Security

Delivery security controls who can obtain executable code and how easily delivery can be automated.

Current session delivery helps prevent:

- Reuse of old payload fetch requests.
- Long-lived public payload URLs.
- Direct delivery without a ready build.
- Delivery of invalidated builds.
- Missing or malformed session token access.
- Simple unauthenticated raw artifact access.

Current session delivery does not prevent:

- A valid client from dumping the runtime payload.
- A valid client from replaying data during the session window.
- Executor hooks from intercepting responses.
- Memory inspection after decryption or execution.
- A user copying the loader and observing its requests.

Loader-side decryption adds:

- Possible passive network confidentiality if key material is not exposed.
- A payload hash validation step before decrypt.

Loader-side decryption also introduces:

- A decryption key distribution problem.
- A large executor compatibility surface.
- More runtime code that can be inspected and patched.
- False confidence that encryption stops authorized-client dumping.

Server-side decryption adds:

- A clear boundary: server controls storage decryption; loader controls execution.
- Lower executor requirements.
- A simpler future license gate at session creation or fetch.

Server-side decryption gives up:

- Encrypted payload confidentiality after the authorized delivery response is returned.

Conclusion:

The strongest enforceable delivery controls are session issuance, visibility, future entitlement checks, rate limits, and build invalidation. Loader-side cryptography does not solve malicious-client dumping because the client must ultimately execute the code.

## 6. Executor Reality Check

Roblox and executor environments are not equivalent to Node or browser crypto runtimes.

Evidence reviewed:

- Roblox documents `HttpService` JSON encoding/decoding as a platform service.
- Roblox/Luau source execution behavior exists as a concept, but executor availability and policy differ from normal Roblox game runtime.
- sUNC documents executor-environment conventions such as `request`, `loadstring`, and `base64decode`.
- sUNC documents LZ4 helpers, not gzip as the portable compression baseline.
- Public executor-specific pages for Solara, Xeno, Swift, and Delta do not provide a verified LuxyHub-compatible primitive matrix.

Current LuxyHub loader-side requirements:

```text
HTTP POST
JSON encode/decode
SHA-256 over exact payload string
AES-256-GCM decrypt with AAD
gzip decompress
execute recovered source
```

Feasibility assessment:

| Capability | Realistic Baseline? | Notes |
|------------|---------------------|-------|
| HTTP GET loader snippet | Likely, but must be verified per executor. | Common executor pattern, not sufficient alone. |
| HTTP POST JSON request | Plausible, not guaranteed. | sUNC-style `request` supports request tables, but each executor must be tested. |
| JSON encode/decode | Plausible through `HttpService`. | Must confirm access in executor context. |
| `loadstring` execution | Plausible, not guaranteed. | Must confirm per executor. |
| SHA-256 | Not a safe baseline. | Not standard Luau; may require native or bundled implementation. |
| AES-256-GCM with AAD | Not a safe baseline. | Not standard Luau; executor native support is not documented as portable. |
| gzip decompression | Not a safe baseline. | sUNC documents LZ4 helpers; gzip would need native or bundled implementation. |
| Binary-safe crypto strings | Not a safe baseline. | Needs test vectors on every executor. |

Conclusion:

Loader-side crypto is not realistic as the default production architecture for the named executors. Even if one executor can support it, requiring AES-GCM + gzip + SHA-256 makes LuxyHub fragile and hard to validate across Solara, Xeno, Swift, and Delta.

## 7. Key Material Review

### 7.1 Key Shipped To Loader

Flow:

```text
server secret or derived AES key
  -> embedded in bootstrap/runtime
  -> loader decrypts payload
```

Security implications:

- Anyone who fetches the loader can extract the key.
- If the same key protects many builds, one leak compromises all payloads using that key.
- Rotation requires rebuilds and redeploys.
- Does not stop malicious clients.

Decision:

```text
Rejected
```

### 7.2 Key Derived In Loader

Flow:

```text
public context + embedded algorithm/secret
  -> loader derives AES key
  -> loader decrypts payload
```

Security implications:

- If derivation uses only public values, there is no secret.
- If derivation uses embedded secret material, it is equivalent to shipping the key.
- Reverse engineers can reproduce the derivation.

Decision:

```text
Rejected
```

### 7.3 Key Delivered By Server

Flow:

```text
delivery session
  -> server returns payload + key or wrapped key
  -> loader decrypts payload
```

Security implications:

- The client still receives decryption capability.
- A network or executor hook can capture the key during a valid session.
- Provides little protection against the users most able to dump scripts.
- Adds protocol and runtime complexity.

Potential use:

- Acceptable only as a defense against passive payload-at-rest mirroring if future requirements demand encrypted network payloads.
- Not useful as a DRM boundary.

Decision:

```text
Acceptable only for future specialized use; not recommended for production baseline.
```

### 7.4 Server-Side Decrypt

Flow:

```text
delivery session
  -> server reads encrypted build
  -> server decrypts + decompresses
  -> server returns runtime payload
  -> loader executes
```

Security implications:

- Server secret stays server-side.
- Executor runtime no longer needs AES-GCM or gzip.
- Authorized clients can still dump runtime payload.
- Delivery security depends on session gating, future entitlement checks, rate limits, and no-store responses.

Decision:

```text
Recommended
```

## 8. Architecture Decision

### Recommended

```text
Encrypted Build
  -> Delivery API
  -> Server Decrypt
  -> Runtime Payload
  -> Execute
```

Justification:

- Keeps encrypted build artifacts, preserving storage security.
- Keeps the current build pipeline concept intact.
- Avoids exposing server-wide AES key material to clients.
- Avoids unrealistic executor requirements.
- Makes Solara/Xeno/Swift/Delta validation focus on HTTP, JSON, and execution.
- Aligns with the realistic threat model: control access to delivery, do not promise client-side secrecy after execution.

### Acceptable

```text
Encrypted Build
  -> Delivery API
  -> Server Decrypt
  -> Obfuscated Runtime Payload
  -> Execute
```

This is the recommended architecture plus future build-time obfuscation. It is acceptable and likely desirable after the server-side runtime-payload flow works.

```text
Encrypted Build
  -> Delivery API
  -> Key Delivered To Loader
  -> Loader Decrypt
  -> Execute
```

This is acceptable only as a future specialized network-confidentiality feature. It should not be used as the production baseline or marketed as protection from authorized-client dumping.

### Rejected

```text
Encrypted Build
  -> Delivery API
  -> Server key shipped or derived in loader
  -> Loader Decrypt
  -> Execute
```

Rejected because it exposes the decryption path to the untrusted client and still requires hard-to-port executor crypto.

```text
Encrypted Build
  -> Delivery API
  -> Loader Decrypt with no key material contract
  -> Execute
```

Rejected because it cannot execute real payloads.

## 9. Migration Impact

If the recommendation is adopted, implementation planning must account for these impacts.

### 9.1 Affected Phases

| Phase | Impact |
|-------|--------|
| Phase 5B Build Pipeline | Keep encrypted builds. No immediate cryptography change required. |
| Phase 5C Delivery API | Future fetch response shape changes from encrypted payload to runtime payload, or adds a new runtime fetch mode. |
| Phase 5D Reference Loader | Reference consumer should model server-decrypted runtime payload flow. |
| Phase 6D Production Loader | Bootstrap should stop requiring AES-GCM/gzip adapter primitives for baseline execution. |
| Phase 6F Runtime Validation | Runtime blocker changes from adapter crypto package to runtime payload delivery validation. |
| Phase 6G Review | Supersedes the previous assumption that adapter implementation alone solves production execution. |
| Future License Phase | Entitlements should gate session creation or runtime fetch, not payload decryption. |

### 9.2 Affected Endpoints

Current:

```text
POST /api/delivery/session
POST /api/delivery/fetch -> encrypted payload + context
GET /api/loader/[slug] -> bootstrap expecting loader-side decrypt
```

Potential future:

```text
POST /api/delivery/session
POST /api/delivery/fetch -> runtime payload + metadata
GET /api/loader/[slug] -> bootstrap expecting runtime payload execution
```

Alternative migration-compatible option:

```text
POST /api/delivery/fetch
  -> mode = "encrypted" for legacy tests
  -> mode = "runtime" for production loader
```

No endpoint change is implemented in this phase.

### 9.3 Affected Loader Flow

Current loader flow:

```text
request session
fetch encrypted payload
validate payload hash
decrypt AES-GCM
gunzip
execute
```

Recommended loader flow:

```text
request session
fetch runtime payload
validate response metadata
execute
```

Optional future validation:

```text
request session
fetch runtime payload
validate runtime payload hash
execute
```

The optional hash can help detect accidental corruption but cannot protect against a malicious server response, because the server provides both payload and metadata.

### 9.4 Compatibility Notes

The current `delivery_builds.payload_ciphertext` can remain unchanged. The server already owns the key material required to decrypt it.

The delivery API must be careful not to regress to the old raw endpoint model:

- keep one-time sessions
- keep short TTL
- keep rate limits
- keep no-store responses
- keep uniform failure responses
- keep future license gates at session creation or runtime fetch

If build-time obfuscation is added later, the server-decrypted runtime payload can be obfuscated source rather than original normalized source.

## 10. Next-Step Recommendation

Recommended next phase:

```text
Phase 6H - Runtime Payload Delivery Planning
```

Scope:

- Design a server-side decrypt/runtime-payload delivery response.
- Decide whether to modify `/api/delivery/fetch` or add a versioned runtime mode.
- Define runtime payload metadata and no-source-leak logging rules.
- Update loader bootstrap responsibilities.
- Preserve current build encryption and delivery session rules.
- Keep license/key systems deferred.

Do not start runtime adapter implementation until this architecture decision is accepted. Adapter work should focus on executor request/JSON/execute compatibility after server-side decrypt removes crypto/gzip from the baseline.

## 11. External References Reviewed

- Roblox HttpService reference: https://create.roblox.com/docs/reference/engine/classes/HttpService
- Roblox Luau globals reference: https://create.roblox.com/docs/reference/engine/globals/LuaGlobals
- sUNC documentation: https://docs.sunc.su/
- sUNC request documentation: https://docs.sunc.su/Miscellaneous/
- sUNC loadstring documentation: https://docs.sunc.su/Closures/loadstring/
- sUNC base64decode documentation: https://docs.sunc.su/Encoding/base64decode/
- sUNC lz4decompress documentation: https://docs.sunc.su/Encoding/lz4decompress/

Executor-specific public pages for Solara, Xeno, Swift, and Delta were treated as weak evidence only. No support claim should be made until LuxyHub validates the full flow in the real executor.
