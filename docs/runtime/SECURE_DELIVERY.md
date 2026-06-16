# Secure Delivery Runtime

Status: Documents current runtime behavior before Phase 7B Key Monetization Platform. This file is documentation only.

Primary files:

- `app/api/delivery/session/route.ts`
- `app/api/delivery/fetch/route.ts`
- `app/lib/services/delivery-session-service.ts`
- `app/lib/services/delivery-authorization-service.ts`
- `app/lib/services/delivery-build-service.ts`
- `app/lib/delivery/runtime-payload.ts`

## Runtime Goals

- Do not expose raw script source through public CDN-style routes.
- Serve only pre-built ready encrypted payloads.
- Use short-lived, hashed, one-time session tokens for payload fetch.
- Keep event reporting tied to delivery sessions without consuming delivery fetch access.
- Preserve public/unlisted delivery behavior while allowing `key_required` and `license_required` access modes.

## Loader Flow

1. Runtime loader knows the script slug and calls `POST /api/delivery/session`.
2. Client request may include `key`, `license`, and `customer_identifier` depending on script access mode.
3. Server applies IP-based rate limiting for `DELIVERY_SESSION`.
4. Server validates slug format.
5. Server loads script by slug using delivery repository lookup.
6. Server rejects missing scripts, scripts without current versions, and non-deliverable visibility with `Delivery unavailable`.
7. Server authorizes access based on `scripts.access_mode`.
8. Server selects latest ready build for `script.current_version_id` matching `DELIVERY_BUILD_VERSION` and `PAYLOAD_FORMAT_VERSION`.
9. Server creates a raw random session token and event secret.
10. Server stores only `session_token_hash`, `event_secret`, `script_id`, `build_id`, and expiration in `delivery_sessions`.
11. Server records a `script_executions` row for execution analytics.
12. Server returns `session_token`, `event_secret`, and `expires_in` with `Cache-Control: no-store`.

## Session Creation

Endpoint: `POST /api/delivery/session`

Inputs:

- `slug`: required script slug.
- `key`: optional for `key_required` scripts.
- `license`: optional for `license_required` scripts.
- `customer_identifier`: optional/required depending on license validation path.

Session properties:

- TTL is `60` seconds.
- Raw session token is generated with `randomBytes(32).toString('base64url')`.
- Stored token is `sha256(rawToken)`.
- Event secret is generated independently and stored on the session.
- Session is tied to exactly one script and one ready build.

Access mode behavior:

- `public`: no key/license required.
- `key_required`: validates supplied key against the key system.
- `license_required`: validates supplied license against hashed license records and customer assignment rules.

Failure responses:

- Invalid slug, missing script, private script, missing current version, missing ready build, or unexpected service failure returns `Delivery unavailable` with status `404`.
- Failed access-mode authorization returns the authorization service status/message.
- Rate limit failure returns `429` with `Retry-After`.

Security boundaries:

- Client never supplies or controls `creator_id`.
- Raw session token is returned once and never stored.
- Session creation does not return payload ciphertext.
- All responses include `Cache-Control: no-store`.

## Fetch Flow

Endpoint: `POST /api/delivery/fetch`

Input:

- `session_token`: raw token received from session creation.

Processing:

1. Server applies IP-based rate limiting for `DELIVERY_FETCH`.
2. Server validates token shape.
3. Server hashes the token and loads `delivery_sessions` by `session_token_hash`.
4. Server rejects missing, expired, or already consumed sessions.
5. Server loads the referenced build.
6. Server verifies build belongs to the same script as the session.
7. Server verifies build is deliverable: ready, inline encrypted, non-empty ciphertext, valid source hash, and valid payload hash.
8. Server consumes the session with an atomic update requiring `consumed_at IS NULL` and `expires_at > now`.
9. Server creates the runtime payload response from the build.
10. Server returns runtime payload metadata and `event_secret` with `Cache-Control: no-store`.

Returned fields:

- `runtime_payload`
- `build_version`
- `version_id`
- `runtime_format_version`
- `event_secret`

Failure responses:

- Invalid, expired, consumed, mismatched, or non-deliverable sessions return `Invalid delivery session` with status `403`.
- Rate limit failure returns `429` with `Retry-After`.

Security boundaries:

- Payload fetch is one-time.
- Fetch validates build/script consistency after session lookup.
- Event reporting does not consume `delivery_sessions.consumed_at`.
- Raw payload decryption is handled by runtime payload consumer logic, not by exposing source in database queries.

## Payload Delivery

Build payload structure:

- Source is normalized and gzip-compressed during build.
- Compressed source is encrypted with AES-256-GCM.
- AAD binds payload format version, version id, and source SHA-256.
- Ciphertext JSON contains format version, algorithm, key id, compression, IV, auth tag, and encrypted data.
- `payload_sha256` records integrity hash of the ciphertext JSON.

Delivery build requirements:

- `build_status = 'ready'`.
- `payload_storage_kind = 'inline_encrypted'`.
- `payload_ciphertext` present.
- `payload_sha256` valid SHA-256 hex.
- `source_sha256` valid SHA-256 hex.
- `built_at` present.
- Build version and payload format match current runtime constants.

Operational caveats:

- If `DELIVERY_PAYLOAD_SECRET` or fallback `SUPABASE_SERVICE_ROLE_KEY` changes, existing payloads encrypted under the old effective secret may require rebuild.
- `DELIVERY_PAYLOAD_KEY_ID` is metadata only; changing it does not decrypt old payloads by itself.
- A ready build can become unusable if the server no longer has the secret required by payload consumer logic.

## Execution Analytics

- `createDeliverySession()` inserts `script_executions` after session row creation.
- `script_executions.session_id` is unique, preventing duplicate execution rows per delivery session.
- Database trigger increments `scripts.execute_count` and updates `scripts.last_executed_at`.

## Security Checklist

- Session tokens must remain high entropy and short lived.
- Session token hashes must remain SHA-256 hex strings.
- Runtime routes must keep `Cache-Control: no-store`.
- Build dashboard responses must not expose `payload_ciphertext`.
- Delivery errors should remain intentionally generic where detailed errors would leak script existence or authorization state.
- Private scripts must not be deliverable through secure delivery session creation.

## Phase Boundary

This document describes current secure delivery behavior before Phase 7B Key Monetization Platform. It does not add key monetization platform features, Phase 7C runtime license enforcement hardening, new APIs, schema changes, or loader delivery changes.
