-- ============================================================================
-- LuxyHub Migration 017 — License Hash Model Alignment
-- ============================================================================
-- Aligns the licenses schema with the current application model:
--   - licenses.key_hash stores a verifier (legacy SHA-256 or scrypt:v1)
--   - licenses.key_lookup_hash stores the deterministic lookup hash
--   - canonical lookup uniqueness is enforced on (script_id, key_lookup_hash)
--
-- This migration intentionally does not change RLS policies, license assignment
-- schema, or application business logic.
-- ============================================================================

BEGIN;

ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS key_lookup_hash text;

-- Preserve legacy SHA-256 licenses for lookup. Do not copy scrypt verifiers into
-- key_lookup_hash if this migration is run after partial/manual hardening.
UPDATE public.licenses
SET key_lookup_hash = key_hash
WHERE key_lookup_hash IS NULL
  AND key_hash ~ '^[a-f0-9]{64}$';

-- Fail fast on malformed lookup hashes before adding the CHECK constraint.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.licenses
    WHERE key_lookup_hash IS NOT NULL
      AND key_lookup_hash !~ '^[a-f0-9]{64}$'
  ) THEN
    RAISE EXCEPTION 'licenses.key_lookup_hash contains non-null values that are not lowercase 64-character hex hashes';
  END IF;
END $$;

-- Fail fast before creating the unique lookup index. Duplicate lookup identities
-- require manual data review and must not be silently repaired by migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.licenses
    WHERE key_lookup_hash IS NOT NULL
    GROUP BY script_id, key_lookup_hash
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate licenses found for (script_id, key_lookup_hash); aborting license hash model alignment';
  END IF;
END $$;

ALTER TABLE public.licenses
  DROP CONSTRAINT IF EXISTS licenses_key_hash_check;

ALTER TABLE public.licenses
  ADD CONSTRAINT licenses_key_hash_check
  CHECK (
    key_hash ~ '^[a-f0-9]{64}$'
    OR key_hash ~ '^scrypt:v1:[0-9]+:[0-9]+:[0-9]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'
  );

ALTER TABLE public.licenses
  DROP CONSTRAINT IF EXISTS licenses_key_lookup_hash_check;

ALTER TABLE public.licenses
  ADD CONSTRAINT licenses_key_lookup_hash_check
  CHECK (key_lookup_hash IS NULL OR key_lookup_hash ~ '^[a-f0-9]{64}$');

-- Move canonical uniqueness from salted/non-deterministic verifier storage to the
-- deterministic lookup hash used by application lookups.
DROP INDEX IF EXISTS idx_licenses_key_lookup_hash;
DROP INDEX IF EXISTS idx_licenses_script_key_lookup_hash;
CREATE UNIQUE INDEX idx_licenses_script_key_lookup_hash
  ON public.licenses (script_id, key_lookup_hash)
  WHERE key_lookup_hash IS NOT NULL;

-- key_hash is no longer the canonical identity because new verifier values are
-- salted. Keep a non-unique index for legacy SHA-256 fallback lookups.
DROP INDEX IF EXISTS idx_licenses_script_key_hash;
DROP INDEX IF EXISTS idx_licenses_script_key_hash_legacy;
CREATE INDEX idx_licenses_script_key_hash_legacy
  ON public.licenses (script_id, key_hash);

COMMIT;
