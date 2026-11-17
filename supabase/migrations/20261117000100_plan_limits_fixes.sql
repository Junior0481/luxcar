-- Corrige a 20261109000100 (já aplicada):
-- 1. Restaura a leitura de vendas e negociações em todos os planos. O bloqueio
--    por plano quebrava Negociações, Pagamentos e Dashboard no Silver; o
--    relatório consolidado passa a ser bloqueado pela RPC report_data.
-- 2. O guard de plano usa o papel do banco: postgres e service_role passam.
-- 3. Empresas existentes vão para Platinum (sem perda de acesso até a decisão
--    comercial); novas continuam entrando em Silver.
-- 4. O limite de veículos também vale ao mover um veículo de empresa.
BEGIN;

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

DROP POLICY IF EXISTS negotiations_tenant_read ON public.negotiations;
CREATE POLICY negotiations_tenant_read ON public.negotiations FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (seller_id = auth.uid() OR public.is_company_admin(company_id))
  );

-- SECURITY INVOKER: current_user é o papel da requisição (anon/authenticated
-- pela API; service_role e postgres passam livres).
CREATE OR REPLACE FUNCTION public.prevent_company_plan_tampering()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan
    AND current_user IN ('anon', 'authenticated')
    AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Somente a administração da plataforma pode alterar o plano da empresa.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

-- Executa uma única vez: reaplicar a migration não pode rebaixar quem já mudou de plano.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261117000100'
  ) THEN
    UPDATE public.companies SET plan = 'platinum';
  END IF;
EXCEPTION WHEN undefined_table THEN
  UPDATE public.companies SET plan = 'platinum';
END;
$$;
ALTER TABLE public.companies ALTER COLUMN plan SET NOT NULL;
UPDATE public.companies c
SET max_vehicles = p.max_vehicles,
    max_users = p.max_administrators + p.max_sellers
FROM public.plans p WHERE p.id = c.plan
  AND (c.max_vehicles IS DISTINCT FROM p.max_vehicles OR c.max_users IS DISTINCT FROM p.max_administrators + p.max_sellers);

CREATE OR REPLACE FUNCTION public.enforce_company_plan_vehicle_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  max_allowed INTEGER;
  current_count INTEGER;
BEGIN
  IF NEW.company_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.company_id IS NOT DISTINCT FROM OLD.company_id THEN RETURN NEW; END IF;
  PERFORM 1 FROM public.companies WHERE id = NEW.company_id FOR UPDATE;
  SELECT p.max_vehicles INTO max_allowed FROM public.companies c JOIN public.plans p ON p.id = c.plan WHERE c.id = NEW.company_id;
  IF max_allowed IS NULL THEN RAISE EXCEPTION 'Plano da empresa não encontrado.'; END IF;
  SELECT count(*) INTO current_count FROM public.vehicles WHERE company_id = NEW.company_id;
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Limite de % veículos do plano atingido.', max_allowed USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_company_plan_vehicle_limit ON public.vehicles;
CREATE TRIGGER enforce_company_plan_vehicle_limit BEFORE INSERT OR UPDATE OF company_id ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.enforce_company_plan_vehicle_limit();

REVOKE EXECUTE ON FUNCTION public.enforce_company_plan_member_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_company_plan_vehicle_limit() FROM PUBLIC, anon, authenticated;

-- Relatório consolidado: recusado quando o plano não inclui relatórios.
-- SECURITY INVOKER: as policies de tenant/ownership continuam valendo.
CREATE OR REPLACE FUNCTION public.current_company_reports_enabled()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT p.reports_enabled FROM public.companies c JOIN public.plans p ON p.id = c.plan
    WHERE c.id = public.current_company_id()
  ), false);
$$;
REVOKE EXECUTE ON FUNCTION public.current_company_reports_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_company_reports_enabled() TO authenticated;

CREATE OR REPLACE FUNCTION public.report_data(p_start TEXT, p_end TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT public.current_company_reports_enabled() THEN
    RAISE EXCEPTION 'Relatórios não estão disponíveis no plano atual.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN jsonb_build_object(
    'sales', COALESCE((
      SELECT jsonb_agg(to_jsonb(s) || jsonb_build_object('vehicle', to_jsonb(v), 'seller', to_jsonb(pr)))
      FROM public.sales s
      LEFT JOIN public.vehicles v ON v.id = s.vehicle_id
      LEFT JOIN public.profiles pr ON pr.id = s.seller_id
      WHERE s.company_id = public.current_company_id()
        AND s.sale_date >= p_start::date AND s.sale_date <= p_end::date
    ), '[]'::jsonb),
    'negotiations', COALESCE((
      SELECT jsonb_agg(to_jsonb(n))
      FROM public.negotiations n
      WHERE n.company_id = public.current_company_id()
        AND n.created_at >= p_start::timestamptz AND n.created_at <= p_end::timestamptz
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.report_data(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_data(TEXT, TEXT) TO authenticated;

COMMIT;
