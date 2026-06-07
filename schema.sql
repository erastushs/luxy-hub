-- LuxyHub Key System - Database Schema
-- Run this in Supabase SQL Editor
--
-- After running this, apply migrations/001_enable_rls.sql
-- to enable Row Level Security.

-- Core key storage
CREATE TABLE IF NOT EXISTS keys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  is_active boolean DEFAULT true
);

-- Work.ink token replay protection
CREATE TABLE IF NOT EXISTS used_workink_tokens (
  token text PRIMARY KEY,
  used_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_used_workink_tokens_used_at
  ON used_workink_tokens (used_at);

-- Rate limiting table for Vercel serverless
CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ip text NOT NULL,
  endpoint text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_endpoint_created_at
  ON rate_limits (ip, endpoint, created_at);

-- Event logging
CREATE TABLE IF NOT EXISTS verification_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event text NOT NULL,
  ip text,
  token_snippet text,
  key_snippet text,
  message text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_logs_event_created_at
  ON verification_logs (event, created_at);

-- Key usage tracking (for analytics/Phase 6)
CREATE TABLE IF NOT EXISTS key_usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL,
  used_at timestamp with time zone DEFAULT now()
);

-- ============================================================================
-- LuxyHub CDN — Phase 2
-- Apply migrations/002_cdn_tables.sql after running this section
-- ============================================================================

-- Script metadata and ownership
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

-- Immutable version history
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

-- current_version_id FK added after script_versions table exists
ALTER TABLE scripts
  ADD CONSTRAINT IF NOT EXISTS fk_scripts_current_version
  FOREIGN KEY (current_version_id) REFERENCES script_versions(id)
  ON DELETE SET NULL;

-- Analytics with hashed PII identifiers
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

-- ============================================================================
-- LuxyHub Creator Identity — Phase 3A
-- Apply migrations/003_profiles.sql after running this section
-- ============================================================================

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

-- ============================================================================
-- LuxyHub Creator Ownership — Phase 3B
-- Apply migrations/004_script_ownership.sql after running this section
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_scripts_creator'
      AND conrelid = 'public.scripts'::regclass
  ) THEN
    ALTER TABLE scripts
      ADD CONSTRAINT fk_scripts_creator
      FOREIGN KEY (creator_id) REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;
