# Phase 7 — Access Modes, Keys, and License Authorization

Phase 7 documentation source of truth:

../../architecture/PHASE7_LICENSE_ARCHITECTURE.md

Phase 7B planning documents:

- `PHASE_7B_DESIGN.md`
- `PHASE_7B_THREAT_MODEL.md`

Current Status:
Phase 7A complete / production ready. Phase 7B Runtime License Enforcement is the next planning track and has not started in code.

Approved access modes:

- `public`
- `key_required`
- `license_required`

Implementation guardrails:

- `visibility` and `access_mode` are separate concerns.
- Authorization occurs only during `POST /api/delivery/session`.
- Existing Work.ink endpoints remain supported and map to `access_mode = key_required`.
- Premium licenses use hashed license keys, nullable `expires_at`, and assignment/device limits.

## Phase 7A Completion

Status: COMPLETE / PRODUCTION READY

Completed milestones:

- 7A.1 Schema Foundation
- 7A.2 Access Authorization Layer
- 7A.3 Key Validation Integration
- 7A.4 License Lifecycle Management
- 7A.4.5 Assignment System
- 7A.5 Runtime License Validation
- 7A.6 License Dashboard UI
- 7A.7 License Analytics UI
- 7A.8 License UX Polish
- 7A.9 UI Remediation

## Implemented Functionality

### License

- Create license keys.
- Enable disabled licenses.
- Disable active licenses.
- Revoke eligible licenses.
- Raw license keys are displayed only immediately after creation.

### Assignments

- Create assignments with hashed customer identifiers and optional display names.
- Remove assignments through the dashboard/API.

### Access Modes

- `public`
- `key_required`
- `license_required`

### Dashboard

- License Management screen at `/dashboard/licenses`.
- License Analytics screen at `/dashboard/licenses/analytics`.
- Search, filters, sorting, bulk selection UI, confirmation dialogs, loading states, empty states, and mobile remediation are implemented.

## Planned

- Phase 7B Runtime License Enforcement.
- Assignment capacity enforcement.
- `customer_identifier` handling and validation.
- `license_key` contract alignment.
- Loader credential forwarding.
- License activity counters.
- Runtime audit trail.

## Future Work

- Analytics V2.
- Production hardening.
- Final security audit.
- Optional assignment lifecycle expansion beyond create/remove.
