# Module Lifecycle Contract

Status: Design Frozen
Date: 2026-06-12

Scope: Frozen lifecycle contract for future script-side game runtime modules. This document does not implement Lua code, runtime code, website code, delivery changes, authorization changes, loader changes, database changes, schema changes, API changes, production changes, or Phase 7B behavior.

## 1. Purpose

The module lifecycle contract defines how the dispatcher initializes, starts, stops, and destroys game runtime modules. It prevents each script from inventing a different startup and shutdown model and allows shared runtime services to preserve analytics, event reporting, error boundaries, and safe shutdown behavior.

## 2. Lifecycle States

| State | Meaning |
|---|---|
| `REGISTERED` | Module exists in the registry and has metadata, but no runtime instance has been initialized. |
| `INITIALIZED` | Module received runtime context and completed initialization checks. No features are running yet. |
| `STARTING` | Module start hook is running. Feature logic may be preparing but is not considered fully active. |
| `RUNNING` | Module started successfully and game features may execute. |
| `STOPPING` | Module stop hook is running and feature activity should wind down. |
| `STOPPED` | Module stopped cleanly and should no longer execute features. |
| `FAILED` | Module failed during init/start/run/stop/destroy and the error boundary owns reporting and shutdown decisions. |

## 3. Required Lifecycle Hooks

Future implementation names may follow language conventions, but the contract semantics are frozen as:

| Hook | Required | Called By | Purpose |
|---|---:|---|---|
| `Init` | Yes | Dispatcher | Validate runtime context, module metadata, feature flags, and game compatibility before feature execution. |
| `Start` | Yes | Dispatcher | Begin game-specific runtime behavior after authorization, metadata validation, and successful initialization. |
| `Stop` | Yes | Runtime / dispatcher | Gracefully stop active features, event loops, UI, and module-owned state where possible. |
| `Destroy` | Yes | Runtime / dispatcher | Release module resources after stop or failure and prevent further feature execution. |

## 4. Hook Responsibilities

### Init

Responsibilities:

- Validate required runtime context is present.
- Validate `runtime_contract_version` compatibility.
- Validate module metadata and feature flag requirements.
- Validate game/place compatibility before feature logic starts.
- Register module-owned diagnostics with the shared error boundary.
- Avoid starting game features.

Failure behavior:

- Transition to `FAILED`.
- Do not call `Start`.
- Report initialization failure through shared observability if available.

### Start

Responsibilities:

- Start game-specific feature logic.
- Initialize game-specific UI and feature state.
- Emit runtime/module start telemetry through shared services.
- Keep provider credentials, raw keys, raw licenses, and session tokens out of module logic.

Failure behavior:

- Transition to `FAILED`.
- Invoke safe shutdown behavior.
- Report module startup failure through shared error boundary.

### Stop

Responsibilities:

- Stop active module feature loops and handlers.
- Close module UI where possible.
- Emit runtime/module stop telemetry where detectable.
- Prepare module state for destruction.

Failure behavior:

- Continue to `Destroy` when possible.
- Report stop failure as recoverable or unrecoverable depending on runtime safety.

### Destroy

Responsibilities:

- Release module-owned resources.
- Clear references that should not continue running.
- Ensure no feature logic continues after shutdown.
- Finalize diagnostics and safe shutdown.

Failure behavior:

- Report destroy failure through shared error boundary.
- Runtime should consider the module terminal for the current session.

## 5. State Transition Rules

Allowed transitions:

```text
REGISTERED -> INITIALIZED
INITIALIZED -> STARTING
STARTING -> RUNNING
RUNNING -> STOPPING
STOPPING -> STOPPED

REGISTERED -> FAILED
INITIALIZED -> FAILED
STARTING -> FAILED
RUNNING -> FAILED
STOPPING -> FAILED
STOPPED -> DESTROYED-equivalent terminal state through Destroy semantics
FAILED -> Destroy semantics
```

Rules:

- `Start` must not run before `Init` succeeds.
- `RUNNING` must not be reached unless `Start` succeeds.
- `Stop` should be idempotent from `RUNNING` or `STARTING` when safe.
- `Destroy` should be callable after `STOPPED` or `FAILED`.
- A module in `FAILED` must not return to `RUNNING` in the same runtime session.
- Dispatcher must not start more than one module unless metadata explicitly declares a multi-module bundle.

## 6. Error Behavior

Error categories:

| Error Type | Example | Expected Behavior |
|---|---|---|
| Init error | Missing required context | Fail before feature execution. |
| Compatibility error | Unsupported contract version | Fail before dispatch/start. |
| Start error | Game module cannot initialize features | Report and safe shutdown. |
| Runtime error | Feature loop throws after start | Report; recover or stop depending on severity. |
| Stop error | Module cannot cleanly stop one feature | Report; continue destroy when safe. |
| Destroy error | Cleanup fails | Report terminal failure; do not restart in same session. |

Shared analytics and event reporting should survive module errors when possible because diagnostics are needed for incident response.

## 7. Dispatcher Expectations

The dispatcher must:

- Load module metadata from the registry/runtime metadata.
- Validate `enabled` state before lifecycle hooks.
- Validate runtime/module contract compatibility before `Init`.
- Call lifecycle hooks in order.
- Wrap each hook in the shared error boundary.
- Emit safe lifecycle observability events.
- Stop before feature execution when compatibility, metadata, or kill switch checks fail.

The dispatcher must not:

- Bypass authorization status.
- Start module logic before metadata validation.
- Treat module-reported identity, entitlement, or credentials as trusted.
- Retry failed modules indefinitely.

## 8. Contract Freeze Decision

The module lifecycle states, required hooks, hook responsibilities, error behavior, and dispatcher expectations are frozen for design purposes. Future implementation may choose language-specific function names, but must preserve these lifecycle semantics.
