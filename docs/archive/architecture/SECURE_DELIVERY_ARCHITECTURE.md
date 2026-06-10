# LuxyHub Secure Script Delivery Architecture

Status: Current secure delivery architecture with Phase 5A design history
Date: 2026-06-08
Scope: Documents the implemented delivery build/session/loader flow and preserves design notes for future hardening.

## 1. Purpose

LuxyHub stores creator source code in `script_versions.content`. Raw delivery remains available for public/unlisted scripts through:

```text
GET /api/scripts/[slug]/raw
```

Secure delivery adds a loader-first boundary. Raw source remains the canonical editable source, but script create/update/publish actions now create pre-built delivery payloads. Loaders retrieve those payloads through short-lived delivery sessions instead of embedding raw source in the bootstrap.

Target data path:

```text
Current:
scripts -> script_versions -> raw source

Implemented secure path:
scripts -> script_versions -> delivery_builds -> loader
```

## 1.1 Current Implementation Summary

Implemented:

- `delivery_builds` stores build artifacts for exact `script_versions` rows.
- Builds use `delivery-build-v1`, `inline-json-v1`, gzip compression, AES-256-GCM payload packaging, and SHA-256 source/payload integrity fields.
- Builds are created automatically after script creation, content version creation, and visibility publish actions.
- `GET /api/loader/[slug]` returns a no-store Lua bootstrap.
- `POST /api/delivery/session` issues a raw session token only once for a public/unlisted script with a ready build.
- `delivery_sessions.session_token_hash` stores `SHA-256(session_token)`, not the raw token.
- Delivery sessions expire after 60 seconds.
- `POST /api/delivery/fetch` validates the hashed token, rejects expired/consumed sessions, consumes the session atomically, and returns a no-store runtime payload response.

Not implemented:

- License, entitlement, marketplace, and paid-access checks.
- Dedicated external builder or object storage payload backend.
- CSP nonce migration.
- Loader-side secrecy guarantees against an authorized client that receives executable code.

## 2. Design Goals

- Keep `script_versions.content` as the source of truth for creator edits and version history.
- Prevent the delivery path from serving raw source once secure delivery is enabled for a script.
- Build obfuscated and encrypted payloads before delivery requests arrive.
- Make delivery payloads independently verifiable with integrity hashes and build metadata.
- Preserve rollback and version history semantics.
- Keep existing raw delivery working during migration.
- Leave license management and paid access for later phases.

Non-goals:

- This document does not implement cryptography.
- This document does not define final endpoint names.
- This document does not create migrations.
- This document does not build the loader.
- This document does not claim perfect client-side secrecy.

## 3. Current Delivery Models

```text
Client or loader
  |
  | GET /api/scripts/[slug]/raw
  v
Next.js route handler
  |
  | visibility check
  | optional admin bearer for private scripts
  v
script service
  |
  v
scripts.current_version_id
  |
  v
script_versions.content
  |
  v
text/plain raw script response
```

Current properties:

- Public and unlisted scripts are openly readable as raw text.
- Private raw scripts require admin bearer access.
- `script_downloads` records version-level delivery analytics.
- The raw endpoint is retained for compatibility while loader-first delivery is available for ready builds.

Secure loader path:

```text
Loader
  |
  | GET /api/loader/[slug]
  v
Lua bootstrap
  |
  | POST /api/delivery/session
  v
session_token, expires_in = 60
  |
  | POST /api/delivery/fetch
  v
SHA-256 token hash lookup
  |
  | consume-once delivery session
  v
runtime payload response
```

Secure delivery properties:

- Only public and unlisted scripts are deliverable through session issuance.
- A ready delivery build must exist for the script's current version.
- Delivery session tokens are stored only as SHA-256 hashes.
- Sessions are one-time use and short-lived.
- Loader, session, and fetch responses use `Cache-Control: no-store`.

## 4. Delivery Build Model

```text
Creator source update
  |
  v
script_versions.content
  |
  | publish or rebuild event
  v
Build pipeline
  |
  | validate
  | normalize
  | obfuscate
  | encrypt/package
  | hash
  v
delivery_builds
  |
  | secure delivery session
  v
Loader
  |
  | decrypt in memory
  | verify integrity
  | execute payload
  v
Executor runtime
```

Implemented properties:

- Delivery routes select a ready delivery build, not raw source.
- A build belongs to one exact `script_versions` row.
- A script rollback selects another version and therefore another build.
- Failed rebuilds do not overwrite known-good payloads.
- Payloads are pre-built artifacts. Current storage is inline encrypted payloads in `delivery_builds`.

## 5. Data Model Overview

```text
scripts
  id
  slug
  visibility
  current_version_id
        |
        | active source version
        v
script_versions
  id
  script_id
  version
  content
        |
        | one source version can have many payload builds
        v
delivery_builds
  id
  script_id
  version_id
  build_status
  payload storage
  payload hash
  build version
  timestamps
```

`delivery_builds` is an artifact table. It should not replace `script_versions`, and it should not become a place where source code is edited.

## 6. Build Pipeline Architecture

### 6.1 Source Flow

Source flow remains dashboard-owned:

```text
Creator dashboard
  |
  | create or edit script content
  v
Server Action / service layer
  |
  | requireAuth()
  | assertScriptOwner()
  | validate content
  v
script_versions.content
```

Rules:

- `creator_id` continues to come from the authenticated server session.
- Each content change creates a new immutable `script_versions` row.
- Raw source remains available to creator-owned dashboard views and build services.
- The secure delivery path should not query `script_versions.content` during ordinary payload retrieval.

### 6.2 Publish Flow

Publish flow turns a source version into a deliverable artifact:

```text
Creator marks a version deliverable
  |
  v
Ownership and visibility validation
  |
  v
Resolve target script_versions row
  |
  v
Find compatible ready delivery_build
  |
  +-- exists and fresh -> version is deliverable
  |
  +-- missing or stale -> create build request
```

For Phase 5B planning, "publish" should mean "the version is allowed to be delivered by the loader." It does not need to imply marketplace publication, paid access, or license state.

The current `scripts.visibility` model should continue to decide whether a script is public, private, or unlisted. Secure delivery adds a delivery artifact requirement; it does not redefine ownership.

### 6.3 Build Flow

Recommended build flow:

```text
delivery_builds row created as pending
  |
  v
builder reads script_versions.content through service-role path
  |
  v
source validation and normalization
  |
  v
build-time obfuscation
  |
  v
payload envelope creation
  |
  v
payload encryption layer
  |
  v
integrity hashes computed
  |
  v
payload stored
  |
  v
delivery_builds marked ready
```

Build output should be immutable. A rebuild should create a new artifact or supersede an older artifact, not mutate source.

The build system may run inside the main app for small payloads, but the architecture should allow a dedicated worker later. Obfuscation can be CPU-heavy, and long-running work should not be tied permanently to user request lifetimes.

### 6.4 Rebuild Flow

Rebuilds are required when:

- The obfuscator changes.
- The payload format changes.
- The encryption envelope changes.
- A build bug is discovered.
- A payload is corrupted or fails integrity checks.
- A manual security rebuild is requested.
- A key rotation policy requires re-encryption.

Rebuild flow:

```text
Rebuild requested
  |
  v
Select target version(s)
  |
  v
Create new pending delivery_build row
  |
  v
Build new artifact
  |
  +-- success -> mark new build ready, invalidate or supersede older build
  |
  +-- failure -> keep previous ready build eligible
```

Operational rule: failed rebuilds must not break current delivery if a prior compatible ready build exists.

## 7. `delivery_builds` Table Proposal

This is a schema proposal only. It is not a migration.

Purpose:

- Store delivery artifacts generated from `script_versions.content`.
- Track build compatibility and payload integrity.
- Support rebuilds without changing source history.
- Allow delivery services to retrieve payloads without reading raw source.

### 7.1 Proposed Columns

| Column | Type | Required | Purpose |
|--------|------|----------|---------|
| `id` | `uuid` | yes | Primary key for the build artifact. |
| `script_id` | `uuid` | yes | Parent script reference for lookup, cleanup, and ownership joins. |
| `version_id` | `uuid` | yes | Exact `script_versions.id` used as build input. |
| `build_status` | `text` | yes | Lifecycle state: `pending`, `building`, `ready`, `failed`, `invalidated`. |
| `payload_storage_kind` | `text` | yes | Storage mode: `inline_encrypted` or `object_encrypted`. |
| `payload_ciphertext` | `text` | no | Inline encrypted payload body when stored in Postgres. |
| `payload_storage_ref` | `text` | no | Object storage key or opaque storage reference when payload is external. |
| `payload_content_type` | `text` | yes | Payload media type, for example a LuxyHub payload envelope type. |
| `payload_byte_size` | `integer` | no | Size of the stored encrypted payload. |
| `source_sha256` | `text` | yes | Hash of normalized source input used to detect stale builds. |
| `payload_sha256` | `text` | yes when ready | Integrity hash of the exact stored payload bytes. |
| `build_version` | `text` | yes | Version of the LuxyHub build pipeline that produced the artifact. |
| `payload_format_version` | `text` | yes | Loader-facing payload envelope format version. |
| `obfuscator_version` | `text` | no | Obfuscator engine and config version. |
| `encryption_scheme` | `text` | no | Named encryption envelope version. No algorithm is finalized in Phase 5A. |
| `encryption_key_id` | `text` | no | Server-side key identifier for rotation and audit. |
| `loader_min_version` | `text` | no | Minimum loader version expected to understand this build. |
| `supersedes_build_id` | `uuid` | no | Older build replaced by this build. |
| `invalidated_reason` | `text` | no | Sanitized reason when a build is invalidated. |
| `build_error_code` | `text` | no | Sanitized machine-readable failure reason. |
| `build_error_message` | `text` | no | Sanitized human-readable failure summary. Must not include source. |
| `metadata` | `jsonb` | no | Non-secret build metadata. Must not contain source code or keys. |
| `built_at` | `timestamptz` | no | Time the artifact became ready. |
| `invalidated_at` | `timestamptz` | no | Time the artifact was removed from delivery eligibility. |
| `created_at` | `timestamptz` | yes | Row creation time. |
| `updated_at` | `timestamptz` | yes | Last lifecycle update time. |

### 7.2 Proposed Constraints

- `version_id` references `script_versions(id)`.
- `script_id` references `scripts(id)`.
- `version_id` must belong to `script_id`; this can be enforced by application logic or a composite database constraint in Phase 5B.
- `build_status` should be limited to known lifecycle values.
- Exactly one payload storage path should be used:
  - inline payload: `payload_ciphertext` set and `payload_storage_ref` null
  - object payload: `payload_storage_ref` set and `payload_ciphertext` null
- `payload_sha256` should be required before `build_status = ready`.
- Ready builds must not contain raw source in `payload_ciphertext`, `payload_storage_ref`, `metadata`, or error fields.

### 7.3 Proposed Indexes

Suggested indexes for Phase 5B planning:

| Index | Purpose |
|-------|---------|
| `(version_id, build_status)` | Resolve ready builds for the active version. |
| `(script_id, build_status)` | List or rebuild builds for a script. |
| `(build_version, payload_format_version)` | Find stale builds after builder or loader format changes. |
| `(payload_sha256)` | Integrity lookup and duplicate detection. |
| `(created_at)` | Build queue and cleanup ordering. |

Phase 5B should also consider a partial uniqueness rule so a version has only one active ready build for a given build version and payload format.

### 7.4 RLS and Access Model

Initial recommendation:

- `delivery_builds` should be service-role-only at the table level.
- Browser users should not query payload rows directly.
- Dashboard views may later display sanitized build status through service functions.
- Payload retrieval should happen through delivery services that validate session, visibility, ownership or entitlement, and rate limits.

This follows the existing pattern for operational tables such as `script_downloads`.

## 8. Payload Lifecycle

### 8.1 Generation

Payload generation starts from a specific immutable source version:

```text
script_versions.id + builder config + loader protocol target
  |
  v
delivery_builds.id
```

The builder must record enough metadata to answer:

- Which source version produced this payload?
- Which source hash was used?
- Which build pipeline version produced it?
- Which loader format can consume it?
- Which encryption envelope protects it?
- Which payload hash should delivery verify?

### 8.2 Storage

Two storage modes should be supported by the schema:

1. `inline_encrypted`
   - Encrypted payload stored directly in `delivery_builds.payload_ciphertext`.
   - Simple for small payloads and consistent with the current Postgres-first MVP.
   - Subject to database row size and query performance considerations.

2. `object_encrypted`
   - Encrypted payload stored in object storage.
   - `delivery_builds.payload_storage_ref` stores an opaque storage key.
   - The object must not be publicly readable.
   - The delivery service should stream or proxy the object after validating a delivery session.

Storage rule: object storage signed URLs should not become a bypass around delivery authorization. If signed URLs are used later, they must point only to encrypted payloads and must be short-lived.

### 8.3 Invalidation

A build should be invalidated when:

- The payload hash no longer matches stored bytes.
- The build pipeline version is revoked.
- The obfuscator version is revoked.
- The encryption key is compromised.
- The payload format is no longer accepted by supported loaders.
- The script or version is deleted.
- An operator manually blocks a build.

Invalidation should remove a build from delivery eligibility but preserve enough metadata for audit and diagnosis.

### 8.4 Rebuild Behavior

Rebuilds should be additive:

```text
old ready build remains eligible
  |
  v
new pending build starts
  |
  +-- new build ready -> old build invalidated or superseded
  |
  +-- new build failed -> old build remains eligible
```

This lets operators rebuild active scripts safely without taking delivery offline.

Historical versions do not need to be rebuilt immediately unless:

- They are active.
- They are selected for rollback.
- A security event requires all deliverable versions to be rebuilt.
- A loader compatibility window requires prebuilt artifacts for older versions.

## 9. Secure Delivery Flow

Endpoint names below are placeholders for Phase 5B planning. They are not API changes in Phase 5A.

### 9.1 Loader Interaction

```text
Loader bootstrap
  |
  | request delivery session for script slug
  | include loader version, runtime hints, nonce, and optional entitlement proof
  v
Delivery session service
  |
  | resolve script
  | check visibility
  | select current_version_id
  | select compatible ready delivery_build
  | validate future token/license/key requirements
  | rate limit
  v
Short-lived delivery session
```

The loader should not receive raw source during session creation. Session creation only authorizes later payload retrieval.

### 9.2 Delivery Session

A delivery session should bind:

- script id
- version id
- delivery build id
- loader protocol version
- expiration timestamp
- request nonce or anti-replay value
- future entitlement result
- optional coarse client fingerprint

Implementation choices for Phase 5B:

- Stateless signed token with short expiry.
- Persisted session record with one-time or limited-use counters.
- Hybrid signed token plus server-side denylist for invalidation.

The architecture does not require `delivery_builds` to store session state. Build artifacts are reusable; delivery sessions are per request or per loader run.

### 9.3 Payload Retrieval

```text
Loader
  |
  | payload request with delivery session token
  v
Delivery service
  |
  | validate session
  | validate build is still ready
  | validate payload hash before response
  | record analytics
  v
Encrypted payload envelope
  |
  v
Loader decrypts in memory and executes
```

The payload response should include:

- build id
- version id
- payload format version
- encryption envelope metadata
- payload integrity hash
- encrypted payload
- short cache lifetime or no-store policy as appropriate

The response should not include:

- `script_versions.content`
- source hash if it would help correlate private source outside the system
- server encryption secrets
- creator-only metadata
- internal build logs

### 9.4 Future Token Integration

Future key, Work.ink, license, or entitlement checks should happen before session issuance:

```text
Loader
  |
  | key/license/workflow proof
  v
Entitlement validation
  |
  +-- denied -> no delivery session
  |
  +-- allowed -> delivery session bound to entitlement result
```

Important separation:

- `delivery_builds` stores reusable payload artifacts.
- Delivery sessions authorize a specific loader attempt.
- License or key records authorize a user or device.

This separation allows Phase 5 secure delivery to ship before Phase 7 license management.

## 10. Obfuscation Strategy

### 10.1 Build-Time Obfuscation

Build-time obfuscation transforms source before any delivery request:

```text
script_versions.content
  |
  v
obfuscator
  |
  v
encrypted delivery payload
```

Benefits:

- Raw source is not needed in the delivery hot path.
- Payloads can be hashed and verified consistently.
- Delivery requests are faster and less CPU-heavy.
- Builds can be tested, audited, and rolled back.
- A broken obfuscator build can fail before users request the script.
- Payloads can be cached safely because they are already transformed and encrypted.
- Rebuilds can be controlled after builder upgrades or security events.

### 10.2 Delivery-Time Obfuscation

Delivery-time obfuscation transforms source during each payload request.

Potential benefit:

- Each request can produce a slightly different payload.

Costs:

- Raw source must be available in the delivery path.
- Request latency becomes dependent on obfuscator cost.
- High traffic multiplies build CPU usage.
- Integrity hashes become less stable.
- Caching becomes difficult or impossible.
- Runtime failures affect live delivery directly.
- Incident rollback is harder because payloads are not durable artifacts.

### 10.3 Decision

LuxyHub should use build-time obfuscation as the default architecture.

Delivery-time variation may be considered later as a lightweight wrapper, watermark, or nonce-bound envelope, but not as the primary obfuscation step.

## 11. Encryption Strategy

Encryption should protect the built payload at rest and during delivery. It should not be described as perfect DRM, because the loader must eventually decrypt or interpret the payload.

### 11.1 Payload Encryption Layer

Recommended envelope concept:

```text
payload envelope
  |
  | metadata:
  | - build_id
  | - version_id
  | - payload_format_version
  | - encryption_scheme
  | - encryption_key_id
  | - nonce or equivalent
  | - payload_sha256
  |
  v
encrypted obfuscated payload bytes
```

Design rules:

- Encrypt the obfuscated payload, not raw source.
- Store only encrypted payload bytes in `delivery_builds` or object storage.
- Keep encryption keys outside the database.
- Record only key identifiers in `delivery_builds`.
- Support key rotation through rebuild or re-encryption.
- Use authenticated encryption in Phase 5B design.
- Treat algorithm selection as a separate implementation decision.

### 11.2 Loader Decryption Expectations

The loader should:

- Request a delivery session before payload retrieval.
- Receive only encrypted payloads.
- Validate payload envelope version compatibility.
- Verify integrity before execution.
- Decrypt in memory.
- Avoid persisting plaintext.
- Fail closed on expired sessions, invalid hashes, unsupported payload formats, or missing keys.

The loader cannot permanently hide decrypted code from a hostile runtime. The goal is to reduce direct scraping, casual copying, and raw endpoint exposure.

## 12. Version Compatibility

### 12.1 Version History Interaction

`script_versions` remains the immutable source history:

```text
script_versions row
  |
  +-- delivery_build for loader format A
  +-- delivery_build for loader format B
  +-- delivery_build after obfuscator upgrade
```

A single source version may have multiple delivery builds because loader protocols, encryption envelopes, and builder versions can change over time.

### 12.2 Rollback Behavior

Rollback should continue to mean selecting an older `script_versions` row as active.

```text
scripts.current_version_id = previous version id
  |
  v
delivery selects ready build for that version
```

If the previous version already has a compatible ready build, rollback can be immediate.

If no compatible build exists:

- Queue a build for that version.
- Keep the current version deliverable until the rollback build is ready, if product behavior allows.
- Or block secure delivery with a clear "build unavailable" state, if strict rollback semantics are required.

The correct product choice should be made in Phase 5B.

### 12.3 Rebuild Behavior

Rebuilding does not create a new script version. It creates a new delivery artifact for the same version.

Use rebuilds for:

- builder upgrades
- obfuscator upgrades
- payload format upgrades
- encryption key rotation
- payload corruption recovery
- loader compatibility windows

### 12.4 Loader Compatibility

The loader should advertise its protocol or version during session creation. The delivery service should select a compatible ready build.

```text
loader version 1.x -> payload_format_version 1
loader version 2.x -> payload_format_version 2
```

If no compatible build exists, the service should return an upgrade-required or build-unavailable response in Phase 5B.

## 13. Migration Strategy

### 13.1 Current State

```text
scripts
  |
  v
script_versions
  |
  v
raw endpoint
```

### 13.2 Future State

```text
scripts
  |
  v
script_versions
  |
  v
delivery_builds
  |
  v
loader
```

### 13.3 Non-Breaking Migration Plan

Phase 5A:

- Document the secure delivery architecture.
- Do not modify code, APIs, migrations, or database schema.

Phase 5B:

- Add `delivery_builds` through a reviewed migration.
- Add service/repository functions for build records.
- Add builder interface behind a feature flag.
- Keep `/api/scripts/[slug]/raw` behavior unchanged.

Phase 5C:

- Generate builds for active versions.
- Backfill builds for current public, private, and unlisted scripts.
- Add operational build status views if needed.
- Continue serving legacy raw delivery.

Phase 6:

- Introduce loader integration against secure delivery endpoints.
- Use secure delivery for test scripts first.
- Compare raw delivery analytics with secure delivery analytics.
- Keep raw fallback until loader reliability is proven.

Post-Phase 6:

- Mark selected scripts as secure-delivery-required.
- Disable public raw delivery for those scripts.
- Keep administrative source access in the dashboard.
- Remove or heavily restrict raw delivery only after all production loaders migrate.

### 13.4 Compatibility Rules

- Existing dashboard script management must continue to use `script_versions`.
- Existing version history must not be rewritten.
- Existing analytics can remain version-level until build-aware analytics are intentionally designed.
- Existing public/unlisted raw URLs should not break before loader migration.
- Private raw access through admin bearer can remain an operational fallback until replaced.

## 14. Risk Analysis

### 14.1 Anti-Curl Limitations

Secure delivery can reduce direct curl access, but it cannot make HTTP impossible to automate.

Limitations:

- Headers can be copied.
- User agents can be spoofed.
- Short-lived tokens can be stolen during their valid window.
- A reverse engineer can replay requests made by their own loader run.
- IP-based rate limits are bypassable with proxies.
- Public scripts can always be requested by some authorized path.

Useful mitigations:

- Short-lived delivery sessions.
- Nonce or one-time session claims.
- Rate limits by IP, script, build, and session.
- Delivery token binding to script/version/build.
- Strict no-store responses for session-bound payloads.
- Abuse analytics and anomaly detection.
- Cloudflare or edge WAF for volumetric abuse.

### 14.2 Anti-Dump Limitations

Obfuscation and encryption do not prevent all dumping.

Limitations:

- The loader must eventually decrypt or interpret the payload.
- A hostile runtime may inspect memory.
- Executor hooks may intercept network responses or execution calls.
- Obfuscated Lua can be studied, patched, or partially deobfuscated.
- Client-side secrets can eventually be extracted by a determined attacker.

Useful mitigations:

- Build-time obfuscation with frequent rebuild capability.
- Payload encryption to remove raw source from storage and network responses.
- Runtime integrity checks where compatible with executors.
- Watermarking or build identifiers for leak tracing.
- Fast key and payload rotation after incidents.
- Clear operational response for compromised builds.

### 14.3 Realistic Threat Model

LuxyHub should aim to defend against:

- Casual users opening a raw URL in a browser.
- Simple curl or script mirroring of public raw endpoints.
- Direct indexing of raw source by external services.
- Unauthorized access to private scripts through public routes.
- Reuse of stale payload URLs.
- Accidental raw source leakage through logs, analytics, or build errors.

LuxyHub should not claim to fully defend against:

- A fully malicious client that controls the runtime.
- A determined reverse engineer with access to a valid loader session.
- Memory dumping after decryption.
- Executor-level hooks that intercept execution.
- Long-term secrecy of code that must execute on an untrusted client.

Security claim:

Phase 5 should make scraping, copying, and unauthorized direct access significantly harder. It should not promise impossible client-side DRM.

## 15. Future Loader Integration Plan

Phase 6 loader integration should consume the Phase 5 delivery architecture rather than design its own storage model.

Expected loader responsibilities:

- Know the script slug or script identifier.
- Advertise loader protocol version.
- Request a delivery session.
- Present future key/license/token proof when required.
- Fetch the encrypted payload.
- Validate integrity and format compatibility.
- Decrypt in memory.
- Execute without writing plaintext source to disk.
- Report structured failure states where possible.

Expected server responsibilities:

- Resolve script and active version.
- Select compatible ready build.
- Enforce visibility and entitlement.
- Issue short-lived sessions.
- Refuse stale, invalidated, or incompatible builds.
- Track delivery analytics.
- Avoid exposing source through payload responses, errors, or logs.

Executor compatibility research should answer:

- Maximum practical payload size.
- Available cryptographic primitives or loader-side implementation constraints.
- Whether binary-like payloads, base64 payloads, or text envelopes are safest.
- Whether no-store cache headers are honored.
- How failure messages should be represented without leaking internals.
- Whether runtime integrity checks are viable across target executors.

## 16. Open Questions for Phase 5B

- Should initial payload storage be Postgres inline, object storage, or a hybrid?
- Should builds run synchronously for small scripts or always through a queue-like worker?
- What exact payload envelope format should the loader consume?
- Which authenticated encryption approach fits the loader runtime?
- Should delivery sessions be stateless signed tokens, persisted records, or hybrid?
- How should secure-delivery-required scripts coexist with legacy raw URLs?
- Should `script_downloads` remain version-only, or should Phase 5B add build-aware analytics later?
- What is the minimum loader version policy for format upgrades?

## 17. Phase 5B Readiness Checklist

Before implementation starts:

- Approve the `delivery_builds` schema proposal.
- Decide inline vs object payload storage for the first implementation.
- Define build status transitions and retry behavior.
- Define the first payload envelope format.
- Define the first loader protocol version.
- Decide how delivery sessions are represented.
- Decide the raw endpoint migration flag strategy.
- Add tests to cover build selection, stale build rejection, invalidation, and rollback behavior.

Phase 5A is complete when this architecture is reviewed and accepted as the basis for Phase 5B implementation planning.
