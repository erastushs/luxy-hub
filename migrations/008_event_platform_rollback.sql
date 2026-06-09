-- ============================================================================
-- LuxyHub Event Platform - Rollback Migration 008
-- ============================================================================
-- Removes the Phase 8B.1 event platform database foundation.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS event_logs_service_access ON event_logs;
DROP POLICY IF EXISTS event_logs_deny_all ON event_logs;
DROP TABLE IF EXISTS event_logs;

DROP POLICY IF EXISTS webhook_config_service_access ON webhook_config;
DROP POLICY IF EXISTS webhook_config_owner_delete ON webhook_config;
DROP POLICY IF EXISTS webhook_config_owner_update ON webhook_config;
DROP POLICY IF EXISTS webhook_config_owner_insert ON webhook_config;
DROP POLICY IF EXISTS webhook_config_owner_select ON webhook_config;
DROP TABLE IF EXISTS webhook_config;

ALTER TABLE IF EXISTS delivery_sessions
  DROP COLUMN IF EXISTS event_secret;

COMMIT;
