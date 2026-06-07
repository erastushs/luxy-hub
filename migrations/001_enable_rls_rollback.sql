-- ============================================================================
-- ROLLBACK: LuxyHub RLS Migration
-- ============================================================================
-- Run this in Supabase SQL Editor to revert the RLS migration.
-- ============================================================================

BEGIN;

ALTER TABLE keys DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS keys_deny_all ON keys;

ALTER TABLE used_workink_tokens DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS used_workink_tokens_deny_all ON used_workink_tokens;

ALTER TABLE rate_limits DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rate_limits_deny_all ON rate_limits;

ALTER TABLE verification_logs DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS verification_logs_deny_all ON verification_logs;

ALTER TABLE key_usage DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS key_usage_deny_all ON key_usage;

COMMIT;
