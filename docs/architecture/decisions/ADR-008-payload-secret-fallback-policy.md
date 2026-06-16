# ADR-008: Payload Secret Fallback Policy

## Status

Superseded by RC hardening

## Date

2026-06-11

## Context

Secure delivery builds encrypt compressed script payloads with AES-256-GCM. RC hardening removed production fallback to `SUPABASE_SERVICE_ROLE_KEY`. The build service derives the encryption key from `DELIVERY_PAYLOAD_SECRET` in production. In non-production development only, a development fallback string can be used.

`DELIVERY_PAYLOAD_KEY_ID` is stored as non-secret metadata on build rows to identify the active payload key generation.

## Problem

Payload encryption requires a stable secret available during build and runtime payload consumption. Early secure delivery needed a practical fallback to avoid making payload encryption unusable in environments that had the service role key but had not yet configured a dedicated payload secret.

However, falling back to `SUPABASE_SERVICE_ROLE_KEY` couples database access credential rotation to payload encryption compatibility.

## Decision

LuxyHub rejects production payload-secret fallback and uses the following policy:

- Production secret: `DELIVERY_PAYLOAD_SECRET` is required.
- Production fallback: none.
- Development fallback: development-only static value when production environment is not active.
- Key id metadata: `DELIVERY_PAYLOAD_KEY_ID` or `default`.

Rotation strategy:

- Production should configure `DELIVERY_PAYLOAD_SECRET` explicitly.
- When rotating the effective payload secret, set a new `DELIVERY_PAYLOAD_KEY_ID`.
- Rebuild all current deliverable script versions under the new secret.
- Verify delivery session/fetch for representative scripts.
- Do not rely on `SUPABASE_SERVICE_ROLE_KEY` for payload encryption.

Security implications:

- Payload ciphertext in `delivery_builds` is not useful without the effective payload secret.
- Compromise or rotation of `SUPABASE_SERVICE_ROLE_KEY` does not affect payload encryption when `DELIVERY_PAYLOAD_SECRET` is configured as required.
- Key id is not secret and does not provide decryption capability.
- Build rows do not store plaintext source in payload metadata.

## Consequences

Positive consequences:

- Secure delivery now fails fast in production when payload encryption is not explicitly configured.
- Production payload encryption is isolated from database administrative credentials.
- Key id metadata helps identify payload generations during rotation and incident response.
- Rebuilds can regenerate encrypted payloads from immutable `script_versions`.

Negative consequences:

- Deployments must configure `DELIVERY_PAYLOAD_SECRET` before production build/runtime delivery.
- Rotating `DELIVERY_PAYLOAD_SECRET` can invalidate payload compatibility until builds are regenerated.
- Existing ready builds may require rebuild after secret changes.
- No multi-key decrypt compatibility policy is currently documented as implemented.

Operational requirements:

- Treat `DELIVERY_PAYLOAD_SECRET` as sensitive and stable.
- Record `DELIVERY_PAYLOAD_KEY_ID` changes during rotations.
- Rebuild payloads after effective secret changes.
- Validate delivery after any payload secret rotation.

## Alternatives Considered

### Require `DELIVERY_PAYLOAD_SECRET` in All Environments

Rejected for initial implementation because it would make development and transitional deployments more fragile. It remains the preferred production posture.

### Store Per-Build Encryption Keys

Rejected because storing decryption keys alongside ciphertext would weaken security and complicate secret handling.

### External KMS/Vault for Payload Keys

Deferred because it adds infrastructure complexity. It may be appropriate if payload protection requirements increase.

### No Payload Encryption

Rejected because secure delivery requires payload confidentiality beyond database RLS and endpoint authorization.

## Related Documents

- `docs/runtime/BUILD_PIPELINE.md`
- `docs/runtime/SECURE_DELIVERY.md`
- `docs/operations/SECRET_ROTATION.md`
- `docs/operations/BUILD_OPERATIONS.md`
- `docs/database/SCHEMA.md`
- `docs/architecture/ARCHITECTURE.md`
