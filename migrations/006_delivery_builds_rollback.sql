-- ============================================================================
-- LuxyHub Secure Delivery - Rollback Migration 006
-- ============================================================================
-- Drops the Phase 5B delivery_builds artifact table.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS delivery_builds_deny_all ON delivery_builds;
ALTER TABLE IF EXISTS delivery_builds DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS delivery_builds;

COMMIT;
