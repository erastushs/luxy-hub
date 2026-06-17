-- Phase 7B.4 Key Type Alignment
-- Separates business classification (key_category) from product classification (key_type).

ALTER TABLE keys
  ADD COLUMN IF NOT EXISTS key_type text NOT NULL DEFAULT 'legacy';

ALTER TABLE keys
  ALTER COLUMN key_type SET DEFAULT 'legacy';

ALTER TABLE keys
  DROP CONSTRAINT IF EXISTS keys_key_type_check;

ALTER TABLE keys
  ADD CONSTRAINT keys_key_type_check
  CHECK (key_type IN ('free', 'weekly', 'monthly', 'custom', 'legacy'));

UPDATE keys
SET key_type = 'legacy'
WHERE key_category = 'legacy';

UPDATE keys
SET key_type = 'free'
WHERE key_category = 'free';

CREATE INDEX IF NOT EXISTS idx_keys_key_category_key_type_created_at
  ON keys (key_category, key_type, created_at DESC);
