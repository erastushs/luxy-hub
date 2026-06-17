-- Phase 7B.5 Device Limits V1
-- Adds lightweight hashed device registration for key sharing reduction.

BEGIN;

ALTER TABLE keys
  ADD COLUMN IF NOT EXISTS max_devices integer;

ALTER TABLE keys
  DROP CONSTRAINT IF EXISTS keys_max_devices_check;

ALTER TABLE keys
  ADD CONSTRAINT keys_max_devices_check
  CHECK (max_devices IS NULL OR max_devices > 0);

UPDATE keys
SET max_devices = 1
WHERE key_type IN ('free', 'weekly')
  AND max_devices IS NULL;

UPDATE keys
SET max_devices = 3
WHERE key_type = 'monthly'
  AND max_devices IS NULL;

CREATE TABLE IF NOT EXISTS key_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id uuid NOT NULL REFERENCES keys(id) ON DELETE CASCADE,
  fingerprint_hash text NOT NULL
    CHECK (fingerprint_hash ~ '^[a-f0-9]{64}$'),
  first_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT key_devices_key_fingerprint_unique
    UNIQUE (key_id, fingerprint_hash)
);

CREATE INDEX IF NOT EXISTS idx_key_devices_key_id
  ON key_devices (key_id);

CREATE INDEX IF NOT EXISTS idx_key_devices_fingerprint_hash
  ON key_devices (fingerprint_hash);

CREATE INDEX IF NOT EXISTS idx_key_devices_last_seen_at
  ON key_devices (last_seen_at DESC);

ALTER TABLE key_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS key_devices_deny_all ON key_devices;
CREATE POLICY key_devices_deny_all
  ON key_devices
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS key_devices_service_access ON key_devices;
CREATE POLICY key_devices_service_access
  ON key_devices
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
