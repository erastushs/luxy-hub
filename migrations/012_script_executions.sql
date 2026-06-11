-- ============================================================================
-- LuxyHub Analytics V1 - Database Migration 012
-- ============================================================================
-- Run this in Supabase SQL Editor after 011_alert_events_rls.sql.
-- This migration:
--   1. Adds cached execution analytics to scripts
--   2. Creates script_executions as the canonical execution event table
--   3. Maintains cached counters atomically via an insert trigger
--   4. Enables Row Level Security with service-role-only access
-- ============================================================================

BEGIN;

ALTER TABLE scripts
  ADD COLUMN IF NOT EXISTS execute_count bigint NOT NULL DEFAULT 0;

ALTER TABLE scripts
  ADD COLUMN IF NOT EXISTS last_executed_at timestamp with time zone;

CREATE TABLE IF NOT EXISTS script_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  session_id uuid NOT NULL UNIQUE REFERENCES delivery_sessions(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_script_executions_script_id
  ON script_executions (script_id);

CREATE INDEX IF NOT EXISTS idx_script_executions_created_at
  ON script_executions (created_at);

CREATE INDEX IF NOT EXISTS idx_script_executions_script_time
  ON script_executions (script_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scripts_execute_count
  ON scripts (execute_count DESC);

CREATE INDEX IF NOT EXISTS idx_scripts_last_executed_at
  ON scripts (last_executed_at DESC);

CREATE OR REPLACE FUNCTION increment_script_execution_cache()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE scripts
  SET
    execute_count = execute_count + 1,
    last_executed_at = NEW.created_at
  WHERE id = NEW.script_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_increment_script_execution_cache ON script_executions;
CREATE TRIGGER trg_increment_script_execution_cache
  AFTER INSERT ON script_executions
  FOR EACH ROW
  EXECUTE FUNCTION increment_script_execution_cache();

ALTER TABLE script_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS script_executions_deny_all ON script_executions;
CREATE POLICY script_executions_deny_all
  ON script_executions
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS script_executions_service_access ON script_executions;
CREATE POLICY script_executions_service_access
  ON script_executions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
