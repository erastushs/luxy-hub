-- Optimize delivery session cleanup RPC
-- Avoids unbounded remaining-candidate counts that can exceed statement timeout.

BEGIN;

CREATE OR REPLACE FUNCTION cleanup_expired_delivery_sessions_without_executions(
  before_timestamp timestamp with time zone DEFAULT now(),
  batch_size integer DEFAULT 1000
)
RETURNS TABLE (
  deleted_count integer,
  processed_count integer,
  remaining_candidates integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  effective_batch_size integer := greatest(1, least(coalesce(batch_size, 1000), 1000));
BEGIN
  RETURN QUERY
  WITH candidate_page AS (
    SELECT ds.id, ds.expires_at
    FROM delivery_sessions ds
    WHERE ds.expires_at < before_timestamp
      AND NOT EXISTS (
        SELECT 1
        FROM script_executions se
        WHERE se.session_id = ds.id
      )
    ORDER BY ds.expires_at ASC, ds.id ASC
    LIMIT effective_batch_size + 1
  ),
  deletable_candidates AS (
    SELECT cp.id
    FROM candidate_page cp
    ORDER BY cp.expires_at ASC, cp.id ASC
    LIMIT effective_batch_size
  ),
  deleted_sessions AS (
    DELETE FROM delivery_sessions ds
    USING deletable_candidates dc
    WHERE ds.id = dc.id
    RETURNING ds.id
  )
  SELECT
    (SELECT count(*)::integer FROM deleted_sessions) AS deleted_count,
    (SELECT count(*)::integer FROM deletable_candidates) AS processed_count,
    CASE
      WHEN (SELECT count(*) FROM candidate_page) > effective_batch_size THEN 1
      ELSE 0
    END::integer AS remaining_candidates;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_expired_delivery_sessions_without_executions(
  timestamp with time zone,
  integer
) TO service_role;

COMMIT;
