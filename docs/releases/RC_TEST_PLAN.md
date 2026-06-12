# Release Candidate Test Plan

Current readiness: Production Ready Candidate

## Scope

Validate real usage behavior on `luxyhub.dev` before production rollout. This plan is operational validation only and does not introduce new features.

## Test Areas

### Soak Testing

- Exercise normal dashboard usage over an extended window.
- Exercise script delivery and loader session creation repeatedly.
- Monitor for recurring errors, latency issues, rate-limit anomalies, and queue drift.

### Runtime Validation

- Validate public access mode delivery.
- Validate `key_required` delivery using the existing Work.ink key path.
- Validate `license_required` delivery using runtime license credentials.
- Confirm runtime failures are controlled and do not leak sensitive information.

### Analytics Validation

- Compare Analytics V2 dashboard values against database-derived values.
- Validate 7d, 30d, and 90d windows.
- Confirm delivery, runtime, authorization, and license metrics update after real activity.

### Audit Validation

- Confirm creator actions create expected audit records.
- Confirm runtime license authorization events create expected audit records.
- Confirm audit data remains owner-isolated and service-role controlled where intended.

### Delivery Validation

- Validate delivery session creation.
- Validate delivery fetch behavior.
- Validate one-time or short-lived session behavior.
- Confirm delivery counters and related monitoring signals update as expected.

### License Validation

- Validate active licenses.
- Validate disabled licenses.
- Validate revoked licenses.
- Validate expired licenses.
- Validate assignment capacity behavior under realistic usage.

## Required Evidence

- Test window and environment noted.
- Sample activity recorded.
- Metrics compared.
- Errors reviewed.
- Rollback readiness confirmed.
- Final release recommendation documented.
