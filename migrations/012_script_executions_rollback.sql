-- ============================================================================
-- LuxyHub Analytics V1 - Migration 012 ROLLBACK
-- ============================================================================
-- Run this in Supabase SQL Editor to undo migration 012.
-- Keeps legacy script_downloads untouched for rollback safety.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS script_executions_service_access ON script_executions;
DROP POLICY IF EXISTS script_executions_deny_all ON script_executions;

DROP TRIGGER IF EXISTS trg_increment_script_execution_cache ON script_executions;
DROP FUNCTION IF EXISTS increment_script_execution_cache();

DROP INDEX IF EXISTS idx_scripts_last_executed_at;
DROP INDEX IF EXISTS idx_scripts_execute_count;
DROP INDEX IF EXISTS idx_script_executions_script_time;
DROP INDEX IF EXISTS idx_script_executions_created_at;
DROP INDEX IF EXISTS idx_script_executions_script_id;

DROP TABLE IF EXISTS script_executions CASCADE;

ALTER TABLE scripts
  DROP COLUMN IF EXISTS last_executed_at;

ALTER TABLE scripts
  DROP COLUMN IF EXISTS execute_count;

COMMIT;
