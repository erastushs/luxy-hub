-- ============================================================================
-- LuxyHub Event Platform - Phase 8 Final Hardening
-- RLS for alert_events — service-role only access
-- ============================================================================
-- Addresses HIGH-1 from PHASE8_FINAL_AUDIT.md:
-- alert_events was created without RLS while all other operational tables
-- enable RLS with explicit deny-all policies.
-- ============================================================================

BEGIN;

ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alert_events_deny_all ON alert_events;
CREATE POLICY alert_events_deny_all
  ON alert_events
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMIT;
