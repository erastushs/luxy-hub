# LuxyHub Roadmap 2026

Last updated: 2026-06-24

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
| 123 | **Database** | Phase 7A.1 Schema Foundation | `scripts.access_mode`, `licenses`, `license_assignments` |
| 124 | **Code** | Phase 7A.2 Access Authorization Layer | delivery-session authorization abstraction |
| 125 | **Code** | Phase 7A.3 Key Validation Integration | existing Work.ink key validation connected to access modes |
| 126 | **Code** | Phase 7A.4 License Lifecycle Management | create, enable, disable, revoke license workflows |
| 127 | **Code** | Phase 7A.4.5 Assignment System | create/remove assignment workflows |
| 128 | **Code** | Phase 7A.5 Runtime License Validation Foundation | license validation foundation at session boundary |
| 129 | **UI** | Phase 7A.6 License Dashboard UI | `/dashboard/licenses` management screen |
| 130 | **UI** | Phase 7A.7 License Analytics UI | `/dashboard/licenses/analytics` analytics screen |
| 131 | **UI** | Phase 7A.8 License UX Polish | search, filters, sorting, selection, dialogs, responsive states |
| 132 | **UI** | Phase 7A.9 UI Remediation | breadcrumbs, race guards, loading/error remediation, naming consistency |
| 133 | **Code** | Phase 7B Backend Key Monetization Infrastructure | provider foundation, premium keys, access modes, key management refinement, key type alignment, device limits |
| 134 | **Performance** | Phase 7C Production Runtime Performance Optimizations | delivery build metadata projection, optimized event write projections, cleanup batching, safe expired session pruning |
| 135 | **Infrastructure** | Phase 7D Valkey Shadow Runtime Baseline | PostgreSQL authoritative, Valkey shadow comparison, rollback to PostgreSQL |
| 136 | **Operations** | Phase 7E.1 Production Verification | `RATE_LIMIT_MODE=shadow`, healthy runtime, 100% parity, zero backend/comparison failures, Cloudflare client IP verification |
---


### Active 🔄

| # | Program | Task | Purpose |
|---|---------|------|---------|
| 1 | Phase 7E.2 | Operational Rollout | Prepare separately approved Valkey canary rollout from 1% to 100% |
| 2 | Production Operations | Monitor shadow runtime metrics | Maintain healthy status, 100% parity, backend failures 0, comparison failures 0, and mismatch rate 0 before canary |
| 3 | Production Operations | Review Cloudflare IP attribution | Confirm rate limits, analytics, abuse detection, and audit logs use real client IPs |
| 4 | Production Operations | Review event worker stability | Confirm event queue, worker, alerts, and Discord delivery remain stable |
| 5 | Production Operations | Review build and delivery stability | Monitor build pipeline, secure delivery success rates, and runtime errors |

### Pending ❌

| # | Phase | Task | Depends On |
|---|-------|------|------------|
| 1 | Phase 7E.2 | Operational Rollout: 1% -> 5% -> 10% -> 25% -> 50% -> 100% | Phase 7E.1 production verification |
| 2 | Valkey | Valkey authoritative runtime | Successful Phase 7E.2 canary progression and approval |
| 3 | PostgreSQL | PostgreSQL rate-limit retirement | Valkey authoritative runtime accepted in production |
| 4 | Analytics V2 | Analytics V2 | Production Operations |
| 5 | QA | QA & Test Coverage Expansion | Analytics V2 |
| 6 | Operations | Operational Hardening | QA & Test Coverage Expansion |
| 7 | Security | Security Review | Operational Hardening |
| 8 | Security | Final Security Audit | Phase 7B backend and Phase 7E rollout closeout |
| 9 | Release | Release Candidate | Final Security Audit |
| 10 | Release | V1 Release | Release Candidate |

### Deferred / Sequenced Work

| # | Phase | Task | Reason |
|---|-------|------|--------|
| 1 | Runtime UX | Roblox popup key validation | Runtime loader still does not call `POST /api/validate`; keep planned until loader execution gating is implemented |
| 2 | Key Analytics | Validation event analytics | Depends on runtime validation UX or explicit server-side validation event instrumentation |
| 3 | Key Operations | Device analytics and reset tooling | Depends on validation event foundation |
| 4 | Provider Expansion | Linkvertise and LootLabs | Future provider expansion after current provider/key flow is stable |
| 5 | Premium License Work | License hardening and runtime enforcement | Deferred; not Phase 7C and not completed |
| 6 | Observability | Grafana, Prometheus, Alertmanager, historical parity | Future external observability stack after current internal health and parity metrics |
| 7 | Resilience | Circuit breaker and automatic rollback | Future automation after canary behavior is proven manually |
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
Access Modes & Keys:    100% complete ████████████████████
Event Platform:        100% complete ████████████████████
Runtime Performance:   100% complete ████████████████████
Scale Runtime Baseline: 100% complete ████████████████████
Operational Rollout:     0% complete ░░░░░░░░░░░░░░░░░░░░
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
| Phase 7A.1 | Schema Foundation | Complete / Production Ready | 100% |
| Phase 7A.2 | Access Authorization Layer | Complete / Production Ready | 100% |
| Phase 7A.3 | Key Validation Integration | Complete / Production Ready | 100% |
| Phase 7A.4 | License Lifecycle Management | Complete / Production Ready | 100% |
| Phase 7A.4.5 | Assignment System | Complete / Production Ready | 100% |
| Phase 7A.5 | Runtime License Validation Foundation | Complete / Production Ready | 100% |
| Phase 7A.6 | License Dashboard UI | Complete / Production Ready | 100% |
| Phase 7A.7 | License Analytics UI | Complete / Production Ready | 100% |
| Phase 7A.8 | License UX Polish | Complete / Production Ready | 100% |
| Phase 7A.9 | UI Remediation | Complete / Production Ready | 100% |
| Production Stabilization | Observation and Stabilization Window | Active | 0% |
| Phase 7B | Key Monetization Backend Platform | Complete | 100% |
| Runtime UX | Roblox Popup Key Validation | Planned / Not Implemented | 0% |
| Phase 7C | Production Runtime Performance | Complete | 100% |
| Phase 7D | Database Scalability & Runtime Optimization | Engineering Complete / Production Baseline | 100% |
| Phase 7E.1 | Operational Health and Canary Infrastructure | Production Verified ✅ | 100% |
| Phase 7E.2 | Operational Rollout | Planned | 0% |
| Phase 8A | Event Foundation | Complete | 100% |
| Phase 8B | Secure Event Delivery | Hardened | 100% |
| Phase 8C | Queue, Worker, Dashboard Operations | Hardened | 100% |
| Phase 8D | Monitoring Foundation | Complete | 100% |
| Phase 8E | Full Analytics & Audit Dashboard | Complete | 100% |
| Phase 9 | Internal Operations & Release Workflow | Deferred / Superseded | 0% |
| Phase 10 | Scale & Infrastructure (Optional) | Superseded by Phase 7D/7E | 0% |

## Current Focus: Phase 7E.2 Operational Rollout
> Phase 1-6 are complete. Phase 7A, Phase 7B backend key monetization infrastructure, Phase 7C production runtime performance optimization, Phase 7D engineering, and Phase 7E.1 production verification are complete. Current runtime is `RATE_LIMIT_MODE=shadow`; PostgreSQL is authoritative; Valkey is shadow; health is healthy; parity is 100%; canary is disabled. Runtime API behavior is preserved. Roblox runtime popup validation against `POST /api/validate` is still planned because the current loader runtime does not yet gate execution through `/api/validate`. Premium license hardening remains deferred future work and is not part of completed Phase 7C.

### Phase 7E.1 Production State

Status: PRODUCTION VERIFIED ✅

Verified state:

- PostgreSQL authoritative.
- Valkey shadow.
- `RATE_LIMIT_MODE=shadow`.
- Canary disabled.
- Rollback: immediate PostgreSQL via `RATE_LIMIT_MODE=postgres`.
- Health: healthy.
- Backend failures: 0.
- Comparison failures: 0.
- Parity: 100%.
- Mismatch rate: 0.
- Valkey healthy.
- PostgreSQL healthy.
- Cloudflare client IP resolution verified.
- Production HTTP 429 verified after exceeding the configured request limit.

Completed production validation:

- Sequential rate-limit testing.
- Parallel rate-limit testing.
- High-concurrency testing.
- Shadow comparison verification.
- Health endpoint verification.
- PostgreSQL authoritative verification.
- Valkey shadow verification.
- Runtime health verification.
- Cloudflare deployment verification.
- Client IP resolution verification.

### Next Phase

Phase 7E.2 Operational Rollout:

1. 1%
2. 5%
3. 10%
4. 25%
5. 50%
6. 100%

### Future Phase Order

1. Phase 7E.2 — Operational Rollout: 1% -> 5% -> 10% -> 25% -> 50% -> 100%
2. Valkey authoritative runtime
3. PostgreSQL rate-limit retirement
4. Analytics V2
5. QA & Test Coverage Expansion
6. Operational Hardening
7. Security Review
8. Final Security Audit
9. Release Candidate
10. V1 Release

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
- [x] Review all dashboard pages for visual consistency
- [x] Add loading skeletons for slow data fetches
- [x] Verify mobile responsiveness on all pages
- [x] Add keyboard navigation support
- [x] Audit color contrast and accessibility

### Phase 4.2 — Performance Review
- [x] Audit bundle size (lighthouse / webpack analyzer)
- [x] Optimize image loading (lazy, next/image)
- [x] Add page-level caching where appropriate
- [x] Review analytics query performance on large datasets

### Phase 4.3 — Documentation Review
- [x] Review all PHASE3*_UI.md files for accuracy
- [x] Update API_SPEC.md with all Phase 3 endpoints
- [x] Add dashboard user guide
- [x] Review `../../AGENTS.md` for Phase 4 conventions

### Phase 4.4 — Production Hardening
- [x] Production two-account isolation test (from Phase 3D)
- [x] Configure error monitoring guidance (Better Stack / Logtail remains optional external integration)
- [x] Test rate limiting behavior in implemented routes
- [x] Verify Supabase RLS policy definitions for production deployment
- [x] Configure production environment variable checklist
- [x] Set up Vercel deployment guidance

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

Status: Phase 7A complete / production ready. Phase 7B backend key monetization infrastructure is complete. Phase 7C production runtime performance optimization is complete. Production Stabilization is active. Premium license hardening is deferred future license work.

Phase 7 introduced a three-mode access model above the existing Secure Delivery architecture and later optimized production runtime database usage. The build pipeline, encryption, delivery fetch response shape, runtime execution response shape, and event reporting API behavior remain unchanged by Phase 7C optimization work. Access-mode authorization still occurs during `POST /api/delivery/session`; the separate planned runtime popup validation work uses `POST /api/validate` before script execution.

Approved access modes:

| Access Mode | Purpose | Authorization |
|---|---|---|
| `public` | Open access | No authorization required |
| `key_required` | Monetized free access | Existing Work.ink key system |
| `license_required` | Paid/premium access | Creator-generated premium licenses with assignment limits; future license hardening deferred |

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

# Phase 7A.1 — Schema Foundation ✅ COMPLETE

## Goal

Introduce the schema foundation for access modes, Work.ink-backed key-required delivery, and premium licenses. Existing scripts default to `public` access mode so current delivery behavior remains unchanged.

## Features

- [x] `scripts.access_mode` column (`public` | `key_required` | `license_required`, default `public`)
- [x] `licenses` table with required fields: id, script_id, creator_id, key_hash, max_assignments, status, activation_count, delivery_count, last_activation_at, last_delivery_at, expires_at, created_at, updated_at
- [x] `license_assignments` table with required fields: id, license_id, customer_identifier_hash, display_name, status, created_at, updated_at
- [x] License status constraint: `active`, `disabled`, `revoked`
- [x] Nullable `licenses.expires_at`; `NULL` means permanent, non-null means time-limited
- [x] Constraints and indexes for key hash lookup, creator ownership, script lookup, assignment lookup, and active assignment counting foundation
- [x] RLS policies for creator-owned licenses and assignments

## Success Criteria

- [x] Existing scripts continue working without keys (`public` access mode default)
- [x] `visibility` remains independent from `access_mode`
- [x] License schema supports permanent and time-limited licenses without an `expired` status
- [x] License assignments enforce by hash and avoid raw customer identifier storage where possible
- [x] Ownership enforced via existing `creator_id` pattern

---

# Phase 7A.2 — Access Authorization Layer ✅ COMPLETE

## Goal

Introduce a single delivery authorization abstraction without changing runtime behavior.

## Features

- [x] `authorizeDeliveryAccess()` design and tests
- [x] Session creation request contract foundation supports credentials for access modes
- [x] `public` mode branch allows current session creation path
- [x] `key_required` mode branch delegates to existing key validation service
- [x] `license_required` mode branch delegates to license authorization service
- [x] No authorization logic added to delivery fetch, payload delivery, runtime execution, or event reporting

## Success Criteria

- [x] Current `public` behavior is unchanged
- [x] Authorization boundary is explicitly limited to `POST /api/delivery/session`
- [x] Tests cover access-mode branches at the implemented foundation level

---

# Phase 7A.3 — Key Validation Integration ✅ COMPLETE

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

- [x] Preserve `/get-key`
- [x] Preserve `/api/generate-key`
- [x] Preserve `/api/validate`
- [x] Preserve `/api/verify-workink`
- [x] Integrate existing key validation service for `key_required` access mode foundation
- [x] Keep Work.ink token replay protection through `used_workink_tokens`

## Success Criteria

- [x] Existing Work.ink behavior remains supported
- [x] Existing key validation remains compatible
- [x] `key_required` authorization branch uses existing key validation
- [x] `public` scripts remain keyless

---

# Phase 7A.4 — License Lifecycle Management ✅ COMPLETE

## Goal

Implement premium license lifecycle services for creator-generated licenses and assignment management.

## Features

- [x] Generate license keys and store only `key_hash`
- [x] Create, enable, disable, and revoke licenses
- [x] Assignment management using `customer_identifier_hash`
- [x] Optional `display_name` for creator-facing assignment labels
- [x] Permanent licenses where `expires_at = NULL`
- [x] Time-limited licenses where `expires_at != NULL`
- [x] Configurable `max_assignments` field foundation

## Success Criteria

- [x] Raw premium license keys are never stored
- [x] Disabled/revoked/expired license validation foundation implemented
- [x] Assignment management follows owner-scoped script ownership
- [x] Generic customer identifier storage foundation implemented through hashing

---

# Phase 7A.4.5 — Assignment System ✅ COMPLETE

## Goal

Provide creator-facing assignment create/remove workflows using existing license data.

## Features

- [x] Create assignments for owned licenses
- [x] Remove assignments from owned licenses
- [x] List assignments for owned licenses
- [x] Store assignment display names for dashboard identification
- [x] Keep raw customer identifiers out of dashboard lists

## Success Criteria

- [x] Assignment operations are owner-scoped
- [x] Dashboard can inspect assignments per license
- [x] Assignment removal updates the visible dashboard state

---

# Phase 7A.5 — Runtime License Validation Foundation ✅ COMPLETE

## Goal

Enforce `access_mode = license_required` during delivery session creation.

## Features

- [x] Validate license hash, script ownership, status, and `expires_at` foundation
- [x] Existing assignment allows license validation foundation
- [x] New assignment creation foundation exists
- [x] Delivery fetch, payload delivery, runtime execution, and event reporting remain unchanged
- [ ] Atomic assignment capacity enforcement — deferred future license work
- [ ] Strict `customer_identifier` handling — deferred future license work
- [ ] License counters and runtime audit trail — deferred future license work

## Success Criteria

- [x] License validation foundation checks active non-expired licenses
- [x] Delivery fetch, payload delivery, runtime execution, and event reporting remain unchanged
- [ ] Device/customer limits are enforced consistently — deferred future license work
- [ ] Disabled/revoked assignment runtime enforcement — deferred future license work

---

# Phase 7A.6 — License Dashboard UI ✅ COMPLETE

## Goal

Expose access mode and license workflows to creators and support loader behavior for all three modes.

## Features

- [x] License management UI: create, enable, disable, revoke, view status
- [x] Assignment management UI: view, create, remove, display names
- [x] Raw license key one-time display UX
- [x] Operational notes for license/key privacy
- [x] Existing APIs consumed only; no production delivery behavior changed

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

- [x] Copy workflows reduce creator friction
- [x] License and assignment status visible at a glance
- [x] Customer/device assignment workflow intuitive for implemented create/remove scope

---

# Phase 7A.7 — License Analytics UI ✅ COMPLETE

## Goal

Provide read-only dashboard analytics over existing license and assignment data.

## Features

- [x] Total Licenses card
- [x] Active Licenses card
- [x] Disabled Licenses card
- [x] Revoked Licenses card
- [x] License status distribution
- [x] Recent license activity table
- [x] Recent assignments table
- [x] Script scope filtering and refresh behavior

## Success Criteria

- [x] License analytics UI is read-only
- [x] Existing APIs only
- [x] Analytics V1 execution counts remain stable
- [x] No authorization logic introduced outside session creation

---

# Phase 7A.8 — License UX Polish ✅ COMPLETE

## Goal

Improve usability of the License Management dashboard without backend/API changes.

## Features

- [x] Advanced search
- [x] Status filters
- [x] Assignment filters
- [x] Sort controls
- [x] Bulk selection UI
- [x] Bulk action confirmation dialogs using existing single-license operations
- [x] Improved loading states
- [x] Improved empty states
- [x] Responsive dashboard controls

## Success Criteria

- [x] Existing endpoints only
- [x] No backend modifications
- [x] No delivery/runtime modifications

---

# Phase 7A.9 — UI Remediation ✅ COMPLETE

## Goal

Resolve remaining UI-only audit findings before closing Phase 7A.

## Features

- [x] License breadcrumbs
- [x] Visible-only bulk selection targeting
- [x] Changed/skipped bulk action feedback
- [x] License list race protection
- [x] Create-license race protection
- [x] Assignment metadata loading state
- [x] Assignment metadata error handling
- [x] Analytics initial loading skeletons
- [x] Analytics refresh race protection
- [x] No-scripts Create Script CTA
- [x] Mobile identifier wrapping
- [x] License Analytics naming consistency

## Success Criteria

- [x] All 14 Phase 7A.9 UI remediation items resolved
- [x] `npm run lint` passes with no new errors
- [x] `npm run build` passes
- [x] No backend, authorization, runtime, delivery, schema, repository, service, API route, or migration changes

---

# Phase 7B — Key Monetization Backend Platform

Status: Complete for backend monetization infrastructure

Runtime UI note: Roblox runtime popup validation is not integrated and remains planned runtime UX work outside the completed backend scope.

Implementation: Backend monetization infrastructure is complete. Device Limits, Premium Keys, and Free Keys are enforced through `POST /api/validate`. Runtime loader execution is not yet gated by popup validation, and delivered payloads currently execute directly.

Design: Refined

Threat Model: Refined

Documentation: Refined

Design documents:

- `../phases/phase7/PHASE_7B_DESIGN.md`
- `../phases/phase7/PHASE_7B_THREAT_MODEL.md`
- `../phases/phase7/PHASE7_KEY_MONETIZATION_MODEL.md`
- `PHASE7_ROADMAP_REALIGNMENT_REPORT.md`

## Objectives

- Connect Roblox runtime to the completed backend key platform.
- Add a runtime popup UI that supports Free Keys, Premium Keys, and Future Providers.
- Request key input, show validation status, show validation errors, and block execution until validation succeeds.
- Call `POST /api/validate` with `key`, `executor_identifier`, and `client_identifier`.
- Require `validation_success == true` before Main Script execution.
- Keep Device Limits enforced exclusively through `POST /api/validate`.
- Keep Premium Keys enforced through `POST /api/validate`.
- Preserve Delivery Session Architecture, Delivery Fetch Architecture, Runtime Payload Delivery, Event Platform, Analytics Pipeline, and Build System.

## Deliverables

- [x] Provider Foundation
- [x] Premium Key Infrastructure
- [x] Access Mode Support
- [x] Provider Hardening
- [x] Dashboard UX Refinement
- [x] Key Management Refinement
- [x] Key Type Alignment
- [x] Device Limits V1
- [x] Custom Device Limits
- [ ] Planned Runtime UX: Runtime popup UI for Free Keys, Premium Keys, and Future Providers
- [ ] Planned Runtime UX: Runtime `POST /api/validate` call with `key`, `executor_identifier`, and `client_identifier`
- [ ] Planned Runtime UX: Execution gate requiring `validation_success == true`
- [ ] Planned Key Analytics: validation foundation events such as `KEY_VALIDATED`, `KEY_VALIDATION_FAILED`, `DEVICE_REGISTERED`, `DEVICE_REUSED`, `DEVICE_LIMIT_DENIED`
- [ ] Planned Key Operations: Device Analytics Dashboard
- [ ] Planned Key Operations: Manual Device Reset
- [ ] Planned Provider Expansion: Linkvertise and LootLabs Provider Expansion
- [ ] Planned Key Analytics: Unified Monetization Analytics

## Success Criteria

- [ ] Runtime popup requests key input.
- [ ] Runtime popup shows validation status.
- [ ] Runtime popup shows validation errors from `/api/validate` failure responses.
- [ ] Runtime validation success response `{ "success": true }` gates Main Script execution.
- [ ] Runtime validation failure response `{ "success": false, "message": "..." }` blocks Main Script execution.
- [ ] Free Keys, Premium Keys, and Device Limits are validated exclusively through `POST /api/validate`.
- [ ] Main Script execution cannot occur before validation succeeds.
- [ ] Delivery Session Architecture, Delivery Fetch Architecture, Runtime Payload Delivery, Event Platform, Analytics Pipeline, and Build System remain unchanged.
- [ ] No `DeviceLimitService` changes are required for Phase 7B.6.
- [ ] No Premium Key backend changes are required for Phase 7B.6.

## Risks

- Runtime loader currently executes delivered payloads directly.
- Popup validation must avoid leaking raw keys, executor identifiers, or client identifiers through logs/errors.
- Runtime-side device-limit logic would duplicate backend enforcement and risk inconsistent behavior.
- Changing protected delivery, event, analytics pipeline, or build-system components would expand Phase 7B.6 beyond the intended blocker.
- Expanding Phase 7B into lifetime keys or premium license behavior would increase production risk and is deferred.

## Progress Assessment Based on MAIN

- Backend key monetization completion estimate: 100%.
- Runtime popup validation completion estimate: 0%.
- Completed foundation: Provider Foundation, Premium Key Infrastructure, Access Mode Support, Provider Hardening, Dashboard UX Refinement, Key Management Refinement, Key Type Alignment, Device Limits V1, and Custom Device Limits.
- Remaining planned work: Runtime Key Integration, Analytics Foundation, Device Analytics Dashboard, Device Reset, Provider Expansion, and Monetization Analytics.
- Critical blocker: runtime popup validation has not been integrated into Roblox runtime execution.

## TODO Classification

| Item | Classification | Rationale |
|---|---|---|
| Preserve `/get-key` | Completed | Existing free key access route remains available. |
| Preserve `/api/generate-key` | Completed | Existing endpoint generates free keys after Work.ink verification. |
| Preserve `/api/validate` | Completed | Existing endpoint validates active, unexpired keys. |
| Preserve `/api/verify-workink` | Completed | Existing Work.ink verification endpoint remains available. |
| Existing key expiration | Completed | Keys already store and enforce `expires_at`. |
| Work.ink token replay protection | Completed | `used_workink_tokens` is already used. |
| Provider Foundation | Completed | Backend provider foundation is complete. |
| Premium Key Infrastructure | Completed | Premium Keys are enforced through `POST /api/validate`. |
| Access Mode Support | Completed | Access mode support is complete for the backend key platform. |
| Provider Hardening | Completed | Provider hardening is complete for the current backend scope. |
| Dashboard UX Refinement | Completed | Dashboard UX refinement is complete for the current backend scope. |
| Key Management Refinement | Completed | Key management refinement is complete for the current backend scope. |
| Key Type Alignment | Completed | Key type alignment is complete. |
| Device Limits V1 | Completed | Device Limits protect `POST /api/validate`. |
| Custom Device Limits | Completed | Custom device limits are complete for the current backend scope. |
| Runtime Key Integration | Phase 7B.6 | Critical blocker; popup validation must gate Roblox runtime execution. |
| Runtime popup UI | Phase 7B.6 | Required to request key input, show status/errors, and block execution. |
| Runtime `/api/validate` call | Phase 7B.6 | Required with `key`, `executor_identifier`, and `client_identifier`. |
| Runtime execution gate | Phase 7B.6 | Main Script must require `validation_success == true`. |
| Validation event foundation | Phase 7B.7 | Required after runtime integration for key/device validation events. |
| Device analytics dashboard | Phase 7B.8 | Required for Active Devices, Registered Devices, and Device Limit Violations. |
| Manual device reset | Phase 7B.9 | Operational support tooling after runtime/device visibility. |
| Linkvertise provider | Phase 7B.10 | Provider expansion after runtime integration. |
| LootLabs provider | Phase 7B.10 | Provider expansion after runtime integration. |
| Monetization analytics | Phase 7B.11 | Unified analytics across Free Keys, Premium Keys, Providers, and Devices. |
| Production Stabilization monitoring | Operational/Ongoing | Continues while Phase 7B remains deferred behind stabilization. |
| Analytics V2 | Operational/Ongoing | Roadmap track outside Phase 7B/7C ownership. |
| QA and test coverage expansion | Operational/Ongoing | Required before final release, not key monetization-specific. |
| Operational hardening | Operational/Ongoing | Platform hardening track outside Phase 7B/7C ownership. |
| Security review | Operational/Ongoing | Required before final release and should include key monetization review. |
| Runtime license enforcement | Deferred Future License Work | Premium license runtime behavior is explicitly moved out of completed Phase 7B backend and completed Phase 7C performance work. |
| Premium licenses | Deferred Future License Work | Premium monetization is not required for key monetization release. |
| License assignments | Deferred Future License Work | Assignment behavior belongs to premium license access. |
| Assignment lifecycle | Deferred Future License Work | Optional expansion after premium license system resumes. |
| Assignment capacity enforcement | Deferred Future License Work | Requires premium-license atomic enforcement semantics. |
| Customer identifiers | Deferred Future License Work | Customer binding belongs to premium license access. |
| HWID binding | Deferred Future License Work | Higher-assurance license binding requires separate premium license design and risk review. |
| Device transfer workflows | Deferred Future License Work | License device transfer is a premium license workflow, not key reset. |
| License entitlements | Deferred Future License Work | Entitlement modeling belongs to premium licenses. |
| License lookup hashes | Deferred Future License Work | Premium license lookup hardening is deferred. |
| License verifier storage | Deferred Future License Work | Premium license verification storage is not part of key monetization. |
| License analytics | Deferred Future License Work | License activation, delivery, denial, and assignment analytics belong to future premium license work. |
| License hardening | Deferred Future License Work | Premium license security hardening is deferred. |
| Marketplace, paid scripts, creator economy | Remove | Explicitly deferred indefinitely and not part of Phase 7B or Phase 7C minimum scope. |

---

# Phase 7C — Production Runtime Performance ✅ COMPLETE

Status: Complete / production validated.

Source commits:

- `814904b` — Reduce delivery build payload reads.
- `f19530c` — Improve cleanup batching and session pruning.
- `e4b7f2d` — Trim event write return projections.

## Completed Optimizations

- [x] Delivery session creation no longer loads `payload_ciphertext` unnecessarily.
- [x] Ready build metadata projection implemented through `getReadyBuildMetadata()`.
- [x] Rebuild invalidation uses ready build metadata instead of loading previous payload ciphertext.
- [x] Event repository write projections optimized so create/update writes do not return event `payload`.
- [x] Rate-limit cleanup batching significantly improved with bounded delete batches.
- [x] Safe expired delivery session cleanup implemented through `deleteExpiredSessionsWithoutExecutions()`.
- [x] Expired delivery sessions with `script_executions` references are retained to preserve analytics relationships.
- [x] Runtime API behavior preserved for `/api/delivery/session`, `/api/delivery/fetch`, and `/api/events/report`.
- [x] Production validation completed for the implemented optimization scope.
- [x] Performance audit completed.

## Implementation Notes

- Session creation and rebuild invalidation use metadata-only ready-build projections. They still filter for non-null/non-empty `payload_ciphertext` at the database level so readiness semantics are unchanged.
- Runtime fetch/consume still intentionally reads `payload_ciphertext` server-side when generating the runtime payload.
- Event write results are intentionally partial and omit `payload`; read paths still use the full event projection.
- Cleanup is safer and more bounded, but true delivery session TTL cleanup is still blocked by the current `script_executions.session_id` relationship. That database decoupling work remains future scope and was not part of the Phase 7D/7E.1 rate-limit shadow baseline.

## Verification Coverage

- Delivery build repository tests verify ready build metadata does not select `payload_ciphertext`.
- Delivery session service tests verify public session creation uses metadata projection while preserving build and payload format filters.
- Delivery build service tests verify rebuild invalidation uses ready build metadata.
- Event repository tests verify create/update write projections omit event `payload`.
- Cleanup route tests verify bounded rate-limit cleanup batches.
- Delivery session repository tests verify expired sessions with execution rows are preserved.

---

# Phase 7D — Database Scalability & Runtime Optimization

Status: Engineering Complete / Production Baseline.

Scope note: Phase 7D/7E.1 completed the rate-limit shadow runtime baseline, health reporting, rollout metrics, and production verification. PostgreSQL remains authoritative, Valkey is shadow, `RATE_LIMIT_MODE=shadow`, canary is disabled, and rollback is immediate PostgreSQL via `RATE_LIMIT_MODE=postgres`. Do not treat database decoupling, analytics aggregation, schema changes, migrations, Valkey authoritative runtime, or PostgreSQL rate-limit retirement as completed work.

## Phase 7D Completed Baseline

- [x] Valkey connection, metrics, and health visibility.
- [x] Rate-limit shadow mode with PostgreSQL authoritative.
- [x] `/api/health` operational reporting.
- [x] `/api/internal/rate-limit-shadow` admin-only shadow monitoring.
- [x] Rollout metrics and deterministic canary infrastructure.
- [x] Rollback path to `RATE_LIMIT_MODE=postgres`.

## Phase 7D.1 — Database Decoupling

- [ ] Decouple `script_executions` from `delivery_sessions`.
- [ ] Allow true delivery session TTL cleanup.
- [ ] Preserve analytics without a foreign-key dependency on short-lived delivery sessions.

## Phase 7D.2 — Analytics Aggregation

- [ ] Aggregate script executions.
- [ ] Add daily statistics.
- [ ] Add weekly statistics.
- [ ] Add monthly statistics.
- [ ] Reduce long-term raw row growth.

## Phase 7D.3 — Redis / Valkey Integration

- [x] Add Valkey shadow comparison for runtime rate limiting.
- [x] Verify PostgreSQL authoritative and Valkey shadow behavior in production.
- [ ] Move runtime rate-limit authority out of PostgreSQL.
- [ ] Retire PostgreSQL rate-limit authority.
- [ ] Reduce write amplification through authoritative Valkey runtime.
- [ ] Reduce cleanup load through PostgreSQL rate-limit retirement.
- [ ] Reduce database contention through authoritative Valkey runtime.

## Phase 7D.4 — Internal Monitoring Dashboard

- [x] Runtime health via `/api/health`.
- [x] Rate-limit shadow metrics via `/api/internal/rate-limit-shadow`.
- [x] Valkey health summary.
- [x] Rollout metrics.
- [ ] Database metrics dashboard.
- [ ] Cleanup metrics dashboard.
- [ ] Runtime metrics dashboard.
- [ ] Bandwidth metrics.
- [ ] Execution metrics.
- [ ] Storage growth.
- [ ] Operational health.

## Phase 7D.5 — Post-Optimization Infrastructure Review

- [ ] Measure production impact from Phase 7C optimization work.
- [ ] Compare Supabase usage before and after optimization.
- [ ] Determine whether PostgreSQL migration is still justified.
- [ ] Treat this as an evaluation milestone, not an implementation task.

## Deferred Future License Work

Premium license hardening remains deferred future work and is not part of completed Phase 7C or planned Phase 7D database scalability work.

Deferred license items:

- Premium licenses.
- License assignments.
- Customer identifiers.
- HWID binding.
- Device transfer workflows.
- License entitlements.
- License lookup hashes and verifier storage.
- License analytics.
- License hardening.
- Runtime license enforcement.
- Assignment lifecycle.
- Assignment capacity enforcement.
- `license_key` request contract alignment.
- License activity counters.
- Runtime license audit trail.

Risks to resolve before future license implementation:

- Non-atomic assignment checks can allow license sharing beyond capacity.
- Identifier normalization changes can strand existing assignment records.
- HWID binding can block legitimate customers if hardware/user identity signals are unstable.
- Device transfer workflows can be abused without policy and audit controls.
- Credential forwarding can leak premium licenses or customer identifiers if logged or exposed in runtime errors.
- License analytics can be misleading if counters are not updated atomically with authorization decisions.

---

# Phase 7E — Future Infrastructure Improvements

Status: Phase 7E.1 Production Verified ✅; Phase 7E.2 Operational Rollout planned.

Phase 7E captures the production rollout from shadow verification to canary and eventual Valkey authority. Phase 7E.1 is complete and production verified. Phase 7E.2 is the operational rollout stage and must not begin without separate rollout approval.

Current Phase 7E.1 state:

- PostgreSQL authoritative.
- Valkey shadow.
- `RATE_LIMIT_MODE=shadow`.
- Canary disabled.
- Health healthy.
- Parity 100%.
- Backend failures 0.
- Comparison failures 0.
- Mismatch rate 0.

Next Phase 7E.2 operational rollout progression:

1. 1%
2. 5%
3. 10%
4. 25%
5. 50%
6. 100%

Future items:

- Valkey authoritative runtime.
- PostgreSQL rate-limit retirement.
- Grafana.
- Prometheus.
- Alertmanager.
- Historical parity.
- Circuit breaker.
- Automatic rollback.
- Database provider migration if Supabase/PostgreSQL usage remains a bottleneck after Phase 7C and Phase 7D improvements.
- Dedicated worker infrastructure if GitHub Actions scheduling becomes insufficient.
- Dedicated app/domain separation if operational requirements justify it.
- External observability stack expansion beyond current internal counters and alerts.
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

Status: Deferred / superseded by the current future phase order. Operational hardening and release workflow work now follows Production Stabilization, Analytics V2, QA expansion, and security review.

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

Status: Deferred optional infrastructure track. Operational hardening remains in the current future phase order; scale work is only considered if production requirements justify it.

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
1. Phase 7E.2 Operational Rollout — keep production at RATE_LIMIT_MODE=shadow until separately approved canary rollout begins.
```

Next Sprint:

```text
1. Phase 7E.2 Operational Rollout — 1% -> 5% -> 10% -> 25% -> 50% -> 100%
```

Following:

```text
1. Valkey authoritative runtime
2. PostgreSQL rate-limit retirement
3. Analytics V2
4. QA & Test Coverage Expansion
5. Operational Hardening
6. Security Review
7. Final Security Audit
8. Release Candidate
9. V1 Release
```

Deferred:

```text
1. Runtime popup key validation until runtime UX requirements are finalized.
2. Premium license hardening until a future license design is approved.
3. Grafana, Prometheus, Alertmanager, historical parity, circuit breaker, and automatic rollback until Phase 7E.2 canary behavior is reviewed.
```

Long-Term Goal:

Build LuxyHub into a complete internal platform for LuxyHub operations, script distribution, Work.ink-backed free monetized access, premium license management, event reporting, and later customer/device access management.
