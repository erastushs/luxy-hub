-- ============================================================================
-- LuxyHub Secure Delivery - Rollback Migration 007
-- ============================================================================
-- Drops the Phase 5C delivery_sessions table.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS delivery_sessions_deny_all ON delivery_sessions;
ALTER TABLE IF EXISTS delivery_sessions DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS delivery_sessions;

COMMIT;
