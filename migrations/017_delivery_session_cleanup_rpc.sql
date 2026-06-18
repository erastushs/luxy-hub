-- Delivery session cleanup RPC
-- Deletes expired delivery sessions that are not referenced by script_executions.

BEGIN;

CREATE OR REPLACE FUNCTION cleanup_expired_delivery_sessions_without_executions(
  before_timestamp timestamp with time zone DEFAULT now(),
  batch_size integer DEFAULT 5000
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
  effective_batch_size integer := greatest(1, least(coalesce(batch_size, 5000), 10000));
BEGIN
  RETURN QUERY
  WITH expired_candidates AS (
    SELECT ds.id
    FROM delivery_sessions ds
    WHERE ds.expires_at < before_timestamp
    ORDER BY ds.expires_at ASC, ds.id ASC
    LIMIT effective_batch_size
  ),
  deletable_candidates AS (
    SELECT ec.id
    FROM expired_candidates ec
    WHERE NOT EXISTS (
      SELECT 1
      FROM script_executions se
      WHERE se.session_id = ec.id
    )
  ),
  deleted_sessions AS (
    DELETE FROM delivery_sessions ds
    USING deletable_candidates dc
    WHERE ds.id = dc.id
    RETURNING ds.id
  )
  SELECT
    (SELECT count(*)::integer FROM deleted_sessions) AS deleted_count,
    (SELECT count(*)::integer FROM expired_candidates) AS processed_count,
    (SELECT count(*)::integer FROM delivery_sessions ds
      WHERE ds.expires_at < before_timestamp
        AND NOT EXISTS (
          SELECT 1
          FROM script_executions se
          WHERE se.session_id = ds.id
        )
    ) AS remaining_candidates;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_expired_delivery_sessions_without_executions(
  timestamp with time zone,
  integer
) TO service_role;

COMMIT;
