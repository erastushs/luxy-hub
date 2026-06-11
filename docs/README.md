# LuxyHub Documentation

## Current Status

- Current Phase: Phase 7A.1 Schema Foundation
- Phase 8: Complete (100%), production verified, Roblox verified
- Analytics V1: Complete

LuxyHub is ready for Phase 7A.1 Schema Foundation implementation planning. Phase 8 Event Reporting & Webhook Platform is complete at 100% for the accepted Discord-backed production scope. Phase 7 is now the active development phase for `public`, `key_required`, and `license_required` access modes.

## Source of Truth Documents

- `architecture/ARCHITECTURE.md` — current implementation architecture.
- `architecture/PHASE7_LICENSE_ARCHITECTURE.md` — Phase 7 access mode, Work.ink key, and premium license architecture.
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
- `phases/phase7/README.md` — Phase 7 pointer to the source-of-truth license architecture.
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
- Phase 8 — complete / formally closed at 100%, production verified, Roblox verified.
