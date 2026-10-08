-- Public lead creation now goes through public-lead, which verifies Turnstile
-- and writes with service_role after validating the active company/vehicle.
DROP POLICY IF EXISTS leads_public_intake ON public.leads;
REVOKE INSERT ON TABLE public.leads FROM anon;

-- Any session authenticated as a database administrator without an end-user
-- JWT may run maintenance. A SECURITY DEFINER wrapper invoked by an app user
-- keeps that user's JWT, so it cannot use the function owner as a bypass.
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
     AND NOT public.is_platform_admin()
     AND NOT (
       session_user IN ('postgres', 'supabase_admin')
       AND auth.uid() IS NULL
       AND COALESCE(auth.role(), '') = ''
     ) THEN
    RAISE EXCEPTION 'Somente um administrador da plataforma pode alterar role ou company_id';
  END IF;
  RETURN NEW;
END;
$$;

-- Related financial and trade-in data follows negotiation ownership for
-- sellers, while company administrators retain full tenant visibility.
DROP POLICY IF EXISTS tenant_read_payments ON public.payments;
CREATE POLICY tenant_read_payments ON public.payments FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.negotiations n
      WHERE n.id = negotiation_id
        AND (n.seller_id = auth.uid() OR public.is_company_admin(n.company_id))
    )
  );

DROP POLICY IF EXISTS tradein_tenant_read ON public.trade_in_vehicles;
CREATE POLICY tradein_tenant_read ON public.trade_in_vehicles FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.negotiations n
      WHERE n.id = negotiation_id
        AND (n.seller_id = auth.uid() OR public.is_company_admin(n.company_id))
    )
  );

DROP POLICY IF EXISTS sales_tenant_read ON public.sales;
CREATE POLICY sales_tenant_read ON public.sales FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.negotiations n
      WHERE n.id = negotiation_id
        AND (n.seller_id = auth.uid() OR public.is_company_admin(n.company_id))
    )
  );

-- This helper was used only by the former direct-insert RLS policy.
DROP FUNCTION IF EXISTS public.can_submit_lead(UUID, UUID);
