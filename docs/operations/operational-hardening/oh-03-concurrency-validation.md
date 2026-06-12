# OH-03 Concurrency Validation Report

Run ID: `oh_m3_20260612125951_8c5c58fa`
Date: 2026-06-12T12:59:59.702Z
Environment: development only (djbpwtjocjeaesmwjlpu.supabase.co)

Scenario: max_assignments=1, concurrent requests=8.

Result: PASS.

| Metric | Value |
| --- | ---: |
| Successful assignment RPCs | 1 |
| Safe failures | 7 |
| Persisted assignment rows | 1 |

Race-condition finding: `authorize_license_assignment` locks the parent `licenses` row with `FOR UPDATE`; live concurrent execution showed capacity enforcement serialized correctly.
