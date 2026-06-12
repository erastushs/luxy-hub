-- Rollback Phase 7B runtime license enforcement helpers.

BEGIN;

DROP FUNCTION IF EXISTS public.authorize_license_assignment(uuid, text, text);
DROP FUNCTION IF EXISTS public.increment_license_delivery_count(uuid);
DROP FUNCTION IF EXISTS public.increment_license_activation_count(uuid);

DROP INDEX IF EXISTS public.idx_audit_logs_actor_action_created;

ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_actor_role_check;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_actor_role_check
  CHECK (actor_role IN ('creator', 'admin'));

COMMIT;
