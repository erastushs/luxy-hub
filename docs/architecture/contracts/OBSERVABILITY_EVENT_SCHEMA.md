# Observability Event Schema

Status: Design Frozen
Date: 2026-06-12

Scope: Frozen canonical runtime observability event schema for future script-side runtime architecture. This document does not implement Lua code, runtime code, website code, delivery changes, authorization changes, loader changes, database changes, schema changes, API changes, production changes, or Phase 7B behavior.

## 1. Purpose

Runtime observability events provide consistent lifecycle visibility across loaders, authorization UX, delivery fetch, runtime bootstrap, dispatcher, and game modules. These events support Analytics V2, operational monitoring, incident response, and rollout analysis.

## 2. Common Event Envelope

Every observability event should follow the same conceptual envelope.

Required common fields:

| Field | Type | Purpose |
|---|---|---|
| `event_name` | string | Canonical event name. |
| `category` | string | Event category such as `loader`, `authorization`, `delivery`, `runtime`, or `error`. |
| `timestamp` | ISO timestamp or server-derived timestamp | Event occurrence time. |
| `script_slug` | string | Script route or product slug when known. |
| `script_id` | string | Stable script identifier when known. |
| `runtime_contract_version` | string | Runtime contract version when known. |
| `module_id` | string | Module identifier when known. |
| `module_version` | string | Module version when known. |
| `payload_version` | string | Runtime payload version when known. |

Optional common fields:

| Field | Type | Purpose |
|---|---|---|
| `access_mode` | string | `public`, `key_required`, or `license_required` when known. |
| `rollout_group` | string | Safe rollout cohort identifier. |
| `feature_flags` | object/map | Safe flag state summary; no secrets. |
| `error_category` | string | Stable non-sensitive error category. |
| `failure_reason` | string | Safe high-level failure reason. |
| `duration_ms` | number | Timing measurement when available. |
| `attempt` | number | Retry attempt number when available. |

## 3. Canonical Events

### `loader_start`

| Attribute | Value |
|---|---|
| Category | `loader` |
| Required fields | Common fields available at loader start: `event_name`, `category`, `timestamp`, `script_slug` when known |
| Optional fields | `script_id`, `rollout_group`, environment capability category |
| Privacy requirements | No local file paths, raw executor identifiers, credentials, or session tokens. |

### `authorization_prompt`

| Attribute | Value |
|---|---|
| Category | `authorization` |
| Required fields | Common fields, `access_mode` |
| Optional fields | prompt type, remembered credential attempted flag, `rollout_group` |
| Privacy requirements | Do not include key, license key, customer identifier, or raw prompt input. |

### `authorization_success`

| Attribute | Value |
|---|---|
| Category | `authorization` |
| Required fields | Common fields, `access_mode`, `duration_ms` when available |
| Optional fields | remembered credential used flag, `rollout_group` |
| Privacy requirements | Do not include key, license key, customer identifier, session token, or entitlement internals. |

### `authorization_failure`

| Attribute | Value |
|---|---|
| Category | `authorization` |
| Required fields | Common fields, `access_mode`, `failure_reason` |
| Optional fields | `attempt`, safe denial category, `duration_ms` |
| Privacy requirements | Use generic failure categories. Do not include raw credentials or oracle-like detail. |

### `payload_fetch_start`

| Attribute | Value |
|---|---|
| Category | `delivery` |
| Required fields | Common fields, `payload_version` when known |
| Optional fields | `attempt` |
| Privacy requirements | Do not include delivery session token or fetch URL secrets. |

### `payload_fetch_success`

| Attribute | Value |
|---|---|
| Category | `delivery` |
| Required fields | Common fields, `payload_version`, `duration_ms` when available |
| Optional fields | payload size category, not raw payload content |
| Privacy requirements | Do not include payload content, hashes, secrets, or session token. |

### `payload_fetch_failure`

| Attribute | Value |
|---|---|
| Category | `delivery` |
| Required fields | Common fields, `failure_reason` |
| Optional fields | `attempt`, `duration_ms`, retryable flag |
| Privacy requirements | Do not include raw response bodies if they may contain sensitive details. |

### `runtime_start`

| Attribute | Value |
|---|---|
| Category | `runtime` |
| Required fields | Common fields, `module_id`, `module_version`, `runtime_contract_version` |
| Optional fields | `feature_flags`, `rollout_group` |
| Privacy requirements | Do not include runtime memory, source content, or credentials. |

### `runtime_stop`

| Attribute | Value |
|---|---|
| Category | `runtime` |
| Required fields | Common fields, stop reason when available |
| Optional fields | runtime duration category, clean shutdown flag |
| Privacy requirements | No raw runtime state or user identifiers. |

### `runtime_error`

| Attribute | Value |
|---|---|
| Category | `error` |
| Required fields | Common fields, `error_category`, safe error stage |
| Optional fields | module lifecycle state, recoverable flag, `failure_reason` |
| Privacy requirements | No raw stack traces unless sanitized. No credentials, session tokens, raw identifiers, or source content. |

## 4. PII Restrictions

Observability events must not include:

- Raw customer identifiers.
- Raw hardware identifiers.
- Raw Roblox user identifiers unless a future privacy review explicitly allows a safe normalized form.
- IP addresses from the client.
- Email addresses.
- Local usernames or file paths.
- Free-form user-entered credential text.

If correlation is required, use server-approved opaque identifiers or hashed identifiers with documented privacy controls.

## 5. Credential Restrictions

Observability events must never include:

- Work.ink keys.
- License keys.
- Delivery session tokens.
- Event secrets.
- Provider credentials.
- Authorization headers.
- Raw payload content.

Credential-related failures must use safe categories such as `missing_credential`, `invalid_credential`, `expired_credential`, `capacity_unavailable`, `network_failure`, or `server_unavailable`.

## 6. Retention Considerations

Retention should be based on operational value and privacy risk:

- High-level lifecycle counters may be retained longer for analytics trends.
- Error diagnostics should have shorter retention unless needed for incidents.
- Rollout and feature flag telemetry should be retained long enough to compare cohorts.
- Any field with privacy sensitivity should have stricter retention and minimization.
- Raw credentials and secrets are prohibited and therefore have no retention path.

## 7. Example Payloads

Authorization success example:

```json
{
  "event_name": "authorization_success",
  "category": "authorization",
  "timestamp": "2026-06-12T03:00:00Z",
  "script_slug": "blox-fruits",
  "script_id": "scr_01HZXAMPLE000000000000000",
  "access_mode": "key_required",
  "runtime_contract_version": "runtime-contract-v1",
  "module_id": "blox-fruits-runtime",
  "module_version": "1.4.2",
  "payload_version": "runtime-payload-v1",
  "rollout_group": "stable",
  "duration_ms": 240
}
```

Runtime error example:

```json
{
  "event_name": "runtime_error",
  "category": "error",
  "timestamp": "2026-06-12T03:01:00Z",
  "script_slug": "grow-a-garden",
  "script_id": "scr_01HZXAMPLE111111111111111",
  "access_mode": "license_required",
  "runtime_contract_version": "runtime-contract-v1",
  "module_id": "grow-a-garden-runtime",
  "module_version": "2.0.0",
  "payload_version": "runtime-payload-v1",
  "error_category": "module_start_failed",
  "failure_reason": "compatibility_check_failed",
  "recoverable": false
}
```

Payload fetch failure example:

```json
{
  "event_name": "payload_fetch_failure",
  "category": "delivery",
  "timestamp": "2026-06-12T03:02:00Z",
  "script_slug": "steal-a-brainrot",
  "script_id": "scr_01HZXAMPLE222222222222222",
  "access_mode": "public",
  "runtime_contract_version": "runtime-contract-v1",
  "module_id": "steal-a-brainrot-runtime",
  "module_version": "1.0.0",
  "payload_version": "runtime-payload-v1",
  "failure_reason": "network_failure",
  "attempt": 1,
  "retryable": true
}
```

## 8. Contract Freeze Decision

The canonical observability event names, event categories, field expectations, privacy restrictions, credential restrictions, retention considerations, and example payload shapes are frozen for design purposes. Future implementation must preserve these event semantics before adding runtime-specific transport details.
