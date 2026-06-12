# OH-02 Rollback Validation Report

Run ID: `oh_m3_20260612125951_8c5c58fa`
Date: 2026-06-12T12:59:56.121Z
Environment: development only (djbpwtjocjeaesmwjlpu.supabase.co)

| Check | Status |
| --- | --- |
| 014 creates runtime RPCs | PASS |
| 014 rollback drops runtime RPCs | PASS |
| 014 rollback restores actor role constraint | PASS |
| 014 rollback leaves 013 license tables intact | PASS |

A destructive 014 rollback was not executed against the shared configured development database because this environment lacks an isolated clean database connection and rollback would remove live runtime RPCs for anyone sharing the dev project.

Expected existing-data behavior after 014 rollback:
- `licenses` and `license_assignments` data from migration 013 remains intact.
- Runtime audit rows with `actor_role = runtime` would violate the restored pre-014 `audit_logs_actor_role_check` if still present; those rows must be deleted, transformed, or migrated before rollback on a database containing runtime audit data.
- Delivery/assignment runtime RPC callers fail until 014 is re-applied or code is rolled back with the schema.
