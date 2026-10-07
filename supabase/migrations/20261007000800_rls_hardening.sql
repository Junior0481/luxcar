-- Replaces legacy policies with tenant and ownership rules.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN (
      'profiles','vehicles','vehicle_costs','negotiations','interaction_history',
      'sales','companies','customers','leads','trade_in_vehicles'
    )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

DROP POLICY IF EXISTS profiles_tenant_read ON public.profiles;
CREATE POLICY profiles_tenant_read ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR company_id = public.current_company_id());
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS vehicles_tenant_read ON public.vehicles;
CREATE POLICY vehicles_tenant_read ON public.vehicles FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
DROP POLICY IF EXISTS vehicles_tenant_insert ON public.vehicles;
CREATE POLICY vehicles_tenant_insert ON public.vehicles FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin(company_id));
DROP POLICY IF EXISTS vehicles_tenant_update ON public.vehicles;
CREATE POLICY vehicles_tenant_update ON public.vehicles FOR UPDATE TO authenticated
  USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id));
DROP POLICY IF EXISTS vehicles_tenant_delete ON public.vehicles;
CREATE POLICY vehicles_tenant_delete ON public.vehicles FOR DELETE TO authenticated
  USING (public.is_company_admin(company_id));

DROP POLICY IF EXISTS costs_tenant_read ON public.vehicle_costs;
CREATE POLICY costs_tenant_read ON public.vehicle_costs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.company_id = public.current_company_id()));
DROP POLICY IF EXISTS costs_tenant_insert ON public.vehicle_costs;
CREATE POLICY costs_tenant_insert ON public.vehicle_costs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.company_id = public.current_company_id()) AND created_by = auth.uid());
DROP POLICY IF EXISTS costs_tenant_update ON public.vehicle_costs;
CREATE POLICY costs_tenant_update ON public.vehicle_costs FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND public.is_company_admin(v.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND public.is_company_admin(v.company_id)));

DROP POLICY IF EXISTS negotiations_tenant_read ON public.negotiations;
CREATE POLICY negotiations_tenant_read ON public.negotiations FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
DROP POLICY IF EXISTS negotiations_tenant_insert ON public.negotiations;
CREATE POLICY negotiations_tenant_insert ON public.negotiations FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND seller_id = auth.uid());
DROP POLICY IF EXISTS negotiations_tenant_update ON public.negotiations;
CREATE POLICY negotiations_tenant_update ON public.negotiations FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id()) WITH CHECK (company_id = public.current_company_id());
DROP POLICY IF EXISTS negotiations_owner_delete ON public.negotiations;
CREATE POLICY negotiations_owner_delete ON public.negotiations FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND (seller_id = auth.uid() OR public.is_company_admin(company_id)));

DROP POLICY IF EXISTS history_tenant_read ON public.interaction_history;
CREATE POLICY history_tenant_read ON public.interaction_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.negotiations n WHERE n.id = negotiation_id AND n.company_id = public.current_company_id()));
DROP POLICY IF EXISTS history_owner_insert ON public.interaction_history;
CREATE POLICY history_owner_insert ON public.interaction_history FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.negotiations n WHERE n.id = negotiation_id AND n.company_id = public.current_company_id()));
DROP POLICY IF EXISTS sales_tenant_read ON public.sales;
CREATE POLICY sales_tenant_read ON public.sales FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
DROP POLICY IF EXISTS sales_admin_insert ON public.sales;
CREATE POLICY sales_admin_insert ON public.sales FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin(company_id));

DROP POLICY IF EXISTS companies_tenant_read ON public.companies;
CREATE POLICY companies_tenant_read ON public.companies FOR SELECT TO authenticated
  USING (id = public.current_company_id());
DROP POLICY IF EXISTS companies_admin_update ON public.companies;
CREATE POLICY companies_admin_update ON public.companies FOR UPDATE TO authenticated
  USING (public.is_company_admin(id)) WITH CHECK (public.is_company_admin(id));
DROP POLICY IF EXISTS customers_owner_read ON public.customers;
CREATE POLICY customers_owner_read ON public.customers FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS customers_owner_insert ON public.customers;
CREATE POLICY customers_owner_insert ON public.customers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS customers_owner_update ON public.customers;
CREATE POLICY customers_owner_update ON public.customers FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS leads_public_intake ON public.leads;
CREATE POLICY leads_public_intake ON public.leads FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.status = 'active')
    AND (vehicle_id IS NULL OR EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.company_id = leads.company_id)));
DROP POLICY IF EXISTS leads_tenant_read ON public.leads;
CREATE POLICY leads_tenant_read ON public.leads FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
DROP POLICY IF EXISTS leads_admin_update ON public.leads;
CREATE POLICY leads_admin_update ON public.leads FOR UPDATE TO authenticated
  USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id));
DROP POLICY IF EXISTS tradein_tenant_read ON public.trade_in_vehicles;
CREATE POLICY tradein_tenant_read ON public.trade_in_vehicles FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
DROP POLICY IF EXISTS tradein_tenant_insert ON public.trade_in_vehicles;
CREATE POLICY tradein_tenant_insert ON public.trade_in_vehicles FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND EXISTS (SELECT 1 FROM public.negotiations n WHERE n.id = negotiation_id AND n.company_id = trade_in_vehicles.company_id));
DROP POLICY IF EXISTS tradein_admin_update ON public.trade_in_vehicles;
CREATE POLICY tradein_admin_update ON public.trade_in_vehicles FOR UPDATE TO authenticated
  USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id));
