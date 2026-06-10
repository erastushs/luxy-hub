# Phase 8C.1 — Dashboard Webhook Management

Status: Implemented
Date: 2026-06-09
Scope: Creator-facing Discord webhook management UI

## Scope Boundary

Implemented:

- `/dashboard/scripts/[slug]/webhooks` route
- Webhook settings form (create, update, enable, disable)
- Webhook status badge (Active, Disabled, Invalid config, Not configured)
- Test webhook event (heartbeat through normal queue flow)
- Safe DTO with masked webhook URL
- Ownership enforcement at service layer
- Provider validation reuse from `discord-provider`

Not implemented:

- Telegram provider
- Slack provider
- Analytics dashboard
- Multi-provider switching in UI
- Event log viewer

## Navigation

```
Dashboard
└── Scripts
    └── [slug]
        └── Webhooks
```

Route: `/dashboard/scripts/[slug]/webhooks`

The link appears in the script detail context. It is not a top-level sidebar item — it's a sub-route of the script management flow, similar to `/dashboard/scripts/[slug]/builds` and `/dashboard/scripts/[slug]/edit`.

## UI Flow

```
Webhooks Page (Server Component)
  |
  ├─ Authenticate user → getCurrentUser()
  ├─ Resolve ownership → getOwnedScript(slug, userId)
  ├─ Fetch config → getWebhookConfigSafe(slug, userId)
  |   └─ Returns WebhookConfigDTO (masked, never raw URL)
  |
  └─ Client Component: WebhookSettings
      |
      ├─ WebhookStatusBadge
      |   ├─ Not configured (grey + XCircle)
      |   ├─ Disabled (amber + PowerOff)
      |   ├─ Active (emerald + CheckCircle2)
      |   └─ Invalid config (red + AlertTriangle)
      |
      ├─ Webhook Form
      |   ├─ Provider: Discord (read-only, hidden field)
      |   ├─ URL input: paste URL, never shown again
      |   ├─ Masked display: "Discord webhook configured" (no URL)
      |   ├─ Enable/Disable toggle button
      |   └─ Save button (red, consistent with dashboard)
      |
      ├─ TestWebhookButton
      |   ├─ Disabled until config is valid + enabled + has URL
      |   ├─ Creates heartbeat event via service layer
      |   ├─ Delivers only that created event through processSingleEvent()
      |   └─ Shows result inline (success/failure message)
      |
      └─ Info panel: "Events are queued and delivered every 5 minutes"
```

## Security Model

### Ownership

Every operation gates on `getOwnedScript(slug, userId)`:

- `getWebhookConfigSafe` — read
- `saveWebhookConfig` — create/update
- `toggleWebhookConfig` — enable/disable
- `sendTestWebhookEvent` — test event creation

Non-owners receive 404 with no config data.

### URL Masking

The raw Discord webhook URL is NEVER returned to the client:

- `toSafeDTO()` replaces the URL with the fixed string `"Discord webhook configured"`
- `createWebhookConfig`/`updateWebhookConfig` accept the raw URL server-side
- Client only sees `webhookUrlMasked: "Discord webhook configured"` or `""` if unset
- `hasWebhookUrl: boolean` tells the UI whether a URL exists

### Safe DTO

```typescript
export type WebhookConfigDTO = {
  id: string
  scriptId: string
  provider: string           // always "discord"
  enabled: boolean
  webhookUrlMasked: string   // "Discord webhook configured" or ""
  hasWebhookUrl: boolean     // does a URL exist (without revealing it)
  isValid: boolean           // provider-level validation
  validationReason: string | null
  lastUpdated: string
}
```

No `config`, no `webhook_url`, no `creator_id`, no `event_secret` exposed.

### Validation Layers

1. **Client**: HTML5 `required`, `type="text"`, `autoComplete="off"`
2. **Action**: `formData.get()` type check
3. **Service**: `validateWebhookUrl()` from `discord-provider` (same regex used by delivery)
4. **Provider**: `validateConfig()` from `discord-provider` (displayed on status badge)

## Test Webhook

### Flow

```
User clicks "Send Test Event"
  |
  v
sendTestEventAction(slug) → requireAuth() → sendTestWebhookEvent(slug, userId)
  |
  ├─ Ownership check → getOwnedScript(slug, userId)
  ├─ Config check → exists, enabled, has valid URL
  ├─ createEventLog({ eventType: 'heartbeat', payload: { test: true, … } })
  |   └─ sessionId sentinel: '00000000-0000-0000-0000-000000000000'
  ├─ processSingleEvent(event.id, resolveProvider)
  |   └─ resolveProvider maps 'discord' → discordProvider
  |   └─ discordProvider.deliver() POSTs to webhook
  └─ Result: success (delivered/failed) or failure (dead_letter/invalid)
```

The test event goes through the same queue/provider delivery logic as production events, but it is isolated to the newly created heartbeat event. Dashboard test sends do not drain or process unrelated global pending queue entries.

## Architecture Integration

The queue worker and provider architecture is **unchanged**:

- Queue service: `processEventQueue(resolveProvider, batchSize)` for cron batches and `processSingleEvent(eventId, resolveProvider)` for isolated dashboard tests
- Discord provider: same `discordProvider.deliver(event, webhookUrl)` implementation
- Worker route: same `POST /api/internal/event-worker` with CRON_SECRET auth
- Vercel Cron: same 5-minute schedule

The dashboard layer adds service-level ownership checks and safe DTOs **above** the existing queue/provider layer.

## Files

| File | Change |
|------|--------|
| `app/lib/services/dashboard-webhook-service.ts` | Created — ownership-enforced CRUD, safe DTOs, test event dispatch |
| `app/actions/webhooks.ts` | Created — server actions with `requireAuth()`, form binding, revalidation |
| `app/dashboard/scripts/[slug]/webhooks/page.tsx` | Created — server component: auth, ownership, config fetch |
| `app/dashboard/scripts/[slug]/webhooks/webhooks-client.tsx` | Created — WebhookSettings, WebhookStatusBadge, TestWebhookButton |
| `app/dashboard/scripts/[slug]/webhooks/loading.tsx` | Created — skeleton loading state |
| `__tests__/dashboard-webhook.test.ts` | Created — 23 tests: ownership, DTO masking, CRUD, toggle, test event |

## Dependencies

### Reads (used by)
Nothing yet — this is the first dashboard consumer.

### Writes (depends on)
- `app/lib/auth/ownership` — `getOwnedScript(slug, userId)`
- `app/lib/repositories/webhook-config-repository` — CRUD operations
- `app/lib/repositories/event-repository` — `createEventLog`
- `app/lib/providers/discord-provider` — `validateWebhookUrl`, `validateConfig`
- `app/lib/services/event-queue-service` — `processEventQueue`, `processSingleEvent`, `ProviderResolver`
