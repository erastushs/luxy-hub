# Delivery

Delivery is the runtime path that turns an authorized script request into a short-lived payload fetch.

## Flow

```text
Loader or runtime client
  -> create delivery session
  -> receive session_token and event_secret
  -> fetch runtime payload with session_token
  -> session is consumed or expires
```

## Key Properties

- Delivery sessions are short-lived.
- Session tokens are stored as hashes.
- Successful fetch consumes the session.
- Payload responses are no-store.
- Access mode authorization happens before session creation.

## Related Documents

- Delivery sessions: `../runtime/DELIVERY_SESSIONS.md`.
- Secure delivery: `SECURE_DELIVERY.md`.
- Event Platform: `EVENT_PLATFORM.md`.
- API reference: `../api/REFERENCE.md`.
