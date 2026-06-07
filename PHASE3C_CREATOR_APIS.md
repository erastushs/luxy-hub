# Phase 3C Creator API Layer

Status: Implemented
Last updated: 2026-06-07

## Purpose
Phase 3C creates creator-facing management APIs under `/api/dashboard/` that will later power `dashboard.luxyhub.space`. All ownership enforcement is centralized in the service and repository layers. Routes remain thin.

## Scope

Included:
- Creator-safe script listing with pagination, filtering, and search
- Creator-safe script detail (ownership enforced)
- Creator-safe script create/update/delete
- Dashboard-specific rate limiting
- Ownership enforcement centralized at repository/service layer
- Unit tests for ownership isolation, pagination, and filtering

Not included:
- Dashboard UI / React components
- Auth screens
- Analytics UI
- Marketplace features
- Organizations
- API token systems

---

## Endpoint Catalog

Base: `/api/dashboard`

### GET /api/dashboard/scripts

List scripts owned by the authenticated creator.

**Auth:** Session required (`requireAuth()`)
**Rate limit:** `DASHBOARD_SCRIPTS_LIST` (60 req/60s)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 20 | Results per page (1-100) |
| `offset` | number | 0 | Pagination offset |
| `visibility` | string | all | Filter: `public`, `private`, `unlisted`, `all` |
| `search` | string | — | Search in name and slug (case-insensitive) |

**Response 200:**
```json
{
  "success": true,
  "scripts": [
    {
      "id": "uuid",
      "slug": "my-script",
      "name": "My Script",
      "description": "Description",
      "visibility": "public",
      "creator_id": "uuid",
      "current_version_id": "uuid",
      "created_at": "ISO8601",
      "updated_at": "ISO8601"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

### POST /api/dashboard/scripts

Create a new script owned by the authenticated creator.

**Auth:** Session required (`requireAuth()`)
**Rate limit:** `DASHBOARD_SCRIPTS_CREATE` (30 req/h)

**Request Body:**
```json
{
  "slug": "my-script",
  "name": "My Script",
  "description": "Optional description",
  "visibility": "private",
  "content": "print('hello')"
}
```

**Rules:**
- `creator_id` is derived from session, never accepted from client
- Default visibility is `private`
- Content is required and limited to 62 KB

**Response 201:**
```json
{
  "success": true,
  "script": { ... }
}
```

### GET /api/dashboard/scripts/[slug]

Get a specific script owned by the authenticated creator.

**Auth:** Session required (`requireAuth()`)
**Rate limit:** `DASHBOARD_SCRIPTS_GET` (60 req/60s)

**Response 200:**
```json
{
  "success": true,
  "script": { ... }
}
```

**Response 404:** Returns 404 for non-owned scripts (existence not exposed).

### PATCH /api/dashboard/scripts/[slug]

Update an owned script.

**Auth:** Session required (`requireAuth()`)
**Rate limit:** `DASHBOARD_SCRIPTS_UPDATE` (60 req/h)

**Request Body (all fields optional):**
```json
{
  "name": "New Name",
  "description": "New description",
  "visibility": "public",
  "content": "updated script content"
}
```

**Response 200:**
```json
{
  "success": true,
  "script": { ... }
}
```

### DELETE /api/dashboard/scripts/[slug]

Delete an owned script.

**Auth:** Session required (`requireAuth()`)
**Rate limit:** `DASHBOARD_SCRIPTS_DELETE` (30 req/h)

**Response 200:**
```json
{
  "success": true,
  "message": "Script deleted"
}
```

---

## Auth Model

All dashboard endpoints require session-based authentication via `requireAuth()`.

```
Browser Session
  |
  v
Supabase Auth cookie (sb-*-auth-token)
  |
  v
createSupabaseServerClient() → supabase.auth.getUser()
  |
  v
getCurrentUser() → AuthenticatedUser { id, email, role, profile }
  |
  v
requireAuth() → throws AuthError(401) if no session
```

**Authenticated User shape:**
```typescript
type AuthenticatedUser = {
  id: string       // auth.users.id
  email: string | null
  role: 'creator' | 'admin'
  profile: ProfileRow
}
```

---

## Ownership Model

```
auth.users.id
  |
  | owns
  v
scripts.creator_id
  |
  | inherited ownership
  v
script_versions.script_id
```

### Enforcement Layers

1. **Route layer** — `requireAuth()` ensures a valid session
2. **Service layer** — `assertScriptOwner(slug, actor.id)` validates ownership
3. **Repository layer** — all queries filter by `creator_id = actor.id`
4. **Database layer** — RLS policies on `scripts` and `script_versions`

### Isolation Guarantees

Creator A **cannot**:
- List Creator B's scripts
- View Creator B's script details
- Update Creator B's scripts
- Delete Creator B's scripts
- Access Creator B's analytics

All violations return `404 Script not found` (existence not disclosed).

### Ownership Helpers

Located in `app/lib/auth/ownership.ts`:

| Helper | Behavior |
|--------|----------|
| `getOwnedScript(slug, ownerId)` | Returns `ScriptRow \| null` |
| `assertScriptOwner(slug, ownerId)` | Throws `OwnershipError('Script not found', 404)` if not owned |
| `requireOwnership(user, slug)` | Wraps `assertScriptOwner(slug, user.id)` |

---

## Repository Layer

### New function: `listScriptsForOwner`

Located in `app/lib/repositories/script-repository.ts`:

```typescript
listScriptsForOwner(params: {
  ownerId: string
  visibility?: string | null
  search?: string | null
  limit?: number
  offset?: number
}): Promise<ListScriptsResult>
```

Filters all results by `creator_id = ownerId`. Supports optional visibility filter, search (name/slug ilike), and pagination.

---

## Service Layer

### New function: `listCreatorScripts`

Located in `app/lib/services/script-service.ts`:

```typescript
listCreatorScripts(
  ownerId: string,
  params: {
    visibility?: unknown
    search?: unknown
    limit?: unknown
    offset?: unknown
  }
): Promise<ScriptListResult>
```

Validates:
- `limit`: 1-100
- `offset`: >= 0
- `visibility`: valid values or "all"

Ownership is enforced implicitly because `listScriptsForOwner` filters by `creator_id`.

---

## Service Layer Refactor

Bug fix applied: `updateScript()` in `script-service.ts` now catches `OwnershipError` in its catch block. Previously ownership errors fell through to the generic 500 handler. This was a latent bug from Phase 3B that manifested in the Phase 3C test suite.

---

## Rate Limiting

New rate limit keys added to `app/lib/repositories/rate-limit-repository.ts`:

| Key | Window | Max |
|-----|--------|-----|
| `DASHBOARD_SCRIPTS_LIST` | 60s | 60 |
| `DASHBOARD_SCRIPTS_CREATE` | 1h | 30 |
| `DASHBOARD_SCRIPTS_UPDATE` | 1h | 60 |
| `DASHBOARD_SCRIPTS_DELETE` | 1h | 30 |
| `DASHBOARD_SCRIPTS_GET` | 60s | 60 |

---

## Response Schemas

### Success
```json
{
  "success": true,
  // ... operation-specific data
}
```

### Error
```json
{
  "success": false,
  "message": "Human-readable error description"
}
```

### Auth Error (401)
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

### Forbidden (403)
```json
{
  "success": false,
  "message": "Forbidden"
}
```

### Rate Limited (429)
```json
{
  "success": false,
  "message": "Too many requests. Please try again later."
}
```
Includes `Retry-After` header.

### Not Found (404)
```json
{
  "success": false,
  "message": "Script not found"
}
```

---

## Future Dashboard Integration

These APIs are designed to be consumed directly by `dashboard.luxyhub.space`:

1. **Script Listing Page** → `GET /api/dashboard/scripts` with pagination, search, and visibility filter
2. **Script Detail Page** → `GET /api/dashboard/scripts/[slug]`
3. **Create Script Form** → `POST /api/dashboard/scripts`
4. **Edit Script Form** → `PATCH /api/dashboard/scripts/[slug]`
5. **Delete Script Action** → `DELETE /api/dashboard/scripts/[slug]`

The dashboard can build pages and components against this API contract without any backend changes.

### Consumption Example

```typescript
// Frontend: My Scripts page
const response = await fetch('/api/dashboard/scripts?limit=20&offset=0&visibility=all')
const { scripts, total } = await response.json()

// Frontend: Search
const response = await fetch('/api/dashboard/scripts?search=bloxatlas')

// Frontend: Filter by visibility
const response = await fetch('/api/dashboard/scripts?visibility=public')
```

---

## Testing

Tests in `__tests__/creator-apis.test.ts` (25 tests, all passing):

- `listCreatorScripts` — pagination, limits, visibility filtering, search
- `getVisibleScript` — ownership enforcement, private script visibility
- `updateScript` — own scripts allowed, foreign scripts denied
- `deleteScript` — own scripts allowed, foreign scripts denied
- `getStats` — own stats accessible, foreign stats denied
- Cross-account isolation — Creator A cannot read/update/delete Creator B resources

Run with:
```bash
npx vitest run
```

---

## Files Changed

### Created
- `app/api/dashboard/scripts/route.ts` — GET (list) + POST (create) handler
- `app/api/dashboard/scripts/[slug]/route.ts` — GET + PATCH + DELETE handler
- `__tests__/creator-apis.test.ts` — 25 unit tests
- `vitest.config.ts` — Vitest configuration
- `PHASE3C_CREATOR_APIS.md` — This document

### Modified
- `app/lib/repositories/script-repository.ts` — Added `listScriptsForOwner()` function
- `app/lib/services/script-service.ts` — Added `listCreatorScripts()` function, fixed `OwnershipError` handling in `updateScript()`
- `app/lib/repositories/rate-limit-repository.ts` — Added 5 dashboard rate limit keys

### Dependency Added
- `vitest`, `@vitejs/plugin-react`, `tsx` (devDependencies)

---

## Security Review

| Check | Status |
|-------|--------|
| `creator_id` never accepted from client | Pass — service layer derives from session |
| Ownership enforced before all mutations | Pass — `assertScriptOwner()` called in all write paths |
| Cross-account isolation | Pass — validated by 4 cross-account isolation tests |
| Rate limiting on all endpoints | Pass — all 5 endpoints have rate limits |
| Session authentication on all endpoints | Pass — `requireAuth()` on all dashboard routes |
| No existence oracle | Pass — foreign scripts return 404, same as non-existent |
| Fail-closed error handling | Pass — all 500 paths return generic messages |

---

## Remaining Work for Phase 3C.2 (Analytics APIs)

- [ ] `GET /api/dashboard/scripts/[slug]/stats` — creator analytics detail
- [ ] `GET /api/dashboard/analytics/overview` — portfolio-level analytics
- [ ] `GET /api/dashboard/analytics/downloads` — time-series download data
- [ ] Aggregation by day/week/month for chart rendering
- [ ] Top scripts by downloads endpoint

(End of file)
