-- ============================================================================
-- LuxyHub License Schema Foundation - Database Migration 013
-- ============================================================================
-- Run this in Supabase SQL Editor after 012_script_executions.sql.
-- This migration:
--   1. Adds scripts.access_mode with a production-safe public default
--   2. Creates licenses for future key/license access modes
--   3. Creates license_assignments with hashed customer identifiers only
--   4. Enables owner-scoped RLS for creators and service-role access
-- ============================================================================

BEGIN;

ALTER TABLE scripts
  ADD COLUMN IF NOT EXISTS access_mode text NOT NULL DEFAULT 'public';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'scripts_access_mode_check'
      AND conrelid = 'public.scripts'::regclass
  ) THEN
    ALTER TABLE scripts
      ADD CONSTRAINT scripts_access_mode_check
      CHECK (access_mode IN ('public', 'key_required', 'license_required')) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_scripts_access_mode
  ON scripts (access_mode);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scripts_id_creator_id
  ON scripts (id, creator_id);

CREATE TABLE IF NOT EXISTS licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash text NOT NULL
    CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  max_assignments integer NOT NULL DEFAULT 1
    CHECK (max_assignments > 0),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled', 'revoked')),
  activation_count bigint NOT NULL DEFAULT 0
    CHECK (activation_count >= 0),
  delivery_count bigint NOT NULL DEFAULT 0
    CHECK (delivery_count >= 0),
  last_activation_at timestamp with time zone,
  last_delivery_at timestamp with time zone,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT licenses_creator_owns_script
    FOREIGN KEY (script_id, creator_id)
    REFERENCES scripts(id, creator_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_licenses_script_id
  ON licenses (script_id);

CREATE INDEX IF NOT EXISTS idx_licenses_creator_id
  ON licenses (creator_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_licenses_script_key_hash
  ON licenses (script_id, key_hash);

CREATE INDEX IF NOT EXISTS idx_licenses_status
  ON licenses (status);

CREATE INDEX IF NOT EXISTS idx_licenses_expires_at
  ON licenses (expires_at)
  WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS license_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  customer_identifier_hash text NOT NULL
    CHECK (customer_identifier_hash ~ '^[a-f0-9]{64}$'),
  display_name text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled', 'revoked')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_license_assignments_license_id
  ON license_assignments (license_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_license_assignments_license_customer
  ON license_assignments (license_id, customer_identifier_hash);

CREATE INDEX IF NOT EXISTS idx_license_assignments_customer_hash
  ON license_assignments (customer_identifier_hash);

CREATE INDEX IF NOT EXISTS idx_license_assignments_status
  ON license_assignments (status);

ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS licenses_deny_anon ON licenses;
CREATE POLICY licenses_deny_anon
  ON licenses
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS licenses_service_access ON licenses;
CREATE POLICY licenses_service_access
  ON licenses
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS licenses_select_own ON licenses;
CREATE POLICY licenses_select_own
  ON licenses
  FOR SELECT
  TO authenticated
  USING (creator_id = auth.uid());

DROP POLICY IF EXISTS licenses_insert_own ON licenses;
CREATE POLICY licenses_insert_own
  ON licenses
  FOR INSERT
  TO authenticated
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS licenses_update_own ON licenses;
CREATE POLICY licenses_update_own
  ON licenses
  FOR UPDATE
  TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS licenses_delete_own ON licenses;
CREATE POLICY licenses_delete_own
  ON licenses
  FOR DELETE
  TO authenticated
  USING (creator_id = auth.uid());

DROP POLICY IF EXISTS license_assignments_deny_anon ON license_assignments;
CREATE POLICY license_assignments_deny_anon
  ON license_assignments
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS license_assignments_service_access ON license_assignments;
CREATE POLICY license_assignments_service_access
  ON license_assignments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS license_assignments_select_own ON license_assignments;
CREATE POLICY license_assignments_select_own
  ON license_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM licenses
      WHERE licenses.id = license_assignments.license_id
        AND licenses.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS license_assignments_insert_own ON license_assignments;
CREATE POLICY license_assignments_insert_own
  ON license_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM licenses
      WHERE licenses.id = license_assignments.license_id
        AND licenses.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS license_assignments_update_own ON license_assignments;
CREATE POLICY license_assignments_update_own
  ON license_assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM licenses
      WHERE licenses.id = license_assignments.license_id
        AND licenses.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM licenses
      WHERE licenses.id = license_assignments.license_id
        AND licenses.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS license_assignments_delete_own ON license_assignments;
CREATE POLICY license_assignments_delete_own
  ON license_assignments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM licenses
      WHERE licenses.id = license_assignments.license_id
        AND licenses.creator_id = auth.uid()
    )
  );

COMMIT;
