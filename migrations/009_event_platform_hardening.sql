-- ============================================================================
-- LuxyHub Event Platform - Phase 8 Hardening
-- ============================================================================
-- Adds queue claim lease support so overlapping workers cannot process the same
-- pending event concurrently. Stale claims are recoverable by application lease
-- expiry checks.
-- ============================================================================

BEGIN;

ALTER TABLE event_logs
  ADD COLUMN IF NOT EXISTS claimed_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_event_logs_pending_claim
  ON event_logs (claimed_at, received_at ASC)
  WHERE delivery_status = 'pending';

COMMIT;
