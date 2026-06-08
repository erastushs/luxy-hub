# Phase 3E.2 — Scripts Management UI

Status: Implemented
Last updated: 2026-06-08

## Purpose

Phase 3E.2 builds the complete Scripts Management experience for the Creator Dashboard, consuming the backend APIs built in Phase 3C. It provides create, read, update, and delete operations for scripts owned by the authenticated creator.

## Scope

Included:
- Scripts list page with pagination, search, and visibility filter
- Create script form page
- Edit script page (metadata editing)
- Delete script with confirmation dialog
- Reusable components: ScriptTable, ScriptCard, ScriptForm, DeleteDialog, EmptyState
- Loading, empty, and error states
- Responsive mobile-friendly layout

Not included:
- Script content editing UI (available through version history)
- Version management UI
- Analytics UI
- Marketplace features
- Organizations
- API token systems

---

## 1. Page Structure

```
/dashboard/scripts              → Scripts list (server component + client shell)
/dashboard/scripts/new           → Create script form (client component)
/dashboard/scripts/[slug]/edit   → Edit script form (server wrapper + client component)
```

### Route Map

| Route | Type | Auth | Purpose |
|-------|------|------|---------|
| `/dashboard/scripts` | Server + Client | `getCurrentUser()` in layout | List scripts, search, filter, paginate |
| `/dashboard/scripts/new` | Client | `requireAuth()` in Server Action | Create a new script |
| `/dashboard/scripts/[slug]/edit` | Server + Client | `getCurrentUser()` in page + `assertScriptOwner()` in service | Edit script metadata |

---

## 2. Component Structure

### Server Components

| Component | File | Purpose |
|-----------|------|---------|
| ScriptsPage | `app/dashboard/scripts/page.tsx` | Fetches scripts from service layer, passes to client |
| EditScriptPage | `app/dashboard/scripts/[slug]/edit/page.tsx` | Fetches script by slug, passes to EditScriptClient |

### Client Components

| Component | File | Purpose |
|-----------|------|---------|
| ScriptsListClient | `app/dashboard/scripts/scripts-client.tsx` | Script list with search, filter, pagination, delete |
| NewScriptPage | `app/dashboard/scripts/new/page.tsx` | Create script form with `useActionState` |
| EditScriptClient | `app/dashboard/scripts/[slug]/edit/edit-client.tsx` | Edit script form with `useActionState` |

### Reusable Components

| Component | File | Purpose |
|-----------|------|---------|
| ScriptTable | `app/dashboard/components/ScriptTable.tsx` | Table view for large screens |
| ScriptCard | `app/dashboard/components/ScriptCard.tsx` | Card view for mobile/small screens |
| ScriptForm | `app/dashboard/components/ScriptForm.tsx` | Reusable form (not used in final — each page has its own) |
| DeleteDialog | `app/dashboard/components/DeleteDialog.tsx` | Confirmation modal for script deletion |
| EmptyState | `app/dashboard/components/EmptyState.tsx` | Empty state with optional action button |

---

## 3. API Usage

All script operations call the service layer directly via Server Actions — no HTTP fetch to the API routes needed. This is the recommended Next.js pattern for server-side mutations.

### Scripts List

```
Server Component → listCreatorScripts(user.id, { visibility, search, limit, offset })
                  → ScriptRepository.listScriptsForOwner({ ownerId, visibility, search, limit, offset })
                  → Supabase: .eq('creator_id', ownerId).ilike('name', search).range(offset, limit)
```

Params:
- `limit`: 12 (page size)
- `offset`: computed from page number
- `visibility`: string filter or undefined (all)
- `search`: string or undefined

Response: `{ scripts: ScriptRow[], total: number }`

### Create Script

```
Client form → createScriptAction(_prevState, formData)
            → requireAuth() → user
            → createScript({ slug, name, description, visibility, content, creatorId, creatorRole })
```

Fields:
- `name` — required, 1-100 chars
- `slug` — required, 3-64 lowercase alphanumeric with hyphens
- `description` — optional string
- `visibility` — default "private", one of public/private/unlisted
- `content` — required, max 62KB (sent as placeholder `--` for metadata-only creates)

On success: redirects to `/dashboard/scripts`

### Update Script

```
Client form → updateScriptAction(slug, _prevState, formData)
            → requireAuth() → user
            → updateScript(slug, user.id, { name, description, visibility }, user.role)
```

Fields (all optional):
- `name` — 1-100 chars
- `description` — string
- `visibility` — public/private/unlisted

On success: redirects to `/dashboard/scripts`

### Delete Script

```
Client component → deleteScriptAction(slug)
                 → requireAuth() → user
                 → deleteScript(slug, user.id, user.role)
```

Returns: `{ success: true, message: 'Script deleted' }`

UI: Confirmation dialog → optimistic removal from list → toast notification

---

## 4. User Flow

### List Scripts
```
/dashboard/scripts
  |
  ├─ Server fetches scripts from listCreatorScripts()
  ├─ Empty state: "No scripts yet" + "Create Script" button
  ├─ Filtered empty: "No scripts match your filters" + clear suggestion
  │
  ├─ Search: form submit reloads page with ?search= term
  ├─ Filter: select dropdown changes ?visibility= param
  ├─ Pagination: Previous/Next buttons with page indicator
  │
  └─ Delete: click trash icon → confirm dialog → optimistic remove + toast
```

### Create Script
```
/dashboard/scripts/new
  │
  ├─ Form: name, slug, description, content, visibility
  ├─ Client validation: required fields, slug pattern
  ├─ Submit → createScriptAction → service layer → redirect to /dashboard/scripts
  └─ Error: red error banner with server message
```

### Edit Script
```
/dashboard/scripts/[slug]/edit
  │
  ├─ Server fetches script from getVisibleScript(slug, userId)
  ├─ 404 if not owned by current user
  ├─ Form: name, description, visibility (pre-filled)
  ├─ Submit → updateScriptAction → service layer → redirect to /dashboard/scripts
  └─ Error: red error banner with server message
```

---

## 5. Security Model

All ownership enforcement happens at the backend layer:

| Layer | Enforcement |
|-------|------------|
| Route | `requireAuth()` validates session |
| Service | `createScript()` assigns `creatorId` from session, `updateScript()`/`deleteScript()` call `assertScriptOwner()` |
| Repository | All queries filter by `.eq('creator_id', ownerId)` |
| Database | RLS policies on `scripts` and `script_versions` |

**Never from client:**
- `creator_id` — derived from session server-side only
- Ownership claims — validated server-side
- Role elevation — role from profile, never from form data

---

## 6. Responsive Design

- **Large screens** (≥1024px): `ScriptTable` — tabular layout with name, visibility, updated, actions columns
- **Small/medium screens** (<1024px): `ScriptCard` — card grid (1-col mobile, 2-col tablet)

---

## 7. UX States

| State | Component/Behavior |
|-------|-------------------|
| Loading | Server component handles async — Next.js streaming/suspense covers initial load |
| Empty (no scripts) | `EmptyState` with "Create Script" CTA |
| Empty (filtered) | `EmptyState` with "adjust filters" message |
| Error (server) | Red error banner with `result.message` |
| Success (create/update) | Redirect to list page |
| Success (delete) | Optimistic removal + toast via `sonner` |
| Form pending | Disabled button with "Saving..." text |

---

## 8. Files Created

### Server Actions
- `app/actions/scripts.ts` — `createScriptAction()`, `updateScriptAction()`, `deleteScriptAction()`

### Pages
- `app/dashboard/scripts/page.tsx` — Server component: fetch + pass data
- `app/dashboard/scripts/scripts-client.tsx` — Client component: list, search, filter, paginate, delete
- `app/dashboard/scripts/new/page.tsx` — Create script form
- `app/dashboard/scripts/[slug]/edit/page.tsx` — Edit page server wrapper
- `app/dashboard/scripts/[slug]/edit/edit-client.tsx` — Edit form client

### Components
- `app/dashboard/components/ScriptTable.tsx` — Table view
- `app/dashboard/components/ScriptCard.tsx` — Card view
- `app/dashboard/components/ScriptForm.tsx` — Reusable form (available, not used in current pages)
- `app/dashboard/components/DeleteDialog.tsx` — Confirmation modal
- `app/dashboard/components/EmptyState.tsx` — Empty state component

### Documentation
- `PHASE3E_SCRIPTS_UI.md` — This document

## 9. Files Modified

None. All new files, no existing files changed.

## 10. Build Validation

```
✓ Compiled successfully (9.0s)
✓ TypeScript (4.7s)
✓ Static pages generated (26/26)
✓ Lint: 0 errors, 0 warnings
✓ Tests: 65/65 passing
```

Routes added:
- `ƒ /dashboard/scripts`
- `ƒ /dashboard/scripts/new`
- `ƒ /dashboard/scripts/[slug]/edit`

## 11. Success Criteria

| Criterion | Status |
|-----------|--------|
| Creator can list their scripts | ✅ |
| Pagination works with Previous/Next | ✅ |
| Search by name/slug works | ✅ |
| Visibility filter works | ✅ |
| Create script form works | ✅ |
| Edit script metadata works | ✅ |
| Delete with confirmation dialog | ✅ |
| Optimistic UI update on delete | ✅ |
| Toast notification on success/error | ✅ |
| Empty state displayed when no scripts | ✅ |
| Responsive (table on desktop, cards on mobile) | ✅ |
| Ownership enforced server-side (no client trust) | ✅ |
| `creator_id` never exposed or accepted from client | ✅ |
| Build passes | ✅ |

## 12. Remaining Work (Phase 3E.3)

- Analytics UI — charts, trends, per-script analytics
- Version history UI — list, detail, rollback
- Profile editing UI
