# Keys

Free keys are Work.ink-gated runtime credentials used by `key_required` scripts.

## Current Behavior

- Users start at `/get-key`.
- Work.ink verification leads to free key generation.
- Free keys expire after 24 hours.
- Runtime `key_required` delivery validates the provided key before creating a delivery session.

## Current Format Finding

The current implementation generates and validates:

```text
LUXY-XXXX-XXXX-XXXX
```

The target reviewed format is:

```text
LUXY-FREE-XXXX-XXXX-XXXX
```

The target format is not implemented in this polish pass because changing it affects runtime key compatibility and validation behavior.

## Migration Plan Summary

1. Add central free-key format constants and tests.
2. Generate only `LUXY-FREE-XXXX-XXXX-XXXX` for new keys.
3. Validate both target and legacy formats for at least the current key TTL plus a safety window.
4. Add telemetry distinguishing legacy and target formats.
5. Add database constraints or metadata only after compatibility behavior is finalized.

## Related Documents

- Access modes: `ACCESS_MODES.md`.
- Runtime licensing: `RUNTIME_LICENSING.md`.
- API reference: `../api/REFERENCE.md`.
- Audit findings: `../audits/POST_RC_POLISH_AUDIT.md`.
