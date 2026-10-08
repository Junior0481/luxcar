-- T11: authenticated store users may create manual leads within their tenant.
-- Public anon intake remains closed; public forms still use public-lead + Turnstile.
ALTER TABLE public.leads ALTER COLUMN vehicle_id DROP NOT NULL;

DROP POLICY IF EXISTS leads_tenant_insert ON public.leads;
CREATE POLICY leads_tenant_insert ON public.leads
FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.current_company_id()
  AND (
    vehicle_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = leads.vehicle_id
        AND v.company_id = leads.company_id
    )
  )
  AND (
    (
      public.is_company_admin(company_id)
      AND (
        assigned_to IS NULL
        OR EXISTS (
          SELECT 1 FROM public.profiles seller
          WHERE seller.id = leads.assigned_to
            AND seller.company_id = leads.company_id
            AND seller.role = 'vendedor'
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles actor
      WHERE actor.id = auth.uid()
        AND actor.company_id = leads.company_id
        AND actor.role = 'vendedor'
        AND (leads.assigned_to IS NULL OR leads.assigned_to = auth.uid())
    )
  )
);
