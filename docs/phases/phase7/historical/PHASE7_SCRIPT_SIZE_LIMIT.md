# Phase 7 — Script Size Limit Expansion

Status: Implemented
Last updated: 2026-06-09

## Purpose

Increased the maximum supported script size from ~62 KB to 1 MB (1,048,576 bytes) with centralized constants, consistent validation, and clear UI communication.

## Previous Limit

| Layer | Location | Value | Details |
|-------|----------|-------|---------|
| Middleware | `proxy.ts:5` | 64 KB (`API_MAX_BODY`) | Content-Length guard on POST /api/* |
| Service validation | `app/lib/validators.ts:23` | 62 KB (`MAX_CONTENT_LENGTH`) | `isValidScriptContent()` UTF-8 byte check |
| Client validation | `app/dashboard/lib/source-file.ts:1` | 62 KB (`MAX_SOURCE_FILE_BYTES`) | `validateSourceFileMetadata()` file.size check |
| Dead code | `app/lib/validators.ts:3` | 64 KB (`MAX_BODY_SIZE`) | `validateRequestSize()` — zero callers |

The 2 KB gap between middleware (64 KB) and validation (62 KB) accounted for JSON wrapper overhead in API requests.

## New Limit

**1 MB = 1,048,576 bytes** — defined once in `app/lib/constants/size-limits.ts` as `MAX_SCRIPT_SIZE_BYTES`.

| Layer | New Value | Formula |
|-------|-----------|---------|
| Content validation (`MAX_CONTENT_LENGTH`) | 1,048,576 | `MAX_SCRIPT_SIZE_BYTES` |
| Client validation (`MAX_SOURCE_FILE_BYTES`) | 1,048,576 | `MAX_SCRIPT_SIZE_BYTES` |
| Middleware (`API_MAX_BODY`) | 1,179,648 | `MAX_SCRIPT_SIZE_BYTES + 128 KB` |
| Dead code (`MAX_BODY_SIZE`) | 2,097,152 | `2 MB` (proxy overhead ceiling) |

The 128 KB middleware headroom covers JSON serialization, metadata fields, and multipart overhead for the largest allowed script.

## Affected Systems

| System | What changed |
|--------|-------------|
| `app/lib/constants/size-limits.ts` | **New** — centralized constant |
| `app/lib/validators.ts` | `MAX_CONTENT_LENGTH` now reads from shared constant |
| `app/dashboard/lib/source-file.ts` | `MAX_SOURCE_FILE_BYTES` now reads from shared constant |
| `proxy.ts` | `API_MAX_BODY` now `MAX_SCRIPT_SIZE_BYTES + 128 KB` |
| `app/lib/services/script-service.ts` | Error messages: "62 KB" → "1 MB" |
| `app/dashboard/components/ScriptForm.tsx` | Label: "Max 62 KB" → "Max 1 MB" |
| `app/dashboard/scripts/new/page.tsx` | Label: "Max 62 KB" → "Max 1 MB" |
| `app/dashboard/components/FileUploadZone.tsx` | Label now includes formatted max size from constant |

Not modified:
- `delivery-build-service.ts` — `payload_byte_size` is informational only, no limit enforced
- `next.config.ts` — no body size configuration
- Database `script_versions.content` — `TEXT` column, no size constraint at DB level

## Validation Behavior

### Server-side (authoritative)

`isValidScriptContent()` in `validators.ts`:
1. Rejects non-string or empty content
2. Encodes to UTF-8 bytes via `TextEncoder`
3. Compares `byteLength` against `MAX_CONTENT_LENGTH` (1 MB)

Error messages:
- Create: "Content is required and must not exceed 1 MB"
- Update: "Content must not exceed 1 MB"

### Client-side (pre-flight)

`validateSourceFileMetadata()` in `source-file.ts`:
1. Checks `file.size` (browser-provided byte size)
2. Returns dynamic error: `File is {actual}; maximum is {max}` — e.g. "File is 1.3 MB; maximum is 1.0 MB"

`validateSourceFileBytes()` in `source-file.ts`:
- Checks binary content (null bytes, control character ratio)
- No size limit check here; size is checked before bytes are decoded

### Middleware (gate)

`proxy.ts` checks `Content-Length` header:
- Rejects `POST /api/*` with Content-Length > `API_MAX_BODY`
- Returns 413 "Payload too large"
- Fail-closed: no Content-Length header → allowed through (downstream validation catches it)

## UI Changes

| Component | Before | After |
|-----------|--------|-------|
| `FileUploadZone` | "Drop a .lua or .txt file here" | "Drop a .lua or .txt file here. Max 1.0 MB." |
| `ScriptForm` content label | "Script body. Max 62 KB." | "Script body. Max 1 MB." |
| `NewScriptPage` paste label | "Script body. Max 62 KB." | "Script body. Max 1 MB." |
| `FileMetadataCard` | Shows file size via `formatFileSize()` | Unchanged — already dynamic |

The `formatFileSize()` helper renders B, KB, or MB automatically — no update needed.

## Security Review

| Concern | Finding |
|---------|---------|
| Memory abuse | TextEncoder processes up to 1 MB of UTF-8 — safe on modern runtimes; Next.js API routes are short-lived |
| Body-parser conflicts | Next.js default body limit is 4 MB; our proxy catches at ~1.1 MB first, so Next.js never sees oversized bodies for script routes |
| Payload expansion | UTF-8 encoding of 1 MB ASCII yields 1 MB bytes; no compression-based expansion risk |
| DoS via large uploads | Middleware rejects before body parsing; no streaming into memory |
| No new attack surface | All validation paths existed before; only constants changed |

No memory abuse, body-parser conflicts, or unintended payload expansion was introduced. The middleware reject-before-parse design is unchanged.
