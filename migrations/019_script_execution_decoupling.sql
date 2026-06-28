-- ============================================================================
-- LuxyHub Phase 8A.3 — Decouple script_executions from delivery_sessions
-- Migration 019
-- ============================================================================
-- Run this in Supabase SQL Editor after 018_optimize_delivery_session_cleanup_rpc.
--
-- This migration:
--   1. Drops the foreign key on script_executions.session_id → delivery_sessions(id)
--   2. Preserves the UNIQUE constraint on session_id
--   3. Preserves the NOT NULL constraint on session_id
--   4. Preserves the AFTER INSERT trigger (execute_count, last_executed_at)
--   5. Preserves all indexes
--   6. Preserves RLS policies
--
-- Reason:
--   Delivery sessions may now be stored in Valkey (DELIVERY_SESSION_MODE=valkey).
--   Valkey sessions do not have corresponding rows in the PostgreSQL delivery_sessions
--   table. The foreign key was an architectural blocker preventing execution recording
--   when Valkey is authoritative.
--
--   script_executions is an append-only analytics event source. No production query
--   reads or JOINs on session_id. Creator Dashboard analytics read cached columns
--   (scripts.execute_count, scripts.last_executed_at) maintained by the trigger.
--
-- Rollback: see 019_script_execution_decoupling_rollback.sql
-- ============================================================================

BEGIN;

-- Drop the foreign key constraint only. The auto-generated name varies per
-- environment, so we discover it dynamically from pg_constraint.
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'script_executions'::regclass
    AND confrelid = 'delivery_sessions'::regclass
    AND contype = 'f';

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE script_executions DROP CONSTRAINT %I', fk_name);
  END IF;
END;
$$;

-- The UNIQUE constraint on session_id is preserved — it was created as part of
-- the inline column definition and remains intact. This ensures no duplicate
-- execution records for the same session.

-- The NOT NULL constraint on session_id is also preserved from the original
-- column definition.

-- No index changes needed. All existing indexes are functional and useful:
--   idx_script_executions_script_id      — per-script execution queries
--   idx_script_executions_created_at     — time-range queries
--   idx_script_executions_script_time    — per-script time-ordered queries

COMMIT;
