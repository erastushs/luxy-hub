-- ============================================================================
-- LuxyHub Event Platform - Phase 8E.3 Internal Alerts
-- ============================================================================
-- Stores active and resolved alert records for internal operations monitoring.
-- Deduplication: only one active alert per alert_type at a time.
-- ============================================================================

BEGIN;

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

COMMIT;
