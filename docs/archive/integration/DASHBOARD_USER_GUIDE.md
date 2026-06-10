# LuxyHub Creator Dashboard — User Guide

Last updated: 2026-06-08
Phase: 4.3

## Overview

The LuxyHub Creator Dashboard is a self-service tool for managing scripts, viewing download analytics, browsing version history, and managing your creator profile. All data is scoped to your account — no other creator's scripts are visible.

## Getting Started

### Login

Navigate to `/login` and sign in with your email and password (Supabase Auth).

- If you do not have an account, your credentials must be provisioned through the Supabase dashboard.
- Registration UI and password reset are not yet self-service.

After login, you are redirected to the dashboard home.

### Dashboard Home

`/dashboard` shows an analytics overview with summary cards:

- Total Scripts — including published and private counts
- Total Downloads — all-time downloads across all your scripts
- Downloads (7 Days) / (30 Days) — recent activity windows
- Downloads Today — downloads since midnight UTC
- Published Scripts — scripts with `public` visibility

A "View full analytics" link points to the detailed analytics page.

## Scripts

### Viewing Scripts

`/dashboard/scripts` lists all scripts you own.

Features:

- **Search** — type a term into the search input to filter by script name or slug
- **Visibility filter** — select Public, Private, or Unlisted to narrow results
- **Pagination** — Previous/Next controls appear when more than 12 scripts exist
- **Desktop** — scripts display in a table with name, visibility, last updated, and delete action
- **Mobile** — scripts display as cards with the same data

### Creating a Script

1. Click "New Script" on `/dashboard/scripts`
2. Fill in the form:
   - **Name** — required, 1–100 characters
   - **Slug** — required, 3–64 lowercase letters, digits, and hyphens (e.g., `my-script`)
   - **Description** — optional
   - **Content** — required, the script source code (max 62 KB)
   - **Visibility** — defaults to Private; choose Public, Private, or Unlisted
3. Click "Create Script"

On success, you are redirected to the scripts list.

### Editing a Script

1. Navigate to `/dashboard/scripts/[slug]/edit` (the edit link is on the script's card)
2. Update the fields you want to change:
   - Name, description, visibility — editable metadata
   - Content editing creates a new version automatically
3. Click "Save Changes"

### Deleting a Script

On the scripts list, click the trash icon on a script row or card.

A confirmation dialog appears. Confirm to permanently delete the script and all associated versions and download data.

## Analytics

### Dashboard Overview

`/dashboard/analytics` provides portfolio-level analytics.

**Summary Cards** (top row):

| Card | Description |
|------|-------------|
| Total Scripts | Count of all owned scripts |
| Total Downloads | All-time downloads across your scripts |
| Downloads (7 Days) | Downloads in the last 7 days |
| Downloads Today | Downloads since midnight UTC |
| Published Scripts | Scripts set to public visibility |
| Downloads (30 Days) | Downloads in the last 30 days |

**Charts** (middle row):

Two SVG bar charts showing download trends for 7-day and 30-day windows.

**Top Scripts** (bottom):

A ranked table of your top 5 scripts by total download count, showing name, visibility badge, and download numbers.

## Versions

### Browsing Version History

`/dashboard/versions` shows all scripts you own. Click any script name to view its version history.

### Version History

`/dashboard/versions/[slug]` displays a paginated list of versions for the selected script.

- Versions are sorted newest first, 10 per page.
- A sidebar on the right lists all your scripts for quick switching.
- Click any version card to see full details.

### Version Detail

`/dashboard/versions/[slug]/[versionId]` shows:

- Version number and script slug badge
- Creation date and time
- Changelog (if provided when the version was created)
- Full script content in a scrollable code block
- Metadata: version number, version ID, creation date

- The "Back to versions" link returns to the version history list.

## Profile

`/dashboard/profile` shows your account information.

### View Mode

- Display name, username (or "Not set"), role, email, user ID
- "Member since" date
- Copy button next to the user ID
- Sign out button

### Edit Mode

Click "Edit" to update:

- **Display name** — required, 1–80 characters
- **Username** — optional, 3–30 lowercase characters, digits, and hyphens

Click "Save Changes" to apply. Duplicate usernames show an error.

- Role, email, and user ID cannot be edited.

### Sign Out

The "Sign out" button on the profile page (and in the sidebar) ends your session and redirects to `/login`.

## Navigation

The sidebar (left) provides links to all dashboard sections:

- Dashboard — analytics overview
- Scripts — script management
- Analytics — detailed charts and top scripts
- Versions — version history browser
- Profile — account view and edit

On mobile, tap the hamburger icon to open the sidebar as a drawer.

## Security Notes

- All operations are scoped to your account. You cannot view or modify another creator's scripts.
- Script ownership is determined server-side — you cannot assign a script to another creator.
- Your session is managed automatically through secure cookies.
- Logging out immediately clears your dashboard access.
