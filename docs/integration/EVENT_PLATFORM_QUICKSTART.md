# Event Platform Quickstart

One-page guide to sending your first event in under 5 minutes.

## 1. Get a Session

```bash
curl -s -X POST https://luxyhub.example.com/api/delivery/session \
  -H "Content-Type: application/json" \
  -d '{"slug":"my-script"}'
```

**If your script is public/unlisted with a ready build**, you'll get:

```json
{
  "session_token": "abc123base64url...",
  "event_secret": "def456base64url...",
  "expires_in": 60
}
```

- `session_token` — identifies your session (lasts 60 seconds).
- `event_secret` — **keep this server-side.** Used to sign events, never sent in requests.

If you get `404 "Delivery unavailable"`, your script doesn't have a ready build
or is private.

## 2. Sign and Send an Event

```javascript
// Node.js — server-side only
const crypto = require('crypto');

const SESSION_TOKEN = "abc123base64url...";
const EVENT_SECRET   = "def456base64url...";

const timestamp = Math.floor(Date.now() / 1000);
const nonce     = crypto.randomBytes(16).toString('hex');
const event     = "execute";
const payload   = { placeId: 123456 };

// HMAC-SHA256(secret, "event:timestamp:nonce:JSON(payload)")
const sigString  = `${event}:${timestamp}:${nonce}:${JSON.stringify(payload)}`;
const signature  = crypto.createHmac('sha256', EVENT_SECRET)
                         .update(sigString)
                         .digest('hex');

const res = await fetch('https://luxyhub.example.com/api/events/report', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: SESSION_TOKEN,
    event,
    timestamp,
    nonce,
    signature,
    payload,
  }),
});

// Response: { "success": true }
console.log(await res.json());
```

## 3. That's It

Your event is queued. The cron worker delivers it to Discord within ~5 minutes.

## Supported Events

`execute` | `purchase` | `error` | `ban` | `key_redeem` | `heartbeat` | `license_activate` | `license_revoke`

## Quick Rules

| Rule | Why |
|---|---|
| New session per boot | Sessions expire in 60s |
| Fresh nonce every event | Replay protection |
| Seconds, not milliseconds | Timestamp validation |
| Payload ≤ 4KB | Size limit enforced |
| Never expose `event_secret` | It's your HMAC key |

## Error Reference

| Status | Problem | Fix |
|---|---|---|
| 400 | Bad timestamp/nonce/signature | Check format: seconds, 32-hex nonce, 64-hex signature |
| 401 | Expired/invalid session | Create new session |
| 413 | Payload too big | Keep under 4,096 bytes |
| 422 | Unknown event type | Use one from the list above |
| 429 | Too many events | Throttle to ≤10 events/minute/session |

> **Full reference**: See `EVENT_PLATFORM_INTEGRATION.md` for signature
> algorithm details, validation order, processing flow, and security guidance.
