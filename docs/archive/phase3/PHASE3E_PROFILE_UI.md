# Phase 3E.3 — Profile UI

Status: Implemented
Last updated: 2026-06-08

## Purpose

Phase 3E.3 builds the Profile section for the Creator Dashboard, leveraging the existing `profiles` table, profile repository, and profile service built in Phase 3A. Creators can view their profile details and update their display name and username.

## Scope

Included:
- Profile page with view mode (all profile fields)
- Profile edit form (display name, username)
- Copy-to-clipboard for user ID
- Logout button on profile page
- Validation with duplicate username handling
- Loading, success, and error states

Not included:
- Role editing (protected server-side)
- Email editing (managed by Supabase Auth)
- User ID editing (identity from auth)
- Avatar upload
- Account deletion
- Password reset

---

## 1. Page Structure

```
/dashboard/profile     → Server wrapper (fetches user) + Client shell (view/edit modes)
```

### Component Tree

```
app/dashboard/profile/page.tsx
└── getCurrentUser() → AuthenticatedUser
    └── ProfileClient (client component)
        ├── View Mode
        │   ├── Avatar placeholder + display name + email
        │   ├── ProfileField grid
        │   │   ├── Display Name
        │   │   ├── Username
        │   │   ├── Role
        │   │   ├── Email
        │   │   ├── User ID + CopyButton
        │   │   └── Member since
        │   ├── Edit button → toggles to edit mode
        │   └── Sign out button (form action → logout())
        │
        └── Edit Mode
            ├── display_name input (required, max 80)
            ├── username input (optional, 3-30 chars)
            ├── Server error banner
            ├── Save Changes button
            └── Cancel button → toggles back to view mode
```

---

## 2. Profile Flow

### View Mode

```
/dashboard/profile (initial load)
  |
  v
page.tsx: getCurrentUser()
  |
  |-- Supabase Auth session validated
  |-- Profile loaded or auto-provisioned
  └─ returns AuthenticatedUser
  |
  v
ProfileClient (view mode)
  |
  ├── Displays: display_name, username, role, email, id, created_at
  ├── CopyButton: copies user.id to clipboard
  └── Sign out: <form action={logout}> → supabase.auth.signOut() → redirect /login
```

### Edit Mode

```
User clicks "Edit"
  |
  v
ProfileClient toggles to edit mode
  |
  ├── Form shows: display_name (prefilled), username (prefilled or empty)
  │
  ├── User submits → formAction → useActionState
  │   |
  │   v
  │   updateProfileAction(prevState, formData)
  │   |
  │   |-- requireAuth() → user.id, user.email
  │   |-- ensureProfile({ id, email, displayName, username })
  │   |   |
  │   |   |-- validates display_name (1-80 chars)
  │   |   |-- validates username (3-30 chars, lowercase/hyphens)
  │   |   |-- upsertProfile({ id, display_name, username })
  │   |   └─ returns ProfileResult
  │   |
  │   |-- revalidatePath('/dashboard/profile')
  │   └─ returns { success, message }
  │
  ├── Success: toast notification, toggles back to view mode
  ├── Error (validation): red banner with message
  └── Error (409 username conflict): "username already exists" banner
```

---

## 3. Validation Rules

| Field | Required | Rules | Source |
|-------|----------|-------|--------|
| `display_name` | Yes | 1-80 characters, trimmed | `isValidDisplayName()` in `app/lib/validators.ts` |
| `username` | No | 3-30 lowercase letters/digits/hyphens, must start and end with alphanumeric | `isValidUsername()` in `app/lib/validators.ts` |
| `role` | — | Cannot be edited by client | Enforced by `ensureProfile()` not accepting role |
| `user id` | — | Cannot be edited by client | Derived from `requireAuth()` session |
| `email` | — | Cannot be edited by client | Derived from `auth.users`, managed by Supabase Auth |

### Username Uniqueness

Duplicates are caught at the database layer:
- `profiles.username` has a `UNIQUE` constraint
- `upsertProfile()` throws `ProfileConflictError` on error code `23505`
- `ensureProfile()` catches this and returns `{ success: false, message: 'username already exists', status: 409 }`

---

## 4. Reusable Components

### CopyButton (`app/dashboard/components/CopyButton.tsx`)

```
Props:
  value: string        — text to copy
  label?: string       — button label (default: "Copy")

States:
  idle    → "Copy" label + Copy icon
  copying → "Copied" label + Check icon (emerald)
  resets  → auto-resets after 2 seconds

Uses: navigator.clipboard.writeText()
```

---

## 5. Security Model

| Concern | Enforcement |
|---------|-------------|
| User identity | `requireAuth()` in `updateProfileAction()` derives `user.id` from session |
| Profile scoping | `ensureProfile()` uses `user.id` — only current user's profile is updated |
| Role preservation | `ensureProfile()` only accepts `id`, `displayName`, `username`, `email`, `avatarUrl` — role is never a parameter |
| Role on read | Role read from `profiles.role` — never from client input |
| Username uniqueness | Enforced by database `UNIQUE` constraint → `ProfileConflictError` → 409 response |
| Session persistence | Server-side Supabase SSR cookie handling; no client-side token storage |

---

## 6. UX States

| State | Behavior |
|-------|----------|
| Loading | Server component async — Next.js streaming handles initial load |
| View mode | All profile fields displayed, Edit + Sign out buttons |
| Edit mode | Form with prefilled values, Save + Cancel buttons |
| Saving | Disabled button with "Saving..." text |
| Success | Toast via `sonner` ("Profile updated"), toggles back to view mode |
| Validation error | Red error banner with specific message (e.g., "Display name is required...") |
| Username conflict | Red banner: "username already exists" |
| Copy ID | "Copy" → click → "Copied" (check icon) → auto-reset after 2s |

---

## 7. Files Created

### Server Actions
- `app/actions/profile.ts` — `updateProfileAction(prevState, formData)`

### Components
- `app/dashboard/components/CopyButton.tsx` — Reusable copy-to-clipboard button

### Pages
- `app/dashboard/profile/profile-client.tsx` — Client shell with view/edit toggle

### Documentation
- `PHASE3E_PROFILE_UI.md` — This document

## 8. Files Modified

- `app/dashboard/profile/page.tsx` — Rewritten from placeholder to server wrapper with `getCurrentUser()` + `ProfileClient`

## 9. Build Validation

```
✓ Compiled successfully (6.6s)
✓ TypeScript (4.4s)
✓ Static pages generated (26/26)
✓ Lint: 0 errors, 0 warnings
✓ Tests: 65/65 passing
```

## 10. Success Criteria

| Criterion | Status |
|-----------|--------|
| Profile loads with current user data | ✅ |
| Display name displayed | ✅ |
| Username displayed (or "Not set") | ✅ |
| Role, email, user ID, created_at displayed | ✅ |
| Copy user ID button works | ✅ |
| Edit mode toggles for display_name + username | ✅ |
| Display name can be updated | ✅ |
| Username can be set/cleared/updated | ✅ |
| Duplicate username shows error | ✅ |
| Validation errors shown as red banner | ✅ |
| Success shown as toast notification | ✅ |
| Logout button works (reuses existing action) | ✅ |
| Role cannot be edited | ✅ |
| Email cannot be edited | ✅ |
| User ID cannot be edited | ✅ |
| Mobile responsive | ✅ |
| Build passes | ✅ |

## 11. Remaining Work

- Analytics UI (Phase 3E.4 — charts, trends, per-script analytics)
- Version history UI (version list, detail, rollback)
