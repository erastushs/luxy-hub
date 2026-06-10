-- ============================================================================
-- LuxyHub Event Platform - Phase 8 Hardening Rollback
-- ============================================================================

BEGIN;

DROP INDEX IF EXISTS idx_event_logs_pending_claim;

ALTER TABLE event_logs
  DROP COLUMN IF EXISTS claimed_at;

COMMIT;
