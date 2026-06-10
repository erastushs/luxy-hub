-- ============================================================================
-- LuxyHub Event Platform - Phase 8 Final Hardening
-- RLS rollback for alert_events
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS alert_events_deny_all ON alert_events;

ALTER TABLE alert_events DISABLE ROW LEVEL SECURITY;

COMMIT;
