-- T9: negotiation assignment is limited to the current tenant and its sellers.
DROP POLICY IF EXISTS negotiations_tenant_insert ON public.negotiations;
CREATE POLICY negotiations_tenant_insert ON public.negotiations
FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.current_company_id()
  AND EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.id = vehicle_id AND v.company_id = negotiations.company_id
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles seller
    WHERE seller.id = negotiations.seller_id
      AND seller.company_id = negotiations.company_id
      AND seller.role = 'vendedor'
  )
  AND (
    seller_id = auth.uid()
    OR public.is_company_admin(company_id)
  )
);

DROP POLICY IF EXISTS negotiations_tenant_update ON public.negotiations;
CREATE POLICY negotiations_tenant_update ON public.negotiations
FOR UPDATE TO authenticated
USING (
  company_id = public.current_company_id()
  AND (seller_id = auth.uid() OR public.is_company_admin(company_id))
)
WITH CHECK (
  company_id = public.current_company_id()
  AND EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.id = vehicle_id AND v.company_id = negotiations.company_id
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles seller
    WHERE seller.id = negotiations.seller_id
      AND seller.company_id = negotiations.company_id
      AND seller.role = 'vendedor'
  )
  AND (
    seller_id = auth.uid()
    OR public.is_company_admin(company_id)
  )
);

-- Related data follows negotiation ownership for sellers, while admins retain
-- visibility across the current company's records.
DROP POLICY IF EXISTS tenant_read_payments ON public.payments;
CREATE POLICY tenant_read_payments ON public.payments FOR SELECT TO authenticated
USING (
  company_id = public.current_company_id()
  AND EXISTS (
    SELECT 1 FROM public.negotiations n
    WHERE n.id = payments.negotiation_id
      AND n.company_id = payments.company_id
      AND (n.seller_id = auth.uid() OR public.is_company_admin(n.company_id))
  )
);

DROP POLICY IF EXISTS tradein_tenant_read ON public.trade_in_vehicles;
CREATE POLICY tradein_tenant_read ON public.trade_in_vehicles FOR SELECT TO authenticated
USING (
  company_id = public.current_company_id()
  AND EXISTS (
    SELECT 1 FROM public.negotiations n
    WHERE n.id = trade_in_vehicles.negotiation_id
      AND n.company_id = trade_in_vehicles.company_id
      AND (n.seller_id = auth.uid() OR public.is_company_admin(n.company_id))
  )
);

DROP POLICY IF EXISTS sales_tenant_read ON public.sales;
CREATE POLICY sales_tenant_read ON public.sales FOR SELECT TO authenticated
USING (
  company_id = public.current_company_id()
  AND EXISTS (
    SELECT 1 FROM public.negotiations n
    WHERE n.id = sales.negotiation_id
      AND n.company_id = sales.company_id
      AND (n.seller_id = auth.uid() OR public.is_company_admin(n.company_id))
  )
);

-- SECURITY DEFINER wrappers keep the caller's JWT, but current_user is the
-- function owner. Use session_user and require the absence of an end-user JWT.
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
