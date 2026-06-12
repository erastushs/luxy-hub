# License Assignments

License assignments connect a premium license to a normalized customer identifier.

## Assignment Concepts

- Customer identifiers are normalized before authorization.
- Assignment status controls whether a customer can use the license.
- Runtime authorization can create or reuse assignments according to capacity rules.
- Creator dashboard workflows can inspect and manage assignments.

## Statuses

| Status | Meaning |
| --- | --- |
| `active` | Assignment can authorize runtime delivery. |
| `disabled` | Assignment is retained but cannot authorize delivery. |
| `revoked` | Assignment is no longer usable. |

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Runtime delivery denied | License status, assignment status, and customer identifier. |
| Capacity exhausted | License `max_assignments` and current active assignment count. |
| Assignment not visible | Confirm the script/license belongs to the current creator. |
| Customer mismatch | Confirm normalized customer identifier matches the expected user/device. |

## Related Documents

- Licenses: `LICENSES.md`.
- Runtime licensing: `RUNTIME_LICENSING.md`.
- Database schema: `../database/SCHEMA.md`.
