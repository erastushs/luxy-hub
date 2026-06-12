# Delivery Sessions

Delivery sessions are short-lived authorization records used to fetch runtime payloads.

## Purpose

A delivery session separates authorization from payload fetch. The runtime caller first proves it can access a script, then receives a short-lived session token for one payload fetch.

## Session Creation

Session creation checks:

- Script exists.
- Script is deliverable by visibility.
- Script has a ready delivery build.
- Access mode authorization succeeds.

## Fetch And Consume

- The session token is submitted to the payload fetch endpoint.
- The server hashes the submitted token and looks up the stored hash.
- A valid unexpired session can be consumed once.
- Responses are no-store.

## TTL And Secrets

- Current TTL: 60 seconds.
- Session token bytes: 32.
- Event secret bytes: 32.
- Raw session tokens are not stored.

## Access Mode Matrix

| Access mode | Required session credential |
| --- | --- |
| `public` | None |
| `key_required` | Free key |
| `license_required` | Premium license and customer identifier |

## Related Documents

- Secure delivery: `SECURE_DELIVERY.md`.
- Delivery overview: `../features/DELIVERY.md`.
- Access modes: `../features/ACCESS_MODES.md`.
- API reference: `../api/REFERENCE.md`.
