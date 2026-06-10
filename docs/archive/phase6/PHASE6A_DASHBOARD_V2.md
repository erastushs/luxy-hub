# Phase 6A - Dashboard V2: Lua Upload and Build Visibility

Status: Implemented
Date: 2026-06-08
Scope: Dashboard upload workflows and secure delivery build visibility only. No license systems, key validation, customer management, HWID systems, marketplace features, organizations, loader changes, secure delivery cryptography changes, delivery session behavior changes, or build pipeline behavior changes.

## 1. Summary

Phase 6A upgrades creator dashboard script management without changing the storage model.

Source still flows through the existing version pipeline:

```text
creator upload or paste
  |
  v
script_versions.content
  |
  v
Phase 5B build pipeline
  |
  v
delivery_builds
```

Files are not stored separately. Uploads are read client-side as UTF-8 source text and submitted through the existing script create/update actions.

## 2. Upload Workflow

Create page:

```text
/dashboard/scripts/new
  |
  +-- Upload File tab
  |     accepts .lua and .txt
  |     validates metadata and bytes client-side
  |     reads content into hidden content field
  |
  +-- Paste Source tab
        preserves existing paste workflow
```

Edit page:

```text
/dashboard/scripts/[slug]/edit
  |
  +-- metadata fields remain unchanged
  |
  +-- Replace Lua File
        validates .lua/.txt client-side
        submits replacement content only when selected
        update service creates a new script_versions row
```

Accepted inputs:

- `.lua`
- `.txt`
- UTF-8 source text up to the existing 62 KB content limit

Rejected inputs:

- archives such as `.zip`, `.rar`, `.7z`, `.tar`, `.gz`
- executable extensions such as `.exe`, `.dll`, `.bat`, `.cmd`, `.msi`, `.sh`
- binary payloads detected through null/control-byte checks
- blocked executable/archive MIME types

Upload filename metadata is stored only as an existing `script_versions.changelog` label:

```text
Uploaded file: main.lua
```

No file object, object storage key, or extra table is created.

## 3. Build Visibility Workflow

Dashboard build visibility uses server-only repository and service reads:

```text
dashboard server page
  |
  v
script service lists owned scripts
  |
  v
version summary service resolves current version labels
  |
  v
dashboard build service resolves latest build summaries
  |
  v
client table/card renders safe DTOs
```

The dashboard displays:

- build status: Ready, Building, Failed, Invalidated, or Not built
- last build timestamp
- build version
- payload format version
- current script version

The dashboard does not select or render:

- `delivery_builds.payload_ciphertext`
- `source_sha256`
- `payload_sha256`
- encryption scheme internals
- delivery session tokens
- `script_versions.content` in list/build views

## 4. Component Catalog

New reusable components:

```text
app/dashboard/components/FileUploadZone.tsx
app/dashboard/components/FileMetadataCard.tsx
app/dashboard/components/BuildStatusBadge.tsx
app/dashboard/components/BuildInfoPanel.tsx
```

New dashboard helpers:

```text
app/dashboard/lib/source-file.ts
app/dashboard/lib/script-list-item.ts
```

New shared metadata helper:

```text
app/lib/source-file-metadata.ts
```

New server-side build visibility service:

```text
app/lib/services/dashboard-build-service.ts
```

Repository additions:

```text
app/lib/repositories/script-repository.ts
  listVersionSummariesByIds()

app/lib/repositories/delivery-build-repository.ts
  listLatestBuildSummariesByVersionIds()
```

## 5. Dashboard Changes

Scripts list now shows:

- Script Name
- Visibility
- Current Version
- Build Status
- Last Updated
- Actions: Edit, Versions, Analytics, Delete

Mobile cards show the same core information in a compact layout.

Edit page now shows:

- current version label
- replace file workflow
- last uploaded filename when the current version was produced by upload
- safe delivery build information

## 6. Security Considerations

Ownership enforcement remains unchanged:

- dashboard pages call `getCurrentUser()`
- mutations call `requireAuth()`
- script updates continue through `updateScript()`
- ownership remains enforced by `assertScriptOwner()`

Build visibility uses safe server DTOs. Client components never receive encrypted payloads, source hashes, payload hashes, delivery session tokens, or raw source content for build visibility.

Upload validation is client-side UX validation. Server-side protection remains the existing content validator:

```text
isValidScriptContent()
```

That validator enforces non-empty source and the 62 KB byte limit before content reaches `script_versions.content`.

## 7. Test Coverage

Added:

```text
__tests__/source-file-validation.test.ts
__tests__/dashboard-build-service.test.ts
```

Extended:

```text
__tests__/creator-apis.test.ts
```

Validated:

- valid `.lua` upload validation
- valid `.txt` upload validation
- archive/executable rejection
- binary file rejection
- replace file creates a new version
- metadata-only edit does not create a new version
- build status display mapping
- dashboard build DTO excludes payload/source/hash fields
- build visibility filters non-owned scripts
- invalidated build status rendering data

## 8. Remaining Work for Phase 6B

- Production loader protocol decisions.
- Loader-safe build context delivery for `version_id` and `source_sha256`.
- Optional creator-triggered build/rebuild controls.
- Optional persisted upload metadata if richer file history is needed.
- Script-specific analytics routing if dashboard analytics becomes per-script.
