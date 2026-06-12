-- Phase 7B runtime license enforcement helpers.
-- Adds atomic assignment-capacity authorization and runtime counter updates.

CREATE OR REPLACE FUNCTION authorize_license_assignment(
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
SET search_path = public
AS $$
DECLARE
  v_license licenses%ROWTYPE;
  v_assignment license_assignments%ROWTYPE;
  v_active_assignments integer;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_license
  FROM licenses
  WHERE licenses.id = p_license_id
  FOR UPDATE;

  IF NOT FOUND OR v_license.status <> 'active' THEN
    RETURN QUERY SELECT false, false, NULL::uuid, p_license_id, p_customer_identifier_hash, NULL::text, NULL::text, NULL::timestamptz, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT * INTO v_assignment
  FROM license_assignments
  WHERE license_assignments.license_id = p_license_id
    AND license_assignments.customer_identifier_hash = p_customer_identifier_hash;

  IF FOUND THEN
    RETURN QUERY SELECT true, false, v_assignment.id, v_assignment.license_id, v_assignment.customer_identifier_hash, v_assignment.display_name, v_assignment.status::text, v_assignment.created_at, v_assignment.updated_at;
    RETURN;
  END IF;

  SELECT count(*)::integer INTO v_active_assignments
  FROM license_assignments
  WHERE license_assignments.license_id = p_license_id
    AND license_assignments.status = 'active';

  IF v_active_assignments >= v_license.max_assignments THEN
    RETURN QUERY SELECT false, false, NULL::uuid, p_license_id, p_customer_identifier_hash, NULL::text, NULL::text, NULL::timestamptz, NULL::timestamptz;
    RETURN;
  END IF;

  INSERT INTO license_assignments (
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

  RETURN QUERY SELECT true, true, v_assignment.id, v_assignment.license_id, v_assignment.customer_identifier_hash, v_assignment.display_name, v_assignment.status::text, v_assignment.created_at, v_assignment.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION increment_license_activation_count(p_license_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE licenses
  SET activation_count = activation_count + 1,
      last_activation_at = now(),
      updated_at = now()
  WHERE id = p_license_id;
$$;

CREATE OR REPLACE FUNCTION increment_license_delivery_count(p_license_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE licenses
  SET delivery_count = delivery_count + 1,
      last_delivery_at = now(),
      updated_at = now()
  WHERE id = p_license_id;
$$;
