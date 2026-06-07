-- ============================================================================
-- LuxyHub Creator Ownership — Database Migration 004
-- ============================================================================
-- Run this in Supabase SQL Editor after 003_profiles.sql.
-- This migration:
--   1. Adds a migration-safe FK from scripts.creator_id to auth.users(id)
--   2. Keeps existing nullable legacy rows valid during migration
--   3. Adds owner-based RLS policies for scripts and script_versions
--   4. Keeps script_downloads service-role-only
-- ============================================================================

BEGIN;

CREATE INDEX IF NOT EXISTS idx_scripts_creator_id
  ON scripts (creator_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_scripts_creator'
      AND conrelid = 'public.scripts'::regclass
  ) THEN
    ALTER TABLE scripts
      ADD CONSTRAINT fk_scripts_creator
      FOREIGN KEY (creator_id) REFERENCES auth.users(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

DROP POLICY IF EXISTS scripts_select_own ON scripts;
CREATE POLICY scripts_select_own
  ON scripts
  FOR SELECT
  TO authenticated
  USING (creator_id = auth.uid());

DROP POLICY IF EXISTS scripts_insert_own ON scripts;
CREATE POLICY scripts_insert_own
  ON scripts
  FOR INSERT
  TO authenticated
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS scripts_update_own ON scripts;
CREATE POLICY scripts_update_own
  ON scripts
  FOR UPDATE
  TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS scripts_delete_own ON scripts;
CREATE POLICY scripts_delete_own
  ON scripts
  FOR DELETE
  TO authenticated
  USING (creator_id = auth.uid());

DROP POLICY IF EXISTS script_versions_select_own ON script_versions;
CREATE POLICY script_versions_select_own
  ON script_versions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM scripts
      WHERE scripts.id = script_versions.script_id
        AND scripts.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS script_versions_insert_own ON script_versions;
CREATE POLICY script_versions_insert_own
  ON script_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM scripts
      WHERE scripts.id = script_versions.script_id
        AND scripts.creator_id = auth.uid()
    )
  );

COMMIT;

-- Run after production orphan checks are clean:
-- ALTER TABLE scripts VALIDATE CONSTRAINT fk_scripts_creator;
