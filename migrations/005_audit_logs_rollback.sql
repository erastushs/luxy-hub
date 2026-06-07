-- ============================================================================
-- LuxyHub Audit Logging — Database Migration 005 ROLLBACK
-- ============================================================================
-- Run this in Supabase SQL Editor to revert 005_audit_logs.sql.
-- ============================================================================

BEGIN;

DROP TABLE IF EXISTS audit_logs;

COMMIT;
