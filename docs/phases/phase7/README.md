# Phase 7 — Access Modes, Keys, and License Authorization

Phase 7 documentation source of truth:

../../architecture/PHASE7_LICENSE_ARCHITECTURE.md

Current Status:
Phase 7A.1 Schema Foundation (active, not started in code)

Approved access modes:

- `public`
- `key_required`
- `license_required`

Implementation guardrails:

- `visibility` and `access_mode` are separate concerns.
- Authorization occurs only during `POST /api/delivery/session`.
- Existing Work.ink endpoints remain supported and map to `access_mode = key_required`.
- Premium licenses use hashed license keys, nullable `expires_at`, and assignment/device limits.
