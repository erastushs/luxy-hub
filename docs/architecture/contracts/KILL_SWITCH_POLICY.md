# Kill Switch Policy

Status: Design Frozen
Date: 2026-06-12

Scope: Frozen policy for future script runtime kill switches. This document does not implement Lua code, runtime code, website code, delivery changes, authorization changes, loader changes, database changes, schema changes, API changes, production changes, or Phase 7B behavior.

## 1. Purpose

Kill switches allow LuxyHub operators to disable all scripts, one script, or one module without requiring loader updates. Kill switches are server-owned operational controls consumed by runtime metadata.

The primary runtime field is `enabled` from the runtime metadata schema. `enabled = false` means dispatcher/module startup must not proceed.

## 2. Kill Switch Types

| Kill Switch | Scope | Metadata Effect | Purpose |
|---|---|---|---|
| Global Kill Switch | All scripts | `enabled = false` for all runtime metadata | Emergency platform-wide stop. |
| Script Kill Switch | One script/product | `enabled = false` for one script slug/id | Disable a broken, unsafe, or paused script. |
| Module Kill Switch | One module or module version | Dispatcher receives disabled module state or alternate module metadata | Disable a broken module without affecting all scripts. |

## 3. Activation Authority

| Switch | Activation Authority | Approval Model |
|---|---|---|
| Global | Operations owner or platform owner | Emergency activation allowed; post-incident review required. |
| Script | Product owner, operations owner, or platform owner | May be planned maintenance or emergency. |
| Module | Runtime owner, module owner, or operations owner | May be activated on crash spikes, compatibility failures, or rollout rollback. |

## 4. Emergency Process

Emergency activation process:

1. Identify scope: global, script, or module.
2. Activate the narrowest kill switch that mitigates the incident.
3. Ensure runtime metadata returns disabled state or safe fallback metadata.
4. Confirm failure UX appears and main script logic does not start.
5. Monitor observability for reduced errors or stopped execution.
6. Document incident timeline and activation reason.
7. Keep switch active until recovery criteria are met.

## 5. Maintenance Process

Planned maintenance process:

1. Schedule maintenance window.
2. Prepare safe `maintenance_message`.
3. Activate script or global disabled state at the scheduled time.
4. Confirm runtime shows maintenance UX without credential prompts where disabled state is known.
5. Complete maintenance.
6. Restore `enabled = true`.
7. Monitor startup and runtime metrics after recovery.

## 6. Failure UX

Runtime UX should be safe, clear, and non-technical.

Recommended messages:

- Global: `LuxyHub is temporarily under maintenance. Please try again later.`
- Script: `This script is temporarily unavailable. Please try again later.`
- Module: `This script version is temporarily unavailable. Please try again later.`

Failure UX must not include:

- Raw stack traces.
- Internal switch names.
- Security incident details.
- Raw metadata.
- Credentials, session tokens, or customer identifiers.

## 7. Recovery Process

Recovery process:

1. Confirm incident or maintenance reason is resolved.
2. Confirm safe module/runtime version is available.
3. Restore `enabled = true` or route to a compatible module version.
4. Monitor `loader_start`, `payload_fetch_success`, `runtime_start`, and `runtime_error` rates.
5. Confirm no elevated authorization or runtime failures.
6. Close incident or maintenance record.

## 8. Examples

Global kill switch example:

- Event platform or delivery payload incident affects all scripts.
- Set all runtime metadata to disabled.
- Runtime shows global maintenance UX.
- No dispatcher/module startup occurs.

Script kill switch example:

- `blox-fruits` module breaks after a game update.
- Disable only the Blox Fruits script metadata.
- Other scripts continue operating.

Module kill switch example:

- `grow-a-garden-runtime` version `2.1.0` has elevated crash rate.
- Disable module version `2.1.0`.
- Route to `2.0.9` if compatible, otherwise show module unavailable UX.

## 9. Expected Runtime Behavior

Runtime must:

- Check disabled state before dispatcher/module startup.
- Stop before main game logic executes when disabled.
- Prefer safe fallback module only when metadata explicitly provides one.
- Emit safe disabled/maintenance observability where event context is available.
- Avoid credential prompts if the disabled state is already known.
- Treat kill switch state as server-owned and read-only.

Runtime must not:

- Override kill switch state locally.
- Continue module startup with `enabled = false`.
- Hide disabled state behind repeated retries.
- Leak incident details in UI or events.

## 10. Contract Freeze Decision

Global, script, and module kill switch semantics, activation authority, emergency process, maintenance process, failure UX, recovery process, and expected runtime behavior are frozen for design purposes.
