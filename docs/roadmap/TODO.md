# LuxyHub Roadmap 2026

Last updated: 2026-06-11

---

## Project Progress

### Completed ✅

| # | Category | Task | Artifact |
|---|----------|------|----------|
| 1 | **Platform** | Website (Next.js 16) | `app/` — 14 static pages |
| 2 | **Platform** | SEO Optimization | robots.txt, sitemap.xml, metadata |
| 3 | **Auth** | Work.ink Integration | `app/lib/services/workink-service.ts` |
| 4 | **Auth** | Key Generation System | `app/api/generate-key/route.ts` |
| 5 | **API** | Key Validation API | `app/api/validate/route.ts` |
| 6 | **API** | Work.ink Verify API | `app/api/verify-workink/route.ts` |
| 7 | **API** | Health Monitoring Endpoint | `app/api/health/route.ts` |
| 8 | **API** | Database Cleanup Cron | `app/api/cleanup/route.ts` |
| 9 | **Security** | Security Hardening | Body size limits, input validation |
| 10 | **Security** | Security Headers (CSP, HSTS, etc.) | `middleware.ts` |
| 11 | **Security** | Rate Limiting (fail-closed) | `app/lib/rate-limiter.ts` |
| 12 | **Security** | RLS Protection (5 tables) | `migrations/001_enable_rls.sql` |
| 13 | **Docs** | API Documentation | `../archive/integration/API_SPEC.md` |
| 14 | **Docs** | Integration Documentation | `../archive/integration/API_INTEGRATION.md` |
| 15 | **Docs** | Architecture Documentation | `../architecture/ARCHITECTURE.md` |
| 16 | **Docs** | Deployment Checklist | `../deployment/DEPLOYMENT_CHECKLIST.md` |
| 17 | **Docs** | Incident Response Plan | `../operations/INCIDENT_RESPONSE.md` |
| 18 | **Docs** | Backup Strategy | `../archive/deployment/BACKUP_STRATEGY.md` |
| 19 | **Docs** | Monitoring Architecture | `../operations/MONITORING.md` |
| 20 | **Infra** | Vercel Cron Job Config | `vercel.json` |
| 21 | **Security** | Unified error codes (no oracle) | Key validation returns identical 403 for missing/expired keys |
| 22 | **Security** | CORS headers for API routes | `middleware.ts` |
| 23 | **Security** | Anti-replay (Work.ink tokens) | `used_workink_tokens` table |
| 24 | **Design** | CDN Architecture Review | `../archive/architecture/CDN_ARCHITECTURE.md` |
| 25 | **Design** | CDN Database Reference | `../architecture/CDN_DATABASE.md` |
| 26 | **Database** | CDN Table Migration (UP) | `migrations/002_cdn_tables.sql` |
| 27 | **Database** | CDN Table Migration (DOWN) | `migrations/002_cdn_tables_rollback.sql` |
| 28 | **Database** | Schema updated (8 tables) | `schema.sql` |
| 29 | **Code** | CDN Repository Layer | `app/lib/repositories/script-repository.ts` |
| 30 | **Code** | CDN Service Layer | `app/lib/services/script-service.ts` |
| 31 | **Code** | Admin Auth Module | `app/lib/auth/admin-auth.ts` |
| 32 | **Code** | CDN Validators | `app/lib/validators.ts` (slug, visibility, content) |
| 33 | **API** | CDN Rate Limits (6 keys) | `app/lib/repositories/rate-limit-repository.ts` |
| 34 | **API** | GET /api/scripts (list) | `app/api/scripts/route.ts` |
| 35 | **API** | POST /api/scripts (upload) | `app/api/scripts/route.ts` |
| 36 | **API** | GET /api/scripts/[slug] (metadata) | `app/api/scripts/[slug]/route.ts` |
| 37 | **API** | PATCH /api/scripts/[slug] (update) | `app/api/scripts/[slug]/route.ts` |
| 38 | **API** | DELETE /api/scripts/[slug] (delete) | `app/api/scripts/[slug]/route.ts` |
| 39 | **API** | GET /api/scripts/[slug]/raw (delivery) | `app/api/scripts/[slug]/raw/route.ts` |
| 40 | **API** | GET /api/scripts/[slug]/stats (analytics) | `app/api/scripts/[slug]/stats/route.ts` |
| 41 | **API** | POST /api/scripts/[slug]/publish (visibility) | `app/api/scripts/[slug]/publish/route.ts` |
| 42 | **Infra** | Cleanup cron extended (downloads) | `app/api/cleanup/route.ts` |
| 43 | **Docs** | CDN Migration Guide | `../archive/integration/CDN_MIGRATION_GUIDE.md` |
| 44 | **Docs** | API Spec updated (CDN endpoints) | `../archive/integration/API_SPEC.md` |
| 45 | **Docs** | Integration Guide updated (CDN) | `../archive/integration/API_INTEGRATION.md` |
| 46 | **Database** | Profiles Migration (UP) | `migrations/003_profiles.sql` |
| 47 | **Database** | Profiles Migration (DOWN) | `migrations/003_profiles_rollback.sql` |
| 48 | **Code** | Session Auth Utilities | `app/lib/auth/session-auth.ts` |
| 49 | **Code** | Profile Repository | `app/lib/repositories/profile-repository.ts` |
| 50 | **Code** | Profile Service | `app/lib/services/profile-service.ts` |
| 51 | **Docs** | Phase 3A Identity Foundation | `../archive/phase3/PHASE3A_IDENTITY.md` |
| 52 | **Database** | Script Ownership Migration (UP) | `migrations/004_script_ownership.sql` |
| 53 | **Database** | Script Ownership Migration (DOWN) | `migrations/004_script_ownership_rollback.sql` |
| 54 | **Code** | Ownership Helpers | `app/lib/auth/ownership.ts` |
| 55 | **Docs** | Ownership Migration Strategy | `../archive/integration/OWNERSHIP_MIGRATION.md` |
| 56 | **Docs** | Phase 3B Ownership Enforcement | `../archive/phase3/PHASE3B_OWNERSHIP.md` |
| 57 | **API** | Phase 3C Creator API Layer | 5 dashboard endpoints, ownership enforcement, tests |
| 58 | **API** | Phase 3C.2 Analytics APIs | 3 analytics endpoints, aggregation, tests |
| 59 | **API** | Phase 3C.3 Version History APIs | 2 version endpoints, cross-script isolation, tests |
| 60 | **API** | Phase 3C.4 Audit Logging System | audit_logs table, sanitized logging, tests |
| 61 | **Security** | Phase 3D Security Validation | RLS audit, ownership audit, isolation testing, rate limit audit, security review |
| 62 | **Docs** | Phase 3D Security Validation Report | `../archive/phase3/PHASE3D_SECURITY_VALIDATION.md` |
| 63 | **Fix** | Rate limit on DELETE /api/scripts/[slug] | `app/api/scripts/[slug]/route.ts` + rate-limit-repository.ts |
| 64 | **UI** | Phase 3E.1 Auth + Dashboard Shell | Login page, proxy auth, sidebar, dashboard home |
| 65 | **UI** | Phase 3E.2 Scripts Management UI | Script list, create, edit, delete, pagination, search, filter |
| 66 | **UI** | Phase 3E.3 Profile UI | Profile view, edit display name/username, copy user ID, logout |
| 67 | **UI** | Phase 3E.4 Analytics UI | Overview cards, download trend charts, top scripts table |
| 68 | **UI** | Phase 3E.5 Versions UI | Script selector, version history, version detail, pagination |
| 69 | **Docs** | Phase 3E Documentation | PHASE3E_AUTH_UI.md, SCRIPTS_UI.md, PROFILE_UI.md, ANALYTICS_UI.md, VERSIONS_UI.md |
| 70 | **Docs** | Phase 3 Closure | RELEASE_V1.md, PHASE3_COMPLETION_REPORT.md, TODO.md updated |
| 71 | **Design** | Phase 5A Secure Delivery Architecture | `../archive/architecture/SECURE_DELIVERY_ARCHITECTURE.md` |
| 72 | **Database** | Phase 5B delivery_builds Migration | `migrations/006_delivery_builds.sql` |
| 73 | **Code** | Phase 5B Build Pipeline Foundation | `app/lib/services/delivery-build-service.ts` |
| 74 | **Docs** | Phase 5B Build Pipeline Documentation | `../archive/phase5/PHASE5B_BUILD_PIPELINE.md` |
| 75 | **Database** | Phase 5C delivery_sessions Migration | `migrations/007_delivery_sessions.sql` |
| 76 | **API** | Phase 5C Secure Delivery Session API | `app/api/delivery/session/route.ts`, `app/api/delivery/fetch/route.ts` |
| 77 | **Code** | Phase 5C Delivery Session Services | `app/lib/services/delivery-session-service.ts` |
| 78 | **Docs** | Phase 5C Secure Delivery API Documentation | `../archive/phase5/PHASE5C_SECURE_DELIVERY_API.md` |
| 79 | **Code** | Phase 5D Payload Consumer Utilities | `app/lib/delivery/payload-consumer.ts` |
| 80 | **Code** | Phase 5D Reference Loader POC | `examples/reference-loader.ts` |
| 81 | **Tests** | Phase 5D Payload Consumption Tests | `__tests__/delivery-payload-consumer.test.ts` |
| 82 | **Docs** | Phase 5D Loader Integration Documentation | `../archive/phase5/PHASE5D_LOADER_INTEGRATION.md` |
| 83 | **UI** | Phase 6A Lua Upload Workflow | `/dashboard/scripts/new`, `/dashboard/scripts/[slug]/edit` |
| 84 | **UI** | Phase 6A Build Status Visibility | `BuildStatusBadge`, `BuildInfoPanel`, scripts table |
| 85 | **Code** | Phase 6A Dashboard Build Visibility Service | `app/lib/services/dashboard-build-service.ts` |
| 86 | **Tests** | Phase 6A Upload and Build Visibility Tests | `__tests__/source-file-validation.test.ts`, `__tests__/dashboard-build-service.test.ts` |
| 87 | **Docs** | Phase 6A Dashboard V2 Documentation | `../archive/phase6/PHASE6A_DASHBOARD_V2.md` |
| 88 | **UI** | Phase 6B Build History Dashboard | `/dashboard/scripts/[slug]/builds` |
| 89 | **UI** | Phase 6B Build Detail Dashboard | `/dashboard/scripts/[slug]/builds/[buildId]` |
| 90 | **Code** | Phase 6B Build Operations Service | `app/lib/services/build-operations-service.ts` |
| 91 | **Code** | Phase 6B Creator Rebuild Action | `app/actions/builds.ts` |
| 92 | **Tests** | Phase 6B Build Operations Tests | `__tests__/build-operations-service.test.ts` |
| 93 | **Docs** | Phase 6B Build Operations Documentation | `../archive/phase6/PHASE6B_BUILD_OPERATIONS.md` |
| 94 | **Code** | Phase 6C Build Automation Service | `app/lib/services/build-automation-service.ts` |
| 95 | **Code** | Phase 6C Automatic Build Triggers | `createScript`, `updateScript`, `changeVisibility` |
| 96 | **Code** | Phase 6C Build Lifecycle Consistency | `pending → building → ready/failed` |
| 97 | **Tests** | Phase 6C Build Automation Tests | `__tests__/build-automation-service.test.ts` |
| 98 | **Docs** | Phase 6C Build Automation Documentation | `../archive/phase6/PHASE6C_BUILD_AUTOMATION.md` |
| 99 | **API** | Phase 6D Loader Bootstrap Endpoint | `app/api/loader/[slug]/route.ts` |
| 100 | **Code** | Phase 6D Loader Runtime V1 | `app/lib/loader/loader-runtime-v1.ts` |
| 101 | **Code** | Phase 6D Delivery Fetch Context | `POST /api/delivery/fetch` context response |
| 102 | **Tests** | Phase 6D Loader Tests | `__tests__/loader-api.test.ts`, `__tests__/loader-runtime-v1.test.ts` |
| 103 | **Docs** | Phase 6D Production Loader Documentation | `../archive/phase6/PHASE6D_PRODUCTION_LOADER.md` |
| 104 | **UI** | Phase 6E Dashboard Action Tooltips | `Tooltip`, dashboard icon actions |
| 105 | **UI** | Phase 6E Loader Copy Workflow | `CopyLoaderButton`, `LoaderSnippetCard`, script metadata summary |
| 106 | **Tests** | Phase 6E Dashboard UX Polish Tests | `__tests__/dashboard-ux-polish.test.tsx` |
| 107 | **Docs** | Phase 6E UX Polish Documentation | `../archive/phase6/PHASE6E_UX_POLISH.md` |
| 108 | **Docs** | Phase 6F Runtime Adapter Audit | `../archive/reports/LOADER_RUNTIME_ADAPTER_AUDIT.md` |
| 109 | **Docs** | Phase 6F Runtime Validation Plan | `../archive/phase6/PHASE6F_RUNTIME_VALIDATION.md` |
| 110 | **Docs** | Phase 6G Delivery Architecture Review | `../archive/phase6/PHASE6G_DELIVERY_ARCHITECTURE_REVIEW.md` |
| 111 | **Code** | Phase 6H Runtime Payload Delivery | `app/lib/delivery/runtime-payload.ts`, `POST /api/delivery/fetch` |
| 112 | **Code** | Phase 6H Simplified Loader Runtime | `app/lib/loader/loader-bootstrap.ts`, `app/lib/loader/loader-runtime-v1.ts` |
| 113 | **Tests** | Phase 6H Runtime Payload Tests | `__tests__/runtime-payload-delivery.test.ts` |
| 114 | **Docs** | Phase 6H Runtime Payload Delivery Documentation | `../archive/phase6/PHASE6H_RUNTIME_PAYLOAD_DELIVERY.md` |
| 115 | **Design** | Phase 8A Event Foundation Design | `../phases/phase8/historical/PHASE8A_EVENT_FOUNDATION_DESIGN.md` |
| 116 | **Database** | Phase 8B.1 Event Platform Foundation | `migrations/008_event_platform.sql` |
| 117 | **API** | Phase 8B.2 Secure Event Reporting API | `app/api/events/report/route.ts` |
| 118 | **Code** | Phase 8B.3 Queue Worker | `app/lib/services/event-queue-service.ts`, `app/api/internal/event-worker/route.ts` |
| 119 | **Code** | Phase 8B.4 Discord Provider | `app/lib/providers/discord-provider.ts` |
| 120 | **UI** | Phase 8C Webhook and Event Operations Dashboard | `/dashboard/scripts/[slug]/webhooks`, `/dashboard/scripts/[slug]/events` |
| 121 | **Security** | Phase 8 Hardening Sprint | event secrets, queue claims, test isolation, retention cleanup, monitoring foundation |
| 122 | **Docs** | Phase 8 Monitoring Foundation | `../phases/phase8/historical/PHASE8D_MONITORING_FOUNDATION.md` |
---


### Pending ❌

| # | Phase | Task | Depends On |
|---|-------|------|------------|
| 1 | Phase 7A.1 | Schema Foundation | Phase 6H, Phase 8 closeout |
| 2 | Phase 7A.2 | Authorization Abstraction | Phase 7A.1 |
| 3 | Phase 7A.3 | Key Required Mode | Phase 7A.2 |
| 4 | Phase 7A.4 | License Services | Phase 7A.1 |
| 5 | Phase 7A.5 | License Delivery Authorization | Phase 7A.4 |
| 6 | Phase 7A.6 | Dashboard & Loader UX | Phase 7A.3, Phase 7A.5 |
| 7 | Phase 7A.7 | Hardening & Audit | Phase 7A.6 |
| 8 | Phase 9 | Internal Operations & Release Workflow | Phase 7 |
| 9 | Phase 10 | Scale & Infrastructure (Optional) | Phase 9 |
---
## Overall Completion
```text
██████████████████████████████████░░ 90%
Code & Docs:           100% complete ████████████████████
Infrastructure:         70% complete ██████████████░░░░░░
CDN Database:          100% complete ████████████████████
CDN API:               100% complete ████████████████████
Dashboard Backend:     100% complete ████████████████████
Dashboard UI:          100% complete ████████████████████
Secure Delivery:       100% complete ████████████████████
Loader Integration:    100% complete ████████████████████
Access Modes & Licenses: 0% complete ░░░░░░░░░░░░░░░░░░░░
Event Platform:        100% complete ████████████████████
Scale (Optional):        0% complete ░░░░░░░░░░░░░░░░░░░░
```
---

## Phase Completion Status

| Phase | Name | Status | % |
|-------|------|--------|---|
| Phase 0 | Core Platform (pre-roadmap) | Complete | 100% |
| Phase 1 | Infrastructure & Monitoring | Docs Complete / Infra Pending | 75% |
| Phase 1.5 | CDN Architecture Review | Complete | 100% |
| Phase 2A | CDN Database Foundation | Complete | 100% |
| Phase 2B | CDN API Implementation | Complete | 100% |
| Phase 2C | Production Verification | Complete | 100% |
| Phase 3A | Identity Foundation | Complete | 100% |
| Phase 3B | Ownership Enforcement | Complete | 100% |
| Phase 3C.1 | Creator API Layer | Complete | 100% |
| Phase 3C.2 | Analytics APIs | Complete | 100% |
| Phase 3C.3 | Version History APIs | Complete | 100% |
| Phase 3C.4 | Audit Logging System | Complete | 100% |
| Phase 3D | Security Validation | Complete | 100% |
| Phase 3E.1 | Auth + Dashboard Shell | Complete | 100% |
| Phase 3E.2 | Scripts Management UI | Complete | 100% |
| Phase 3E.3 | Profile UI | Complete | 100% |
| Phase 3E.4 | Analytics UI | Complete | 100% |
| Phase 3E.5 | Versions UI | Complete | 100% |
| Phase 4.1 | UI Polish | Complete | 100% |
| Phase 4.2 | Performance Review | Complete | 100% |
| Phase 4.3 | Documentation Review | Complete | 100% |
| Phase 4.4 | Production Hardening | Complete | 100% |
| Phase 5A | Secure Delivery Architecture | Complete | 100% |
| Phase 5B | Build Pipeline Foundation | Complete | 100% |
| Phase 5C | Secure Delivery API | Complete | 100% |
| Phase 5D | Loader Integration POC | Complete | 100% |
| Phase 5 | Secure Script Delivery | Complete | 100% |
| Phase 6A | Dashboard V2 Upload + Build Visibility | Complete | 100% |
| Phase 6B | Build Operations + Delivery Visibility | Complete | 100% |
| Phase 6C | Build Automation | Complete | 100% |
| Phase 6D | Production Loader | Complete | 100% |
| Phase 6E | Dashboard UX Polish | Complete | 100% |
| Phase 6F | Runtime Validation | Complete | 100% |
| Phase 6G | Delivery Architecture Review | Complete | 100% |
| Phase 6H | Runtime Payload Delivery | Complete | 100% |
| Phase 6 | Loader Integration | Complete | 100% |
| Phase 7A.1 | Schema Foundation | Active / Not Started in Code | 0% |
| Phase 7A.2 | Authorization Abstraction | Not Started | 0% |
| Phase 7A.3 | Key Required Mode | Not Started | 0% |
| Phase 7A.4 | License Services | Not Started | 0% |
| Phase 7A.5 | License Delivery Authorization | Not Started | 0% |
| Phase 7A.6 | Dashboard & Loader UX | Not Started | 0% |
| Phase 7A.7 | Hardening & Audit | Not Started | 0% |
| Phase 8A | Event Foundation | Complete | 100% |
| Phase 8B | Secure Event Delivery | Hardened | 100% |
| Phase 8C | Queue, Worker, Dashboard Operations | Hardened | 100% |
| Phase 8D | Monitoring Foundation | Complete | 100% |
| Phase 8E | Full Analytics & Audit Dashboard | Complete | 100% |
| Phase 9 | Internal Operations & Release Workflow | Not Started | 0% |
| Phase 10 | Scale & Infrastructure (Optional) | Not Started | 0% |

## Current Phase: Phase 7A.1 Schema Foundation
> Phase 8 Event Reporting & Webhook Platform is complete, production verified, and Roblox verified. Analytics V1 is complete. Phase 7 is now the active development phase. The approved access model is `public`, `key_required`, and `license_required`; `visibility` and `access_mode` are separate concerns. Start with schema foundation only after documentation approval.

# Phase 1 — Infrastructure & Monitoring

## Infrastructure

- [x] Configure Cloudflare — **DOCUMENTED** — see `../deployment/DEPLOYMENT_CHECKLIST.md` §5
- [x] Configure DNS Records — **DOCUMENTED** — see `../deployment/DEPLOYMENT_CHECKLIST.md` §5.1
- [x] Configure SSL/TLS — **DOCUMENTED** — see `../deployment/DEPLOYMENT_CHECKLIST.md` §5.2
- [x] Configure DDoS Protection — **DOCUMENTED** — Cloudflare public traffic protection configured/documented
- [x] Configure Production Environment Variables — **EXTERNAL VERIFIED IN DEPLOYMENT** — Vercel dashboard values required for live changes

## Monitoring

- [ ] Uptime Kuma — **EXTERNAL** — see `../operations/MONITORING.md` §4 for Docker deployment
- [ ] Better Stack — **EXTERNAL** — see `../operations/MONITORING.md` §3 for account setup
- [ ] API Monitoring — **EXTERNAL** — dependent on Better Stack / Uptime Kuma
- [ ] Error Tracking — **EXTERNAL** — dependent on Better Stack Logtail
- [ ] Uptime Alerts — **EXTERNAL** — dependent on alert destinations

## Operational Documentation

- [x] Create DEPLOYMENT_CHECKLIST.md — `../deployment/DEPLOYMENT_CHECKLIST.md` (691 lines)
- [x] Create INCIDENT_RESPONSE.md — `../operations/INCIDENT_RESPONSE.md` (560 lines)
- [x] Create BACKUP_STRATEGY.md — `../archive/deployment/BACKUP_STRATEGY.md` (470 lines)
- [x] Create MONITORING.md — `../operations/MONITORING.md` (420 lines)
- [x] Create vercel.json (cron config) — `vercel.json` (daily cleanup only; 5-minute worker scheduled by GitHub Actions)

**Deployment Requirements:**

- **Development:** Vercel Hobby + GitHub Actions scheduler (`.github/workflows/event-worker.yml`)
- **Production:** GitHub Actions scheduler posts to `https://luxyhub.vercel.app/api/internal/event-worker` every 5 minutes; Vercel daily cleanup cron remains in `vercel.json`.
- Do not use `https://www.luxyhub.space/api/internal/event-worker` for GitHub Actions because Cloudflare can challenge scheduler traffic.

Success Criteria:

- [x] Architecture review complete — CDN_ARCHITECTURE.md
- [x] Schema design approved — 3 tables, 8 indexes, RLS
- [x] API design documented — 8 endpoints, visibility model
- [x] No conflicts with existing APIs — 6 current routes isolated
- [x] RLS-compatible design — deny_all pattern replicated
- [x] Audit logging plan — download tracking + PII protection

- [x] Deployment procedures documented
- [ ] Infrastructure monitored (Better Stack / Uptime Kuma / external monitoring pending)
- [ ] Alerts operational (external alert destinations pending)
- [x] Recovery procedures documented

---

# Phase 1.5 — CDN Architecture Review ✅ COMPLETE

Before implementing the CDN MVP, audit the existing architecture to ensure:

1. **No conflicts with existing APIs** — Validate, Verify-Work.ink, Generate-Key, Cleanup, Health must remain untouched
2. **Database design review** — `scripts`, `script_versions`, `script_downloads` must follow existing RLS patterns
3. **API surface review** — New endpoints must not collide with existing routes
4. **Security boundary review** — CDN is public-facing; must not leak private data
5. **Rate limiting review** — CDN endpoints need rate limiting (bandwidth protection)
6. **Middleware review** — Body size limits, CORS, security headers must apply to CDN routes
7. **Supabase storage review** — Determine if script content should be stored in `storage` buckets or inline in database
8. **Backward compatibility** — Existing Work.ink + Key system must not be disrupted

Review Artifacts to Produce:

All artifacts produced:

- [x] CDN schema design (scripts, script_versions, script_downloads)
- [x] CDN API route design (endpoints, methods, auth, rate limits)
- [x] CDN security model (public vs private vs unlisted, access control)
- [x] Storage strategy (inline PostgreSQL text)
- [x] Migration path from GitHub Raw to LuxyHub CDN


Success Criteria:

- [x] Architecture review complete — CDN_ARCHITECTURE.md
- [x] Schema design approved — 3 tables, 8 indexes, RLS
- [x] API design documented — 8 endpoints, visibility model
- [x] No conflicts with existing APIs — 6 current routes isolated
- [x] RLS-compatible design — deny_all pattern replicated
- [x] Audit logging plan — download tracking + PII protection

- Architecture review complete
- Schema design approved
- API design documented
- No conflicts with existing APIs
- RLS-compatible design
- Audit logging plan

---

# Phase 2A — CDN Database Foundation ✅ COMPLETE

## Goal

Create the database foundation for the LuxyHub CDN (Phase 2B implements the API).

## Deliverables

- [x] scripts table — metadata, slug, visibility, creator_id, current_version_id
- [x] script_versions table — immutable version history, cascade delete
- [x] script_downloads table — analytics with PII protection (hashed IP/UA)
- [x] Indexes — 8 indexes covering queries for raw, stats, listing, cleanup
- [x] RLS policies — deny_all on anon/authenticated (service role only)
- [x] FK constraint — scripts.current_version_id -> script_versions(id) ON DELETE SET NULL
- [x] UP migration — migrations/002_cdn_tables.sql
- [x] DOWN migration — migrations/002_cdn_tables_rollback.sql
- [x] Migration documentation — CDN_DATABASE.md

## Architecture Docs

- [x] CDN_ARCHITECTURE.md — full architecture review (v2, visibility model)
- [x] CDN_DATABASE.md — ER diagram, table docs, index strategy, RLS strategy, future integration

## Success Criteria

- [x] All 3 tables defined with proper constraints
- [x] RLS follows existing deny_all pattern
- [x] Migration files provide rollback path
- [x] schema.sql reflects current state
- [x] Zero code changes to existing APIs
- [x] Build + lint + typecheck pass

# Phase 2B — CDN API Implementation ✅ COMPLETE

## Goal

Implement script upload, delivery, and analytics APIs.

## Script Management

- [x] Upload Script (POST /api/scripts)
- [x] Edit Script (PATCH /api/scripts/[slug])
- [x] Delete Script (DELETE /api/scripts/[slug])
- [x] Change Visibility (POST /api/scripts/[slug]/publish)

## Script Delivery

- [x] Raw Endpoint (GET /api/scripts/[slug]/raw)
- [x] Public Scripts
- [x] Private Scripts
- [x] Unlisted Scripts
- [x] Metadata Endpoint (GET /api/scripts/[slug])
- [x] Script Directory (GET /api/scripts)

## Analytics

- [x] Download Count
- [x] Request Count
- [x] Last Access
- [x] Unique Visitors (via hashed IPs)

## API

```text
POST /api/scripts
GET  /api/scripts
GET  /api/scripts/:slug
PATCH /api/scripts/:slug
DELETE /api/scripts/:slug
POST /api/scripts/:slug/publish
GET  /api/scripts/:slug/raw
GET  /api/scripts/:slug/stats
```

Success Criteria:

- GitHub Raw no longer required
- Scripts delivered from LuxyHub infrastructure

---

# Phase 3 — Creator Dashboard ✅ COMPLETE

Domain:

```text
www.luxyhub.space/dashboard
```

## Features

- [x] Script List
- [x] Upload Script
- [x] Edit Script
- [x] Delete Script
- [x] Version History
- [x] Analytics Dashboard
- [x] Creator Profile
- [x] Session Management

Success Criteria:

- All backend APIs operational (10 dashboard endpoints)
- Creator ownership enforced (assertScriptOwner + RLS)
- Audit logging active (script CRUD + visibility changes)
- Security validated (97/100 score)
- Full self-service creator dashboard
- 14 reusable UI components
- 9 dashboard pages
- 65 unit tests passing
- Build passes clean

---

```text
Phase 3 Complete

Creator Dashboard V1 delivered.

Features:

- Authentication
- Script Management
- Analytics
- Version History
- Profile Management
- Ownership Enforcement
- Audit Logging
- Security Validation

All tests passing.
```

---

# Phase 4 — Polish & Production Readiness

## Sub-Phases

### Phase 4.1 — UI Polish
- [ ] Review all dashboard pages for visual consistency
- [ ] Add loading skeletons for slow data fetches
- [ ] Verify mobile responsiveness on all pages
- [ ] Add keyboard navigation support
- [ ] Audit color contrast and accessibility

### Phase 4.2 — Performance Review
- [ ] Audit bundle size (lighthouse / webpack analyzer)
- [ ] Optimize image loading (lazy, next/image)
- [ ] Add page-level caching where appropriate
- [ ] Review analytics query performance on large datasets

### Phase 4.3 — Documentation Review
- [ ] Review all PHASE3*_UI.md files for accuracy
- [ ] Update API_SPEC.md with all Phase 3 endpoints
- [ ] Add dashboard user guide
- [ ] Review `../../AGENTS.md` for Phase 4 conventions

### Phase 4.4 — Production Hardening
- [ ] Production two-account isolation test (from Phase 3D)
- [ ] Configure error monitoring (Better Stack / Logtail)
- [ ] Test rate limiting in production
- [ ] Verify Supabase RLS policies in production
- [ ] Configure production environment variables
- [ ] Set up Vercel deployment

---

# Phase 5 — Secure Script Delivery

## Goal

Create a protected script delivery architecture that is significantly harder to scrape, read, dump, or access directly.

## Features

- [x] Secure delivery architecture design — `../archive/architecture/SECURE_DELIVERY_ARCHITECTURE.md`
- [x] Pre-built payload build pipeline — `../archive/phase5/PHASE5B_BUILD_PIPELINE.md`
- [x] `delivery_builds` artifact storage — `migrations/006_delivery_builds.sql`
- [x] Inline encrypted payload storage — `delivery_builds.payload_ciphertext`
- [x] Build payload hashing — `source_sha256`, `payload_sha256`
- [x] Secure delivery API design — `../archive/phase5/PHASE5C_SECURE_DELIVERY_API.md`
- [x] Temporary one-time delivery tokens — `delivery_sessions`
- [x] Delivery session validation — `app/lib/services/delivery-session-service.ts`
- [x] Delivery fetch endpoint — `POST /api/delivery/fetch`
- [x] Session creation endpoint — `POST /api/delivery/session`
- [x] Payload consumer utilities — `app/lib/delivery/payload-consumer.ts`
- [x] Reference loader POC — `examples/reference-loader.ts`
- [x] Loader architecture documentation — `../archive/phase5/PHASE5D_LOADER_INTEGRATION.md`
- [x] Script encryption strategy — AES-256-GCM envelope in Phase 5B
- [x] Payload delivery architecture — build artifact + session API + consumer POC
- [x] Production loader implementation — Phase 6D
- [x] Runtime payload delivery (server-side decrypt/decompress) — Phase 6H
- [x] Executor crypto/gzip dependency removed from loader baseline
- [x] Simplified loader runtime (session → fetch → execute)
- [ ] Executor compatibility verified in real executors
- [ ] Raw endpoint cutover / secure-delivery-required flag — Phase 7 or later
- [ ] Obfuscation beyond encryption/compression — future hardening
Success Criteria:
- [x] Pre-built encrypted payload delivery supported
- [x] One-time session-gated payload retrieval works
- [x] Payload can be decrypted/decompressed by reference consumer
- [x] Secure delivery proven end-to-end in tests
- [x] Production loader can retrieve scripts securely
- [x] Runtime payload delivery works end-to-end
- [x] Executor crypto/gzip dependency removed from loader baseline
- [ ] Executor compatibility verified against real executors
- [ ] Obfuscation beyond encryption/compression — future hardening

---

# Phase 6 — Loader Integration ✅ COMPLETE

## Goal

Integrated LuxyHub delivery system with production script loaders.

## Features

- [x] Reference loader POC
- [x] Payload validation/decryption/decompression utilities
- [x] Temporary token exchange proven against Phase 5C API shape
- [x] Dashboard Lua/TXT upload workflow
- [x] Dashboard replace-file workflow using `script_versions.content`
- [x] Dashboard build status visibility from `delivery_builds`
- [x] Safe build info DTOs without ciphertext/hash exposure
- [x] Build history page
- [x] Build detail page
- [x] Creator-triggered rebuild for current version
- [x] Build status visible on version pages
- [x] Automatic build trigger on script creation
- [x] Automatic build trigger on content/version replacement
- [x] Automatic build trigger on publish/change visibility
- [x] Consistent `pending → building → ready/failed` lifecycle
- [x] Duplicate build prevention for latest compatible builds
- [x] Production loader validation flow
- [x] Production delivery authorization flow
- [x] Production session validation
- [x] Script bootstrap architecture
- [x] Dashboard action tooltips and accessible icon labels
- [x] Copy Loader action in script table, script cards, and edit page
- [x] Loader snippet card and script metadata summary card
- [x] Slug safety guidance for loader URLs
- [x] Dashboard UX polish documentation and tests
- [x] Runtime adapter contract audit
- [x] Runtime distribution strategy selected
- [x] Proof-of-execution blocker documented
- [x] Executor compatibility assumptions reviewed
- [x] Runtime packaging plan documented
- [x] Minimal real-world validation procedure documented
- [x] Delivery architecture feasibility reviewed
- [x] Loader-side crypto assumptions rejected for production baseline
- [x] Server-side decrypt runtime payload architecture recommended
- [x] Migration impact documented
- [x] Runtime payload delivery implemented
- [x] Server-side decrypt/decompress after session validation
- [x] Runtime response excludes ciphertext and source/payload hashes
- [x] Loader runtime simplified to request, fetch, execute
- [x] Runtime payload delivery documentation and tests
- [ ] Executor compatibility testing — cross-phase operational task

Success Criteria:

- [x] Reference loader can consume secure payloads
- [x] Delivery flow validated
- [x] Lua file upload works in dashboard
- [x] Build status visible in dashboard
- [x] Build history visible
- [x] Rebuild works for current version
- [x] Builds happen automatically
- [x] Manual rebuild remains available
- [x] Build lifecycle is consistent
- [x] Production loader can retrieve scripts securely
- [x] Dashboard icon actions are understandable
- [x] Loader URL is easy to discover and copy
- [x] Slug risks are clearly communicated
- [x] No delivery/security behavior changed by UX polish
- [x] Real execution path is understood
- [x] Runtime requirements are documented
- [x] Execution blocker identified
- [x] Recommended runtime architecture chosen
- [x] Loader-side crypto assumptions validated or rejected
- [x] Recommended delivery architecture is clearly documented
- [x] Runtime payload delivery works
- [x] Encrypted storage remains
- [x] Executor crypto/gzip dependency removed from loader baseline

Executor compatibility validation is a cross-phase operational task tracked separately from Phase 6 implementation.

---

# Phase 7 — Access Modes, Keys, and License Authorization

Phase 7 introduces a three-mode access model above the existing Secure Delivery architecture. The build pipeline, encryption, session lifecycle, delivery fetch, runtime execution, and event reporting remain unchanged. Authorization occurs only during `POST /api/delivery/session`.

Approved access modes:

| Access Mode | Purpose | Authorization |
|---|---|---|
| `public` | Open access | No authorization required |
| `key_required` | Monetized free access | Existing Work.ink key system |
| `license_required` | Paid/premium access | Creator-generated premium licenses with assignment limits |

`visibility` and `access_mode` are separate concerns:

| Concern | Values | Meaning |
|---|---|---|
| `visibility` | `public`, `unlisted`, `private` | Discoverability and whether the script can be publicly addressed by slug |
| `access_mode` | `public`, `key_required`, `license_required` | Delivery authorization requirement |

Existing Work.ink key endpoints remain supported and become the implementation of `access_mode = key_required`:

- `/get-key`
- `/api/generate-key`
- `/api/validate`
- `/api/verify-workink`

---

# Phase 7A.1 — Schema Foundation

## Goal

Introduce the schema foundation for access modes, Work.ink-backed key-required delivery, and premium licenses. Existing scripts default to `public` access mode so current delivery behavior remains unchanged.

## Features

- [ ] `scripts.access_mode` column (`public` | `key_required` | `license_required`, default `public`)
- [ ] `licenses` table with required fields: id, script_id, creator_id, key_hash, max_assignments, status, activation_count, delivery_count, last_activation_at, last_delivery_at, expires_at, created_at, updated_at
- [ ] `license_assignments` table with required fields: id, license_id, customer_identifier_hash, display_name, status, created_at, updated_at
- [ ] License status constraint: `active`, `disabled`, `revoked`
- [ ] Nullable `licenses.expires_at`; `NULL` means permanent, non-null means time-limited
- [ ] Constraints and indexes for key hash lookup, creator ownership, script lookup, assignment lookup, and active assignment counting
- [ ] RLS policies for creator-owned licenses and assignments

## Success Criteria

- [ ] Existing scripts continue working without keys (`public` access mode default)
- [ ] `visibility` remains independent from `access_mode`
- [ ] License schema supports permanent and time-limited licenses without an `expired` status
- [ ] License assignments enforce by hash and avoid raw customer identifier storage where possible
- [ ] Ownership enforced via existing `creator_id` pattern

---

# Phase 7A.2 — Authorization Abstraction

## Goal

Introduce a single delivery authorization abstraction without changing runtime behavior.

## Features

- [ ] `authorizeDeliveryAccess()` design and tests
- [ ] Session creation request contract supports `key`, `license_key`, and `customer_identifier`
- [ ] `public` mode branch allows current session creation path
- [ ] `key_required` mode branch delegates to existing key validation service
- [ ] `license_required` mode branch delegates to license authorization service
- [ ] No authorization logic added to delivery fetch, payload delivery, runtime execution, or event reporting

## Success Criteria

- [ ] Current `public` behavior is unchanged
- [ ] Authorization boundary is explicitly limited to `POST /api/delivery/session`
- [ ] Tests cover missing/extra credentials for all three modes

---

# Phase 7A.3 — Key Required Mode

## Goal

Integrate the existing Work.ink key system as the implementation of `access_mode = key_required`.

## Planned Flow

```text
Loader
  |
  | key = "LUXY-XXXX-XXXX"            (obtained through existing Work.ink flow)
  |
  | POST /api/delivery/session { slug, key }
  v
Existing Key Validation                  (NEW SESSION GATE)
  |
  | validate using current key service
  | verify script.access_mode = key_required
  v
Create Session                          (unchanged)
```

## Features

- [ ] Preserve `/get-key`
- [ ] Preserve `/api/generate-key`
- [ ] Preserve `/api/validate`
- [ ] Preserve `/api/verify-workink`
- [ ] Require valid existing key before session creation for `key_required` scripts
- [ ] Keep Work.ink token replay protection through `used_workink_tokens`

## Success Criteria

- [ ] Existing Work.ink behavior remains supported
- [ ] Existing key validation remains compatible
- [ ] `key_required` scripts require a valid key before receiving a delivery session
- [ ] `public` scripts remain keyless

---

# Phase 7A.4 — License Services

## Goal

Implement premium license lifecycle services for creator-generated licenses and assignment management.

## Features

- [ ] Generate license keys and store only `key_hash`
- [ ] Create, disable, revoke, and update licenses
- [ ] Assignment management using `customer_identifier_hash`
- [ ] Optional `display_name` for creator-facing assignment labels
- [ ] Permanent licenses where `expires_at = NULL`
- [ ] Time-limited licenses where `expires_at != NULL`
- [ ] Device/customer limit presets: 1, 3, 5, custom

## Success Criteria

- [ ] Raw premium license keys are never stored
- [ ] Disabled/revoked/expired licenses cannot authorize new delivery sessions
- [ ] Assignment management follows owner-scoped script ownership
- [ ] Generic identifiers support `roblox_user:*`, `hwid:*`, and `custom:*` formats

---

# Phase 7A.5 — License Delivery Authorization

## Goal

Enforce `access_mode = license_required` during delivery session creation.

## Features

- [ ] Require `license_key` and `customer_identifier` on `POST /api/delivery/session`
- [ ] Validate license hash, script ownership, status, and `expires_at`
- [ ] Existing active assignment allows delivery
- [ ] New assignment checks `max_assignments` and creates assignment if capacity remains
- [ ] Assignment creation and limit checks are atomic
- [ ] Increment `activation_count` only on new assignment
- [ ] Increment `delivery_count` on successful license-authorized session creation
- [ ] Update `last_activation_at` and `last_delivery_at` according to license activity

## Success Criteria

- [ ] Licensed scripts require valid active non-expired license plus valid assignment
- [ ] Device/customer limits are enforced consistently
- [ ] Delivery fetch, payload delivery, runtime execution, and event reporting remain unchanged
- [ ] Revoked/disabled licenses and assignments lose access immediately except for already-issued short-lived sessions

---

# Phase 7A.6 — Dashboard & Loader UX

## Goal

Expose access mode and license workflows to creators and support loader behavior for all three modes.

## Features

- [ ] Access mode selector: `public`, `key_required`, `license_required`
- [ ] License management UI: create, disable, revoke, update, view status
- [ ] Assignment/device management UI: view, revoke/disable, reset, display names
- [ ] Loader support for public delivery
- [ ] Loader support for Work.ink key-required delivery
- [ ] Loader support for premium license-required delivery
- [ ] Clear UX copy explaining that `visibility` and `access_mode` are separate

## Example Loader Snippet

```lua
getgenv().luxy_key = "LUXY-XXXX-XXXX"
getgenv().luxy_license_key = "LUXY-LIC-XXXX-XXXX-XXXX-XXXX"
getgenv().luxy_customer_identifier = "roblox_user:123456"

loadstring(game:HttpGet(
    "https://www.luxyhub.space/api/loader/luxy"
))()
```

## Success Criteria

- [ ] Copy workflows reduce creator friction
- [ ] Loader examples reflect the selected access mode
- [ ] License and assignment status visible at a glance
- [ ] Customer/device assignment workflow intuitive

---

# Phase 7A.7 — Hardening & Audit

## Goal

Make authorization activity observable, auditable, and safe to operate.

## Features

- [ ] Audit events: `license.created`, `license.updated`, `license.disabled`, `license.revoked`, `license.assignment_created`, `license.assignment_disabled`, `license.assignment_revoked`, `script.access_mode_changed`
- [ ] Authorization monitoring for invalid keys, invalid licenses, exhausted assignment limits, and repeated failures
- [ ] Analytics integration for license activations and delivery counts
- [ ] Rate-limit review for key/license attempts through delivery session creation
- [ ] Security review for raw credential logging and customer identifier privacy

## Success Criteria

- [ ] Audit trail covers access mode and license lifecycle changes
- [ ] Failed authorization attempts are observable without leaking raw credentials
- [ ] Analytics V1 execution counts remain stable
- [ ] Phase 7 does not introduce authorization logic outside session creation
---

# Phase 8 — Event Reporting & Webhook Platform

Phase 8 allows Roblox scripts to securely report events through LuxyHub without exposing provider credentials in Lua source code. The completed production scope is Discord-backed event delivery; Telegram and Slack providers are deferred future enhancements and accepted risks, not Phase 8 blockers.

## Deployment Requirements

Development:

- [x] Vercel Hobby-compatible deployment
- [x] GitHub Actions scheduler invokes `/api/internal/event-worker` every 5 minutes
- [x] Vercel daily cron remains for `/api/cleanup`

Production:

- [x] GitHub Actions scheduler invokes `https://luxyhub.vercel.app/api/internal/event-worker` every 5 minutes
- [x] `/api/internal/event-worker` runs `processEventQueue()` followed by `checkAlerts()`
- [x] `/api/internal/check-alerts` route retained for manual/debug/future use
- [x] Dedicated check-alerts cron not required because event worker runs `checkAlerts()` after `processEventQueue()`

## Deferred Features / Future Enhancements / Accepted Risks

- Telegram provider implementation
- Slack provider implementation
- Discord webhook URL encryption at rest
- Atomic nonce uniqueness enforcement
- Durable audit event stream for webhook lifecycle and replay operations

---

# Phase 8A — Event Foundation
## Goal

Introduce event data model, webhook configuration storage, and allowed event registry.

## Features
- [x] `webhook_config` table — per-script provider configuration (script_id, provider, config, enabled)
- [x] `event_logs` table — event storage with delivery tracking (script_id, session_id, event_type, nonce, payload, delivery_status, retry_count)
- [x] Event schema: `sessionId`, `event`, `timestamp`, `nonce`, `signature`, `payload`
- [x] Allowed event registry — `execute`, `purchase`, `error`, `ban`, `key_redeem`, `heartbeat`, `license_activate`, `license_revoke`
- [x] Unknown event types return 422
- [x] Event repository and service layers
- [x] RLS policies for webhook_config (owner-aware) and event_logs (service-role only)

## Success Criteria

- [x] Provider credentials stored server-side only — never in Lua scripts
- [x] Event types strictly allowlisted
- [x] RLS enforces owner isolation on webhook configs
---

# Phase 8B — Secure Event Delivery

## Goal

Validate, authenticate, and protect every event report before queueing.

## Features

- [x] Session validation — reuse existing delivery session infrastructure
- [x] HMAC-SHA256 event signatures computed from per-session event secret
- [x] Signature validation server-side before storage
- [x] Nonce validation — unique within session TTL window (replay protection)
- [x] Timestamp validation — ±300s from server time
- [x] Rate limiting per event session
- [x] Uniform error responses (no oracle for auth failures)
- [x] 200 success after storage — never blocks on provider delivery

## Success Criteria

- [x] Replayed events rejected after nonce storage lookup
- [x] Tampered events rejected (signature mismatch)
- [x] Expired sessions denied
- [x] Rate limits reduce webhook flooding per valid event session
- [x] Provider outages do not cause event reporting API 5xx responses

---

# Phase 8C — Queue & Worker System

## Goal

Reliably deliver stored events to provider webhooks with retry and dead-letter handling.

## Features

- [x] Database-backed queue (`event_logs.delivery_status = 'pending'`)
- [x] Worker polling loop (GitHub Actions scheduler on Vercel Hobby; Vercel Pro cron optional)
- [x] Queue claim lease (`event_logs.claimed_at`) prevents overlapping workers processing the same event concurrently
- [x] Exponential backoff retry: 10s, 30s, 90s, 270s, 810s
- [x] Max 5 retries before dead-letter
- [x] Dead-letter handling — mark, log error, visible in dashboard for manual replay
- [x] Provider abstraction layer — Discord adapter implemented
- [x] Discord provider: Discord webhook embed formatting
- [ ] Telegram provider: bot token + chat ID message delivery
- [ ] Slack provider: Slack incoming webhook formatting

## Success Criteria

- [x] Events survive process restarts (DB-backed, not in-memory)
- [x] Discord outage does not block API / return 5xx
- [x] Events not lost — retried until success or dead-letter
- [x] Dead-letter events visible and replayable from dashboard

---

# Phase 8D — Dashboard Management

## Goal

Creator-facing webhook configuration and event visibility.

## Features

- [x] Configure Discord webhook provider per script
- [x] Enable/disable webhook toggle
- [x] Test Webhook button — sends isolated test event to verify connectivity
- [x] View delivery status via event operations pages
- [x] Event history table with filters (event type, status, pagination)
- [x] Event detail view (payload, delivery metadata, error messages)
- [x] Dead-letter queue with manual replay button

## Success Criteria

- [x] Creators can configure and test Discord webhooks from dashboard
- [x] Delivery status visible through event operations views
- [x] Failed deliveries diagnosable from dashboard

---

# Phase 8E — Analytics & Audit

## Goal


- [x] Event counts by type (per script, time range)
- [x] Delivery success rate (%)
- [x] Failure counts and rate
- [x] Queue health metrics foundation (`pendingCount`, `deadLetterCount`, `oldestPendingAgeSeconds`)
- [ ] Average delivery latency (received_at → delivered_at)
- [ ] Audit events: `webhook.created`, `webhook.updated`, `webhook.deleted`, `webhook.test_sent`
- [x] Security counters: invalid signatures, replay attempts, rate-limit violations, auth failures
- [x] Webhook counters: delivery success, retryable failure, provider failure
- [x] Security monitoring dashboard: risk classification, anomaly detection, security events table
- [x] Internal alert system: threshold evaluation, auto-resolution, Discord notifications, admin dashboard
- [x] GitHub Actions scheduler for Vercel Hobby-compatible 5-minute worker cadence
---

# Phase 9 — Internal Operations & Release Workflow

## Goal

Manage script lifecycle.

## Features

- [ ] Draft releases
- [ ] Published releases
- [ ] Archived releases
- [ ] Release notes
- [ ] Internal moderation tools
- [ ] Operational audit review

Success Criteria:

- Script release workflow operational
- Internal management tools available

---

# Phase 10 — Scale & Infrastructure (Optional)

## Goal

Prepare for future growth only if required.

## Features

- [ ] Monitoring stack
- [ ] Better Stack integration
- [ ] Uptime Kuma
- [ ] Redis caching
- [ ] app.luxyhub.space migration
- [ ] Infrastructure scaling

Success Criteria:

- Platform scalable when needed

---

# Deferred Ideas (Not Planned)

The following features are deferred indefinitely. They are not part of the current roadmap. LuxyHub is currently an internal platform for LuxyHub operations and script distribution. It is not intended to become a large creator marketplace.

- Creator Marketplace
- Paid Scripts
- Subscription Plans
- Revenue Tracking
- Creator Earnings
- Team Collaboration
- Organizations
- API Tokens
- Public Creator Economy

---

# Platform Architecture

## Current Implementation
```text
www.luxyhub.space
├── /
├── /login
├── /get-key
├── /verify-token
├── /docs/api
├── /dashboard
├── /dashboard/scripts
├── /dashboard/scripts/new
├── /dashboard/scripts/[slug]/edit
├── /dashboard/scripts/[slug]/builds
├── /dashboard/scripts/[slug]/builds/[buildId]
├── /dashboard/analytics
├── /dashboard/versions
├── /dashboard/versions/[slug]
├── /dashboard/versions/[slug]/[versionId]
├── /dashboard/profile
├── /api/loader/[slug]
├── /api/delivery/session
├── /api/delivery/fetch
└── /api/*
```

## Public Platform

```text
www.luxyhub.space
```

Purpose:

- Landing Page
- Script Directory
- Public Documentation
- API Documentation
- Blog / Updates
- Public Content

---

## Authentication

Authentication is integrated into the main application at:

```text
www.luxyhub.space/login
```

Purpose:

- Login
- Registration (future)
- Password Reset (future)
- Session Management
- OAuth (future)

---

## Creator Dashboard

Dashboard is served within the main application at:

```text
www.luxyhub.space/dashboard
```

Purpose:

- Script Management
- Analytics
- Version Control
- Secure Script Delivery
- Loader Integration
- Key Management (future)
- Creator Tools

---

## API Services

API routes are served from the same Next.js application:

```text
www.luxyhub.space/api/*
```

Purpose:

- Key Validation API
- CDN API
- Dashboard API

---

## Script CDN

Script delivery is served from the same Next.js application:

```text
www.luxyhub.space/api/scripts/[slug]/raw
```

---

## Future Consideration

```text
app.luxyhub.space
```

Only after operational requirements justify separation. Not required for current operations.

---

# Recommended Tech Stack

Frontend

```text
Next.js
Tailwind CSS
Shadcn UI
```

Backend

```text
Next.js API Routes
TypeScript
```

Database

```text
PostgreSQL
Supabase
```

Infrastructure

```text
Vercel
Cloudflare
Supabase
```

Monitoring

```text
Uptime Kuma
Better Stack
Grafana
```

---

# Immediate Priority

Current Sprint:

```text
1. Phase 7A.1 — Schema Foundation (scripts.access_mode, licenses, license_assignments)
2. Phase 7A.2 — Authorization Abstraction (authorizeDeliveryAccess())
```

Next Sprint:

```text
1. Phase 7A.3 — Key Required Mode (existing Work.ink integration)
2. Phase 7A.4 — License Services (generate, revoke, assignment management)
```

Following:

```text
1. Phase 7A.5 — License Delivery Authorization
2. Phase 7A.6 — Dashboard & Loader UX
3. Phase 7A.7 — Hardening & Audit
```

Future:

```text
1. Phase 9 — Internal Operations & Release Workflow
2. Phase 10 — Scale & Infrastructure (Optional)
```

Long-Term Goal:

Build LuxyHub into a complete internal platform for LuxyHub operations, script distribution, Work.ink-backed free monetized access, premium license management, event reporting, and customer/device access management.
