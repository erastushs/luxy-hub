# LuxyHub Script Runtime Architecture

Status: Design Frozen
Date: 2026-06-12

Scope: Future script-side runtime architecture for shared loaders, authorization UX, script dispatch, analytics, and event reporting. This document does not implement Lua code, runtime code, website code, delivery changes, Phase 7A changes, Phase 7B changes, production behavior changes, database changes, schema changes, or API changes.

Design freeze status:

- Script Runtime Architecture: DESIGN FROZEN
- Phase 7B Key Monetization: DESIGN REALIGNED
- Implementation: Not Started
- Contract freeze: Complete in `contracts/`
- Phase 7B Key Monetization implementation remains deferred until explicitly approved after the Production Stabilization Window. Premium license runtime behavior belongs to Phase 7C.

Frozen contract documents:

- `contracts/RUNTIME_METADATA_SCHEMA.md`
- `contracts/MODULE_LIFECYCLE_CONTRACT.md`
- `contracts/FEATURE_FLAG_POLICY.md`
- `contracts/KILL_SWITCH_POLICY.md`
- `contracts/OBSERVABILITY_EVENT_SCHEMA.md`

## 1. Executive Summary

LuxyHub should use a universal script-side runtime architecture built around one shared loader, one shared authorization experience, one shared session and delivery path, one shared analytics/event model, and game-specific runtime modules selected by a dispatcher.

Recommended architecture:

```text
Universal Loader
  -> Authorization Window
  -> Server Authorization / Session Creation
  -> Payload Fetch
  -> Runtime Bootstrap
  -> Script Dispatcher
  -> Game Runtime Module
```

The universal loader should be small, stable, and generic. It should not contain game-specific feature logic. Its job is to identify the requested script or game, collect required credentials, request authorization, fetch the authorized payload, start the runtime bootstrap, and pass control to the dispatcher. Main script logic must not load until authorization succeeds.

The dispatcher should map runtime context to a game-specific module such as Blox Fruits, Grow A Garden, or Steal A Brainrot. Each game module owns feature behavior, game detection, UI decisions, and game-specific compatibility handling. Shared runtime services, such as analytics event emission, event reporting, error boundaries, version metadata, and credential state, should be reused across modules.

This architecture is preferred over separate loaders, separate key systems, or separate analytics systems per script because it reduces duplicated logic, centralizes security-sensitive behavior, simplifies updates, and allows LuxyHub to scale from 1 script to 10 scripts to 50+ scripts without rebuilding foundational systems for every game.

## 2. Architecture Diagram

```text
User Executor
  |
  | executes one universal loader snippet
  v
Universal Loader
  |
  | owns generic startup only
  | - environment checks
  | - script/game identifier intake
  | - credential state lookup
  | - authorization window launch
  | - session request orchestration
  | - payload fetch orchestration
  v
Authorization Layer
  |
  | key/license/public access decision happens before payload execution
  v
Secure Delivery Session
  |
  | one-time authorized runtime payload fetch
  v
Runtime Bootstrap
  |
  | starts shared runtime services
  | - context
  | - analytics hooks
  | - event reporter
  | - safe error reporting boundary
  | - dispatcher handoff
  v
Script Dispatcher
  |
  | selects game runtime module
  v
Game Runtime Module
  |
  | owns game-specific logic
  v
Features Execute
```

### Universal Loader Responsibilities

- Start from a single generic loader snippet.
- Identify the intended script, game, or product route.
- Detect whether authorization is required based on server-provided or payload-provided metadata.
- Display the Key / License Window when credentials are required and not already usable.
- Submit credentials only to the authorization/session boundary.
- Fetch the authorized runtime payload only after authorization succeeds.
- Initialize shared runtime context and pass control to the dispatcher.
- Emit high-level lifecycle events through shared runtime services after a session exists.
- Avoid embedding game-specific feature logic.
- Avoid storing raw secrets beyond the minimum required client-side runtime lifetime.

### Validation Responsibilities

- Server-side authorization remains the source of truth for public, key-required, and license-required access.
- Client-side validation is only UX validation, such as empty fields, obvious malformed inputs, and expiration messaging.
- The client must not decide entitlement. It can only collect credentials and request authorization.
- Delivery session creation is the authorization gate before payload fetch.
- Payload fetch remains dependent on an authorized, short-lived, one-time session.

### Runtime Responsibilities

- Hold shared runtime context after successful authorization.
- Provide module-safe access to script metadata, version metadata, runtime session metadata, and event reporting capabilities.
- Emit lifecycle analytics such as runtime start, runtime stop, and runtime error.
- Route operational telemetry to the event platform without exposing provider credentials.
- Provide a common error boundary so game modules report failures consistently.
- Keep authorization state separate from game-specific feature state.

### Script Dispatch Responsibilities

- Select the correct game runtime module from script metadata, game identifier, place identifier, or product configuration.
- Prevent unrelated game modules from loading when the current context does not match.
- Provide a consistent module contract for initialization, start, stop, and error reporting.
- Support multiple scripts and games without changing the universal loader.

### What Remains Inside The Universal Loader

- Minimal startup logic.
- Credential collection UX orchestration.
- Authorization/session request orchestration.
- Payload fetch orchestration.
- Shared runtime bootstrap handoff.
- Dispatcher invocation.
- Generic lifecycle/error reporting hooks.

### What Is Delegated To Game-Specific Scripts

- Game feature logic.
- Game-specific UI and menu design.
- Game-specific compatibility checks.
- Game-specific object, event, and remote handling.
- Game-specific feature flags.
- Game-specific runtime state.
- Game-specific telemetry semantics beyond shared lifecycle events.

## 3. Authorization Flow Diagram

```text
User Executes Loader
  |
  v
Universal Loader Starts
  |
  v
Resolve Script Metadata / Access Mode
  |
  +-- public ------------------------------+
  |                                        |
  +-- key_required --> Key Window ---------+--> Submit Session Request
  |                                        |
  +-- license_required --> License Window -+
                                             |
                                             v
                                      Server Authorization
                                             |
                 +---------------------------+---------------------------+
                 |                                                       |
                 v                                                       v
          Authorization Success                                  Authorization Failure
                 |                                                       |
                 v                                                       v
          Session Created                                      Show Failure State
                 |                                                       |
                 v                                                       v
          Payload Fetch                                        Retry / Get Key / Exit
                 |
                 v
          Payload Loaded
                 |
                 v
          Runtime Bootstrap
                 |
                 v
          Dispatcher Selects Game Runtime
                 |
                 v
          Runtime Start / Features Execute
```

### Success Flow

1. User executes the universal loader.
2. Loader resolves the intended script and access requirements.
3. If credentials are required, the Key / License Window appears before main script logic loads.
4. User submits a Work.ink key or license credentials.
5. Loader requests a delivery session through the authorization boundary.
6. Server validates access requirements and creates a one-time delivery session.
7. Loader fetches the authorized payload.
8. Runtime bootstrap starts shared runtime services.
9. Dispatcher selects the game runtime module.
10. Game runtime starts and features execute.

### Failure Flow

1. User executes the universal loader.
2. Loader determines credentials are missing, invalid, expired, or rejected by the server.
3. Main script payload is not fetched or executed.
4. Authorization Window shows a generic denial state such as invalid key, expired key, license unavailable, capacity exceeded, or network failure depending on safe server response categories.
5. User may retry, open the Get Key flow, correct license input, or exit.
6. Shared analytics can record authorization failure only through approved event boundaries and without raw credentials.

### Retry Flow

```text
Failure State
  |
  +-- invalid/missing key ------> Re-enter key or Get Key
  +-- expired key --------------> Get Key again
  +-- missing license ----------> Enter license key and identifier
  +-- network failure ----------> Retry same request with backoff UX
  +-- session fetch failure ----> Request a fresh session, then fetch again
  +-- repeated denial ----------> Stop and show support guidance
```

Retry rules:

- Retry must never load the main script before authorization succeeds.
- A failed payload fetch should not reuse an already consumed or expired delivery session.
- Network retry should distinguish between connectivity failure and authorization denial.
- Repeated failures should avoid tight retry loops and should guide the user toward Get Key, license correction, or support.
- Raw keys, license keys, and customer identifiers should not be included in analytics or error messages.

## 4. Key / License Window Design

The Key / License Window is a shared script-side authorization UX. It appears before main runtime loading whenever the selected script requires credentials and no currently usable credential state exists.

### Get Key Flow

```text
Key Required
  |
  v
Show Key Window
  |
  +-- User Has Key -> Enter Key -> Validate Through Session Request
  |
  +-- User Needs Key -> Open Get Key Instructions / Link
                           |
                           v
                    User Completes Key Flow
                           |
                           v
                    User Returns With Key
                           |
                           v
                    Validate Through Session Request
```

Design principles:

- The window should explain why a key is required.
- The Get Key action should route users to the existing key acquisition flow, not duplicate key issuance inside the script.
- The loader should not implement a separate key system per script.
- Key validation should be confirmed through server authorization before payload fetch.

### License Flow

```text
License Required
  |
  v
Show License Window
  |
  +-- License Key Field
  +-- Customer Identifier Field or Runtime-Derived Identifier Display
  +-- Remember Option, if allowed
  |
  v
Submit Session Request
  |
  +-- valid license and assignment allowed -> payload fetch
  +-- invalid / expired / disabled / revoked -> denial state
  +-- assignment capacity exceeded -> denial state
```

Design principles:

- License UX should be shared across all premium scripts.
- License validation must occur server-side.
- The window should avoid exposing raw credential values after submission.
- Customer/device identifier semantics should remain generic and must not be treated as tamper-proof client-side identity.

### Remember Key Behavior

Remembered credentials are a UX convenience, not a security boundary.

Recommended behavior:

- Remember only when the user opts in or when product policy explicitly allows it.
- Store credentials in the safest available client-side location for the executor environment, with the assumption that client storage is inspectable by the user.
- Revalidate remembered credentials server-side before each protected payload load.
- Do not skip session creation because a key or license was remembered.
- Allow users to clear remembered credentials.
- Prefer storing minimal references or masked state where possible; avoid long-lived raw credential exposure when the environment allows safer alternatives.

### Revalidation Behavior

- Public scripts can proceed directly to session creation without showing the window.
- Key-required scripts should revalidate the key when a new runtime session is needed.
- License-required scripts should revalidate license and customer identifier state when a new runtime session is needed.
- Revalidation is required after process restart, executor restart, expired local state, explicit logout/clear, server denial, or version/access policy change.
- Revalidation should happen before payload fetch and before main runtime loading.

### Expiration Handling

- Expired keys should route users back to the Get Key flow.
- Expired licenses should show a license expiration message and support guidance.
- Expired delivery sessions should be recreated through a fresh authorization attempt.
- Expired local remembered state should show the authorization window again.
- Expiration messaging should avoid leaking whether unrelated scripts, licenses, or accounts exist.

### When The Window Should Appear

- Script access mode requires a key and no remembered key is available.
- Script access mode requires a key and remembered key fails revalidation.
- Script access mode requires a license and required license fields are missing.
- Script access mode requires a license and remembered license state fails revalidation.
- Server responds with an authorization failure that can be corrected by user action.
- Local credential state was cleared, expired, or is incompatible with the selected script.

### When The Window Should Not Appear

- Public script path requires no key or license.
- A remembered credential exists and silent server revalidation succeeds.
- Runtime is already authorized and active for the current session.
- Failure is non-recoverable in the current environment, such as unsupported executor or blocked network, where a direct error state is clearer than credential input.
- Main runtime has already started; post-start authorization prompts should not be used as a substitute for pre-load authorization.

## 5. Script Dispatcher Diagram

```text
Universal Loader
  |
  v
Runtime Bootstrap
  |
  v
Dispatcher Context
  |
  |-- script slug / product id
  |-- game id / place id
  |-- runtime version
  |-- feature flags
  |-- access mode result
  |-- event reporter
  |-- analytics hooks
  v
Script Dispatcher
  |
  +-- Blox Fruits Runtime
  |
  +-- Grow A Garden Runtime
  |
  +-- Steal A Brainrot Runtime
  |
  +-- Future Game Runtime
```

### How One Loader Supports Many Games

The universal loader should never hardcode the full behavior of every supported game. Instead, it should load a versioned runtime payload containing shared runtime code and dispatch metadata. The dispatcher uses metadata and environment context to select exactly one game runtime module.

Example routing model:

| Input | Dispatcher Decision |
|---|---|
| Script slug `blox-fruits` | Load Blox Fruits runtime module |
| Script slug `grow-a-garden` | Load Grow A Garden runtime module |
| Script slug `steal-a-brainrot` | Load Steal A Brainrot runtime module |
| Place ID matches configured game | Load matching runtime module if script policy allows it |
| Unknown game or unsupported context | Stop before feature execution and report safe error |

Dispatcher responsibilities:

- Match runtime context to a supported module.
- Verify the module is compatible with the current runtime contract version.
- Provide shared services to the module through a stable context object.
- Prevent multiple game modules from competing for startup unless explicitly configured as a multi-game bundle.
- Emit runtime start only after the selected game module begins execution.

Game runtime responsibilities:

- Validate game-specific assumptions.
- Initialize game-specific menus and feature state.
- Register feature handlers.
- Emit feature-level events through shared event reporting when appropriate.
- Stop cleanly when requested by shared runtime controls.

## 6. Runtime Contract Versioning

Runtime contract versioning prevents future loader, bootstrap, dispatcher, and shared runtime changes from breaking older game modules.

```text
Universal Loader
  |
  v
Runtime Bootstrap
  |
  v
Contract Validation
  |
  +-- supported ----> Dispatcher
  |
  +-- unsupported --> Safe Failure UX / Update Required
```

### Runtime Contract Version

`runtime_contract_version` is the compatibility contract between shared runtime services and game runtime modules. It describes the module lifecycle methods, available shared services, metadata shape, feature flag shape, analytics/event expectations, and error boundary behavior a module can rely on.

Frozen contract source of truth: `contracts/RUNTIME_METADATA_SCHEMA.md` and `contracts/MODULE_LIFECYCLE_CONTRACT.md`.

Design requirements:

- Every runtime payload should declare a `runtime_contract_version`.
- Every game module should declare a supported `module_contract_version` or compatible contract range.
- The bootstrap validates compatibility before the dispatcher starts a module.
- Contract validation happens after payload fetch and before module dispatch.
- Unsupported modules should fail safely before game feature logic executes.

### Compatibility Strategy

Compatibility should be additive by default. New runtime contracts should avoid removing fields, renaming lifecycle hooks, or changing shared service behavior without a migration window.

Example compatibility model:

| Runtime Contract | Supported Module Contracts | Notes |
|---|---|---|
| Contract V1 | Module V1 | Initial runtime/module lifecycle |
| Contract V2 | Module V1, Module V2 | Adds new services while preserving V1 compatibility |
| Contract V3 | Module V2, Module V3 | Removes V1 only after migration window closes |

Contract V1 supports:

- Module V1

Contract V2 supports:

- Module V1
- Module V2

### Unsupported Version Handling

Unsupported version handling should be explicit and safe:

- Stop before dispatcher execution.
- Show an update-required or temporarily unavailable UX.
- Emit a safe compatibility failure event when event context is available.
- Avoid loading partial module logic.
- Avoid retry loops if the incompatibility is deterministic.
- Provide support guidance without exposing internal metadata or secrets.

### Migration Strategy

Recommended migration flow:

1. Introduce the new runtime contract as backward compatible.
2. Release shared runtime bootstrap that supports old and new module contracts.
3. Migrate one reference module to the new contract.
4. Validate analytics, event reporting, error boundary behavior, and feature flags with both old and new modules.
5. Migrate remaining modules in batches.
6. Monitor compatibility failures and runtime errors.
7. Deprecate the old module contract only after production confidence is high.
8. Remove old compatibility only after the documented migration window closes.

### Rollout Strategy

```text
Contract V1 Stable
  |
  v
Introduce Contract V2 With V1 Compatibility
  |
  v
Migrate Reference Module To Module V2
  |
  v
Enable Feature Flags For V2-Only Capabilities
  |
  v
Migrate Remaining Modules In Batches
  |
  v
Monitor Compatibility And Runtime Errors
  |
  v
Deprecate V1 After Migration Window
```

Rollout should be controlled through metadata and feature flags, not by requiring users to copy a new loader for every module update.

## 7. Feature Flag Architecture

Feature flags allow staged rollout of runtime behavior without creating separate loaders or hardcoding per-game branches.

Frozen policy source of truth: `contracts/FEATURE_FLAG_POLICY.md`.

```text
Session Creation
  |
  v
Runtime Metadata
  |
  v
Feature Flags
  |
  v
Dispatcher
  |
  v
Game Module
```

### Purpose

Feature flags should allow LuxyHub to gradually enable shared runtime features, test new UX paths, and isolate risky changes by script, module, account, or rollout cohort.

Example flags:

- `analytics_v2`
- `license_runtime_enforcement`
- `new_authorization_window`
- `experimental_features`

### Server Ownership

Feature flag state should be owned by server-side product configuration or session metadata. The client may consume flags but should not be the source of truth for entitlement, security, or rollout decisions.

Server-owned feature flags should define:

- Whether the flag is enabled for the script.
- Whether the flag is enabled for the module version.
- Whether the flag is enabled for a rollout cohort.
- Whether the flag is safe for public, key-required, or license-required access modes.
- Whether the flag is experimental, default-on, default-off, or deprecated.

### Runtime Consumption

Runtime consumption should be read-only:

- Bootstrap receives feature flags as part of runtime metadata.
- Dispatcher passes relevant flags to the selected module through the shared context.
- Game modules may branch on flags for feature availability or UX variants.
- Shared runtime services may branch on flags for analytics/event behavior.
- Runtime code should treat missing flags as disabled unless explicitly documented otherwise.

### Fallback Behavior

Fallback behavior must be deterministic:

- Missing optional flag: use default-off behavior.
- Unknown flag: ignore safely.
- Required flag missing: stop module startup only if the module declares that flag as required.
- Flag disabled: use stable existing behavior.
- Flag metadata malformed: fail safe for the affected feature, not the whole runtime unless startup would be unsafe.

Feature flags must not bypass authorization. A flag such as `license_runtime_enforcement` may control a future rollout path, but server-side authorization remains the source of truth.

## 8. Kill Switch Architecture

Kill switches allow operators to disable all scripts, individual scripts, or individual modules without requiring loader updates.

Frozen policy source of truth: `contracts/KILL_SWITCH_POLICY.md`.

```text
Loader
  |
  v
Session Response / Runtime Metadata
  |
  | enabled = true / false
  v
Runtime Decision
  |
  +-- enabled -----> Payload Fetch / Runtime Start
  |
  +-- disabled ----> Maintenance UX / Safe Stop
```

### Global Kill Switch

The global kill switch disables all script runtime starts through server-owned metadata or session responses.

Use cases:

- Critical platform incident.
- Compromised runtime payload.
- Major delivery instability.
- Emergency maintenance.
- Provider or infrastructure incident that makes safe operation impossible.

Expected UX:

- Show maintenance mode.
- Do not fetch or execute game runtime logic if the disabled state is known before payload fetch.
- Provide a generic retry-later message.
- Avoid exposing incident internals.

### Script Kill Switch

The script kill switch disables one script or product without affecting all other scripts.

Use cases:

- One game update breaks a module.
- One script has a dangerous bug.
- One script is under abuse investigation.
- A creator wants to pause a script.

Expected UX:

- Show script unavailable or maintenance mode.
- Avoid loading that script's game module.
- Allow other scripts to continue operating.

### Module Kill Switch

The module kill switch disables one module version or module family.

Use cases:

- A module version crashes after rollout.
- A specific game runtime becomes incompatible with a game update.
- A shared dependency used by a subset of modules is unstable.
- A staged rollout needs immediate rollback.

Expected UX:

- Dispatcher refuses to start the disabled module.
- Shared runtime remains alive only long enough to report safe diagnostics and show UX.
- If another compatible module version is available, metadata may route to that version.

### Failure And Maintenance UX

Kill switch UX should be clear and non-technical:

- `LuxyHub is temporarily under maintenance.`
- `This script is temporarily unavailable.`
- `This module version is disabled. Please try again later.`

UX should avoid:

- Raw server errors.
- Internal configuration names.
- Security incident details.
- Credential prompts when a disabled state is already known.

### Operational Use Cases

- Stop all script execution during a critical incident.
- Disable a single broken game module after a game update.
- Roll back a staged runtime feature without loader changes.
- Temporarily pause premium scripts during entitlement incidents.
- Reduce support load during known outages by showing maintenance UX early.

## 9. Module Registry Design

The module registry allows LuxyHub to support 50+ scripts without hardcoding all routing logic into the universal loader or dispatcher.

```text
Module Registry
  |
  v
Metadata
  |
  v
Dispatcher
  |
  v
Runtime Module
```

### Purpose

The registry is the source of truth for which modules exist, which scripts they serve, which game contexts they support, which runtime contracts they require, and whether they are enabled.

### Module Registration

Module registration should define:

- Module identifier.
- Human-readable module name.
- Owning script or product.
- Supported game/place identifiers.
- Supported runtime contract versions.
- Current module version.
- Enabled/disabled state.
- Required feature flags.
- Optional rollout cohort rules.
- Fallback or previous stable module version, if available.

### Module Ownership

Every module should have a clear owner:

- Product owner for business behavior.
- Runtime owner for shared compatibility requirements.
- Maintainer for game-specific feature behavior.
- Operational owner for incident response and kill switch decisions.

Ownership avoids orphaned modules when the platform grows beyond a few scripts.

### Module Versioning

Module versioning should be independent from the universal loader version:

- The loader changes rarely.
- The runtime contract changes carefully.
- Game modules can change more frequently.
- Module versions declare compatible runtime contracts.
- Rollbacks should route metadata to a previous compatible module version when available.

### Module Discovery

Discovery should be metadata-driven:

- The loader identifies script/product intent.
- Server/session/runtime metadata identifies candidate modules.
- Dispatcher validates the current game context against registry metadata.
- Dispatcher starts exactly one matching module unless a multi-module bundle is explicitly configured.
- Unknown or ambiguous matches fail safely before feature execution.

### Why Registry Beats Hardcoded Routing

Hardcoded routing creates loader or dispatcher changes for every new script. A registry scales better because adding a module becomes a metadata and payload release process instead of a universal loader rewrite.

Registry benefits:

- Supports many scripts without loader bloat.
- Enables operational disablement per module.
- Supports version compatibility checks.
- Enables staged rollout by module.
- Makes ownership and support boundaries explicit.
- Reduces risk when adding new games.

## 10. Analytics Integration Diagram

```text
Universal Loader
  |
  | loader_start
  v
Authorization Window
  |
  | authorization_prompt_shown
  v
Server Authorization
  |
  +-- authorization_success
  |       |
  |       v
  |   payload_fetch_start
  |       |
  |       v
  |   payload_fetch_success
  |       |
  |       v
  |   runtime_start
  |       |
  |       v
  |   runtime_stop / runtime_error
  |
  +-- authorization_failure
          |
          v
      retry / exit
```

Analytics should be emitted at lifecycle boundaries, not scattered independently across every game script.

Recommended analytics event categories:

| Event | Emitted By | Purpose |
|---|---|---|
| `loader_start` | Universal loader | Count loader executions and startup environment volume |
| `authorization_prompt_shown` | Authorization UX | Measure credential friction |
| `authorization_success` | Shared authorization flow | Measure successful access decisions |
| `authorization_failure` | Shared authorization flow | Measure denied access without raw credentials |
| `payload_fetch_start` | Shared delivery flow | Measure delivery attempts after authorization |
| `payload_fetch_success` | Shared delivery flow | Measure successful payload retrieval |
| `payload_fetch_failure` | Shared delivery flow | Measure delivery failures after authorization |
| `runtime_start` | Runtime bootstrap / dispatcher | Measure actual runtime execution |
| `runtime_stop` | Shared runtime | Measure clean stops where detectable |
| `runtime_error` | Shared runtime error boundary | Measure runtime failures |

Design boundaries:

- Authorization analytics should not expose raw keys, license keys, customer identifiers, or session tokens.
- Game modules can emit feature-level analytics through shared runtime services, but lifecycle analytics should remain centralized.
- Analytics events should use server-approved session or event context after authorization where possible.
- Public, key-required, and license-required scripts should share the same event vocabulary so reporting scales across all scripts.

## 11. Runtime Observability

Runtime observability is the shared measurement model for script-side behavior. It should provide consistent lifecycle visibility across all scripts and modules without requiring every game module to build its own monitoring system.

Frozen event schema source of truth: `contracts/OBSERVABILITY_EVENT_SCHEMA.md`.

### Lifecycle Metrics

Core lifecycle metrics:

| Metric | Meaning | Primary Consumer |
|---|---|---|
| `loader_start` | Universal loader started | Analytics, operations |
| `authorization_prompt` | Key/license prompt shown | Analytics, UX review |
| `authorization_success` | Server authorization succeeded | Analytics, entitlement monitoring |
| `authorization_failure` | Server authorization failed | Analytics, abuse monitoring, support |
| `payload_fetch_start` | Authorized payload fetch began | Delivery monitoring |
| `payload_fetch_success` | Authorized payload fetch succeeded | Delivery success-rate monitoring |
| `payload_fetch_failure` | Authorized payload fetch failed | Delivery incident detection |
| `runtime_start` | Dispatcher/module runtime started | Usage analytics |
| `runtime_stop` | Runtime stopped cleanly where detectable | Stability metrics |
| `runtime_error` | Runtime or module error captured | Incident response, reliability |

### Analytics V2 Support

Runtime observability should support Analytics V2 by making lifecycle metrics comparable across scripts:

- Loader-to-runtime conversion rate.
- Authorization prompt-to-success rate.
- Authorization failure rate by script and access mode.
- Payload fetch success rate.
- Runtime start count by module version.
- Runtime error rate by module, script, and runtime contract version.
- Feature flag impact by cohort.

Analytics V2 should be able to answer whether failures come from authorization, delivery, dispatcher compatibility, module crashes, or game-specific behavior.

### Operational Monitoring Support

Observability should support production monitoring by identifying platform-level degradation quickly:

- Global drop in `payload_fetch_success` may indicate delivery instability.
- Spike in `authorization_failure` may indicate credential, license, or abuse issues.
- Spike in `runtime_error` for one module may indicate a game update or module regression.
- Spike in compatibility failures may indicate a bad runtime contract rollout.
- Missing `runtime_start` after successful payload fetch may indicate dispatcher or bootstrap failures.

### Incident Response Support

Incident response depends on knowing where startup failed:

```text
loader_start
  |
  +-- no authorization_prompt or session attempt -> loader/bootstrap issue
  |
  +-- authorization_failure spike -> credential/license/access issue
  |
  +-- payload_fetch_failure spike -> delivery/session issue
  |
  +-- runtime_error spike after runtime_start -> module/runtime issue
```

Recommended incident response dimensions:

- Script slug or product ID.
- Module ID and module version.
- Runtime contract version.
- Access mode.
- Feature flag cohort.
- Error category.
- Delivery result category.

Observability should avoid raw credentials, raw customer identifiers, session tokens, or provider credentials.

## 12. Event Platform Diagram

```text
Runtime Bootstrap
  |
  | receives event reporting context after authorized delivery
  v
Shared Event Reporter
  |
  | signs / formats allowed runtime events through approved session context
  v
LuxyHub Event API
  |
  v
Event Queue
  |
  v
Providers / Dashboards / Alerts
```

The script-side runtime should use a shared event reporter rather than each game module manually integrating with LuxyHub event APIs.

Event reporting examples:

- Runtime lifecycle events.
- Feature errors.
- Suspicious runtime state.
- Operational telemetry.
- Script-specific alerts.
- User-visible failure diagnostics that do not contain secrets.

Boundaries:

- Scripts should communicate only with approved LuxyHub event APIs.
- Provider credentials must remain server-side and must never be placed in script source or runtime payloads.
- Game modules should not know Discord, Slack, Telegram, or provider-specific credential details.
- Event reporting should use allowlisted event types and safe payload shapes.
- Event reporting must not become an authorization layer. Authorization occurs before delivery session creation and payload execution.
- Event failures should not unlock protected functionality or change authorization decisions.
- Event failures should degrade gracefully and avoid breaking core runtime execution unless product policy explicitly requires fail-closed telemetry.

Recommended event ownership:

| Layer | Event Responsibility |
|---|---|
| Universal loader | Startup and authorization UX attempts, where allowed |
| Runtime bootstrap | Runtime start, stop, and shared errors |
| Dispatcher | Module selection success/failure |
| Game runtime module | Feature-specific telemetry and game-specific errors |
| Server event platform | Validation, queueing, provider delivery, alerting, retention |

## 13. Formal Error Boundary Model

The runtime needs a formal error boundary so game module failures do not destroy shared diagnostics, analytics, event reporting, or safe shutdown behavior.

```text
Game Runtime
  |
  v
Error Boundary
  |
  +-- recoverable ----> Report -> Continue / Degrade Feature
  |
  +-- unrecoverable --> Report -> Safe Shutdown
                           |
                           v
                      Analytics
                           |
                           v
                      Event Platform
                           |
                           v
                      Safe Shutdown
```

### Recoverable Errors

Recoverable errors are failures where the runtime can continue safely:

- Optional feature initialization fails.
- A game-specific object is temporarily unavailable.
- A non-critical UI panel fails to open.
- A telemetry event fails to send.
- A feature flag references an unavailable optional feature.

Recommended behavior:

- Capture the error through the shared boundary.
- Emit `runtime_error` or feature-specific error telemetry if event context is available.
- Disable or degrade only the affected feature.
- Keep the main runtime active when safe.
- Avoid repeated noisy reports for the same failure loop.

### Unrecoverable Errors

Unrecoverable errors are failures where continuing could be unsafe or misleading:

- Runtime contract validation fails.
- Dispatcher cannot select a valid module.
- Required shared runtime service is missing.
- Required module dependency is unavailable.
- Core module startup fails before feature isolation exists.
- Kill switch or disabled state is discovered after bootstrap.

Recommended behavior:

- Stop before feature execution when possible.
- Emit safe diagnostics if event context is available.
- Show a generic failure or maintenance UX.
- Avoid retry loops unless the failure is likely transient.
- Shut down shared runtime state cleanly.

### Runtime Crash Handling

Runtime crash handling should prioritize safe reporting and shutdown:

- Shared runtime bootstrap should wrap dispatcher startup.
- Shared services should isolate analytics/event reporting from module execution where practical.
- Crash reports should include safe metadata such as module ID, module version, runtime contract version, script slug, and error category.
- Crash reports should exclude raw credentials, raw customer identifiers, session tokens, and provider credentials.

### Dispatcher Crash Handling

Dispatcher crashes are platform-level failures because no module can safely start without dispatch:

- Stop module startup.
- Emit dispatcher failure diagnostics if possible.
- Show a script unavailable or compatibility failure UX.
- Treat repeated dispatcher crashes as rollout blockers.
- Prefer registry/metadata fallback only when a known compatible module exists.

### Module Crash Handling

Module crashes are game-specific failures unless they corrupt shared runtime state:

- Isolate module startup inside the error boundary.
- Report module ID and version.
- Disable the module instance for the current runtime session if startup fails.
- Allow safe shutdown without affecting other scripts or future sessions.
- Use module kill switch if crash rate exceeds operational thresholds.

### Why Analytics And Events Should Survive Module Crashes

Analytics and event reporting should be owned by shared runtime services, not by individual game modules. If a module crash disables reporting, operators lose the exact diagnostics needed to understand the incident.

Survivable reporting enables:

- Faster incident triage.
- Module-version rollback decisions.
- Feature flag rollback decisions.
- Distinction between delivery issues and game-specific crashes.
- Detection of game updates that break only one module.

Shared diagnostics should therefore initialize before module startup and remain available until safe shutdown completes.

## 14. Trust Boundary Diagram

```text
Untrusted Client Environment
  |
  | user executor, loader source, local credential storage,
  | runtime memory, game APIs, client-side identifiers
  v
Universal Loader / Runtime
  |
  | can guide UX and request authorization
  | cannot be trusted to enforce entitlement by itself
  v
Network Boundary
  |
  v
Trusted Server Boundary
  |
  | authorization decision
  | delivery session creation
  | payload fetch validation
  | event API validation
  | rate limiting
  | audit/analytics persistence
  v
LuxyHub Services / Database
```

### Trusted Boundaries

- Server-side session creation authorization.
- Server-side key/license validation.
- Server-side delivery session token hashing and one-time consumption.
- Server-side rate limiting.
- Server-side event validation and queueing.
- Server-side analytics and audit persistence.
- Server-side ownership and access-mode configuration.

### Untrusted Boundaries

- User executor environment.
- Client-side loader code after it reaches the user.
- Client-side runtime memory.
- Local remembered key/license storage.
- Client-reported customer identifiers or device identifiers.
- Client-side game detection.
- Client-side analytics or event payloads before server validation.

### Loader Trust Model

The loader is a convenience and orchestration layer, not a security boundary. It can improve UX, reduce duplication, and route users through the correct authorization path. It cannot prove that a user is honest, that local storage is private, or that client-side identifiers are tamper-proof.

The loader should therefore:

- Request authorization before payload fetch.
- Avoid embedding secrets or provider credentials.
- Avoid implementing entitlement decisions locally.
- Treat all local remembered credentials as hints that require server revalidation.
- Assume users can inspect, modify, or replay client-side code.

### Runtime Trust Model

The runtime is also untrusted after execution begins. It can report telemetry, enforce UX-level state, and coordinate game modules, but it cannot prevent all client-side tampering. A user with control of the executor can inspect memory, alter control flow, suppress events, or call APIs directly.

The runtime should therefore:

- Keep server-issued sessions short-lived.
- Avoid relying on client-only checks for premium access.
- Report useful telemetry without assuming telemetry is complete.
- Keep game modules isolated behind shared contracts.
- Fail safely when required context is missing.

### What Can Be Enforced Server-Side

- Whether a delivery session is created.
- Whether a key or license is accepted.
- Whether a one-time session token can fetch a payload.
- Whether event reports are accepted, rejected, rate-limited, or queued.
- Whether known script metadata, access mode, and ownership records allow delivery.
- Whether analytics and audit records are persisted.

### What Cannot Be Fully Enforced Client-Side

- Preventing a user from inspecting loaded script memory.
- Preventing all client-side tampering after payload execution.
- Treating hardware IDs or customer identifiers as unspoofable.
- Guaranteeing telemetry is always sent.
- Preventing copied client-side code from being modified.
- Keeping locally remembered credentials secret from the user who controls the executor.

## 15. Scalability Model

The runtime architecture should scale by adding modules and metadata, not by copying loaders and authorization logic.

### 1 Script

Recommended structure:

- One universal loader.
- One shared authorization window.
- One runtime bootstrap.
- One game runtime module.
- Shared analytics/event lifecycle vocabulary.

Benefits:

- Establishes correct boundaries early.
- Avoids throwaway one-off script architecture.
- Makes future scripts cheaper to add.

### 10 Scripts

Recommended structure:

- One universal loader shared by all scripts.
- Dispatcher routes by script slug, product ID, game ID, or metadata.
- Shared runtime services used by every module.
- Game modules versioned independently where needed.
- Shared compatibility contract for module initialization and lifecycle.

Benefits:

- Updates to authorization UX apply to all scripts.
- Analytics dashboards receive comparable lifecycle events.
- Event reporting behavior remains consistent.
- Bug fixes in shared runtime services benefit every script.

### 100 Scripts

Recommended structure:

- Versioned runtime contract.
- Module registry or metadata-driven dispatch.
- Shared module library for common UI, settings, feature toggles, error reporting, event reporting, and runtime state.
- Script-specific modules remain thin and focused on game behavior.
- Compatibility windows for old modules when universal runtime contracts evolve.

Benefits:

- Maintains consistency across many scripts.
- Reduces operational overhead.
- Supports gradual migration and phased rollout.
- Enables centralized observability.
- Avoids 100 different authorization and analytics implementations.

### Maintainability

- Keep the universal loader minimal and stable.
- Keep shared runtime services reusable and versioned.
- Keep game logic isolated in modules.
- Avoid direct provider integrations inside game modules.
- Use a consistent module lifecycle contract.
- Centralize authorization UX and session orchestration.

### Update Process

Recommended update layers:

| Layer | Update Frequency | Notes |
|---|---|---|
| Universal loader | Low | Keep small and stable to avoid frequent user-facing loader changes |
| Runtime bootstrap | Medium | Update shared services, diagnostics, and lifecycle behavior |
| Dispatcher metadata | Medium | Add games, script routes, compatibility rules, and feature flags |
| Game runtime modules | High | Iterate game features independently |
| Event/analytics vocabulary | Low to Medium | Extend carefully to preserve reporting consistency |

### Versioning

- Use a runtime contract version for loader-to-runtime and runtime-to-module compatibility.
- Use module versions for game-specific runtime modules.
- Use payload versions for secure delivery compatibility.
- Use feature flags for staged rollout.
- Keep older runtime contracts available during migration windows when practical.
- Track which runtime/module version emitted analytics and event reports.

### Shared Modules

Recommended shared runtime modules:

- Authorization UX shell.
- Credential state manager.
- Session lifecycle coordinator.
- Runtime context provider.
- Dispatcher registry.
- Analytics emitter.
- Event reporter.
- Error boundary and diagnostics.
- Settings/state persistence helper.
- Feature flag reader.
- Compatibility guard.

## 16. Recommended Future Implementation Strategy

This document is design-only. Future implementation should be staged and should not begin as part of this document.

Implementation readiness after contract freeze: 96/100.

Remaining pre-implementation work is operational approval and implementation planning, not architecture contract definition.

Recommended strategy when implementation is approved:

1. Freeze runtime contract design.
2. Define runtime contract compatibility rules and unsupported-version UX.
3. Define feature flag ownership, defaults, and fallback behavior.
4. Define kill switch metadata and maintenance UX.
5. Define the module registry shape, ownership model, and discovery behavior.
6. Define universal loader responsibilities and explicitly exclude game logic from the loader.
7. Define shared authorization window states for public, key-required, and license-required scripts.
8. Define dispatcher metadata and game module lifecycle contracts.
9. Define shared analytics, observability, and event names before adding game modules.
10. Define error boundary behavior for recoverable and unrecoverable failures.
11. Build one reference game runtime module using the shared dispatcher contract.
12. Validate that main script logic cannot start before authorization success.
13. Add a second game module to prove the dispatcher and registry model.
14. Add versioning and feature flag rollout strategy before scaling beyond a few scripts.
15. Expand to additional games only after shared runtime services are stable.

Recommended rollout phases:

```text
Design Freeze
  -> Runtime Contract And Feature Flag Prototype
  -> Kill Switch And Module Registry Design Validation
  -> One Reference Game Module
  -> Two-Game Dispatcher Validation
  -> Shared Analytics/Event/Error Boundary Validation
  -> Staged Internal Rollout
  -> Multi-Script Expansion
```

Implementation guardrails for the future:

- Do not create separate key systems per game.
- Do not create separate analytics systems per game.
- Do not place provider credentials in scripts.
- Do not let main game logic load before authorization succeeds.
- Do not treat loader or runtime code as trusted security boundaries.
- Do not add game-specific branches directly into the universal loader except for stable metadata routing.
- Do not begin Phase 7C runtime license enforcement as part of script runtime architecture work.
- Do not ship runtime contract changes without compatibility handling.
- Do not ship experimental runtime behavior without server-owned feature flags and fallback behavior.
- Do not scale beyond a few modules without a registry and ownership model.

## 17. Recommended Architecture Choice

Recommended choice: Universal Loader + Shared Runtime Bootstrap + Runtime Contract Validation + Server-Owned Feature Flags + Kill Switches + Module Registry + Metadata-Driven Dispatcher + Game Runtime Modules.

This is the preferred architecture because it separates stable platform concerns from game-specific logic:

- The universal loader handles startup, authorization UX orchestration, session creation, payload fetch, and runtime handoff.
- The shared runtime bootstrap handles context, analytics, event reporting, diagnostics, and module lifecycle.
- Runtime contract validation prevents unsupported modules from starting.
- Server-owned feature flags allow staged rollout without loader forks.
- Kill switches allow operators to disable unsafe global, script, or module paths without loader updates.
- The module registry scales dispatch beyond hardcoded routing.
- The dispatcher selects the correct game runtime from metadata.
- Game runtime modules focus only on game behavior and features.

### Why Not Separate Loader Per Script

Separate loaders create duplicated authorization UX, duplicated delivery behavior, inconsistent error handling, and fragmented update processes. Every script would need its own loader fixes, credential handling, analytics hooks, and event reporting decisions. This does not scale to 10 or 100 scripts.

### Why Not Separate Key System Per Script

Separate key systems fragment user experience and increase operational risk. Each game would need separate key validation semantics, expiration behavior, support workflows, analytics mapping, and abuse monitoring. A shared authorization model keeps entitlement handling consistent and server-controlled.

### Why Not Separate Analytics Per Script

Separate analytics systems prevent consistent reporting across products. Lifecycle events such as authorization success, authorization failure, runtime start, runtime stop, and runtime error should have the same meaning for every script. Game-specific feature analytics can extend the shared model without replacing it.

## 18. Non-Goals

- No Lua implementation.
- No runtime implementation.
- No website code changes.
- No delivery system changes.
- No Phase 7A changes.
- No Phase 7B Key Monetization implementation.
- No production behavior changes.
- No database changes.
- No migration changes.
- No new API contract implementation.
