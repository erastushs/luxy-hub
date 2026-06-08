-- ============================================================================
-- LuxyHub Secure Delivery - Database Migration 006
-- ============================================================================
-- Run this in Supabase SQL Editor after 005_audit_logs.sql.
-- This migration:
--   1. Creates delivery_builds for Phase 5B pre-built payload artifacts
--   2. Uses inline encrypted payload storage only
--   3. Adds integrity and compatibility indexes
--   4. Enables Row Level Security with deny-all (service-role-only)
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS delivery_builds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES script_versions(id) ON DELETE CASCADE,
  build_status text NOT NULL DEFAULT 'building'
    CHECK (build_status IN ('pending', 'building', 'ready', 'failed', 'invalidated')),
  payload_storage_kind text NOT NULL DEFAULT 'inline_encrypted'
    CHECK (payload_storage_kind = 'inline_encrypted'),
  payload_ciphertext text,
  payload_content_type text NOT NULL DEFAULT 'application/vnd.luxyhub.delivery-payload.v1+json',
  payload_byte_size integer
    CHECK (payload_byte_size IS NULL OR payload_byte_size >= 0),
  source_sha256 text NOT NULL
    CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
  payload_sha256 text
    CHECK (payload_sha256 IS NULL OR payload_sha256 ~ '^[a-f0-9]{64}$'),
  build_version text NOT NULL,
  payload_format_version text NOT NULL,
  encryption_scheme text NOT NULL DEFAULT 'aes-256-gcm:v1',
  encryption_key_id text,
  invalidated_reason text,
  build_error_code text,
  build_error_message text,
  metadata jsonb NOT NULL DEFAULT '{}',
  built_at timestamp with time zone,
  invalidated_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT delivery_builds_ready_payload_required
    CHECK (
      build_status <> 'ready'
      OR (
        payload_ciphertext IS NOT NULL
        AND payload_sha256 IS NOT NULL
        AND built_at IS NOT NULL
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_delivery_builds_version_status
  ON delivery_builds (version_id, build_status);

CREATE INDEX IF NOT EXISTS idx_delivery_builds_script_status
  ON delivery_builds (script_id, build_status);

CREATE INDEX IF NOT EXISTS idx_delivery_builds_compatibility
  ON delivery_builds (build_version, payload_format_version);

CREATE INDEX IF NOT EXISTS idx_delivery_builds_payload_sha256
  ON delivery_builds (payload_sha256);

CREATE INDEX IF NOT EXISTS idx_delivery_builds_created_at
  ON delivery_builds (created_at DESC);

ALTER TABLE delivery_builds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delivery_builds_deny_all ON delivery_builds;
CREATE POLICY delivery_builds_deny_all
  ON delivery_builds
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMIT;
