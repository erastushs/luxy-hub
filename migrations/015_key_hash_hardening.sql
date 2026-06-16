-- ============================================================================
-- LuxyHub Migration 015 — Free Key Hash Hardening
-- ============================================================================
-- Adds hashed lookup columns for free keys and migrates existing plaintext keys
-- to legacy SHA-256 lookup hashes. Application code upgrades legacy hashes to
-- keyed HMAC hashes on successful validation.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE keys
  ADD COLUMN IF NOT EXISTS key_hash text,
  ADD COLUMN IF NOT EXISTS hash_version text NOT NULL DEFAULT 'plaintext-legacy';

UPDATE keys
SET
  key_hash = 'legacy-sha256:' || encode(digest(key, 'sha256'), 'hex'),
  hash_version = 'legacy-sha256',
  key = NULL
WHERE key IS NOT NULL
  AND (key_hash IS NULL OR hash_version = 'plaintext-legacy');

ALTER TABLE keys
  ALTER COLUMN key DROP NOT NULL;

ALTER TABLE keys DROP CONSTRAINT IF EXISTS keys_key_key;
DROP INDEX IF EXISTS idx_keys_key_hash;
CREATE UNIQUE INDEX IF NOT EXISTS idx_keys_key_hash
  ON keys (key_hash)
  WHERE key_hash IS NOT NULL;

ALTER TABLE keys
  DROP CONSTRAINT IF EXISTS keys_lookup_present;

ALTER TABLE keys
  ADD CONSTRAINT keys_lookup_present
  CHECK (key_hash IS NOT NULL OR key IS NOT NULL);

COMMIT;
