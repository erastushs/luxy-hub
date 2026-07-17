-- ============================================================================
-- LuxyHub Phase 8B.2 — Analytics Simplification
-- ============================================================================
-- Compatibility phase: script_executions, its trigger, indexes, and constraints
-- are deliberately retained for rollback. Production code stops writing to it.
-- ============================================================================

BEGIN;

-- The expression UPDATE is atomic under PostgreSQL row locking. Concurrent calls
-- serialize on the scripts row, so no execute_count increment can be lost.
CREATE OR REPLACE FUNCTION increment_script_execution_stats(p_script_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE scripts
  SET
    execute_count = execute_count + 1,
    last_executed_at = now()
  WHERE id = p_script_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Script % not found while incrementing execution stats', p_script_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION increment_script_execution_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_script_execution_stats(uuid) TO service_role;

-- Keep the old table and trigger untouched, but remove the cleanup path's table
-- dependency. The function is replaced rather than dropped for a simple rollback.
CREATE OR REPLACE FUNCTION cleanup_expired_delivery_sessions(
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
  deleted_sessions AS (
    DELETE FROM delivery_sessions ds
    USING candidate_page cp
    WHERE ds.id = cp.id
    RETURNING ds.id
  )
  SELECT
    (SELECT count(*)::integer FROM deleted_sessions) AS deleted_count,
    (SELECT count(*)::integer FROM candidate_page) AS processed_count,
    GREATEST((SELECT count(*)::integer FROM candidate_page) - (SELECT count(*)::integer FROM deleted_sessions), 0) AS remaining_candidates;
END;
$$;

REVOKE ALL ON FUNCTION cleanup_expired_delivery_sessions(timestamp with time zone, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_expired_delivery_sessions(
  timestamp with time zone,
  integer
) TO service_role;

-- Ensure legacy callers cannot retain a runtime dependency on script_executions.
CREATE OR REPLACE FUNCTION cleanup_expired_delivery_sessions_without_executions(
  before_timestamp timestamp with time zone DEFAULT now(),
  batch_size integer DEFAULT 1000
)
RETURNS TABLE (
  deleted_count integer,
  processed_count integer,
  remaining_candidates integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM cleanup_expired_delivery_sessions(before_timestamp, batch_size);
$$;

REVOKE ALL ON FUNCTION cleanup_expired_delivery_sessions_without_executions(timestamp with time zone, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_expired_delivery_sessions_without_executions(
  timestamp with time zone,
  integer
) TO service_role;

COMMIT;
