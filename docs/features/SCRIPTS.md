# Scripts

Scripts are creator-owned resources that combine metadata, visibility, access mode, versions, builds, and analytics.

## Common Tasks

| Task | Where |
| --- | --- |
| Create a script | Dashboard -> Scripts -> New Script |
| Edit script metadata | Dashboard -> Scripts -> Edit |
| Change visibility | Script edit page |
| Change access mode | Script edit page |
| Review runtime requirements | Script list cards/table show Visibility and Access Mode badges |
| Build delivery payload | Script build workflow |
| Review versions | Dashboard -> Versions |
| Review events | Script -> Events |

## Runtime Readiness Checklist

- Script is owned by the current creator account.
- Visibility is `public` or `unlisted` for runtime delivery.
- Current build is ready.
- Access mode matches the expected runtime credential model.
- For `key_required`, callers have a valid free key.
- For `license_required`, callers have a valid license and customer identifier.

## Related Documents

- Dashboard workflows: `../dashboard/DASHBOARD_WORKFLOWS.md`.
- Access modes: `ACCESS_MODES.md`.
- Delivery: `DELIVERY.md`.
- Runtime delivery sessions: `../runtime/DELIVERY_SESSIONS.md`.
