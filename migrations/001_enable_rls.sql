-- ============================================================================
-- LuxyHub RLS Migration — Service Role Only Access
-- ============================================================================
-- Run this in Supabase SQL Editor.
-- This migration:
--   1. Enables RLS on all application tables
--   2. Denies all access for anon and authenticated users
--   3. Allows full access only for service role
--   4. Preserves existing indexes, defaults, and data
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. keys — Core key storage
-- ---------------------------------------------------------------------------
ALTER TABLE keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS keys_deny_all ON keys;
CREATE POLICY keys_deny_all
  ON keys
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 2. used_workink_tokens — Token replay protection
-- ---------------------------------------------------------------------------
ALTER TABLE used_workink_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS used_workink_tokens_deny_all ON used_workink_tokens;
CREATE POLICY used_workink_tokens_deny_all
  ON used_workink_tokens
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 3. rate_limits — Rate limiting
-- ---------------------------------------------------------------------------
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rate_limits_deny_all ON rate_limits;
CREATE POLICY rate_limits_deny_all
  ON rate_limits
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 4. verification_logs — Event logging
-- ---------------------------------------------------------------------------
ALTER TABLE verification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS verification_logs_deny_all ON verification_logs;
CREATE POLICY verification_logs_deny_all
  ON verification_logs
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 5. key_usage — Future analytics (currently unused)
-- ---------------------------------------------------------------------------
ALTER TABLE key_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS key_usage_deny_all ON key_usage;
CREATE POLICY key_usage_deny_all
  ON key_usage
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMIT;
