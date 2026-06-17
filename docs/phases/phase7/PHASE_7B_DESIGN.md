# Phase 7B Design — Key Monetization Platform

Status: Runtime Integration Blocked
Date: 2026-06-17

Reason: Product direction was refined after backend monetization infrastructure reached completion. Phase 7B is now blocked by Roblox runtime integration, not backend key-platform work. Phase 7C remains the deferred Premium License System.

Implementation: Backend monetization infrastructure is complete for the current Phase 7B scope. Device Limits, Premium Keys, and Free Keys are enforced through `POST /api/validate`. Popup validation has not yet been integrated into the Roblox runtime, and the runtime loader currently executes delivered payloads directly. No runtime implementation is part of this documentation update.

Design: Refined

Threat Model: Refined

Documentation: Refined

This document describes the updated Phase 7B roadmap and implementation boundary. Phase 7B must not implement premium licenses, license assignments, customer identifiers, HWID binding, device transfer workflows, license entitlements, license analytics, runtime license hardening, or license assignment capacity enforcement. Those items belong to Phase 7C.

## 1. Objective

Phase 7B connects the completed backend Key Monetization Platform to the Roblox runtime.

The platform supports:

- Free Keys through `POST /api/validate`.
- Premium Keys through `POST /api/validate`.
- Device Limits through `POST /api/validate`.
- Future provider support through the same validation boundary.
- Runtime popup validation that blocks main script execution until validation succeeds.

Target runtime architecture:

```text
Delivery
↓
Bootstrap
↓
Popup UI
↓
Key Entry
↓
POST /api/validate
↓
Validation Success
↓
Main Script
↓
Feature Execution
```

## 2. Current MAIN Foundation

Already present in MAIN/backend infrastructure:

- Free key generation.
- Work.ink token verification flow.
- Work.ink token replay protection.
- Key validation.
- Key expiration through `keys.expires_at`.
- `access_mode` with `public`, `key_required`, and `license_required` values.
- Delivery-session authorization branch for `key_required` that delegates to existing key validation.
- Operational logging/analytics tables that can support a minimal analytics view.
- Provider foundation.
- Premium key infrastructure.
- Provider hardening.
- Dashboard UX refinement.
- Key management refinement.
- Key type alignment.
- Device Limits V1.
- Custom device limits.

Known runtime gap for the updated Phase 7B scope:

- Popup validation has not been integrated into the Roblox runtime.
- The runtime loader currently executes delivered payloads directly.
- Runtime execution is not yet gated on successful `POST /api/validate` response.
- Runtime validation events are not yet recorded as the Phase 7B.7 analytics foundation.

## 3. Phase 7B Scope

Updated Phase 7B includes:

- Phase 7B.6 Runtime Key Integration.
- Phase 7B.7 Analytics Foundation.
- Phase 7B.8 Device Analytics Dashboard.
- Phase 7B.9 Device Reset.
- Phase 7B.10 Provider Expansion.
- Phase 7B.11 Monetization Analytics.

Phase 7B excludes:

- Premium licenses.
- License assignments.
- Customer identifiers.
- HWID binding.
- Device transfer workflows.
- License entitlements.
- License analytics.
- License hardening.
- Runtime license enforcement.
- Delivery Session Architecture changes.
- Delivery Fetch Architecture changes.
- Runtime Payload Delivery changes.
- Event Platform changes.
- Analytics Pipeline rewrites.
- Build System changes.
- Assignment lifecycle.
- Assignment capacity enforcement.
- Marketplace, paid scripts, and creator economy features.

## 4. Runtime Validation Contract

The Roblox runtime must call:

```text
POST /api/validate
```

Request body:

```json
{
  "key": "USER_KEY",
  "executor_identifier": "...",
  "client_identifier": "..."
}
```

Validation success:

```json
{
  "success": true
}
```

Validation failure:

```json
{
  "success": false,
  "message": "..."
}
```

Execution gate:

```text
validation_success == true
```

Main script execution must not occur before validation succeeds.

## 5. Popup Layer Requirements

The runtime popup must support:

- Free Keys.
- Premium Keys.
- Future Providers.

The popup must:

- Request key input.
- Show validation status.
- Show validation errors.
- Block script execution until validation succeeds.

## 6. Protected Components

The following components must remain unchanged during Phase 7B.6 runtime key integration:

- Delivery Session Architecture.
- Delivery Fetch Architecture.
- Runtime Payload Delivery.
- Event Platform.
- Analytics Pipeline.
- Build System.

Runtime integration should wrap/gate execution after delivery/bootstrap instead of redesigning delivery or backend validation.

## 7. Device Limit Enforcement

Device Limits remain enforced exclusively through:

```text
POST /api/validate
```

No `DeviceLimitService` changes are required for Phase 7B.6.

## 8. Premium Key Enforcement

Premium Keys remain enforced through:

```text
POST /api/validate
```

No Premium Key backend changes are required for Phase 7B.6.

## 9. Phase 7B.6 Runtime Key Integration

Priority: Critical.

Goal:
Connect Roblox runtime to the completed backend key platform.

Deliverables:

- Runtime popup UI.
- Runtime key input flow.
- Runtime call to `POST /api/validate`.
- Validation success/failure state handling.
- Execution gate before main script execution.
- Error display for validation failures.

Success criteria:

- Free Keys validate through `/api/validate` before execution.
- Premium Keys validate through `/api/validate` before execution.
- Device Limits are enforced by `/api/validate` without runtime-side device-limit logic.
- Main Script execution requires `validation_success == true`.
- Delivered payloads are not executed directly before validation.
- Delivery, fetch, payload delivery, events, analytics pipeline, and build system remain unchanged.

## 10. Phase 7B.7 Analytics Foundation

Prerequisite: Phase 7B.6 complete.

Goal:
Record runtime validation events.

Initial events:

- `KEY_VALIDATED`.
- `KEY_VALIDATION_FAILED`.
- `DEVICE_REGISTERED`.
- `DEVICE_REUSED`.
- `DEVICE_LIMIT_DENIED`.

## 11. Phase 7B.8 Device Analytics Dashboard

Goal:
Dashboard visibility for:

- Active Devices.
- Registered Devices.
- Device Limit Violations.

## 12. Phase 7B.9 Device Reset

Goal:
Support manual device resets.

## 13. Phase 7B.10 Provider Expansion

Includes:

- Linkvertise.
- LootLabs.

## 14. Phase 7B.11 Monetization Analytics

Goal:
Unified analytics across:

- Free Keys.
- Premium Keys.
- Providers.
- Devices.

## 15. Future Backlog

Lifetime Keys are a potential future key type:

```text
lifetime
```

Example:

```text
key_category = premium
key_type = lifetime
expires_at = NULL
```

Lifetime Keys are not part of Phase 7B and are deferred until monetization requirements justify implementation.

## 16. Progress Assessment

Current progress estimate:

- Backend Infrastructure: approximately 100%.
- Runtime Integration: approximately 0%.
- Overall Phase 7B: approximately 85-90%.

Completed backend foundation:

- Provider Foundation.
- Premium Key Infrastructure.
- Access Mode Support.
- Provider Hardening.
- Dashboard UX Refinement.
- Key Management Refinement.
- Key Type Alignment.
- Device Limits V1.
- Custom Device Limits.

Production blocker:

- Runtime key integration is not implemented.

Remaining work is primarily runtime integration and operational tooling, not backend foundation.

## 17. Recommended Implementation Order

1. Implement Phase 7B.6 Runtime Key Integration.
2. Verify runtime popup validation blocks direct payload execution until `/api/validate` succeeds.
3. Add Phase 7B.7 runtime validation event recording.
4. Add Phase 7B.8 device analytics dashboard visibility.
5. Add Phase 7B.9 manual device reset support.
6. Add Phase 7B.10 provider expansion for Linkvertise and LootLabs.
7. Add Phase 7B.11 unified monetization analytics.

## 18. Phase 7C Boundary

All premium-license work is Phase 7C:

- Premium licenses.
- License assignments.
- Customer identifiers.
- HWID binding.
- Device transfer workflows.
- License entitlements.
- License analytics.
- License hardening.
- Runtime license enforcement.
- Assignment lifecycle.
- Assignment capacity enforcement.
- License counters and runtime audit trail.
- `license_key` contract alignment.

Phase 7C may require migrations or database functions. Those risks must not be introduced into Phase 7B documentation as implemented behavior.
