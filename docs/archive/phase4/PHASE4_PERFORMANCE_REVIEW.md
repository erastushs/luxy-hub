# Phase 4.2 — Performance Review

Status: Complete
Last updated: 2026-06-08

## Purpose

Audit Creator Dashboard performance with measurement first and conservative optimization second. This review does not add features, change business logic, change authentication, change ownership behavior, change APIs, or add database schema/indexes.

## Measurement Summary

| Area | Measurement | Result |
|------|-------------|--------|
| Framework | `next build` | Next.js 16.2.7 with Turbopack |
| Build validation | `npm run build` | Passed, compiled successfully in 9.1s |
| TypeScript validation | Build TypeScript phase | Passed in 4.8s |
| Route generation | Static page generation | 26/26 generated in 360ms |
| Dashboard rendering mode | Build route table | All dashboard routes are dynamic server-rendered (`ƒ`) |
| Static asset output | `du -sh .next/static` | 1.3M |
| Dashboard server output | `du -sh .next/server/app/dashboard` | 580K |
| Dependency duplication | `npm ls react react-dom ...` | React 19.2.4 and React DOM 19.2.4 deduped |
| Client component count | Search for `'use client'` under `app/dashboard` | 14 dashboard client-component entry points after optimization |
| Lint validation | `npm run lint` | No errors; 7 pre-existing unused-symbol warnings remain |

Build route evidence:

```text
ƒ /dashboard
ƒ /dashboard/analytics
ƒ /dashboard/profile
ƒ /dashboard/scripts
ƒ /dashboard/scripts/[slug]/edit
ƒ /dashboard/scripts/new
ƒ /dashboard/versions
ƒ /dashboard/versions/[slug]
ƒ /dashboard/versions/[slug]/[versionId]
```

Dependency audit evidence:

```text
react@19.2.4 deduped across next, react-dom, lucide-react, sonner,
framer-motion, react-markdown, @vercel/analytics, and @vercel/speed-insights.
```

## Bundle Audit

### Findings

| Finding | Evidence | Impact |
|---------|----------|--------|
| Dashboard shell hydrates on every dashboard route | `app/dashboard/layout.tsx` renders client `Sidebar` and client `TopNav` globally | Persistent dashboard JS/hydration cost |
| `TopNav` is client-only for breadcrumb path parsing | `app/dashboard/components/TopNav.tsx` uses `usePathname()` | Candidate for server-side route metadata or static mapping in a later pass |
| Scripts page hydrates both desktop and mobile script presentations | `app/dashboard/scripts/scripts-client.tsx` renders `ScriptTable` and `ScriptCard` branches with CSS breakpoint hiding | Higher hydration cost on scripts page |
| Mobile script cards duplicate delete behavior | `ScriptCard` owns delete action/toast/router behavior while `scripts-client` also owns delete dialog state for desktop | More client code than necessary |
| Version history still uses client navigation for list/pagination | `versions-client.tsx`, `VersionList.tsx`, `Pagination.tsx` | Remaining but bounded hydration cost |
| Profile page hydrates mostly static account display plus edit/logout/copy interactions | `profile-client.tsx` | Candidate for smaller client islands later |
| No duplicated React dependency tree found | `npm ls` result | No dependency dedupe action needed |

### Server Component Opportunities

These are opportunities only; they were not all implemented because Phase 4.2 allows only low-risk changes.

| Candidate | Recommendation |
|-----------|----------------|
| `TopNav` | Replace `usePathname()` breadcrumb logic with server-provided title metadata or a smaller client island. |
| Version list cards | Replace `button onClick` navigation with `Link` where pagination/client state is not needed. |
| Scripts list rows/cards | Consider server-rendered list markup with small client islands for delete controls and filters. |
| Profile page | Render static profile details as a Server Component and isolate edit/copy/logout controls. |

## Rendering Audit

### Scripts Pages

`/dashboard/scripts` is the heaviest dashboard client surface today. The page uses a client wrapper for search navigation, visibility filter changes, pagination, local delete state, desktop table rendering, and mobile card rendering.

Evidence:

- `app/dashboard/scripts/scripts-client.tsx` is a client component.
- Desktop table and mobile cards are both present in the rendered tree and hidden by responsive classes.
- `ScriptCard` also owns delete behavior independently from the parent delete dialog path.

Recommendation:

- Keep current behavior for V1 stability.
- In a later performance pass, consolidate desktop/mobile script markup or split controls into smaller client islands.

### Analytics Pages

`/dashboard/analytics` is currently a Server Component page. Rendering cost is mostly backend/query cost, not browser-side state.

Evidence:

- `app/dashboard/analytics/page.tsx` has no `'use client'` directive.
- It renders `AnalyticsCard`, `DownloadsChart`, and `TopScriptsTable` as server-rendered components.
- It runs four analytics calls in parallel.

Recommendation:

- Prioritize backend query consolidation before adding client-side chart complexity.

### Versions Pages

Version detail was hydrating solely to support a back button. This has been optimized.

Applied optimization:

- `app/dashboard/components/VersionDetail.tsx` is now a Server Component.
- The back control now uses `next/link` instead of `useRouter().push()`.

Impact:

- Removes one dashboard client-component entry point.
- Avoids hydrating the version detail content block, including potentially large script content.

Remaining version-area cost:

- `versions-client.tsx`, `VersionList.tsx`, and `Pagination.tsx` still hydrate for list navigation and pagination.

### Profile Pages

`/dashboard/profile` hydrates account display, edit form, copy button, logout form, and local edit state together.

Evidence:

- `app/dashboard/profile/profile-client.tsx` is a client component.

Recommendation:

- Split static profile fields into server-rendered markup and keep edit/copy/logout as focused client controls in a future pass.

## Data Fetching Audit

### Analytics Queries

The highest-risk performance hotspot is analytics aggregation.

| Finding | Evidence | Impact |
|---------|----------|--------|
| Top scripts uses N+1 query pattern | `getTopScripts()` loads up to 100 scripts then calls `getScriptAnalyticsForOwner()` per script | Up to roughly 601 DB queries for top scripts alone: 1 script list plus up to 100 script analytics calls with multiple queries each |
| Analytics page duplicates owner script fetches | `getOverview()`, `getDownloadTrends('7d')`, `getDownloadTrends('30d')`, and `getTopScripts()` each resolve owned scripts independently | Redundant DB work per analytics render |
| Overview counts are separate exact count queries | `getCreatorAnalyticsOverview()` performs multiple counts over `script_downloads` | Acceptable for small V1 data, but expensive at scale |
| Trends transfer raw rows and aggregate in Node | `getDownloadTrendsForOwner()` selects `created_at` rows then groups in JavaScript | Transfer grows linearly with download volume |

Recommendations:

- Replace `getTopScripts()` with one aggregate query or Postgres RPC grouped by `script_id` and joined to script metadata.
- Add a combined dashboard analytics service that resolves owned script IDs once and returns overview, 30-day trend, 7-day slice, and top scripts together.
- Move trend grouping to SQL using `date_trunc('day', created_at)` when Supabase query/RPC implementation is justified.
- Consider 30-60 second per-owner analytics caching only after query consolidation and after a clear stale-data policy is chosen.

### Version Queries

Applied optimization:

- Version list queries no longer select `content`.

Before:

```ts
.select('id, script_id, version, content, changelog, created_at', { count: 'exact' })
```

After:

```ts
.select('id, script_id, version, changelog, created_at', { count: 'exact' })
```

Impact:

- `/dashboard/versions/[slug]` no longer transfers full script contents for each version row.
- Script content remains fetched only by detail views and raw delivery paths.
- No API behavior, ownership logic, or visible UI behavior changed.

Additional finding:

- Version detail currently validates script ownership, fetches version by ID, then checks `version.script_id`. This is safe, but could be reduced to a script-scoped version query in a later backend pass.

### Script Listing Queries

Current script listing query shape:

- Filter by `creator_id`.
- Optional filter by `visibility`.
- Optional wildcard search over `name` and `slug`.
- Sort by `updated_at desc`.
- Use exact count and range pagination.

Evidence:

- `app/lib/repositories/script-repository.ts` `listScriptsForOwner()`.

Potential bottlenecks:

- Current indexes support `creator_id` and `visibility`, but not the combined dashboard sort shape.
- Wildcard `ilike.*term*` search has no trigram/full-text index.

No index was added in Phase 4.2 because the task explicitly prohibits speculative indexes and there are no production query measurements showing slow script listing yet.

## Caching Review

Current cache posture:

- Dashboard pages are dynamic because they depend on authenticated user/session data.
- No `unstable_cache`, `use cache`, or route-level dashboard revalidation is used for dashboard data.
- Server actions use `revalidatePath()` for script/profile mutations.

Assessment:

- This is correctness-safe for authenticated creator data.
- Broad page-level caching would risk stale or incorrectly scoped user data if implemented carelessly.
- Per-owner short TTL caching may be useful for analytics after query consolidation, but should be measured first.

Recommendations:

- Do not add broad dashboard page caching in V1.
- Consider per-owner analytics caching only with explicit owner-scoped cache keys and a short TTL.
- Keep mutation-driven invalidation via `revalidatePath()` for script/profile UI paths.

## Database Access Review

### Current Relevant Indexes

| Table | Indexes |
|-------|---------|
| `scripts` | `idx_scripts_slug`, `idx_scripts_visibility`, `idx_scripts_creator_id` |
| `script_versions` | `idx_script_versions_script_id`, `idx_script_versions_script_version` |
| `script_downloads` | `idx_script_downloads_script_id`, `idx_script_downloads_created_at`, `idx_script_downloads_script_time` |
| `rate_limits` | `idx_rate_limits_ip_endpoint_created_at` |

### Owner-Scoped Queries

Owner-scoped queries consistently filter by `creator_id` or validate through ownership helpers before exposing creator data.

No ownership changes were made.

### Analytics Aggregation Queries

Current indexes are aligned for per-script download lookup and date filtering, especially `idx_script_downloads_script_time (script_id, created_at)`. The main performance issue is query shape rather than missing indexes.

Evidence-based future recommendations:

- If script listing becomes slow, measure and consider `(creator_id, updated_at DESC)`.
- If visibility-filtered listing becomes slow, measure and consider `(creator_id, visibility, updated_at DESC)`.
- If wildcard dashboard search becomes frequent, measure and consider `pg_trgm` GIN indexes on `name` and `slug`.
- If unique visitor analytics remains important at scale, move `count(distinct ip_hash)` to SQL/RPC before adding an index such as `(script_id, ip_hash)`.
- If analytics volume grows, consider daily aggregate rollups or a materialized view keyed by `(script_id, day)`.

No speculative indexes were added.

## Lighthouse Review

A live Lighthouse run was not executed in this local pass because no production server/browser audit target was started for this review. Expected Lighthouse findings are based on build output, dashboard architecture, and the Phase 4.1 UI/accessibility changes.

### Performance

Expected positives:

- Dashboard routes are server-rendered and avoid large client chart libraries.
- Static asset output is small at 1.3M for `.next/static`.
- Version detail now avoids unnecessary hydration.
- Version list avoids transferring full script content.

Expected risks:

- Scripts page hydration cost from duplicate desktop/mobile render paths.
- Global shell hydration from `Sidebar` and `TopNav`.
- Analytics server response time may degrade as `script_downloads` grows due to N+1 and raw-row aggregation.

### Accessibility

Expected positives from Phase 4.1:

- Skip-to-content link exists.
- Navigation has labels and active state.
- Error banners use alert semantics.
- Focus-visible rings were added broadly.
- Dialog semantics were added for delete confirmation.

Expected remaining risks:

- Dynamic toasts and form action feedback should be checked with a real browser/screen reader pass.
- Mobile drawer focus management should be validated manually.

### Best Practices

Expected positives:

- No broad client-side auth trust model introduced.
- Dashboard remains behind server-side session validation.
- No new API or schema risk in Phase 4.2.

Expected risks:

- Node deprecation warning during build: `module.register()` deprecated. This appears toolchain-related and not caused by application code.
- Lighthouse should validate CSP/header behavior in the deployed environment, not only locally.

## Optimizations Applied

| File | Change | Reason |
|------|--------|--------|
| `app/lib/repositories/script-repository.ts` | Added `VersionSummaryRow`; `listVersionsForScript()` no longer selects `content` | Avoid transferring full script content for version list pages |
| `app/lib/services/script-service.ts` | Updated version list result typing to use `VersionSummaryRow[]` | Preserve type safety for the lighter version-list payload |
| `app/dashboard/versions/[slug]/page.tsx` | Uses `VersionSummaryRow[]` for version history list data | Align page with lighter list query |
| `app/dashboard/versions/[slug]/versions-client.tsx` | Uses `VersionSummaryRow[]` props | Avoid implying `content` is available in the client list payload |
| `app/dashboard/components/VersionDetail.tsx` | Converted from Client Component to Server Component; replaced router push button with `Link` | Remove hydration for a static version detail view/back link |

## Build Validation

Commands run:

```bash
npm run build
npm run lint
npm ls react react-dom lucide-react sonner framer-motion react-markdown remark-gfm @vercel/analytics @vercel/speed-insights
du -sh .next/static .next/server/app/dashboard
```

Results:

```text
✓ npm run build passed
✓ TypeScript passed during build
✓ Static generation completed for 26/26 pages
✓ npm run lint completed with 0 errors
✓ React/React DOM dependency tree deduped
```

Known validation warnings:

- `npm run lint` reports 7 unused-symbol warnings that existed outside the Phase 4.2 optimization scope.
- Build reports Node `[DEP0205] module.register()` deprecation warning from the toolchain.

## Remaining Work for Phase 4.3

Phase 4.3 is Documentation Review. Recommended handoff items:

- Update roadmap status so Phase 4.1 and Phase 4.2 are marked complete.
- Review Phase 3 UI docs for accuracy after Phase 4.1/4.2 changes.
- Update `../API_SPEC.md` with all Phase 3 dashboard endpoints if not already reflected.
- Add or update dashboard user guide documentation.
- Review `../../../AGENTS.md` for Phase 4 conventions and Next.js 16 guidance.
- Carry forward the analytics query recommendations as documented performance follow-up, not as speculative schema work.

## Final Assessment

Phase 4.2 completed a measurable performance review and applied two low-risk optimizations. The dashboard remains behaviorally equivalent, with no changes to business logic, authentication, ownership, APIs, or database schema. Build validation passes.
