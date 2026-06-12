# Dashboard Workflows

The dashboard is the creator control plane for scripts, builds, versions, licenses, events, analytics, profile settings, and admin alerts.

## Quick Navigation

| Area | Route | Purpose |
| --- | --- | --- |
| Overview | `/dashboard` | High-level dashboard entry. |
| Scripts | `/dashboard/scripts` | Create, edit, delete, build, and inspect scripts. |
| Licenses | `/dashboard/licenses` | Manage premium licenses and assignments. |
| Analytics | `/dashboard/analytics` | Portfolio analytics. |
| Versions | `/dashboard/versions` | Script version history. |
| Profile | `/dashboard/profile` | Display name, username, avatar URL, password. |
| Documentation | `/docs` | Public knowledge base and developer docs. |

## Scripts Workflow

1. Create a script from Scripts -> New Script.
2. Set visibility and access mode.
3. Upload or edit source according to the active script workflow.
4. Build the delivery payload.
5. Confirm the script list shows the expected Visibility and Access Mode badges.
6. Use Copy Loader when the build is ready.

## Licenses Workflow

1. Create a license for a script.
2. Configure assignment capacity.
3. Copy the raw license key when shown.
4. Add or inspect assignments as needed.
5. Disable, enable, or revoke according to customer state.

## Events Workflow

1. Open a script's Events page.
2. Inspect event delivery status and details.
3. Use dead-letter views for failed events.
4. Replay only after confirming the target webhook/config is healthy.

## Profile Workflow

1. Open Profile.
2. Edit display name, username, or avatar URL.
3. Password changes are handled by Supabase Auth.
4. Role, email, and user ID are read-only dashboard fields.

## Related Documents

- Scripts: `../features/SCRIPTS.md`.
- Access modes: `../features/ACCESS_MODES.md`.
- Licenses: `../features/LICENSES.md`.
- Event Platform: `../features/EVENT_PLATFORM.md`.
