# LuxyHub Documentation

## Current Status

- Current Phase: Release Candidate polish and validation
- Documentation Status: Knowledge-base navigation added; stale historical links still need final cleanup
- Phase 8: Complete (100%), production verified, Roblox verified
- Phase 7B Runtime License Enforcement: Complete
- Analytics V2: Complete with documented validation caveats

LuxyHub is in post-RC polish. Current docs should help readers find answers without reading full architecture documents first. Historical documents remain available under `archive/`, but current behavior should be documented in active feature, runtime, API, database, dashboard, and operations docs.

## Quick Navigation

| Need | Start here | Related documents |
| --- | --- | --- |
| First orientation | `GETTING_STARTED.md` | `PROJECT_STATUS.md`, `roadmap/TODO.md` |
| Scripts | `features/SCRIPTS.md` | `dashboard/DASHBOARD_WORKFLOWS.md` |
| Keys | `features/KEYS.md` | `audits/POST_RC_POLISH_AUDIT.md` |
| Licenses | `features/LICENSES.md` | `features/LICENSE_ASSIGNMENTS.md` |
| Delivery | `features/DELIVERY.md` | `runtime/DELIVERY_SESSIONS.md` |
| Analytics | `features/ANALYTICS_V2.md` | `operations/MONITORING.md` |
| Operations | `OPERATIONS.md` | `operations/` |
| Reference | `REFERENCE.md` | `api/REFERENCE.md`, `database/SCHEMA.md` |
| Troubleshooting | `TROUBLESHOOTING.md` | `operations/INCIDENT_RESPONSE.md` |

## Popular Tasks

- Create a script: `features/SCRIPTS.md`.
- Choose `public`, `key_required`, or `license_required`: `features/ACCESS_MODES.md`.
- Understand free-key migration risk: `features/KEYS.md` and `audits/POST_RC_POLISH_AUDIT.md`.
- Create a premium license: `features/LICENSES.md`.
- Create delivery sessions: `runtime/DELIVERY_SESSIONS.md`.
- Integrate event reporting: `features/EVENT_PLATFORM.md`.
- Run RC validation: `releases/RC_TEST_PLAN.md`.

## Source of Truth Documents

- `architecture/ARCHITECTURE.md` — current implementation architecture.
- `architecture/PHASE7_LICENSE_ARCHITECTURE.md` — Phase 7 access mode, Work.ink key, and premium license architecture.
- `architecture/decisions/` — accepted Architecture Decision Records required before Phase 7B implementation.
- `features/` — task-oriented knowledge-base articles.
- `dashboard/DASHBOARD_WORKFLOWS.md` — creator dashboard workflows.
- `runtime/DELIVERY_SESSIONS.md` — delivery session reference.
- `phases/phase7/PHASE_7B_DESIGN.md` — Phase 7B runtime license enforcement design record.
- `phases/phase7/PHASE_7B_THREAT_MODEL.md` — Phase 7B license runtime threat model.
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

### `features/`

- `features/ACCESS_MODES.md` — visibility vs runtime access requirements.
- `features/SCRIPTS.md` — script lifecycle and runtime readiness.
- `features/KEYS.md` — Work.ink free keys and target format audit summary.
- `features/LICENSES.md` — premium license workflow.
- `features/LICENSE_ASSIGNMENTS.md` — assignment lifecycle and troubleshooting.
- `features/RUNTIME_LICENSING.md` — runtime license authorization.
- `features/DELIVERY.md` — secure delivery overview.
- `features/ANALYTICS_V2.md` — metric definitions and limitations.
- `features/EVENT_PLATFORM.md` — event reporting and webhook platform overview.

### `dashboard/`

- `dashboard/DASHBOARD_WORKFLOWS.md` — creator dashboard workflows.

### `runtime/`

- `runtime/DELIVERY_SESSIONS.md` — delivery session lifecycle and access-mode matrix.
- `runtime/SECURE_DELIVERY.md` — secure delivery internals.
- `runtime/EVENT_QUEUE.md` — event queue runtime behavior.
- `runtime/BUILD_PIPELINE.md` — build pipeline runtime behavior.

#### Architecture Decision Records

- `architecture/decisions/ADR-001-delivery-session-authorization-boundary.md` — delivery session authorization boundary.
- `architecture/decisions/ADR-002-postgres-backed-event-queue.md` — PostgreSQL-backed event queue.
- `architecture/decisions/ADR-003-github-actions-event-worker-scheduler.md` — GitHub Actions event worker scheduler.
- `architecture/decisions/ADR-004-inline-alert-evaluation.md` — inline alert evaluation after worker execution.
- `architecture/decisions/ADR-005-build-automation-failure-model.md` — build automation failure and recovery model.
- `architecture/decisions/ADR-006-verification-logs-as-monitoring-counters.md` — verification logs as monitoring counters.
- `architecture/decisions/ADR-007-webhook-credential-storage-risk.md` — webhook credential storage risk and mitigations.
- `architecture/decisions/ADR-008-payload-secret-fallback-policy.md` — payload secret fallback and rotation policy.
- `architecture/decisions/ADR-009-license-authorization-model.md` — Phase 7A license authorization model and Phase 7B boundary.

### `roadmap/`

- `roadmap/TODO.md` — project roadmap and active phase.
- `roadmap/RELEASE_V1.md` — V1 release summary.

### `deployment/`

- `deployment/DEPLOYMENT_CHECKLIST.md` — deployment checklist.
- `deployment/PRODUCTION_VALIDATION_REPORT.md` — production validation record.

### `operations/`

- `OPERATIONS.md` — operations landing page.
- `operations/ENVIRONMENT_VARIABLES.md` — environment variable reference.
- `operations/MONITORING.md` — monitoring guide.
- `operations/INCIDENT_RESPONSE.md` — incident response plan.

### `phases/`

- `phases/phase4/PHASE4_DOCUMENTATION_REVIEW.md` — Phase 4 documentation review.
- `phases/phase7/README.md` — Phase 7 status and source-of-truth pointers.
- `phases/phase7/PHASE_7B_DESIGN.md` — Phase 7B runtime enforcement design record.
- `phases/phase7/PHASE_7B_THREAT_MODEL.md` — Phase 7B runtime enforcement threat model.
- `phases/phase7/historical/` — Phase 7 supporting historical records.
- `phases/phase8/active/` — Phase 8 closeout and operational decisions retained after production verification.
- `phases/phase8/historical/` — Phase 8 historical implementation records.

### `audits/`

- `audits/POST_RC_POLISH_AUDIT.md` — post-RC polish findings for UX, docs, security, config, and cleanup.
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
- Phase 8 — complete / formally closed at 100%, production verified, Roblox verified.

## Project Status

### Completed Systems

- Authentication
- Dashboard
- Scripts
- Secure Delivery
- Analytics V1
- Analytics V2
- Event Platform
- License Foundation
- License Dashboard
- Phase 7B Runtime License Enforcement
- Testing Expansion
- Operational Hardening

### In Progress

- Release Candidate Program

### Remaining Before Production Rollout

- Soak testing
- Rollback drill
- Production rollout review
