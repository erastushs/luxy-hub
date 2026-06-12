# Licenses

Premium licenses are runtime credentials used by `license_required` scripts.

## Common Tasks

| Task | Where |
| --- | --- |
| Create a license | Dashboard -> Licenses |
| Set assignment capacity | License creation form |
| Disable or enable a license | Dashboard -> Licenses |
| Revoke a license | Dashboard -> Licenses |
| Review license analytics | Dashboard -> Licenses -> Analytics |
| Add or remove assignments | Dashboard -> Licenses assignment controls |

## Runtime Requirements

`license_required` delivery requires:

- Script slug.
- Premium license key.
- Customer identifier.

The runtime authorization path validates ownership, script relationship, license status, assignment status, and capacity before delivery session creation.

## Related Documents

- Runtime licensing: `RUNTIME_LICENSING.md`.
- License assignments: `LICENSE_ASSIGNMENTS.md`.
- Access modes: `ACCESS_MODES.md`.
- API reference: `../api/REFERENCE.md`.
