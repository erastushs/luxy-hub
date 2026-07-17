-- ============================================================================
-- Rollback Phase 8B.2 Analytics Simplification
-- ============================================================================
-- Roll back the application deployment first so delivery resumes inserting into
-- script_executions and its retained trigger restores the cached counters.
-- ============================================================================

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
  WITH candidate_page AS MATERIALIZED (
    SELECT ds.id
    FROM delivery_sessions ds
    WHERE ds.expires_at < before_timestamp
    ORDER BY ds.expires_at ASC, ds.id ASC
    LIMIT effective_batch_size
  ),
  deletable_candidates AS (
    SELECT cp.id
    FROM candidate_page cp
    WHERE NOT EXISTS (
      SELECT 1
      FROM script_executions se
      WHERE se.session_id = cp.id
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
    (SELECT count(*)::integer FROM deletable_candidates) AS processed_count,
    GREATEST((SELECT count(*)::integer FROM candidate_page) - (SELECT count(*)::integer FROM deleted_sessions), 0) AS remaining_candidates;
END;
$$;

DROP FUNCTION IF EXISTS cleanup_expired_delivery_sessions(timestamp with time zone, integer);
DROP FUNCTION IF EXISTS increment_script_execution_stats(uuid);

COMMIT;
