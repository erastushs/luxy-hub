# Phase 6B - Build Operations and Delivery Visibility

Status: Implemented
Date: 2026-06-08
Scope: Dashboard build lifecycle visibility and creator-triggered rebuilds only. No license systems, key validation, customer management, loader authorization, delivery cryptography changes, payload format changes, delivery session behavior changes, marketplace features, or organizations.

## 1. Summary

Phase 6B exposes the existing Phase 5B build pipeline to creators through dashboard views and a controlled rebuild action.

Current delivery artifact path remains unchanged:

```text
scripts
  |
  v
script_versions
  |
  v
delivery_builds
```

The dashboard now reads safe build metadata and never exposes encrypted payloads, source hashes, payload hashes, key identifiers, or delivery session records.

## 2. Build Lifecycle

Existing pipeline lifecycle:

```text
current script_versions row
  |
  v
creator-triggered rebuild
  |
  v
delivery_builds row created as building
  |
  +-- success -> ready
  |
  +-- pipeline failure -> failed
```

Successful rebuild:

```text
find previous ready build for current version
  |
  v
build current version
  |
  v
mark new build ready
  |
  v
invalidate previous ready build
```

Failed rebuilds create a failed build row and keep previous ready builds intact.

## 3. Dashboard Pages

Build history:

```text
/dashboard/scripts/[slug]/builds
```

Displays:

- build status
- build version
- payload format version
- built timestamp
- invalidated timestamp
- safe failure code/message
- pagination, newest first

Build detail:

```text
/dashboard/scripts/[slug]/builds/[buildId]
```

Displays:

- status
- build version
- payload format version
- encryption scheme
- payload byte size
- created, updated, built, invalidated timestamps
- sanitized build metadata
- safe failure details

Does not display:

- `payload_ciphertext`
- `source_sha256`
- `payload_sha256`
- `encryption_key_id`
- delivery session data

## 4. Rebuild Workflow

Dashboard rebuild flow:

```text
owner clicks Rebuild
  |
  v
server action requires auth
  |
  v
build operations service asserts script ownership
  |
  v
current_version_id is selected
  |
  v
existing rebuildVersion(current_version_id)
  |
  v
dashboard paths revalidated
  |
  v
creator returns to build history
```

Rules:

- Only the latest/current script version is rebuilt.
- Older versions cannot be rebuilt from the dashboard action.
- Rebuild uses the existing Phase 5B build pipeline.
- Build history is recorded by `delivery_builds` rows.
- Failed rebuilds are visible in the history page.

## 5. Repository Architecture

File:

```text
app/lib/repositories/delivery-build-repository.ts
```

Additions:

- `listBuildsForScript(scriptId, limit, offset)`
- `getBuildDashboardById(buildId)`
- `getLatestBuild(versionId)`

Safe dashboard selectors intentionally exclude sensitive columns:

- payload ciphertext
- source hash
- payload hash
- encryption key id

The existing full `getBuildById()` remains available for secure delivery internals that need encrypted payload data.

## 6. Service Architecture

File:

```text
app/lib/services/build-operations-service.ts
```

Functions:

- `listBuildHistory(ownerId, slug, params)`
- `getBuildDetails(ownerId, slug, buildId)`
- `getLatestBuildStatus(ownerId, slug)`
- `getBuildStatusesForVersions(ownerId, slug, versions)`
- `rebuildLatestVersion(ownerId, slug)`

Ownership enforcement is centralized in the service through `assertScriptOwner()`. Pages and components do not query build repositories directly.

## 7. Dashboard Integration

Build status appears in:

- scripts table
- script cards
- edit page
- version history page
- version detail page
- build history page
- build detail page

Components:

```text
app/dashboard/components/BuildStatusBadge.tsx
app/dashboard/components/BuildInfoPanel.tsx
app/dashboard/components/BuildHistoryTable.tsx
app/dashboard/components/RebuildButton.tsx
```

## 8. Auto Build Audit

Current findings:

| Flow | Current Build Trigger? | Notes |
|------|-------------------------|-------|
| Create script | No | Creates `scripts` and initial `script_versions` row only. |
| Replace file | No | Creates a new `script_versions` row through `updateScript()` only. |
| Publish/change visibility | No | Updates visibility only through `changeVisibility()`. |
| Create version | No standalone creator action | Content updates create versions; they do not trigger builds. |
| Manual rebuild | Yes | Phase 6B rebuild action runs `rebuildVersion()` for `current_version_id`. |

Phase 6B does not change automatic build behavior. Auto-build policy is deferred so Phase 6C can choose between synchronous builds, queued builds, or explicit creator rebuilds.

## 9. Security Considerations

- Build pages require dashboard session.
- Build service enforces owner access with `assertScriptOwner()`.
- Cross-script build details return not found.
- Dashboard DTOs exclude payload ciphertext and integrity hashes.
- Encryption scheme is visible for compatibility/debugging, but key identifiers are not.
- Delivery sessions remain isolated to Phase 5C APIs and are not queried by dashboard pages.
- Rebuild does not modify cryptography, payload format, or delivery session behavior.

## 10. Test Coverage

Added:

```text
__tests__/build-operations-service.test.ts
```

Validated:

- build history listing
- pagination validation
- build detail retrieval
- ownership isolation
- failed build fields
- latest build retrieval
- version build status retrieval
- rebuild latest version only
- sensitive fields excluded from dashboard DTOs

Regression suite:

```text
npx vitest run
```

Latest validation:

```text
12 test files passed
107 tests passed
```

## 11. Remaining Work for Phase 6C

- Decide automatic build trigger policy for create/update/publish flows.
- Add queued/background build execution if synchronous rebuilds are not acceptable.
- Add build freshness indicators if builder versions or payload format versions change.
- Add production loader authorization strategy.
- Add executor compatibility testing.
