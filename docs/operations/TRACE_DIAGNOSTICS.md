# Delivery Session Trace Diagnostics

## Overview

Trace diagnostics provide structured log output for debugging `POST /api/delivery/session` failures. When enabled, every request emits a sequence of `PASS`/`FAIL` lines identifying exactly which step caused the response `"Delivery unavailable"`.

## Enabling

Set the environment variable:

```
DELIVERY_SESSION_TRACE=true
```

## Disabling

Set to `false` or remove the variable (default is `false`):

```
DELIVERY_SESSION_TRACE=false
```

When disabled: zero additional log output, zero behavior changes.

## How It Works

Each request generates a trace ID (`delivery_<random hex>`) or reuses an `x-request-id` header if present. All log lines for that request share the same trace ID prefix:

```
[delivery][trace-id] <event> [detail]
```

## Example Outputs

### Successful Request

```
[delivery][delivery_abcd1234] PASS slug_validation
[delivery][delivery_abcd1234] PASS script_lookup
[delivery][delivery_abcd1234] PASS authorization
[delivery][delivery_abcd1234] PASS build_lookup
[delivery][delivery_abcd1234] adapter=valkey_canary selectedBackend=postgres
[delivery][delivery_abcd1234] SHADOW
[delivery][delivery_abcd1234]   authoritative=postgres
[delivery][delivery_abcd1234]   shadow=valkey
[delivery][delivery_abcd1234]   comparison=identical
[delivery][delivery_abcd1234] PASS session_create
[delivery][delivery_abcd1234] PASS execution_record
[delivery][delivery_abcd1234] SUCCESS
```

### Failed Request — No Ready Build

```
[delivery][delivery_efgh5678] PASS slug_validation
[delivery][delivery_efgh5678] PASS script_lookup
[delivery][delivery_efgh5678] PASS authorization
[delivery][delivery_efgh5678] FAIL build_lookup
[delivery][delivery_efgh5678]   reason=build_not_found
[delivery][delivery_efgh5678] FAILURE
```

### Failed Request — Invalid Slug

```
[delivery][delivery_ijkl9012] FAIL slug_validation
[delivery][delivery_ijkl9012]   reason=invalid_slug
[delivery][delivery_ijkl9012] FAILURE
```

### Fallback Trace (Valkey → PostgreSQL)

```
[delivery][delivery_mnop3456] PASS slug_validation
[delivery][delivery_mnop3456] PASS script_lookup
[delivery][delivery_mnop3456] PASS authorization
[delivery][delivery_mnop3456] PASS build_lookup
[delivery][delivery_mnop3456] adapter=valkey_canary selectedBackend=valkey
[delivery][delivery_mnop3456] FALLBACK
[delivery][delivery_mnop3456]   backend=valkey
[delivery][delivery_mnop3456]   fallback=postgres
[delivery][delivery_mnop3456]   reason=Connection refused
[delivery][delivery_mnop3456] PASS session_create
[delivery][delivery_mnop3456] PASS execution_record
[delivery][delivery_mnop3456] SUCCESS
```

### Shadow Mode Trace

```
[delivery][delivery_qrst7890] PASS slug_validation
[delivery][delivery_qrst7890] PASS script_lookup
[delivery][delivery_qrst7890] PASS authorization
[delivery][delivery_qrst7890] PASS build_lookup
[delivery][delivery_qrst7890] adapter=shadow
[delivery][delivery_qrst7890] SHADOW
[delivery][delivery_qrst7890]   authoritative=postgres
[delivery][delivery_qrst7890]   shadow=valkey
[delivery][delivery_qrst7890]   comparison=identical
[delivery][delivery_qrst7890] PASS session_create
[delivery][delivery_qrst7890] PASS execution_record
[delivery][delivery_qrst7890] SUCCESS
```

### Exception Trace

```
[delivery][delivery_uvwx1111] PASS slug_validation
[delivery][delivery_uvwx1111] PASS script_lookup
[delivery][delivery_uvwx1111] PASS authorization
[delivery][delivery_uvwx1111] PASS build_lookup
[delivery][delivery_uvwx1111] adapter=valkey
[delivery][delivery_uvwx1111] EXCEPTION
[delivery][delivery_uvwx1111]   step=createDeliverySession
[delivery][delivery_uvwx1111]   exception=Error
[delivery][delivery_uvwx1111]   message=Valkey client unavailable
[delivery][delivery_uvwx1111] FAILURE
```

## Failure Reason Codes

| Reason                  | Meaning                                              |
|-------------------------|------------------------------------------------------|
| `invalid_slug`          | Slug failed format validation                        |
| `script_not_found`      | No script found for the slug                         |
| `no_version`            | Script exists but has no `current_version_id`        |
| `script_not_deliverable`| Script visibility is `private` (not `public`/`unlisted`) |
| `authorization_failed`  | Key or license validation failed                     |
| `build_not_found`       | No ready delivery build for the script version       |
| `build_not_ready`       | Build exists but fails deliverability checks         |

## Security

- No secrets, session tokens, or event secrets are ever logged.
- Stack traces are only emitted when `NODE_ENV != production`.
