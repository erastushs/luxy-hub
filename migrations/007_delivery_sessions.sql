-- ============================================================================
-- LuxyHub Secure Delivery - Database Migration 007
-- ============================================================================
-- Run this in Supabase SQL Editor after 006_delivery_builds.sql.
-- This migration:
--   1. Creates delivery_sessions for short-lived secure payload access
--   2. Stores only session token hashes, never raw tokens
--   3. Adds indexes for token lookup and expiration cleanup
--   4. Enables Row Level Security with deny-all (service-role-only)
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS delivery_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  build_id uuid NOT NULL REFERENCES delivery_builds(id) ON DELETE CASCADE,
  session_token_hash text NOT NULL UNIQUE
    CHECK (session_token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamp with time zone NOT NULL,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT delivery_sessions_expires_after_created
    CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_delivery_sessions_token_hash
  ON delivery_sessions (session_token_hash);

CREATE INDEX IF NOT EXISTS idx_delivery_sessions_expires_at
  ON delivery_sessions (expires_at);

CREATE INDEX IF NOT EXISTS idx_delivery_sessions_build_id
  ON delivery_sessions (build_id);

ALTER TABLE delivery_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delivery_sessions_deny_all ON delivery_sessions;
CREATE POLICY delivery_sessions_deny_all
  ON delivery_sessions
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMIT;
