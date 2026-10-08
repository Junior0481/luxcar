-- Restore platform-wide company access removed by the RLS hardening migration.
DROP POLICY IF EXISTS companies_platform_read ON public.companies;
CREATE POLICY companies_platform_read ON public.companies
FOR SELECT TO authenticated
USING (public.is_platform_admin());

DROP POLICY IF EXISTS companies_platform_update ON public.companies;
CREATE POLICY companies_platform_update ON public.companies
FOR UPDATE TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());
