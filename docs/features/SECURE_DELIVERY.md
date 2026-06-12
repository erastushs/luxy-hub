# Secure Delivery

Secure Delivery protects runtime script payload delivery through build outputs, short-lived sessions, payload verification, and access-mode authorization.

## What To Know First

- Creators manage scripts and builds in the dashboard.
- Runtime callers do not receive raw source directly from dashboard pages.
- A delivery session must be authorized before payload fetch.
- Delivery sessions expire quickly and are consumed once.

## Operational Caveats

- Scripts must have a ready build for runtime delivery.
- Private scripts are not deliverable through public runtime delivery.
- Credential requirements depend on access mode.
- Delivery payload secret rotation should follow the operations runbook.

## Related Documents

- Runtime internals: `../runtime/SECURE_DELIVERY.md`.
- Delivery sessions: `../runtime/DELIVERY_SESSIONS.md`.
- Access modes: `ACCESS_MODES.md`.
- Operations: `../operations/BUILD_OPERATIONS.md`.
