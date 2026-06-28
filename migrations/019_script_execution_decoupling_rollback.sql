-- ============================================================================
-- LuxyHub Phase 8A.3 — Rollback: Restore script_executions → delivery_sessions FK
-- Migration 019 Rollback
-- ============================================================================
-- Run this in Supabase SQL Editor to undo migration 019.
--
-- This rollback:
--   1. Restores the foreign key on script_executions.session_id → delivery_sessions(id)
--      with ON DELETE CASCADE
--   2. Preserves the UNIQUE constraint (the FK uses ADD CONSTRAINT, not inline)
--
-- Warning: If Valkey-mode sessions were written while the FK was absent, this
-- rollback will fail if any script_executions row references a session_id that
-- does not exist in delivery_sessions. Clean those rows first.
-- ============================================================================

BEGIN;

-- Check for orphaned rows before adding the constraint back
DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM script_executions se
  WHERE NOT EXISTS (
    SELECT 1 FROM delivery_sessions ds WHERE ds.id = se.session_id
  );

  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Cannot restore FK: % script_executions rows reference session_ids not in delivery_sessions. Clean up orphaned rows first.',
      orphan_count;
  END IF;
END;
$$;

-- Re-add the foreign key constraint with the same ON DELETE CASCADE semantics
ALTER TABLE script_executions
  ADD CONSTRAINT script_executions_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES delivery_sessions(id) ON DELETE CASCADE;

COMMIT;
