-- Prevent users from changing their own privilege or tenant assignment.
CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role
      OR NEW.company_id IS DISTINCT FROM OLD.company_id)
     AND COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Somente um administrador da plataforma pode alterar role ou company_id';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_privileges ON public.profiles;
CREATE TRIGGER guard_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_privileges();
