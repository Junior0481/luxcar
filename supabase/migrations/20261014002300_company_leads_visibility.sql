-- All authenticated users in a store can see its leads.
-- The assigned_to field remains the source of truth for the responsible seller.
DROP POLICY IF EXISTS leads_tenant_read ON public.leads;
CREATE POLICY leads_tenant_read ON public.leads
FOR SELECT TO authenticated
USING (company_id = public.current_company_id());
