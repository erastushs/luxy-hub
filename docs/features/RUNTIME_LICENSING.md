# Runtime Licensing

Runtime licensing is the authorization layer for `license_required` script delivery.

## Request Contract

Delivery session creation uses the script slug plus runtime credentials. For license-required scripts, callers provide a license key and customer identifier. Some docs and clients may still reference `license` as a compatibility alias; use the current API reference for exact accepted fields.

## Authorization Sequence

1. Load the script by slug.
2. Reject non-deliverable visibility.
3. Check the script access mode.
4. For public mode, continue without a credential.
5. For key-required mode, validate the free key.
6. For license-required mode, validate the premium license and customer identifier.
7. Create a short-lived delivery session only after authorization succeeds.

## Security Boundaries

- Creator ownership is never taken from client input.
- Runtime callers receive generic denial responses.
- Delivery session tokens are short-lived and stored only as hashes.
- Loader URLs do not include credential secrets.

## Related Documents

- License assignments: `LICENSE_ASSIGNMENTS.md`.
- Secure delivery: `SECURE_DELIVERY.md`.
- Delivery sessions: `../runtime/DELIVERY_SESSIONS.md`.
- API reference: `../api/REFERENCE.md`.
