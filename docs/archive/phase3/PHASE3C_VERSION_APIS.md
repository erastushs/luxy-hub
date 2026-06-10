# Phase 3C.3 Version History APIs

Status: Implemented
Last updated: 2026-06-08

## Purpose
Phase 3C.3 creates creator-safe version history APIs for the existing `script_versions` table. Every script update creates a new immutable version row. These endpoints expose version history to the script owner only.

## Scope

Included:
- Version history listing with pagination
- Version detail retrieval
- Ownership enforcement on all version queries
- Cross-script version isolation (version must belong to the parent script)
- Rate limiting on version endpoints

Not included:
- Dashboard UI / React components
- Version rollback UI
- Version diff/comparison
- Marketplace features
- Organizations

---

## Endpoint Catalog

Base: `/api/dashboard`

### GET /api/dashboard/scripts/[slug]/versions

List all versions for an owned script.

**Auth:** Session required (`requireAuth()`)
**Rate limit:** `DASHBOARD_VERSIONS_LIST` (60 req/60s)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 20 | Results per page (1-100) |
| `offset` | number | 0 | Pagination offset |

**Response 200:**
```json
{
  "success": true,
  "versions": [
    {
      "id": "uuid",
      "script_id": "uuid",
      "version": "1.1.0",
      "content": "print('updated')",
      "changelog": "Added new feature",
      "created_at": "2026-06-01T12:00:00.000Z"
    },
    {
      "id": "uuid",
      "script_id": "uuid",
      "version": "1.0.0",
      "content": "print('hello')",
      "changelog": "Initial release",
      "created_at": "2026-05-15T08:00:00.000Z"
    }
  ],
  "total": 5,
  "limit": 20,
  "offset": 0
}
```

**Ordering:** Versions sorted by `created_at` descending (newest first).

**Response 404:** Returns 404 for non-owned scripts.

### GET /api/dashboard/scripts/[slug]/versions/[versionId]

Get a specific version by ID, for an owned script.

**Auth:** Session required (`requireAuth()`)
**Rate limit:** `DASHBOARD_VERSIONS_GET` (60 req/60s)

**Response 200:**
```json
{
  "success": true,
  "version": {
    "id": "uuid",
    "script_id": "uuid",
    "version": "1.1.0",
    "content": "print('updated')",
    "changelog": "Added new feature",
    "created_at": "2026-06-01T12:00:00.000Z"
  }
}
```

**Response 404:** Returns 404 if:
- The script is not owned by the actor
- The version does not exist
- The version belongs to a different script

---

## Ownership Model

Version ownership is **inherited** from the parent script:

```
auth.users.id
  |
  | owns
  v
scripts.creator_id
  |
  | parent of
  v
script_versions.script_id
```

### Enforcement Flow

1. **Route layer** — `requireAuth()` validates session identity
2. **Service layer** — `assertScriptOwner(slug, actor.id)` verifies parent script ownership before touching version data
3. **Repository layer** — versions are fetched by script_id or version_id; service layer validates the script_id match
4. **Database layer** — RLS policies on `script_versions` inherit ownership from parent `scripts` row

### Cross-Script Version Isolation

A version must belong to the script specified in the URL. The `getVersionDetail()` service checks:

```typescript
const script = await assertScriptOwner(slug, ownerId)    // Step 1: owns the script?
const version = await getVersionById(versionId)           // Step 2: version exists?
if (version.script_id !== script.id) {                    // Step 3: belongs to this script?
  return { success: false, message: 'Version not found', status: 404 }
}
```

This prevents a scenario where Creator A owns script X and tries to access version Y from script Z by knowing the version UUID.

---

## Architecture

### Repository Layer (`app/lib/repositories/script-repository.ts`)

New types:
- `VersionListResult` — `{ versions: VersionRow[], total: number }`

New functions:

| Function | Purpose |
|----------|---------|
| `listVersionsForScript(scriptId, limit, offset)` | Paginated version list for a script |
| `getVersionById(versionId)` | Single version lookup by ID |

### Service Layer (`app/lib/services/script-service.ts`)

New types:
- `VersionListResultType` — discriminated union for list responses
- `VersionDetailResult` — discriminated union for detail responses

New functions:

| Function | Purpose |
|----------|---------|
| `listVersions(ownerId, slug, limit?, offset?)` | Validate ownership, then list versions |
| `getVersionDetail(ownerId, slug, versionId)` | Validate ownership, fetch version, verify script_id match |

### Route Layer

Two new endpoints:

| Route | Handler |
|-------|---------|
| `/api/dashboard/scripts/[slug]/versions` | `app/api/dashboard/scripts/[slug]/versions/route.ts` |
| `/api/dashboard/scripts/[slug]/versions/[versionId]` | `app/api/dashboard/scripts/[slug]/versions/[versionId]/route.ts` |

Both follow the standard Phase 3C pattern: `requireAuth()` → rate limit → service call → JSON response.

---

## Pagination

Version listing supports standard pagination:

```
GET /api/dashboard/scripts/my-script/versions?limit=10&offset=0   → page 1
GET /api/dashboard/scripts/my-script/versions?limit=10&offset=10  → page 2
GET /api/dashboard/scripts/my-script/versions?limit=10&offset=20  → page 3
```

Response includes `total` count for building pagination controls:

```json
{
  "success": true,
  "versions": [...],
  "total": 35,
  "limit": 10,
  "offset": 0
}
```

---

## Security Review

| Check | Status |
|-------|--------|
| Session authentication required | Pass — `requireAuth()` on all version endpoints |
| Ownership enforced before version access | Pass — `assertScriptOwner()` called before any version query |
| Cross-script version isolation | Pass — `version.script_id !== script.id` check in `getVersionDetail()` |
| Foreign version access returns 404 | Pass — all unauthorized paths return 404 |
| No existence oracle | Pass — foreign scripts, missing versions, mismatched script_ids all return 404 |
| Rate limiting | Pass — both endpoints rate-limited at 60 req/60s |
| Valid inputs enforced | Pass — slug validated, versionId required and validated |

---

## Testing

Tests in `__tests__/version-apis.test.ts` (16 tests, all passing):

### listVersions
- Returns paginated versions for owned script
- Returns 404 for foreign script versions
- Respects pagination limit
- Respects pagination offset
- Rejects invalid slug
- Rejects invalid limit

### getVersionDetail
- Returns version detail for owned script
- Returns 404 for foreign script version
- Returns 404 when version belongs to different script
- Returns 404 for non-existent version
- Rejects empty version ID

### Cross-account isolation
- Creator A cannot list Creator B versions
- Creator A cannot get Creator B version detail
- Version hidden when script ownership fails

### Version content security
- Version detail includes content only for owner
- Version listing includes changelog with content

Run with:
```bash
npx vitest run
```
Overall: 58 tests across 3 files, all passing.

---

## Files Created
- `app/api/dashboard/scripts/[slug]/versions/route.ts` — Version listing endpoint
- `app/api/dashboard/scripts/[slug]/versions/[versionId]/route.ts` — Version detail endpoint
- `__tests__/version-apis.test.ts` — 16 version history tests
- `PHASE3C_VERSION_APIS.md` — This document

## Files Modified
- `app/lib/repositories/script-repository.ts` — Added `VersionListResult` type, `listVersionsForScript()`, `getVersionById()`
- `app/lib/services/script-service.ts` — Added `VersionListResultType`, `VersionDetailResult`, `listVersions()`, `getVersionDetail()`
- `app/lib/repositories/rate-limit-repository.ts` — Added `DASHBOARD_VERSIONS_LIST`, `DASHBOARD_VERSIONS_GET`

---

## All Phase 3C Endpoints

| Method | Route | Auth | Phase | Purpose |
|--------|-------|------|-------|---------|
| GET | `/api/dashboard/scripts` | Session | 3C.1 | List creator's scripts |
| POST | `/api/dashboard/scripts` | Session | 3C.1 | Create script |
| GET | `/api/dashboard/scripts/[slug]` | Session | 3C.1 | Script detail |
| PATCH | `/api/dashboard/scripts/[slug]` | Session | 3C.1 | Update script |
| DELETE | `/api/dashboard/scripts/[slug]` | Session | 3C.1 | Delete script |
| GET | `/api/dashboard/scripts/[slug]/stats` | Session | 3C.2 | Per-script analytics |
| GET | `/api/dashboard/analytics/overview` | Session | 3C.2 | Portfolio overview |
| GET | `/api/dashboard/analytics/downloads` | Session | 3C.2 | Time-series trends |
| GET | `/api/dashboard/scripts/[slug]/versions` | Session | 3C.3 | Version history |
| GET | `/api/dashboard/scripts/[slug]/versions/[versionId]` | Session | 3C.3 | Version detail |

**Total: 10 endpoints**

---

## Remaining Work for Phase 3C.4 (Audit Logging)

- [ ] Create `audit_logs` table migration
- [ ] Create audit log repository
- [ ] Create audit log service
- [ ] Add audit log writes to create/update/delete/visibility/publish endpoints
- [ ] Admin audit log inspection endpoints

(End of file)
