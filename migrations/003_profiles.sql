-- ============================================================================
-- LuxyHub Creator Identity — Database Migration 003
-- ============================================================================
-- Run this in Supabase SQL Editor after 002_cdn_tables.sql.
-- This migration:
--   1. Creates the profiles table linked one-to-one with auth.users
--   2. Enforces allowed creator roles
--   3. Enables Row Level Security with deny-all for anon/authenticated
--   4. Prepares Phase 3B ownership enforcement and creator session auth
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  display_name text NOT NULL,
  avatar_url text,
  role text NOT NULL DEFAULT 'creator'
    CHECK (role IN ('creator', 'admin')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON profiles (role);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_deny_all ON profiles;
CREATE POLICY profiles_deny_all
  ON profiles
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMIT;
