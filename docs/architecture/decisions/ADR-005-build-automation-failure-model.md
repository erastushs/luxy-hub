# ADR-005: Build Automation Failure Model

## Status

Accepted

## Date

2026-06-11

## Context

LuxyHub secure delivery uses pre-built encrypted payloads in `delivery_builds`. Build generation can run automatically after script creation, version creation, or script publication, and can also be triggered manually from build operations.

Source mutations create or update script metadata and immutable `script_versions`. Build generation then transforms a version into a compressed, encrypted delivery payload.

## Problem

Source updates and build generation have different durability requirements.

Source updates are creator-authored data and must not be lost just because build automation fails. Build generation is derived state that can fail due to source validation, secret configuration, database writes, or transient runtime errors.

If source mutation and build generation were a single all-or-nothing operation, a build failure could incorrectly roll back creator data. If build failures were ignored entirely, creators and operators would lack recovery paths.

## Decision

LuxyHub accepts a separated source mutation and build generation failure model.

Source update behavior:

- Source mutations are durable through script services and server actions.
- New content creates immutable version records.
- Automatic build is triggered after source/version/publish operations where appropriate.
- Unexpected automatic build exceptions do not roll back the source mutation.

Build failure behavior:

- Build generation creates a `delivery_builds` row before encryption work.
- Build state transitions through `pending`, `building`, and then `ready` or `failed`.
- Empty source, missing payload secret, and unexpected failures are recorded as sanitized build error codes/messages where possible.
- Failed builds do not invalidate previous ready builds.

Rollback behavior:

- Source rollback is not automatic.
- Build rollback is modeled as retaining the previous ready build unless a new ready build successfully supersedes it.
- Successful rebuild invalidates the previous ready build as `superseded_by_rebuild`.

Recovery process:

- Fix source, environment, or infrastructure root cause.
- Manually rebuild affected version.
- Verify a ready build exists.
- Verify delivery session/fetch behavior.
- Invalidate stale older ready builds only when safe.

## Consequences

Positive consequences:

- Creator source changes are not lost because derived build generation fails.
- Previous ready builds can continue serving while a new build fails.
- Build failures are visible in `delivery_builds` and dashboard operations.
- Recovery is explicit and auditable.
- Secret rotation can be handled by rebuilding derived payloads.

Negative consequences:

- A source version can exist without a ready build.
- Delivery for a newly updated script may remain unavailable until build succeeds.
- Automatic build failures require manual attention.
- Multiple build rows per version require clear dashboard/operations interpretation.
- Stale pending/building rows can cause auto-build skips until manually addressed.

Operational implications:

- Operators should monitor `failed`, stale `pending`, and stale `building` rows.
- Rebuilds should be preferred over source rollback for derived-state failures.
- Previous ready builds should not be invalidated until a new ready build is validated.

## Alternatives Considered

### Transactionally Couple Source Mutation and Build Generation

Rejected because build generation includes compression/encryption and environment-dependent work that should not determine whether creator source changes persist.

### Always Invalidate Previous Builds Before Rebuild

Rejected because it can create avoidable delivery outages if the new build fails.

### Ignore Automatic Build Failures

Rejected because creators and operators need failure visibility and recovery actions.

### Build Only on Fetch

Rejected because runtime delivery should be fast and should not perform build/encryption work during payload fetch.

## Related Documents

- `docs/runtime/BUILD_PIPELINE.md`
- `docs/operations/BUILD_OPERATIONS.md`
- `docs/runtime/SECURE_DELIVERY.md`
- `docs/database/SCHEMA.md`
- `docs/operations/SECRET_ROTATION.md`
- `docs/architecture/ARCHITECTURE.md`
