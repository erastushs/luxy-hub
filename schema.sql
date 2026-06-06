-- LuxyHub Key System - Database Schema
-- Run this in Supabase SQL Editor

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
