# Phase 5D - Loader Integration Proof of Concept

Status: Implemented
Date: 2026-06-08
Scope: Reference loader and payload consumer proof of concept only. No key validation, license system, customer management, dashboard UI, HWID system, anti-tamper system, or build pipeline behavior changes.

## 1. Summary

Phase 5D proves that LuxyHub secure delivery payloads can be consumed end-to-end:

```text
script_versions.content
  |
  v
build pipeline
  |
  v
delivery_builds.payload_ciphertext
  |
  v
delivery session API
  |
  v
reference loader
  |
  v
decrypt
  |
  v
decompress
  |
  v
recovered normalized source
```

This phase does not ship a production Roblox loader. It provides a Node reference loader and reusable payload consumer utilities so Phase 6 can design the real loader protocol with working proof.

## 2. Files

Payload consumer:

```text
app/lib/delivery/payload-consumer.ts
```

Reference loader:

```text
examples/reference-loader.ts
```

Tests:

```text
__tests__/delivery-payload-consumer.test.ts
```

## 3. Loader Architecture

Reference flow:

```text
request delivery session
  |
  v
receive session token
  |
  v
fetch encrypted payload
  |
  v
validate payload envelope
  |
  v
decrypt payload
  |
  v
decompress payload
  |
  v
execute recovered source through caller-provided callback
```

The reference loader exposes:

```text
runReferenceLoader({
  baseUrl,
  slug,
  versionId,
  sourceSha256,
  payloadSecret,
  execute,
})
```

Important Phase 5D limitation:

- Phase 5B AES-GCM payloads bind authenticated additional data to `payload_format_version`, `version_id`, and `source_sha256`.
- The Phase 5C fetch endpoint returns `payload`, `payload_format_version`, and `build_version`.
- The Phase 5D reference loader therefore requires `versionId` and `sourceSha256` as trusted build context.
- Phase 6 must decide how production loaders receive or derive that context safely.

## 4. Payload Consumer Utilities

Functions:

```text
validatePayload(payload)
decryptPayload({ payload, versionId, sourceSha256, secret? })
decompressPayload(payload)
```

`validatePayload()` checks the inline JSON envelope:

```json
{
  "v": "inline-json-v1",
  "alg": "aes-256-gcm:v1",
  "kid": "default",
  "compression": "gzip",
  "iv": "...",
  "tag": "...",
  "data": "..."
}
```

`decryptPayload()` decrypts the compressed bytes using the same key derivation and AAD contract as Phase 5B.

`decompressPayload()` gunzips the decrypted bytes back to normalized source text.

## 5. Payload Lifecycle

Build time:

```text
source
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
```

Delivery time:

```text
session token
  |
  v
one-time delivery session
  |
  v
payload_ciphertext
```

Loader time:

```text
payload_ciphertext
  |
  v
validate envelope
  |
  v
decrypt with payload context
  |
  v
gunzip
  |
  v
execute recovered source
```

## 6. Compatibility Matrix

| Build Version | Payload Format | Encryption | Compression | Consumer Support |
|---------------|----------------|------------|-------------|------------------|
| `delivery-build-v1` | `inline-json-v1` | `aes-256-gcm:v1` | `gzip` | Supported |

Unsupported cases:

- Unknown payload format version.
- Unknown encryption scheme.
- Unknown compression method.
- Invalid base64 envelope fields.
- Invalid source hash context.
- Failed authentication tag verification.
- Invalid gzip data.

## 7. Future Migration Strategy

Payload format changes should create a new `payload_format_version`.

Recommended strategy:

1. Add a new consumer implementation alongside `inline-json-v1`.
2. Teach the delivery session service to select compatible builds.
3. Keep older ready builds available during loader rollout.
4. Rebuild active versions into the new format.
5. Retire older payload formats only after loader compatibility windows close.

Build version changes should not automatically imply payload format changes. A builder can change internally while still producing the same loader-facing format.

## 8. Future Key Integration Points

Phase 5D does not implement keys or licenses.

Future integration points:

- Before `POST /api/delivery/session` returns a session token.
- During delivery session creation, after script/build lookup and before token creation.
- In the future loader bootstrap, before requesting the session.

Do not bind key validation into payload decryption. Entitlements should authorize sessions; payload format should remain focused on delivery compatibility.

## 9. End-to-End Validation Results

Validated by:

```text
__tests__/delivery-payload-consumer.test.ts
```

Covered:

- Phase 5B build output decrypts correctly.
- Decrypted payload decompresses correctly.
- Recovered source matches original normalized source.
- Payload returned in the Phase 5C response shape can be consumed.
- Invalid payload JSON is rejected.
- Invalid payload format version is rejected.
- Invalid payload context fails decryption.

## 10. Security Review

- No build pipeline behavior changed.
- No source is exposed by delivery API changes.
- No dashboard UI was added.
- No key validation, license system, customer management, HWID system, or anti-tamper system was added.
- Reference loader is not a production security boundary.
- Recovered source exists in memory after decryption; a hostile runtime can still inspect it.
- Phase 5D proves payload consumption, not client-side DRM.

## 11. Remaining Work for Phase 6

- Decide how real loaders receive `version_id` and `source_sha256` context.
- Port payload consumer behavior to the target executor environment.
- Decide whether the production loader receives source text, bytecode, or another execution envelope.
- Add compatibility negotiation between loader version and payload format.
- Add operational telemetry without logging payloads or session tokens.
- Add entitlement integration only after loader requirements are finalized.
