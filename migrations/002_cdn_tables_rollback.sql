-- ============================================================================
-- LuxyHub CDN — Migration 002 ROLLBACK
-- ============================================================================
-- Run this in Supabase SQL Editor to undo migration 002.
-- Drops RLS policies, foreign keys, indexes, and tables in reverse order.
-- ============================================================================

BEGIN;

-- 1. Drop RLS policies
DROP POLICY IF EXISTS script_downloads_deny_all ON script_downloads;
DROP POLICY IF EXISTS script_versions_deny_all ON script_versions;
DROP POLICY IF EXISTS scripts_deny_all ON scripts;

-- 2. Disable RLS on all CDN tables
ALTER TABLE script_downloads DISABLE ROW LEVEL SECURITY;
ALTER TABLE script_versions DISABLE ROW LEVEL SECURITY;
ALTER TABLE scripts DISABLE ROW LEVEL SECURITY;

-- 3. Drop foreign key from scripts to script_versions
ALTER TABLE scripts
  DROP CONSTRAINT IF EXISTS fk_scripts_current_version;

-- 4. Drop tables (CASCADE to remove dependent FKs in script_downloads)
DROP TABLE IF EXISTS script_downloads CASCADE;
DROP TABLE IF EXISTS script_versions CASCADE;
DROP TABLE IF EXISTS scripts CASCADE;

COMMIT;
