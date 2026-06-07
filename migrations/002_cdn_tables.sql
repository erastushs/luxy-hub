-- ============================================================================
-- LuxyHub CDN — Database Migration 002
-- ============================================================================
-- Run this in Supabase SQL Editor after 001_enable_rls.sql.
-- This migration:
--   1. Creates scripts, script_versions, script_downloads tables
--   2. Creates indexes for performance
--   3. Enables Row Level Security (service-role-only access)
--   4. Adds foreign key constraints with appropriate ON DELETE behavior
--   5. Places the CDN schema ready for Phase 2B API implementation
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. scripts — Core script metadata and ownership
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scripts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text DEFAULT '',
  visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('public', 'private', 'unlisted')),
  creator_id uuid,
  current_version_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scripts_slug
  ON scripts (slug);

CREATE INDEX IF NOT EXISTS idx_scripts_visibility
  ON scripts (visibility);

CREATE INDEX IF NOT EXISTS idx_scripts_creator_id
  ON scripts (creator_id);

-- RLS — service role only, deny anon and authenticated
ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scripts_deny_all ON scripts;
CREATE POLICY scripts_deny_all
  ON scripts
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 2. script_versions — Immutable version history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS script_versions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  script_id uuid NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  version text NOT NULL,
  content text NOT NULL,
  changelog text,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(script_id, version)
);

CREATE INDEX IF NOT EXISTS idx_script_versions_script_id
  ON script_versions (script_id);

CREATE INDEX IF NOT EXISTS idx_script_versions_script_version
  ON script_versions (script_id, version);

-- RLS — service role only, deny anon and authenticated
ALTER TABLE script_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS script_versions_deny_all ON script_versions;
CREATE POLICY script_versions_deny_all
  ON script_versions
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 3. scripts.current_version_id — Foreign Key to script_versions
--    Must be added after script_versions table exists.
-- ---------------------------------------------------------------------------
ALTER TABLE scripts
  ADD CONSTRAINT fk_scripts_current_version
  FOREIGN KEY (current_version_id) REFERENCES script_versions(id)
  ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 4. script_downloads — Analytics with PII protection (hashed identifiers)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS script_downloads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  script_id uuid NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  version_id uuid REFERENCES script_versions(id) ON DELETE SET NULL,
  ip_hash text NOT NULL,
  user_agent_hash text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_script_downloads_script_id
  ON script_downloads (script_id);

CREATE INDEX IF NOT EXISTS idx_script_downloads_created_at
  ON script_downloads (created_at);

CREATE INDEX IF NOT EXISTS idx_script_downloads_script_time
  ON script_downloads (script_id, created_at);

-- RLS — service role only, deny anon and authenticated
ALTER TABLE script_downloads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS script_downloads_deny_all ON script_downloads;
CREATE POLICY script_downloads_deny_all
  ON script_downloads
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMIT;
