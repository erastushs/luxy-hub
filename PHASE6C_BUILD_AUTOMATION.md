# Phase 6C - Build Automation

Status: Implemented
Date: 2026-06-08
Scope: Automatic build lifecycle triggers only. No loaders, key systems, license validation, delivery cryptography changes, payload format changes, or delivery session security changes.

## 1. Summary

Phase 6C removes the dashboard dependency on manual rebuilds for normal creator workflows.

Source mutation flow now becomes:

```text
create or update source
  |
  v
script_versions.content
  |
  v
automatic build trigger
  |
  v
delivery_builds
```

Manual rebuild remains available for explicit recovery and operational retries.

## 2. Trigger Points

Automatic build integration lives in the service layer, not in pages or route handlers.

| Flow | Trigger | Build Target |
|------|---------|--------------|
| Create script | `script_created` | initial `script_versions` row |
| Upload Lua/TXT file | `script_created` | initial uploaded source version |
| Replace Lua/TXT file | `version_created` | new current version |
| Create version through content update | `version_created` | new current version |
| Publish/change visibility | `script_published` | existing `current_version_id` |

Implementation:

```text
app/lib/services/script-service.ts
  createScript()
  updateScript()
  changeVisibility()
    |
    v
app/lib/services/build-automation-service.ts
  runAutoBuildForVersion()
  ensureAutoBuildForVersion()
    |
    v
app/lib/services/delivery-build-service.ts
  buildVersion()
```

## 3. Duplicate Prevention

Before building, automation checks the latest compatible build:

```text
getLatestBuildRow(version_id, delivery-build-v1, inline-json-v1)
```

Behavior:

| Latest Status | Automation Behavior |
|---------------|---------------------|
| none | build |
| pending | skip |
| building | skip |
| ready | skip |
| failed | skip; manual rebuild required |
| invalidated | build |

This prevents repeated publish/update actions from creating duplicate build rows while preserving manual failed-build recovery.

## 4. Lifecycle

Build lifecycle now consistently records:

```text
pending
  |
  v
building
  |
  +-- ready
  |
  +-- failed
```

Repository/service flow:

```text
createBuild()
  |
  v
delivery_builds.build_status = pending
  |
  v
markBuildBuilding()
  |
  v
compress/encrypt/hash
  |
  +-- markBuildReady()
  |
  +-- markBuildFailed()
```

Ready builds still require encrypted payload, payload hash, and `built_at`.

## 5. Failure Handling

Automatic build failures do not roll back creator source changes.

Reason:

- `script_versions.content` remains the creator source of truth.
- Failed builds are visible in build history and edit/version views.
- Existing ready builds remain intact unless a rebuild succeeds and invalidates them.

Failed auto-builds record:

- `build_status = failed`
- safe error code
- safe error message
- no payload ciphertext
- no payload hash

## 6. Rebuild Behavior

Manual rebuild remains available through Phase 6B:

```text
/dashboard/scripts/[slug]/builds
/dashboard/scripts/[slug]/builds/[buildId]
/dashboard/scripts/[slug]/edit
```

Manual rebuild:

- enforces ownership
- targets only `scripts.current_version_id`
- uses the existing `rebuildVersion()` service
- can recover from failed auto-builds
- records a new build history row

## 7. Build Timeline and Latest Build

Chronological history is centralized:

```text
delivery-build-repository.listBuildsForScript()
  order by created_at desc
```

Latest build determination is centralized:

```text
delivery-build-repository.getLatestBuildRow()
delivery-build-repository.getLatestBuild()
build-operations-service.getLatestBuildStatus()
build-automation-service.ensureAutoBuildForVersion()
```

Dashboard views consume service DTOs rather than querying `delivery_builds` directly.

## 8. Security Review

- No loader implementation.
- No key or license logic.
- No payload format changes.
- No delivery session behavior changes.
- No delivery cryptography changes.
- Automation uses service-role repository access already required by the build pipeline.
- Dashboard build DTOs continue to exclude payload ciphertext, source hash, payload hash, encryption key id, and delivery session data.
- Source remains in `script_versions.content`; `delivery_builds` does not store raw source.

## 9. Test Coverage

Added:

```text
__tests__/build-automation-service.test.ts
```

Extended:

```text
__tests__/creator-apis.test.ts
__tests__/delivery-build-service.test.ts
__tests__/delivery-build-repository.test.ts
__tests__/delivery-payload-consumer.test.ts
```

Validated:

- create script auto-build trigger
- upload initial source auto-build path
- replace file/content update auto-build trigger
- publish/change visibility auto-build trigger
- failed build recovery remains manual
- duplicate build prevention for ready/running/failed builds
- invalidated builds can be rebuilt automatically
- latest compatible build lookup
- lifecycle transition from pending to building to ready/failed

Latest validation:

```text
13 test files passed
115 tests passed
```

## 10. Remaining Work for Phase 6D

- Production loader integration.
- Loader-safe build context strategy.
- Optional async/queued build worker if synchronous automation becomes too slow.
- Build freshness indicators for future builder or payload format migrations.
