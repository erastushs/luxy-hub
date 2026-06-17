# Phase 7B.6 Runtime Integration Specification

Status: Preparation
Date: 2026-06-17

Purpose: Technical implementation guide for Lua/runtime developers integrating Phase 7B key validation into the Roblox runtime execution flow.

Scope: Documentation only. This specification does not modify runtime code, delivery code, analytics, event platform behavior, or the build system.

## 1. Overview

Phase 7B backend implementation is complete for the current monetization scope:

- Free Keys.
- Premium Keys.
- Work.ink.
- Key Types.
- Device Limits.
- Custom Device Limits.

Runtime integration has not been implemented yet. The runtime loader currently executes delivered payloads directly after bootstrap.

Current architecture:

```text
Delivery
-> Bootstrap
-> Main Script
```

Target architecture:

```text
Delivery
-> Bootstrap
-> Popup UI
-> Key Entry
-> POST /api/validate
-> Validation Success
-> Main Script
```

The runtime must insert a validation popup between bootstrap and Main Script execution. Main Script execution must not occur until the validation API returns success.

## 2. Validation API

Endpoint:

```text
POST /api/validate
```

Request:

```json
{
  "key": "USER_KEY",
  "executor_identifier": "...",
  "client_identifier": "..."
}
```

Success Response:

```json
{
  "success": true
}
```

Failure Response:

```json
{
  "success": false,
  "message": "..."
}
```

Runtime behavior:

- Treat `success: true` as the only authorization signal that allows Main Script execution.
- Treat all non-2xx responses, malformed responses, network failures, and `success: false` responses as validation failures.
- Display the returned `message` when available.
- Display a generic validation error when no safe message is available.
- Do not log raw keys, executor identifiers, or client identifiers.

## 3. Device Limits

Device Limits are enforced by the backend through `POST /api/validate`. Runtime code must send the required identifiers and must not reimplement device-limit decisions locally.

Current device-limit policy:

| Key Type | Device Limit |
|---|---:|
| Free | 1 device |
| Weekly | 1 device |
| Monthly | 3 devices |
| Custom | Configured limit |
| Legacy | Unlimited |

Runtime implications:

- If a key is allowed for the current device, `/api/validate` returns success.
- If a key exceeds its device limit, `/api/validate` returns failure with a message.
- The runtime should display the failure and continue blocking Main Script execution.
- The runtime should not attempt to count, reset, override, or infer device registrations.

## 4. Runtime Requirements

The runtime must:

- Display a popup before Main Script execution.
- Request a key from the user.
- Call `POST /api/validate` with `key`, `executor_identifier`, and `client_identifier`.
- Show validation status while the request is pending.
- Show validation errors when validation fails.
- Block execution until validation succeeds.
- Execute the Main Script only after receiving `success: true`.

The runtime must not:

- Execute the script before validation.
- Cache validation permanently.
- Treat local state as proof of authorization.
- Reimplement backend device-limit enforcement.
- Modify delivery architecture.
- Modify delivery session creation.
- Modify delivery fetch behavior.
- Modify runtime payload delivery.
- Modify analytics pipeline behavior.
- Modify event platform behavior.
- Modify the build system.

Temporary caching guidance:

- A short in-session validation state may be used only to prevent duplicate popup submissions during the same active execution flow.
- Validation must not be persisted as a permanent bypass across sessions, devices, executors, or script launches.

## 5. Future Compatibility

Runtime validation must remain provider-agnostic. Providers affect how users obtain keys; they must not change runtime validation semantics.

Compatible providers:

- Work.ink.
- Linkvertise.
- LootLabs.

Compatibility rules:

- Runtime code submits keys to `POST /api/validate` regardless of provider source.
- Runtime code must not contain Work.ink-specific, Linkvertise-specific, or LootLabs-specific validation logic.
- Provider completion and key issuance remain backend/provider responsibilities.
- Future providers should continue to work if they issue keys accepted by `/api/validate`.

## 6. Definition Of Done

Runtime integration is complete when:

- Popup appears before Main Script execution.
- User can enter a key in the popup.
- Runtime calls `POST /api/validate` with the expected request body.
- Validation succeeds for valid Free Keys.
- Validation succeeds for valid Premium Keys.
- Validation failure messages are shown to the user.
- Main Script executes only after validation success.
- Main Script does not execute after validation failure.
- Device limits are enforced through `/api/validate`.
- Premium keys work without Premium Key backend changes.
- Delivery Session Architecture remains unchanged.
- Delivery Fetch Architecture remains unchanged.
- Runtime Payload Delivery remains unchanged.
- Event Platform remains unchanged.
- Analytics Pipeline remains unchanged.
- Build System remains unchanged.
