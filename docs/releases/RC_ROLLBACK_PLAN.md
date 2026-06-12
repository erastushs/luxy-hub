# Release Candidate Rollback Plan

Current readiness: Production Ready Candidate

## Scope

This plan covers rollback readiness validation before production rollout. It does not execute rollback and does not modify production.

## Remaining Requirements

- Soak testing
- Rollback drill
- Production rollout review

## Rollback Drill Requirement

Execute rollback validation in an isolated development database before production rollout.

Required drill sequence:

1. Apply migration 013.
2. Apply migration 014.
3. Seed representative license, assignment, audit, delivery, runtime, and analytics data.
4. Execute migration 014 rollback.
5. Verify schema consistency.
6. Verify existing data behavior.
7. Document any rows that require transformation or cleanup before rollback.

## Known Rollback Considerations

- Migration 014 rollback removes runtime license RPCs.
- Code that depends on runtime license RPCs must be rolled back with the schema.
- Runtime audit rows using `actor_role = runtime` may conflict with the pre-014 `audit_logs_actor_role_check` constraint unless handled before rollback.
- Migration 013 license and assignment tables should remain intact after migration 014 rollback.

## Rollback Readiness Exit Criteria

- Isolated rollback drill succeeds.
- Data behavior is documented.
- Rollback decision owner is identified.
- Production rollout review accepts the rollback plan.
