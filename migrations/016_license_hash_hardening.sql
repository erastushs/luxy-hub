-- ============================================================================
-- LuxyHub Migration 016 — License Secret Hash Hardening
-- ============================================================================
-- Adds a deterministic lookup hash for license keys. Existing SHA-256 license
-- hashes remain valid and are upgraded to scrypt verifiers plus HMAC lookup
-- hashes by application code after successful validation.
-- ============================================================================

BEGIN;

ALTER TABLE licenses
  ADD COLUMN IF NOT EXISTS key_lookup_hash text;

UPDATE licenses
SET key_lookup_hash = key_hash
WHERE key_lookup_hash IS NULL;

DROP INDEX IF EXISTS idx_licenses_key_lookup_hash;
CREATE INDEX IF NOT EXISTS idx_licenses_key_lookup_hash
  ON licenses (script_id, key_lookup_hash)
  WHERE key_lookup_hash IS NOT NULL;

COMMIT;
