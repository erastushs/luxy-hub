# Runtime Metadata Schema

Status: Design Frozen
Date: 2026-06-12

Scope: Frozen script-side runtime metadata contract for future LuxyHub runtime architecture. This document does not implement Lua code, runtime code, website code, delivery changes, authorization changes, loader changes, database changes, schema changes, API changes, production changes, or Phase 7B behavior.

## 1. Purpose

Runtime metadata is the canonical configuration object consumed by the future script-side runtime after authorization/session creation and before dispatcher startup. It tells the runtime which script is being loaded, which module should run, which contract versions are expected, which feature flags apply, and whether execution is allowed.

Main script logic must not load unless runtime metadata is present, compatible, and enabled.

## 2. Runtime Metadata Object

```text
runtime_metadata
  script_slug
  script_id
  access_mode
  runtime_contract_version
  module_id
  module_version
  payload_version
  feature_flags
  enabled
  maintenance_message?
  rollout_group?
  compatibility_window?
```

## 3. Field Definitions

| Field | Type | Required | Owner | Purpose |
|---|---|---:|---|---|
| `script_slug` | string | Yes | Server/runtime metadata | Stable human-readable script route used by loader, dispatcher, analytics, and support workflows. |
| `script_id` | string | Yes | Server/runtime metadata | Stable opaque script identifier used for correlation, analytics, and event reporting. |
| `access_mode` | string enum: `public`, `key_required`, `license_required` | Yes | Server authorization/configuration | Declares the authorization mode that produced the runtime session. Runtime consumes this for UX, analytics, and diagnostics only. |
| `runtime_contract_version` | string | Yes | Runtime platform | Declares the shared runtime contract version required by the metadata and compatible module. |
| `module_id` | string | Yes | Module registry | Identifies the game runtime module selected for dispatch. |
| `module_version` | string | Yes | Module registry | Identifies the exact module version selected for dispatch and observability. |
| `payload_version` | string | Yes | Delivery/runtime platform | Identifies the payload format/runtime payload generation version. |
| `feature_flags` | object/map of string keys to boolean or structured flag values | Yes | Server configuration | Server-owned rollout, experiment, emergency, and compatibility controls consumed read-only by runtime. |
| `enabled` | boolean | Yes | Server configuration / kill switch policy | Determines whether runtime execution may continue. `false` blocks dispatcher/module start. |
| `maintenance_message` | string | No | Server configuration / operations | Safe user-facing maintenance or disabled-state message. Must not include secrets or incident details. |
| `rollout_group` | string | No | Server configuration | Optional cohort identifier for staged runtime/module rollout and analytics segmentation. |
| `compatibility_window` | object | No | Runtime platform | Optional metadata describing supported legacy contract/module versions during migration windows. |

## 4. Required Field Rules

- Missing required fields make metadata invalid.
- Invalid `access_mode` makes metadata invalid.
- Missing `feature_flags` must be treated as invalid metadata; an empty object is valid.
- `enabled = false` is valid metadata but blocks runtime start.
- `runtime_contract_version`, `module_id`, `module_version`, and `payload_version` must be captured in observability events when available.
- Runtime must treat metadata as server-owned and read-only.

## 5. Optional Field Rules

- `maintenance_message` is used only for safe UX and may be omitted.
- `rollout_group` is used for observability and staged rollout analysis; it must not contain raw user identifiers.
- `compatibility_window` is advisory metadata for contract migration and must not override hard compatibility validation.

## 6. Example Metadata Payload

```json
{
  "script_slug": "blox-fruits",
  "script_id": "scr_01HZXAMPLE000000000000000",
  "access_mode": "key_required",
  "runtime_contract_version": "runtime-contract-v1",
  "module_id": "blox-fruits-runtime",
  "module_version": "1.4.2",
  "payload_version": "runtime-payload-v1",
  "feature_flags": {
    "analytics_v2": false,
    "license_runtime_enforcement": false,
    "new_authorization_window": true,
    "experimental_runtime": false
  },
  "enabled": true,
  "rollout_group": "stable",
  "compatibility_window": {
    "supports_module_contracts": ["module-contract-v1"],
    "deprecated_after": null
  }
}
```

Disabled example:

```json
{
  "script_slug": "grow-a-garden",
  "script_id": "scr_01HZXAMPLE111111111111111",
  "access_mode": "license_required",
  "runtime_contract_version": "runtime-contract-v1",
  "module_id": "grow-a-garden-runtime",
  "module_version": "2.0.0",
  "payload_version": "runtime-payload-v1",
  "feature_flags": {},
  "enabled": false,
  "maintenance_message": "This script is temporarily unavailable. Please try again later."
}
```

## 7. Versioning Strategy

Runtime metadata versioning is governed by `runtime_contract_version` and `payload_version`.

Rules:

- Additive metadata changes are allowed within a contract version when existing fields keep the same meaning.
- Required field removals require a new `runtime_contract_version`.
- Required field type changes require a new `runtime_contract_version`.
- Payload format changes require a new `payload_version`.
- Module compatibility changes must be represented through `module_version` and contract compatibility rules.
- Older modules may continue running during a documented `compatibility_window` only when the runtime contract explicitly supports them.

Recommended rollout:

1. Add new optional metadata fields first.
2. Teach runtime and modules to ignore unknown fields safely.
3. Promote fields to required only in a new contract version.
4. Keep old and new contract support during migration windows.
5. Remove old contract support only after observability confirms migration completion.

## 8. Contract Freeze Decision

The runtime metadata schema is frozen for design purposes. Future implementation may refine serialization details, but changes to required fields, ownership, or semantics require a new design review before Phase 7B Key Monetization implementation. Premium-license metadata changes belong to Phase 7C review.
