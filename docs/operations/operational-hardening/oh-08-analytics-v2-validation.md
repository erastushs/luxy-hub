# OH-08 Analytics V2 Validation Report

Run ID: `oh_m3_20260612125951_8c5c58fa`
Date: 2026-06-12T13:00:05.807Z
Environment: development only (djbpwtjocjeaesmwjlpu.supabase.co)

Generated realistic test data across 2d, 10d, 20d, and 40d windows and compared database aggregate values for 7d, 30d, and 90d windows.

| Window | Accuracy | Total Scripts | Auth Success | Auth Failure | Delivery Sessions | Runtime Starts | Runtime Failures |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 7d | 100% | 1 | 3 | 0 | 1 | 3 | 0 |
| 30d | 100% | 1 | 3 | 1 | 2 | 3 | 1 |
| 90d | 100% | 1 | 3 | 2 | 2 | 4 | 1 |

Dashboard parity note: direct UI rendering was not browser-tested in this CLI run; service/database aggregate parity was validated at 100% for the generated data set.
