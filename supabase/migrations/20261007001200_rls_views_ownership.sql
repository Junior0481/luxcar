-- Relatórios executam com os privilégios do chamador para que RLS das tabelas
-- base continue limitando cada resultado ao tenant e ao vendedor autorizados.
DROP VIEW IF EXISTS public.vehicles_with_negotiations;
CREATE VIEW public.vehicles_with_negotiations
WITH (security_invoker = true)
AS
SELECT
  v.*,
  COUNT(DISTINCT n.id) FILTER (WHERE n.stage NOT IN ('finalizado', 'perdido')) AS active_negotiations_count,
  json_agg(
    json_build_object(
      'id', n.id,
      'seller_name', p.full_name,
      'client_name', n.client_name,
      'stage', n.stage,
      'priority', n.priority
    )
  ) FILTER (WHERE n.id IS NOT NULL AND n.stage NOT IN ('finalizado', 'perdido')) AS active_negotiations
FROM public.vehicles v
LEFT JOIN public.negotiations n ON v.id = n.vehicle_id
LEFT JOIN public.profiles p ON n.seller_id = p.id
GROUP BY v.id;

CREATE OR REPLACE VIEW public.dashboard_metrics
WITH (security_invoker = true)
AS
SELECT
  (SELECT COUNT(*) FROM public.vehicles WHERE status = 'disponivel') AS vehicles_available,
  (SELECT COUNT(*) FROM public.vehicles WHERE status = 'em_negociacao') AS vehicles_in_negotiation,
  (SELECT COUNT(*) FROM public.vehicles WHERE status = 'vendido') AS vehicles_sold,
  (SELECT COUNT(*) FROM public.negotiations WHERE stage NOT IN ('finalizado', 'perdido')) AS active_negotiations,
  (SELECT COALESCE(SUM(final_price), 0) FROM public.sales
   WHERE EXTRACT(MONTH FROM sale_date) = EXTRACT(MONTH FROM CURRENT_DATE)) AS monthly_revenue,
  (SELECT COALESCE(SUM(v.sale_price - v.purchase_price), 0) FROM public.vehicles v
   WHERE v.status = 'disponivel') AS potential_profit;

REVOKE ALL ON public.vehicles_with_negotiations, public.dashboard_metrics FROM anon;
GRANT SELECT ON public.vehicles_with_negotiations, public.dashboard_metrics TO authenticated;

-- Um usuário comum altera seu próprio perfil, mas não papel nem tenant.
-- SQL administrativo e service_role podem corrigir dados de provisionamento.
CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role
      OR NEW.company_id IS DISTINCT FROM OLD.company_id)
     AND current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
     AND COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Somente um administrador da plataforma pode alterar role ou company_id';
  END IF;

  RETURN NEW;
END;
$$;

-- Vendedores acessam apenas seus próprios registros; administradores veem
-- todos os registros da empresa.
DROP POLICY IF EXISTS negotiations_tenant_read ON public.negotiations;
CREATE POLICY negotiations_tenant_read ON public.negotiations FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (seller_id = auth.uid() OR public.is_company_admin(company_id))
  );

DROP POLICY IF EXISTS negotiations_tenant_update ON public.negotiations;
CREATE POLICY negotiations_tenant_update ON public.negotiations FOR UPDATE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (seller_id = auth.uid() OR public.is_company_admin(company_id))
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND (seller_id = auth.uid() OR public.is_company_admin(company_id))
  );

DROP POLICY IF EXISTS negotiations_tenant_insert ON public.negotiations;
CREATE POLICY negotiations_tenant_insert ON public.negotiations FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND seller_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = vehicle_id AND v.company_id = negotiations.company_id
    )
  );

DROP POLICY IF EXISTS leads_tenant_read ON public.leads;
CREATE POLICY leads_tenant_read ON public.leads FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (assigned_to = auth.uid() OR public.is_company_admin(company_id))
  );

DROP POLICY IF EXISTS tenant_create_payments ON public.payments;
CREATE POLICY tenant_create_payments ON public.payments FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.negotiations n
      WHERE n.id = negotiation_id AND n.company_id = payments.company_id
    )
  );

-- O intake público valida o tenant e o veículo sem conceder SELECT anônimo
-- nas tabelas privadas de empresas ou veículos.
CREATE OR REPLACE FUNCTION public.can_submit_lead(target_company UUID, target_vehicle UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = target_company AND c.status = 'active'
  )
  AND (
    target_vehicle IS NULL
    OR EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = target_vehicle AND v.company_id = target_company
    )
  );
$$;
REVOKE ALL ON FUNCTION public.can_submit_lead(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_submit_lead(UUID, UUID) TO anon, authenticated;

DROP POLICY IF EXISTS leads_public_intake ON public.leads;
CREATE POLICY leads_public_intake ON public.leads FOR INSERT TO anon, authenticated
  WITH CHECK (public.can_submit_lead(company_id, vehicle_id));
