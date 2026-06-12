# Analytics V2

Analytics V2 provides dashboard metrics for creator scripts, authorization outcomes, license state, delivery activity, and runtime activity.

## Metric Areas

| Area | Meaning | Notes |
| --- | --- | --- |
| Scripts | Script counts and execution totals | Owner scoped. |
| Authorization | Runtime authorization success/failure | Uses audit and verification style counters where available. |
| Licenses | Active, revoked, disabled, assignment utilization | Owner scoped. |
| Delivery | Session creation and payload fetch indicators | Some fetch counters may be null when not persisted. |
| Runtime | Starts, failures, execution volume | Derived from available runtime/event records. |

## Windows

- Dashboard windows: 7, 30, and 90 days.
- Service normalization also supports a 1-day bucket for internal use.

## Known Limitations

- Delivery payload fetch success/failure may be `null` where no persisted counter exists.
- Dashboard parity should be validated during RC testing.

## Related Documents

- Monitoring: `../operations/MONITORING.md`.
- RC test plan: `../releases/RC_TEST_PLAN.md`.
- Operational validation: `../operations/operational-hardening/oh-08-analytics-v2-validation.md`.
