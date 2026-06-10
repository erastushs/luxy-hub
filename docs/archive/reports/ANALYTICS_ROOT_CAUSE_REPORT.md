# Analytics Root Cause Report

## Symptom
Production validation reported that `script_downloads` rows were not being created after successful raw downloads.

## Audit Findings
- The raw endpoint calls `getRawContent()` in `app/api/scripts/[slug]/raw/route.ts`.
- `getRawContent()` in `app/lib/services/script-service.ts` resolves the script and version successfully, then invokes `trackDownloadAsync(script.id, version.id, '0.0.0.0')`.
- `trackDownloadAsync()` is intentionally fire-and-forget.
- `trackDownload()` hashes the provided identifier values and calls `recordDownload()`.
- `recordDownload()` inserts into `script_downloads` through `supabaseAdmin.from('script_downloads').insert(...)`.
- Errors inside `trackDownload()` are swallowed by design so analytics failures do not break raw delivery.
- `logEvent()` is unrelated to raw downloads and does not record download analytics.

## Root Cause Assessment
No confirmed application logic defect was found in the download tracking chain that would deterministically prevent inserts after a successful raw download.

The most likely causes are environment-side or database-side:
- `SUPABASE_SERVICE_ROLE_KEY` missing or misconfigured in production
- `script_downloads` table missing or not migrated correctly
- RLS or policy mismatch in the deployed database
- Supabase insert rejected by a constraint or permissions issue that is swallowed by analytics error handling

## Confirmed Code Adjustment
- `trackDownloadAsync()` was simplified to `void trackDownload(...)` to make the fire-and-forget behavior explicit.
- No architecture change was made.

## Remaining Validation Gap
Because analytics errors are intentionally swallowed, production operators must inspect the deployed logs and database state directly to identify the exact insert failure if rows still do not appear.

## Recommendation
Run a controlled raw download against production, then immediately verify:
1. `script_downloads` contains a new row for the script
2. Supabase application logs for insert failures
3. service-role credentials are present in production
4. the CDN tables and policies match the migration
