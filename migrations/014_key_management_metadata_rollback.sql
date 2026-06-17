-- Rollback Phase 7B Key Management Metadata

DROP INDEX IF EXISTS idx_keys_key_category_created_at;

ALTER TABLE keys
  DROP CONSTRAINT IF EXISTS keys_key_category_check;

ALTER TABLE keys
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS key_category;
