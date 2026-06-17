-- Phase 7B Key Management Metadata
-- Adds simple key categories and human-readable premium key metadata.

ALTER TABLE keys
  ADD COLUMN IF NOT EXISTS key_category text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS description text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'keys_key_category_check'
  ) THEN
    ALTER TABLE keys
      ADD CONSTRAINT keys_key_category_check
      CHECK (key_category IN ('free', 'premium', 'legacy'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_keys_key_category_created_at
  ON keys (key_category, created_at DESC);
