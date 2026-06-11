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
  execute_count bigint NOT NULL DEFAULT 0,
  last_executed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scripts_slug
  ON scripts (slug);

CREATE INDEX IF NOT EXISTS idx_scripts_visibility
  ON scripts (visibility);

CREATE INDEX IF NOT EXISTS idx_scripts_creator_id
  ON scripts (creator_id);

CREATE INDEX IF NOT EXISTS idx_scripts_execute_count
  ON scripts (execute_count DESC);

CREATE INDEX IF NOT EXISTS idx_scripts_last_executed_at
  ON scripts (last_executed_at DESC);

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
-- LuxyHub Secure Delivery - Phase 5B
-- Apply migrations/006_delivery_builds.sql after running this section
-- ============================================================================

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

-- ============================================================================
-- LuxyHub Secure Delivery - Phase 5C
-- Apply migrations/007_delivery_sessions.sql after running this section
-- ============================================================================

CREATE TABLE IF NOT EXISTS delivery_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  build_id uuid NOT NULL REFERENCES delivery_builds(id) ON DELETE CASCADE,
  session_token_hash text NOT NULL UNIQUE
    CHECK (session_token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamp with time zone NOT NULL,
  consumed_at timestamp with time zone,
  event_secret text,
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

-- Analytics V1 execution tracking
CREATE TABLE IF NOT EXISTS script_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  session_id uuid NOT NULL UNIQUE REFERENCES delivery_sessions(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_script_executions_script_id
  ON script_executions (script_id);

CREATE INDEX IF NOT EXISTS idx_script_executions_created_at
  ON script_executions (created_at);

CREATE INDEX IF NOT EXISTS idx_script_executions_script_time
  ON script_executions (script_id, created_at DESC);

-- ============================================================================
-- LuxyHub Event Platform - Phase 8B.1
-- Apply migrations/008_event_platform.sql after running this section
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL UNIQUE REFERENCES scripts(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('discord', 'telegram', 'slack')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(config) = 'object'),
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_config_script_id
  ON webhook_config (script_id);

CREATE INDEX IF NOT EXISTS idx_webhook_config_creator_id
  ON webhook_config (creator_id);

CREATE INDEX IF NOT EXISTS idx_webhook_config_enabled_provider
  ON webhook_config (enabled, provider)
  WHERE enabled = true;

CREATE TABLE IF NOT EXISTS event_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  session_id uuid REFERENCES delivery_sessions(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'execute', 'purchase', 'error', 'ban',
    'key_redeem', 'heartbeat',
    'license_activate', 'license_revoke'
  )),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  delivery_status text NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'delivered', 'dead_letter')),
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0 AND retry_count <= 5),
  timestamp timestamp with time zone NOT NULL,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  nonce text NOT NULL,
  last_retry_at timestamp with time zone,
  delivered_at timestamp with time zone,
  error_message text,
  claimed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_logs_pending_delivery
  ON event_logs (received_at ASC)
  WHERE delivery_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_event_logs_pending_claim
  ON event_logs (claimed_at, received_at ASC)
  WHERE delivery_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_event_logs_session_nonce
  ON event_logs (session_id, nonce);

CREATE INDEX IF NOT EXISTS idx_event_logs_script_event_time
  ON event_logs (script_id, event_type, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_logs_dead_letter
  ON event_logs (script_id, received_at DESC)
  WHERE delivery_status = 'dead_letter';

CREATE INDEX IF NOT EXISTS idx_event_logs_delivered_latency
  ON event_logs (script_id, received_at)
  WHERE delivery_status = 'delivered';

CREATE INDEX IF NOT EXISTS idx_event_logs_delivered_created
  ON event_logs (created_at)
  WHERE delivery_status = 'delivered';

-- ============================================================================
-- LuxyHub Internal Alerts — Phase 8E.3
-- Apply migrations/010_internal_alerts.sql after running this section
-- ============================================================================

CREATE TABLE IF NOT EXISTS alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  current_value numeric NOT NULL,
  threshold_value numeric NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_alert_events_type_status
  ON alert_events (alert_type, status);

CREATE INDEX IF NOT EXISTS idx_alert_events_severity_status
  ON alert_events (severity, status);

CREATE INDEX IF NOT EXISTS idx_alert_events_created_at
  ON alert_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_events_resolved_at
  ON alert_events (resolved_at DESC)
  WHERE status = 'resolved';



-- alert_events RLS: migrations/011_alert_events_rls.sql
-- enables RLS with deny-all for anon/authenticated (service-role only)


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
