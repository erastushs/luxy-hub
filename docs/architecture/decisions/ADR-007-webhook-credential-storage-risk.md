# ADR-007: Webhook Credential Storage Risk

## Status

Accepted

## Date

2026-06-11

## Context

LuxyHub stores creator webhook provider configuration in `webhook_config`. The current event worker resolves enabled webhook configs by script and delivers accepted runtime events to configured providers. Discord is the currently implemented provider in the worker.

The `webhook_config.config` JSON object can include provider credentials such as a Discord webhook URL. These credentials are server-side only and are not shipped to loader/runtime scripts.

## Problem

Webhook provider credentials are sensitive because possession of a webhook URL can allow posting to the target channel. LuxyHub needs to persist credentials for asynchronous queue delivery, but a dedicated secret vault/encryption layer for per-creator webhook URLs is not currently implemented.

The architecture must explicitly accept or reject this storage model and define mitigations.

## Decision

LuxyHub accepts the current webhook credential storage model with documented operational risk and mitigations.

Current model:

- Webhook configs are stored in `webhook_config`.
- `webhook_config` is owner-scoped by RLS for authenticated creators and fully accessible by service role.
- Event worker reads configs with service role.
- Runtime scripts receive only delivery session tokens/event secrets, never provider URLs.
- Dashboard/service code must avoid returning provider secrets unnecessarily.

Accepted risks:

- Database/service-role compromise can expose stored webhook URLs.
- Application bugs in dashboard serialization could accidentally expose URLs.
- Logs could leak webhook URLs if provider config is logged unsafely.
- Creator devices/accounts with dashboard access may view or change their own provider config depending on UI behavior.

Operational mitigations:

- RLS owner policies restrict direct authenticated access to owned rows.
- Service code should sanitize dashboard DTOs and avoid logging `config.webhook_url`.
- Internal docs and runbooks treat webhook URLs as secrets.
- Provider URLs can be rotated independently by deleting old webhooks and updating config.
- Event worker does not accept arbitrary provider URL input from runtime event reports.

Rotation process:

1. Create replacement webhook in provider UI.
2. Update `webhook_config.config.webhook_url` through dashboard/service path.
3. Verify event delivery succeeds for a test event.
4. Replay dead letters if needed.
5. Delete the old provider webhook.

## Consequences

Positive consequences:

- Keeps event delivery implementation simple.
- No additional vault/KMS integration is required for current scope.
- Creator webhook delivery can operate asynchronously from stored config.
- Rotation is straightforward and provider-native.

Negative consequences:

- Stored webhook URLs are sensitive database contents.
- Service role compromise has broad impact.
- Future provider types may have stronger credential requirements than Discord webhooks.
- Additional controls may be needed before supporting paid/marketplace or higher-risk integrations.

Future considerations:

- Encrypt provider credentials at rest with an application-managed key.
- Use a dedicated secrets vault for provider credentials.
- Store only provider secret references in `webhook_config`.
- Add explicit secret redaction tests for dashboard/API serialization.

## Alternatives Considered

### Do Not Store Webhook URLs

Rejected because asynchronous queue delivery needs server-side provider credentials after the runtime event report completes.

### Store Webhook URLs in Runtime Payloads

Rejected because it would expose provider credentials to untrusted clients and turn scripts into webhook relays.

### Dedicated Secret Vault Now

Deferred because it adds infrastructure and operational complexity not required for the accepted current Discord-backed scope.

### Per-Delivery User-Supplied Webhook URL

Rejected because it would create an open relay risk and bypass creator-managed provider configuration.

## Related Documents

- `docs/runtime/EVENT_QUEUE.md`
- `docs/operations/EVENT_QUEUE_RUNBOOK.md`
- `docs/operations/SECRET_ROTATION.md`
- `docs/database/SCHEMA.md`
- `docs/database/RLS_POLICIES.md`
- `docs/phases/phase8/active/PHASE8_EVENT_PLATFORM_ARCHITECTURE.md`
