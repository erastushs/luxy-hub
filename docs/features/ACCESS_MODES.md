# Access Modes

Access mode controls what a runtime caller must provide before LuxyHub creates a delivery session.

## Modes

| Access mode | Dashboard badge | Runtime requirement | Typical use |
| --- | --- | --- | --- |
| `public` | PUBLIC | No key or license | Free public distribution |
| `key_required` | KEY REQUIRED | Valid free key | Work.ink gated access |
| `license_required` | LICENSE REQUIRED | Valid premium license and customer identifier | Paid/private customer access |

## Visibility vs Access Mode

- Visibility controls discoverability and public metadata: `public`, `unlisted`, or `private`.
- Access mode controls runtime authorization: `public`, `key_required`, or `license_required`.
- Private scripts are not deliverable through public runtime delivery even if the access mode is public.

## Where Enforcement Happens

- Dashboard ownership is enforced server-side through the authenticated creator session.
- Runtime delivery sessions call the delivery authorization service before issuing a short-lived session token.
- Loader URLs do not include free keys or license secrets.

## Related Documents

- Scripts workflow: `SCRIPTS.md`.
- Keys: `KEYS.md`.
- Licenses: `LICENSES.md`.
- Delivery sessions: `../runtime/DELIVERY_SESSIONS.md`.
- API reference: `../api/REFERENCE.md`.
