-- ============================================================================
-- LuxyHub Audit Logging — Database Migration 005
-- ============================================================================
-- Run this in Supabase SQL Editor after 004_script_ownership.sql.
-- This migration:
--   1. Creates the audit_logs table for tracking creator actions
--   2. Adds indexes for actor_id and created_at lookups
--   3. Enables Row Level Security with deny-all (service-role-only)
--   4. Prepares Phase 3D security validation and compliance
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  actor_role text NOT NULL DEFAULT 'creator'
    CHECK (actor_role IN ('creator', 'admin')),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  resource_slug text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id
  ON audit_logs (actor_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource
  ON audit_logs (resource_type, resource_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_deny_all ON audit_logs;
CREATE POLICY audit_logs_deny_all
  ON audit_logs
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMIT;
