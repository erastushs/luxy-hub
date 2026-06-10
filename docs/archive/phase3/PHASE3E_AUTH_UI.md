# Phase 3E.1 — Authentication UI and Dashboard Shell

Status: Implemented
Last updated: 2026-06-08

## Purpose

Phase 3E.1 builds the initial dashboard UI foundation and authentication flow for the LuxyHub Creator Dashboard, consuming the backend APIs built in Phases 3A–3D.

## Scope

Included:
- `/login` page with email/password authentication
- Session persistence via Supabase SSR cookies
- Protected dashboard routes with auth enforcement in proxy
- Dashboard shell: sidebar, top navigation, content area
- Dashboard home page with analytics overview summary cards
- Placeholder pages for Scripts, Analytics, Versions, Profile
- Profile auto-provisioning on first login (handled by existing `getCurrentUser()`)

Not included:
- Registration/signup page (creators created via Supabase dashboard)
- Password reset flow (Supabase handles natively)
- OAuth providers
- Script management UI (placeholder only)
- Full analytics charts and trends UI
- Version history UI
- Profile editing UI

---

## 1. Authentication Flow

### Architecture

```
Browser enters /dashboard
  |
  v
proxy.ts (updateSession)
  |
  |-- reads Supabase auth cookies (sb-*-auth-token)
  |-- creates Supabase SSR client
  |-- supabase.auth.getUser()
  |
  |-- no user + /dashboard/* → redirect to /login
  |-- user + /login → redirect to /dashboard
  |-- otherwise → pass through
  |
  v
Page renders
  |
  v
Server Component / Server Action
  |
  |-- getCurrentUser() (session-auth.ts)
  |   |-- creates Supabase SSR client from cookies
  |   |-- supabase.auth.getUser()
  |   |-- loads or auto-provisions profile
  |   └─ returns AuthenticatedUser
  |
  └─ requireAuth() → throws AuthError(401) if no session
```

### Login Flow

```
POST /login (form submit → Server Action)
  |
  v
actions/auth.ts → login()
  |
  |-- supabase.auth.signInWithPassword({ email, password })
  |
  |-- on success:
  |   |-- Supabase sets sb-*-auth-token cookie
  |   |-- revalidatePath('/dashboard', 'layout')
  |   └─ redirect('/dashboard')
  |
  └─ on error:
      └─ returns { error: message } to useActionState
```

### Logout Flow

```
POST /dashboard (sidebar logout button → Server Action)
  |
  v
actions/auth.ts → logout()
  |
  |-- supabase.auth.signOut()
  |-- revalidatePath('/', 'layout')
  └─ redirect('/login')
```

### Session Persistence

Supabase SSR (`@supabase/ssr`) creates per-request server clients that:
1. Read cookies from the incoming request
2. Verify the session with Supabase Auth
3. Refresh cookies on the response when tokens near expiry

The `proxy.ts` `updateSession()` function handles this cookie refresh at the proxy layer before routes render.

---

## 2. Protected Route Architecture

### Proxy Layer (`proxy.ts`)

The Next.js 16 proxy (formerly middleware) handles auth enforcement before routing:

```typescript
// proxy.ts
export async function proxy(request: NextRequest) {
  // 1. Security headers + API payload limits
  // 2. updateSession() from app/lib/supabase/proxy.ts
  //    - Creates SSR client from request cookies
  //    - Gets user from supabase.auth.getUser()
  //    - Redirects /dashboard/* → /login if no user
  //    - Redirects /login → /dashboard if user exists
  // 3. CSP, CORS, and other security headers
}
```

Protected paths: `/dashboard/*`
Auth gateway: `/login`
Public paths: `/`, `/api/*`, `/get-key`, `/verify-token`, `/docs/*`, static assets

### Page-Level Enforcement

Dashboard pages use `getCurrentUser()` + `redirect()` as a second layer:

```typescript
// app/dashboard/layout.tsx
export default async function DashboardLayout({ children }) {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  return <DashboardShell>{children}</DashboardShell>
}
```

The API routes under `/api/dashboard/*` use `requireAuth()` which throws `AuthError(401)`.

---

## 3. Dashboard Layout Architecture

### Component Tree

```
app/dashboard/layout.tsx
├── Sidebar (app/dashboard/components/Sidebar.tsx)
│   ├── Logo + brand
│   ├── Navigation items
│   │   ├── Dashboard          → /dashboard
│   │   ├── Scripts            → /dashboard/scripts
│   │   ├── Analytics          → /dashboard/analytics
│   │   ├── Versions           → /dashboard/versions
│   │   └── Profile            → /dashboard/profile
│   └── Sign out button (Server Action)
│
├── TopNav (app/dashboard/components/TopNav.tsx)
│   └── Breadcrumb label based on pathname
│
└── <main> content area
    └── {children} (page content)
        ├── /dashboard          → Analytics overview + summary cards
        ├── /dashboard/scripts  → Placeholder
        ├── /dashboard/analytics → Placeholder
        ├── /dashboard/versions → Placeholder
        └── /dashboard/profile  → Profile display
```

### Layout States

| State | Description |
|-------|-------------|
| Loading | Server-side auth check, no client spinner needed |
| Error (no auth) | Proxy redirects to `/login`, layout redirects to `/login` |
| Error (no profile) | Profile auto-provisioned by `getCurrentUser()` |
| Authenticated | Dashboard shell rendered with sidebar + content |

### Responsive Design

- Sidebar: Fixed 240px width, full height, dark background
- TopNav: Sticky, semi-transparent backdrop blur
- Content: Left margin matching sidebar width, padded
- Cards: 1-col mobile, 2-col tablet, 4-col desktop grid

---

## 4. Dashboard Home — Analytics Overview

The dashboard home page (`app/dashboard/page.tsx`) integrates with the existing analytics API:

```
Server Component
  |
  |-- getCurrentUser() → AuthenticatedUser
  |-- getOverview(user.id) → CreatorAnalyticsOverview
  |
  v
Summary Cards:
  ┌──────────────┬──────────────┬──────────────┬──────────────┐
  │ Total Scripts │ Total D/L    │ D/L (7 Days) │ D/L Today    │
  │       5       │    1,000     │      300     │       50     │
  │ 3 pub, 2 priv │              │              │              │
  └──────────────┴──────────────┴──────────────┴──────────────┘
```

Data source: `app/lib/services/analytics-service.ts:getOverview()`

The overview is fetched server-side, bypassing the HTTP API layer. All ownership enforcement is handled by the service/repository layer.

---

## 5. Profile Provisioning Verification

### Path Verification

The `getCurrentUser()` function at `app/lib/auth/session-auth.ts:22-61` already implements profile auto-provisioning:

1. Gets Supabase user from session cookie
2. Loads existing profile via `getProfile(user.id)` (profile-service.ts)
3. If profile exists (200) → returns `AuthenticatedUser` with profile
4. If profile not found (404) → calls `ensureProfile()` (profile-service.ts)
5. `ensureProfile()`:
   - Resolves display name from `user_metadata` or email prefix
   - Upserts profile via `upsertProfile()` (profile-repository.ts)
   - Returns profile with default role `'creator'`

### Trigger Points

Profile provisioning is triggered on:
- First visit to any dashboard page after login (layout calls `getCurrentUser()`)
- First API call to any `/api/dashboard/*` endpoint (route calls `requireAuth()`)
- Any page that directly calls `getCurrentUser()` or `requireAuth()`

### Verification Result

No manual profile creation is needed. The flow is verified by code review:
- `session-auth.ts:30-60` — explicit 404 check → `ensureProfile()` call
- `profile-service.ts:30-66` — `ensureProfile()` handles missing profile
- `profile-repository.ts:32-58` — `upsertProfile()` uses `onConflict: 'id'`

---

## 6. UI Style

### Design System

- **Colors**: Dark theme (zinc-950 background, zinc-800 borders, zinc-400 text)
- **Accent**: Red-600 (LuxyHub brand)
- **Typography**: Geist Sans (via next/font/google)
- **Spacing**: Tailwind v4 utility classes
- **Icons**: lucide-react

### Component Patterns

- Cards: `rounded-xl border border-zinc-800 bg-zinc-900/50`
- Inputs: `rounded-lg border border-zinc-800 bg-zinc-900 text-white`
- Buttons: `rounded-lg bg-red-600 text-white hover:bg-red-700`
- Nav items: Active state uses `bg-red-600/10 text-red-400`

### Tailwind Configuration

Tailwind v4 via CSS-first config (`@import 'tailwindcss'` in `globals.css`).
Theme variables defined with `@theme inline` directive.

---

## 7. Files Created

### Auth
- `app/actions/auth.ts` — Server Actions: `login()`, `logout()`
- `app/lib/supabase/server.ts` — SSR Supabase client factory
- `app/lib/supabase/proxy.ts` — Proxy-layer session update helper
- `app/api/auth/callback/route.ts` — OAuth/email callback handler

### Pages
- `app/login/page.tsx` — Email/password login form
- `app/dashboard/layout.tsx` — Dashboard shell (sidebar + topnav + content)
- `app/dashboard/page.tsx` — Dashboard home (analytics overview + summary cards)
- `app/dashboard/scripts/page.tsx` — Scripts placeholder
- `app/dashboard/analytics/page.tsx` — Analytics placeholder
- `app/dashboard/versions/page.tsx` — Versions placeholder
- `app/dashboard/profile/page.tsx` — Profile display

### Components
- `app/dashboard/components/Sidebar.tsx` — Navigation sidebar
- `app/dashboard/components/TopNav.tsx` — Top navigation bar

### Utilities
- `app/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)

### Documentation
- `PHASE3E_AUTH_UI.md` — This document

## 8. Files Modified

- `proxy.ts` — Renamed from `middleware.ts`, added session validation and auth redirects, Next.js 16 proxy convention
- `app/lib/auth/session-auth.ts:1` — Updated import from `@/app/lib/supabase` to `@/app/lib/supabase/server`

## 9. Files Deleted

- `middleware.ts` — Renamed to `proxy.ts` (Next.js 16 convention)
- `app/lib/supabase/middleware.ts` — Renamed to `app/lib/supabase/proxy.ts`

## 10. Dependencies Added

- `@supabase/ssr` — Supabase SSR client with cookie handling
- `clsx` — Conditional class utility
- `tailwind-merge` — Tailwind class conflict resolution

## 11. Build Validation

```
✓ Compiled successfully
✓ Running TypeScript (4.3s)
✓ Generating static pages (25/25)
✓ All routes compiled
```

Route summary:
- `/login` — Static (client form with Server Action)
- `/dashboard` — Dynamic (session check + analytics fetch)
- `/dashboard/*` — Dynamic (session check)
- `/api/auth/callback` — Dynamic (OAuth callback)
- All existing routes preserved and functional

## 12. Test Verification

Existing test suites (65 tests) remain passing. No new tests added (Phase 3E is UI-only, existing backend tests cover auth and API flows).

```bash
npx vitest run  # 65 tests, all passing
```

## 13. Success Criteria

| Criterion | Status |
|-----------|--------|
| `/login` page exists with email/password form | ✅ |
| Login Server Action calls Supabase Auth | ✅ |
| Logout Server Action clears session | ✅ |
| Session persisted via Supabase SSR cookies | ✅ |
| Protected routes redirect to `/login` | ✅ |
| Authenticated users redirected from `/login` | ✅ |
| Dashboard shell with sidebar + topnav + content | ✅ |
| Navigation: Dashboard, Scripts, Analytics, Versions, Profile | ✅ |
| Dashboard home displays analytics summary cards | ✅ |
| Profile auto-provisioned by `getCurrentUser()` | ✅ |
| No manual profile creation UI added | ✅ |
| Responsive, dark-themed, clean design | ✅ |
| Build passes with zero errors | ✅ |

## 14. Remaining Work

All items below have been completed in Phase 3E.2 through 3E.5 and Phase 4.1:

- ~~Script management UI (CRUD forms, script list)~~ — Completed in Phase 3E.2
- ~~Full analytics UI (charts, trends, per-script breakdown)~~ — Completed in Phase 3E.4
- ~~Version history UI (list, detail)~~ — Completed in Phase 3E.5
- ~~Profile editing UI~~ — Completed in Phase 3E.3
- ~~Loading skeletons~~ — Completed in Phase 4.1
- Registration/signup flow (deferred)
- Password reset integration (deferred)
