# Feature Flag Policy

Status: Design Frozen
Date: 2026-06-12

Scope: Frozen policy for future script runtime feature flags. This document does not implement Lua code, runtime code, website code, delivery changes, authorization changes, loader changes, database changes, schema changes, API changes, production changes, or Phase 7B behavior.

## 1. Purpose

Feature flags allow staged rollout, experiments, emergency mitigation, and compatibility transitions without creating separate loaders or separate game-specific runtime forks.

Feature flags are server-controlled. Runtime consumes flags only.

## 2. Ownership Model

| Action | Authority | Notes |
|---|---|---|
| Create flag | Runtime/platform owner plus product approval | New flags need documented purpose, category, default, and rollback behavior. |
| Modify flag | Server-side operations/product owner | Runtime must consume the server-provided value as read-only. |
| Remove flag | Runtime/platform owner after deprecation review | Removal requires confirming no active module depends on the flag. |
| Emergency disable | Operations owner | Emergency flags may be changed quickly but must be documented after the incident. |

Runtime modules may request flags through design review, but they do not own flag truth.

## 3. Flag Categories

| Category | Purpose | Default Behavior |
|---|---|---|
| `release` | Gradual rollout of stable planned features | Default off until rollout begins. |
| `experiment` | Limited testing or UX/runtime variants | Default off outside assigned rollout groups. |
| `emergency` | Rapid mitigation or disabling of risky behavior | Default safest behavior. |
| `compatibility` | Preserve old behavior during contract/module migration | Default to stable compatible path. |

## 4. Example Flags

| Flag | Category | Purpose | Default |
|---|---|---|---|
| `analytics_v2` | release | Enable future Analytics V2 runtime event behavior. | `false` |
| `license_runtime_enforcement` | compatibility/release | Gate future runtime-license-related behavior after design approval. This must not implement key monetization or Phase 7D database scalability work by itself. | `false` |
| `new_authorization_window` | experiment/release | Enable redesigned key/license window UX. | `false` |
| `experimental_runtime` | experiment | Enable experimental runtime services for controlled cohorts only. | `false` |

## 5. Flag Value Rules

- Boolean flags are preferred for runtime startup decisions.
- Structured flags may be used for rollout groups or configuration, but must have a documented schema.
- Missing optional flags are treated as disabled.
- Unknown flags are ignored safely.
- Required module flags must be declared in module metadata.
- Malformed flag values must fail the affected feature safely.

## 6. Runtime Consumption Rules

Runtime may:

- Read flags from `feature_flags` in runtime metadata.
- Pass relevant flags to dispatcher and module context.
- Enable or disable UX, analytics, diagnostics, or feature availability based on flags.
- Emit flag state in observability events where safe and useful.

Runtime must not:

- Treat local flag overrides as authoritative.
- Use flags to bypass server authorization.
- Use flags to expose provider credentials or raw secrets.
- Continue a module when a required disabled flag makes startup unsafe.

## 7. Rollout Process

Recommended rollout:

1. Document flag purpose, owner, category, default, and rollback behavior.
2. Add flag to server-owned metadata with default disabled.
3. Ensure runtime treats missing flag as disabled.
4. Enable for internal/test rollout group.
5. Monitor observability metrics and runtime errors.
6. Expand rollout gradually by script, module, or cohort.
7. Roll back immediately if error or incident thresholds are exceeded.
8. Promote stable behavior and deprecate the flag when no longer needed.

## 8. Removal Process

Flag removal requires:

- No active module depends on the flag.
- Observability confirms stable behavior without the flag branch.
- Documentation updated to remove the flag from examples.
- Rollback path documented if removal creates unexpected behavior.

## 9. Contract Freeze Decision

Feature flag ownership, categories, runtime consumption rules, fallback behavior, and rollout process are frozen for design purposes. Future implementation must preserve server ownership and read-only runtime consumption.
