-- ============================================================================
-- LuxyHub Event Platform - Database Migration 008
-- ============================================================================
-- Run this in Supabase SQL Editor after 007_delivery_sessions.sql.
-- This migration creates only the database foundation for Phase 8B.1:
--   1. webhook_config for one owner-managed provider config per script
--   2. event_logs for validated event storage and delivery audit state
--   3. nullable delivery_sessions.event_secret for future event signatures
-- No API endpoints, workers, provider integrations, webhook delivery, or queue
-- processing are implemented by this migration.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. webhook_config — provider credentials per script
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL UNIQUE
    REFERENCES scripts(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL
    CHECK (provider IN ('discord', 'telegram', 'slack')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(config) = 'object'),
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- lookup by script at event validation/config resolution time
CREATE INDEX IF NOT EXISTS idx_webhook_config_script_id
  ON webhook_config (script_id);

-- owner dashboard listing and owner-aware access checks
CREATE INDEX IF NOT EXISTS idx_webhook_config_creator_id
  ON webhook_config (creator_id);

-- future delivery worker lookup for enabled configs by provider
CREATE INDEX IF NOT EXISTS idx_webhook_config_enabled_provider
  ON webhook_config (enabled, provider)
  WHERE enabled = true;

ALTER TABLE webhook_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webhook_config_owner_select ON webhook_config;
CREATE POLICY webhook_config_owner_select
  ON webhook_config
  FOR SELECT
  TO authenticated
  USING (
    creator_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM scripts
      WHERE scripts.id = webhook_config.script_id
        AND scripts.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS webhook_config_owner_insert ON webhook_config;
CREATE POLICY webhook_config_owner_insert
  ON webhook_config
  FOR INSERT
  TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM scripts
      WHERE scripts.id = webhook_config.script_id
        AND scripts.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS webhook_config_owner_update ON webhook_config;
CREATE POLICY webhook_config_owner_update
  ON webhook_config
  FOR UPDATE
  TO authenticated
  USING (
    creator_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM scripts
      WHERE scripts.id = webhook_config.script_id
        AND scripts.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    creator_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM scripts
      WHERE scripts.id = webhook_config.script_id
        AND scripts.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS webhook_config_owner_delete ON webhook_config;
CREATE POLICY webhook_config_owner_delete
  ON webhook_config
  FOR DELETE
  TO authenticated
  USING (
    creator_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM scripts
      WHERE scripts.id = webhook_config.script_id
        AND scripts.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS webhook_config_service_access ON webhook_config;
CREATE POLICY webhook_config_service_access
  ON webhook_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2. event_logs — validated event storage and delivery audit state
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL
    REFERENCES scripts(id) ON DELETE CASCADE,
  session_id uuid
    REFERENCES delivery_sessions(id) ON DELETE SET NULL,
  event_type text NOT NULL
    CHECK (event_type IN (
      'execute',
      'purchase',
      'error',
      'ban',
      'key_redeem',
      'heartbeat',
      'license_activate',
      'license_revoke'
    )),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(payload) = 'object'),
  delivery_status text NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'delivered', 'dead_letter')),
  retry_count integer NOT NULL DEFAULT 0
    CHECK (retry_count >= 0 AND retry_count <= 5),
  timestamp timestamp with time zone NOT NULL,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  nonce text NOT NULL,
  last_retry_at timestamp with time zone,
  delivered_at timestamp with time zone,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Worker polling: find undelivered events in FIFO order
CREATE INDEX IF NOT EXISTS idx_event_logs_pending_delivery
  ON event_logs (received_at ASC)
  WHERE delivery_status = 'pending';

-- Nonce replay check within session scope
CREATE INDEX IF NOT EXISTS idx_event_logs_session_nonce
  ON event_logs (session_id, nonce);

-- Dashboard/API selector: event history per script and event type
CREATE INDEX IF NOT EXISTS idx_event_logs_script_event_time
  ON event_logs (script_id, event_type, received_at DESC);

-- Dashboard/API selector: dead-letter review per script
CREATE INDEX IF NOT EXISTS idx_event_logs_dead_letter
  ON event_logs (script_id, received_at DESC)
  WHERE delivery_status = 'dead_letter';

-- Delivery latency analytics in later Phase 8 work
CREATE INDEX IF NOT EXISTS idx_event_logs_delivered_latency
  ON event_logs (script_id, received_at)
  WHERE delivery_status = 'delivered';

-- Cleanup selector for old delivered events
CREATE INDEX IF NOT EXISTS idx_event_logs_delivered_created
  ON event_logs (created_at)
  WHERE delivery_status = 'delivered';

ALTER TABLE event_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_logs_deny_all ON event_logs;
CREATE POLICY event_logs_deny_all
  ON event_logs
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS event_logs_service_access ON event_logs;
CREATE POLICY event_logs_service_access
  ON event_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3. delivery_sessions — nullable event secret extension
-- ---------------------------------------------------------------------------
ALTER TABLE delivery_sessions
  ADD COLUMN IF NOT EXISTS event_secret text;

COMMIT;
