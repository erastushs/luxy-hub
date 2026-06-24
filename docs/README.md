# LuxyHub Documentation

## Current Status

- Current Focus: Phase 7E.2 Operational Rollout preparation after Phase 7E.1 production verification
- Documentation Status: DOCUMENTATION COMPLETE
- Phase 8: Complete (100%), production verified, Roblox verified
- Analytics V1: Complete
- Phase 7A: Complete / production ready
- Phase 7B: Backend Key Monetization Platform, complete
- Phase 7C: Production Runtime Performance, complete
- Phase 7D: Database Scalability & Runtime Optimization, engineering complete / production baseline
- Phase 7E.1: Production verified; PostgreSQL authoritative, Valkey shadow, `RATE_LIMIT_MODE=shadow`, canary disabled
- Phase 7E.2: Operational Rollout for planned production canary progression
- Premium license hardening: deferred future license work

LuxyHub has closed Phase 7A with the access-mode foundation, key validation integration, license foundation, license management dashboard, and license analytics dashboard production ready for the implemented UI/backend scope. Phase 7B backend monetization infrastructure is complete. Phase 7C production runtime performance optimization is complete and preserved runtime API behavior while reducing delivery build payload reads, optimizing event write projections, improving cleanup batching, and safely pruning expired delivery sessions without execution references. Phase 7D engineering is complete as the current production baseline. Phase 7E.1 is production verified with PostgreSQL authoritative, Valkey shadow comparison, `RATE_LIMIT_MODE=shadow`, healthy runtime health, 100% parity, zero backend failures, zero comparison failures, and canary disabled. Phase 8 Event Reporting & Webhook Platform is complete at 100% for the accepted Discord-backed production scope.

## Source of Truth Documents

- `architecture/ARCHITECTURE.md` — current implementation architecture.
- `architecture/PHASE7_LICENSE_ARCHITECTURE.md` — Phase 7 access mode, provider-backed key, and premium license architecture.
- `architecture/decisions/` — accepted Architecture Decision Records for current production boundaries and access-mode authorization.
- `phases/phase7/PHASE_7B_DESIGN.md` — refined Phase 7B Key Monetization Platform design scope; runtime integration blocked.
- `phases/phase7/PHASE_7B_THREAT_MODEL.md` — refined Phase 7B Key Monetization Platform threat model; runtime integration blocked.
- `phases/phase7/PHASE7_KEY_MONETIZATION_MODEL.md` — product, provider, device-limit, reset, and analytics model for Phase 7B.
- `roadmap/PHASE7_ROADMAP_REALIGNMENT_REPORT.md` — report documenting the Phase 7B/7C product-direction split.
- `roadmap/TODO.md` — roadmap, active phase, completed phases, and pending work.

## Production Scheduler

```text
GitHub Actions
  -> POST https://luxyhub.vercel.app/api/internal/event-worker
  -> processEventQueue()
  -> checkAlerts()
```

Scheduler notes:

- GitHub Actions is the production 5-minute event worker scheduler.
- The scheduler uses the Vercel hostname directly.
- No Cloudflare bypass rule is required.
- Vercel Cron remains only for daily cleanup.

## Documentation Categories

### `architecture/`

- `architecture/ARCHITECTURE.md` — current system architecture.
- `architecture/CDN_DATABASE.md` — CDN/database reference.
- `architecture/PHASE7_LICENSE_ARCHITECTURE.md` — source-of-truth Phase 7 access mode and license architecture.
- `architecture/decisions/` — accepted ADRs for delivery, event queue, scheduler, alerts, builds, monitoring counters, webhook credentials, payload secrets, and license authorization.

#### Architecture Decision Records

- `architecture/decisions/ADR-001-delivery-session-authorization-boundary.md` — delivery session authorization boundary.
- `architecture/decisions/ADR-002-postgres-backed-event-queue.md` — PostgreSQL-backed event queue.
- `architecture/decisions/ADR-003-github-actions-event-worker-scheduler.md` — GitHub Actions event worker scheduler.
- `architecture/decisions/ADR-004-inline-alert-evaluation.md` — inline alert evaluation after worker execution.
- `architecture/decisions/ADR-005-build-automation-failure-model.md` — build automation failure and recovery model.
- `architecture/decisions/ADR-006-verification-logs-as-monitoring-counters.md` — verification logs as monitoring counters.
- `architecture/decisions/ADR-007-webhook-credential-storage-risk.md` — webhook credential storage risk and mitigations.
- `architecture/decisions/ADR-008-payload-secret-fallback-policy.md` — payload secret fallback and rotation policy.
- `architecture/decisions/ADR-009-license-authorization-model.md` — Phase 7A access-mode authorization model and Phase 7B/7C boundary.
- `architecture/decisions/ADR-010-client-ip-resolution-behind-reverse-proxies.md` — client IP resolution priority behind Cloudflare and reverse proxies.

### `roadmap/`

- `roadmap/TODO.md` — project roadmap and active phase.
- `roadmap/RELEASE_V1.md` — V1 release summary.

### `deployment/`

- `deployment/DEPLOYMENT_CHECKLIST.md` — deployment checklist.
- `deployment/PRODUCTION_VALIDATION_REPORT.md` — production validation record.

### `operations/`

- `operations/MONITORING.md` — monitoring guide.
- `operations/INCIDENT_RESPONSE.md` — incident response plan.

### `phases/`

- `phases/phase4/PHASE4_DOCUMENTATION_REVIEW.md` — Phase 4 documentation review.
- `phases/phase7/README.md` — Phase 7 status and source-of-truth pointers.
- `phases/phase7/PHASE_7E2_CANARY_PLAYBOOK.md` — Phase 7E.2 operational rollout playbook for canary metrics, gates, monitoring, and rollback.
- `phases/phase7/PHASE_7B_DESIGN.md` — Phase 7B Key Monetization Platform design.
- `phases/phase7/PHASE_7B_THREAT_MODEL.md` — planned Phase 7B Key Monetization Platform threat model.
- `phases/phase7/PHASE7_KEY_MONETIZATION_MODEL.md` — Phase 7B key product/provider/device model.
- `phases/phase7/historical/` — Phase 7 supporting historical records.
- `phases/phase8/active/` — Phase 8 closeout and operational decisions retained after production verification.
- `phases/phase8/historical/` — Phase 8 historical implementation records.

### `audits/`

- `audits/ARCHITECTURE_COMPLIANCE_REPORT.md` — architecture compliance audit.

### `archive/`

- `archive/architecture/` — superseded architecture and design references.
- `archive/deployment/` — superseded deployment and backup references.
- `archive/integration/` — superseded API, integration, migration, and user guides.
- `archive/reports/` — historical audits, validation reports, review reports, test plans, and fix reports.
- `archive/phase3/` — Phase 3 historical records.
- `archive/phase4/` — superseded Phase 4 records.
- `archive/phase5/` — Phase 5 historical records.
- `archive/phase6/` — Phase 6 historical records.

## Historical Documents

- `phases/phase8/historical/` contains historical Phase 8 implementation records retained after closeout.
- `archive/` contains superseded documents retained for reference, organized by document type and historical phase.

## Closed Phases

- Phase 4 — complete.
- Phase 5 — complete.
- Phase 6 — complete.
- Analytics V1 — complete.
- Phase 7A — complete / production ready.
- Phase 7B — backend key monetization infrastructure complete.
- Phase 7C — production runtime performance complete.
- Phase 7D — engineering complete / production baseline.
- Phase 7E.1 — production verified.
- Phase 8 — complete / formally closed at 100%, production verified, Roblox verified.

## Project Status

### Completed Systems

- Authentication
- Dashboard
- Scripts
- Secure Delivery
- Analytics V1
- Event Platform
- License Foundation
- License Dashboard
- Phase 7B Backend Key Monetization Infrastructure
- Phase 7C Production Runtime Performance
- Phase 7D Valkey Shadow Runtime Baseline
- Phase 7E.1 Operational Health and Canary Infrastructure

### In Progress

- Phase 7E.2 Operational Rollout

### Deferred / Not Started

- Valkey authoritative runtime
- PostgreSQL rate-limit retirement
- Analytics V2
- QA & Test Coverage Expansion
- Operational Hardening
- Security Review
- Runtime popup key validation
- Premium license hardening
- Final Security Audit

### Future Phase Order

1. Phase 7E.2 Operational Rollout: 1% -> 5% -> 10% -> 25% -> 50% -> 100%
2. Valkey authoritative runtime
3. PostgreSQL rate-limit retirement
4. Analytics V2
5. QA & Test Coverage Expansion
6. Operational Hardening
7. Security Review
8. Final Security Audit
9. Release Candidate
10. V1 Release
