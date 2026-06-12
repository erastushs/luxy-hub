# OH-07 Monitoring Validation Report

Run ID: `oh_m3_20260612125951_8c5c58fa`
Date: 2026-06-12T13:00:03.564Z
Environment: development only (djbpwtjocjeaesmwjlpu.supabase.co)

| Event Class | Status | Detail |
| --- | --- | --- |
| audit events | PASS | 5 rows |
| runtime events | PASS | 2 rows |
| analytics events | PASS | 3 rows |
| delivery events | PASS | 1 rows |
| license events | PASS | 3 rows |
| alert events | PASS | 1 rows |

Missing metrics: delivery payload fetch success/failure remains `null` in Analytics V2 and is not backed by a persisted event counter in the current schema.
