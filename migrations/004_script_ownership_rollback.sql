-- ============================================================================
-- LuxyHub Creator Ownership — Migration 004 ROLLBACK
-- ============================================================================
-- Run this in Supabase SQL Editor to undo migration 004.
-- Removes owner-based policies and drops the creator FK.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS script_versions_insert_own ON script_versions;
DROP POLICY IF EXISTS script_versions_select_own ON script_versions;
DROP POLICY IF EXISTS scripts_delete_own ON scripts;
DROP POLICY IF EXISTS scripts_update_own ON scripts;
DROP POLICY IF EXISTS scripts_insert_own ON scripts;
DROP POLICY IF EXISTS scripts_select_own ON scripts;

ALTER TABLE scripts
  DROP CONSTRAINT IF EXISTS fk_scripts_creator;

COMMIT;
