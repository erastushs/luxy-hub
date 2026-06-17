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

## 3. Fingerprint Requirements

The runtime must populate both fingerprint fields in every validation request:

```json
{
  "executor_identifier": "...",
  "client_identifier": "..."
}
```

These values are required for device-limit enforcement. The backend combines both values into one server-side fingerprint hash. If either value is missing or blank for a device-limited key, `/api/validate` returns a failure response.

Recommended values:

| Field | Purpose | Recommended Source | Example |
|---|---|---|---|
| `executor_identifier` | Identifies the executor/runtime environment submitting validation. | Stable executor-provided identifier when available. If the executor exposes a supported executor name or executor fingerprint, use that exact value. | `"synapse-x"`, `"krnl"`, `"scriptware"`, `"executor:unknown"` |
| `client_identifier` | Identifies the local client/device installation. | Stable per-install client ID generated once by the runtime and persisted by the executor environment when persistence is available. | `"client:8f5f7a4e-3d1f-4f5f-8b2a-7d2e9b7f1c20"` |

Implementation guidance:

- `executor_identifier` should remain stable for the same executor/runtime environment.
- `client_identifier` should remain stable for the same user/device installation.
- `client_identifier` should not be regenerated on every script launch.
- If durable local storage is available, generate a random UUID once and reuse it.
- If durable local storage is not available, use the most stable executor-provided client/device value available in that environment.
- Prefix values with their source when possible, for example `executor:synapse-x` or `client:<uuid>`.
- Do not use the user-entered key as either identifier.
- Do not use the script slug, script ID, or current session token as either identifier.
- Do not log raw `executor_identifier` or `client_identifier` values.

The runtime developer must not guess these values at integration time. Before implementation, choose the exact executor/runtime APIs that will supply the two fields and document those choices in the runtime code review. If a target executor does not provide durable storage or a stable device value, the integration must explicitly record the fallback behavior before release.

## 4. Real API Examples

The current `/api/validate` response shape is intentionally small:

- Success: `{ "success": true }`
- Failure: `{ "success": false, "message": "..." }`

The success response does not include key type, device count, expiration, provider, or entitlement data. Runtime code must not expect those fields.

### Valid Key

Request:

```http
POST /api/validate
Content-Type: application/json
```

```json
{
  "key": "LUXY-VALID-EXAMPLE",
  "executor_identifier": "executor:synapse-x",
  "client_identifier": "client:8f5f7a4e-3d1f-4f5f-8b2a-7d2e9b7f1c20"
}
```

Response status: `200`

```json
{
  "success": true
}
```

### Invalid Key

Request:

```http
POST /api/validate
Content-Type: application/json
```

```json
{
  "key": "not-a-real-key",
  "executor_identifier": "executor:synapse-x",
  "client_identifier": "client:8f5f7a4e-3d1f-4f5f-8b2a-7d2e9b7f1c20"
}
```

Response status: `403`

```json
{
  "success": false,
  "message": "Invalid key"
}
```

### Expired Key

Expired keys currently return the same public error as invalid keys. This avoids exposing whether a key exists.

Request:

```http
POST /api/validate
Content-Type: application/json
```

```json
{
  "key": "LUXY-EXPIRED-EXAMPLE",
  "executor_identifier": "executor:synapse-x",
  "client_identifier": "client:8f5f7a4e-3d1f-4f5f-8b2a-7d2e9b7f1c20"
}
```

Response status: `403`

```json
{
  "success": false,
  "message": "Invalid key"
}
```

### Disabled Key

Disabled keys currently return the same public error as invalid keys. This avoids exposing whether a key exists but has been disabled.

Request:

```http
POST /api/validate
Content-Type: application/json
```

```json
{
  "key": "LUXY-DISABLED-EXAMPLE",
  "executor_identifier": "executor:synapse-x",
  "client_identifier": "client:8f5f7a4e-3d1f-4f5f-8b2a-7d2e9b7f1c20"
}
```

Response status: `403`

```json
{
  "success": false,
  "message": "Invalid key"
}
```

### Device Limit Reached

Request:

```http
POST /api/validate
Content-Type: application/json
```

```json
{
  "key": "LUXY-DEVICE-LIMITED-EXAMPLE",
  "executor_identifier": "executor:synapse-x",
  "client_identifier": "client:new-device-over-limit"
}
```

Response status: `403`

```json
{
  "success": false,
  "message": "Device limit reached"
}
```

### Missing Device Fingerprint

Device-limited keys require both `executor_identifier` and `client_identifier`.

Request:

```http
POST /api/validate
Content-Type: application/json
```

```json
{
  "key": "LUXY-DEVICE-LIMITED-EXAMPLE",
  "executor_identifier": "executor:synapse-x",
  "client_identifier": ""
}
```

Response status: `400`

```json
{
  "success": false,
  "message": "Device fingerprint is required"
}
```

Other current failure responses:

| Condition | Status | Response |
|---|---:|---|
| Missing `key` | `400` | `{ "success": false, "message": "Key is required" }` |
| Invalid JSON body | `400` | `{ "success": false, "message": "Invalid JSON body" }` |
| Rate limited | `429` | `{ "success": false, "message": "Too many requests. Please try again later." }` |
| Server error | `500` | `{ "success": false, "message": "Server error" }` |

## 5. Device Limits

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

## 6. Runtime Execution Strategy

The delivered payload may already be downloaded before validation, depending on the current loader/bootstrap implementation. Phase 7B.6 does not change delivery architecture. Runtime integration must therefore treat the downloaded Main Script as locked content that is present but not executed until validation succeeds.

Explicit answers for runtime developers:

- Is payload already downloaded before validation? Yes, it may be. Do not rely on delivery fetch as the validation boundary for Phase 7B.6.
- Is payload executed only after validation? Yes. Main Script execution must be delayed until `/api/validate` returns `{ "success": true }`.
- What exact event unlocks execution? Receiving a successful HTTP response whose parsed JSON body has `success === true` from `POST /api/validate` unlocks execution.

Clear execution sequence:

1. Loader starts.
2. Delivery/bootstrap prepares the runtime payload using the existing delivery architecture.
3. Runtime stores the Main Script execution function, chunk, or dispatch callback without invoking it.
4. Runtime displays the validation popup.
5. User enters a key.
6. Runtime submits `key`, `executor_identifier`, and `client_identifier` to `POST /api/validate`.
7. Runtime parses the response.
8. If the response is missing, malformed, non-2xx, or `{ "success": false, "message": "..." }`, the popup remains open and displays an error.
9. If the response is `{ "success": true }`, set the in-memory validation state for this execution flow to true.
10. Runtime closes or advances the popup.
11. Runtime invokes the Main Script exactly once for that validated execution flow.

Required guardrail:

```text
if validation_success == true then
  execute_main_script()
else
  block_execution()
end
```

Do not execute the Main Script from any alternate callback, timeout, popup close action, UI cancel action, or failed request path.

## 7. Popup Flow Diagram

```text
Script Start
 ↓
Popup
 ↓
Enter Key
 ↓
POST /api/validate
 ↓
Success?
 ├─ No → Show Error
 └─ Yes → Execute Main Script
```

Popup behavior:

- The popup appears before Main Script execution.
- The popup remains visible or blocking while validation is pending.
- The popup displays the backend `message` for validation failures when available.
- The popup must not expose raw key, executor identifier, or client identifier values in logs or screenshots beyond the user-entered key field itself.

## 8. Runtime Requirements

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

## 9. Future Compatibility

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

## 10. Runtime Testing Checklist

Runtime implementation acceptance tests:

- [ ] Valid Free Key: popup accepts a valid Free Key and Main Script executes after `/api/validate` returns `{ "success": true }`.
- [ ] Valid Weekly Key: popup accepts a valid Weekly Premium Key and Main Script executes after validation success.
- [ ] Valid Monthly Key: popup accepts a valid Monthly Premium Key and Main Script executes after validation success.
- [ ] Valid Custom Key: popup accepts a valid Custom Premium Key and Main Script executes after validation success.
- [ ] Invalid Key: popup shows `Invalid key` and Main Script remains blocked.
- [ ] Expired Key: popup shows the current backend failure message `Invalid key` and Main Script remains blocked.
- [ ] Disabled Key: popup shows the current backend failure message `Invalid key` and Main Script remains blocked.
- [ ] Device Limit Reached: popup shows `Device limit reached` and Main Script remains blocked.
- [ ] Missing Fingerprint: popup shows `Device fingerprint is required` for device-limited keys when either identifier is missing or blank.
- [ ] Main Script Blocked Before Validation: Main Script does not execute when the popup is open, when no key is entered, while validation is pending, or after validation failure.
- [ ] Main Script Executes After Validation: Main Script executes only after a parsed `/api/validate` response returns `{ "success": true }`.
- [ ] No Permanent Cache: restarting the script requires validation again unless a separately approved short-lived runtime policy exists.
- [ ] Protected Components Unchanged: delivery session creation, delivery fetch, runtime payload delivery, analytics, event platform, and build-system behavior are unchanged.

## 11. Definition Of Done

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
