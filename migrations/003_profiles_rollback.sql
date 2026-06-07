-- ============================================================================
-- LuxyHub Creator Identity — Migration 003 ROLLBACK
-- ============================================================================
-- Run this in Supabase SQL Editor to undo migration 003.
-- Drops RLS policy, disables RLS, and drops the profiles table.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS profiles_deny_all ON profiles;

ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

DROP TABLE IF EXISTS profiles CASCADE;

COMMIT;
