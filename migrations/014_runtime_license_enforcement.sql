-- Phase 7B runtime license enforcement helpers.
-- Adds atomic assignment-capacity authorization, runtime counters, and runtime audit support.

BEGIN;

ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_actor_role_check;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_actor_role_check
  CHECK (actor_role IN ('creator', 'admin', 'runtime'));

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_action_created
  ON public.audit_logs (actor_id, action, created_at DESC);

CREATE OR REPLACE FUNCTION public.authorize_license_assignment(
  p_license_id uuid,
  p_customer_identifier_hash text,
  p_display_name text DEFAULT NULL
)
RETURNS TABLE (
  success boolean,
  created boolean,
  id uuid,
  license_id uuid,
  customer_identifier_hash text,
  display_name text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_license public.licenses%ROWTYPE;
  v_assignment public.license_assignments%ROWTYPE;
  v_active_assignments integer;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_license
  FROM public.licenses
  WHERE public.licenses.id = p_license_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_license.status <> 'active'
    OR (v_license.expires_at IS NOT NULL AND v_license.expires_at <= v_now)
  THEN
    RETURN QUERY SELECT false, false, NULL::uuid, p_license_id, p_customer_identifier_hash, NULL::text, NULL::text, NULL::timestamptz, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT * INTO v_assignment
  FROM public.license_assignments
  WHERE public.license_assignments.license_id = p_license_id
    AND public.license_assignments.customer_identifier_hash = p_customer_identifier_hash;

  IF FOUND THEN
    RETURN QUERY SELECT v_assignment.status = 'active', false, v_assignment.id, v_assignment.license_id, v_assignment.customer_identifier_hash, v_assignment.display_name, v_assignment.status::text, v_assignment.created_at, v_assignment.updated_at;
    RETURN;
  END IF;

  SELECT count(*)::integer INTO v_active_assignments
  FROM public.license_assignments
  WHERE public.license_assignments.license_id = p_license_id
    AND public.license_assignments.status = 'active';

  IF v_active_assignments >= v_license.max_assignments THEN
    RETURN QUERY SELECT false, false, NULL::uuid, p_license_id, p_customer_identifier_hash, NULL::text, NULL::text, NULL::timestamptz, NULL::timestamptz;
    RETURN;
  END IF;

  INSERT INTO public.license_assignments (
    license_id,
    customer_identifier_hash,
    display_name,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_license_id,
    p_customer_identifier_hash,
    p_display_name,
    'active',
    v_now,
    v_now
  )
  RETURNING * INTO v_assignment;

  UPDATE public.licenses
  SET activation_count = activation_count + 1,
      last_activation_at = v_now,
      updated_at = v_now
  WHERE public.licenses.id = p_license_id;

  RETURN QUERY SELECT true, true, v_assignment.id, v_assignment.license_id, v_assignment.customer_identifier_hash, v_assignment.display_name, v_assignment.status::text, v_assignment.created_at, v_assignment.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_license_delivery_count(p_license_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.licenses
  SET delivery_count = delivery_count + 1,
      last_delivery_at = now(),
      updated_at = now()
  WHERE public.licenses.id = p_license_id;
$$;

REVOKE ALL ON FUNCTION public.authorize_license_assignment(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_license_delivery_count(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.authorize_license_assignment(uuid, text, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_license_delivery_count(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_license_assignment(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_license_delivery_count(uuid) TO service_role;

DROP FUNCTION IF EXISTS public.increment_license_activation_count(uuid);

COMMIT;
