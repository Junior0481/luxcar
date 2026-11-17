BEGIN;

CREATE TABLE IF NOT EXISTS public.plans (
  id TEXT PRIMARY KEY CHECK (id IN ('silver', 'gold', 'platinum')),
  name TEXT NOT NULL,
  max_administrators INTEGER NOT NULL CHECK (max_administrators > 0),
  max_sellers INTEGER NOT NULL CHECK (max_sellers >= 0),
  max_vehicles INTEGER NOT NULL CHECK (max_vehicles > 0),
  reports_enabled BOOLEAN NOT NULL DEFAULT false,
  monthly_price NUMERIC(12, 2) NOT NULL CHECK (monthly_price >= 0),
  annual_price NUMERIC(12, 2) NOT NULL CHECK (annual_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.plans (id, name, max_administrators, max_sellers, max_vehicles, reports_enabled, monthly_price, annual_price)
VALUES
  ('silver', 'Silver', 1, 5, 25, false, 400, 4000),
  ('gold', 'Gold', 1, 10, 50, true, 850, 8500),
  ('platinum', 'Platinum', 2, 50, 100, true, 1500, 15000)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  max_administrators = EXCLUDED.max_administrators,
  max_sellers = EXCLUDED.max_sellers,
  max_vehicles = EXCLUDED.max_vehicles,
  reports_enabled = EXCLUDED.reports_enabled,
  monthly_price = EXCLUDED.monthly_price,
  annual_price = EXCLUDED.annual_price,
  updated_at = now();

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plans_public_read ON public.plans;
CREATE POLICY plans_public_read ON public.plans FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.plans TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.plans FROM anon, authenticated;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS address_number TEXT,
  ADD COLUMN IF NOT EXISTS neighborhood TEXT;

ALTER TABLE public.companies ALTER COLUMN plan DROP DEFAULT;
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_plan_check;
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_plan_fkey;
UPDATE public.companies
SET plan = CASE plan WHEN 'basic' THEN 'silver' WHEN 'pro' THEN 'gold' WHEN 'enterprise' THEN 'platinum' ELSE COALESCE(plan, 'silver') END;
ALTER TABLE public.companies ALTER COLUMN plan SET DEFAULT 'silver';
ALTER TABLE public.companies
  ADD CONSTRAINT companies_plan_fkey FOREIGN KEY (plan) REFERENCES public.plans(id);
UPDATE public.companies c
SET max_vehicles = p.max_vehicles,
    max_users = p.max_administrators + p.max_sellers
FROM public.plans p WHERE p.id = c.plan;

CREATE OR REPLACE FUNCTION public.prevent_company_plan_tampering()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan
    AND COALESCE(auth.role(), '') <> 'service_role'
    AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Somente a administração da plataforma pode alterar o plano da empresa.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS prevent_company_plan_tampering ON public.companies;
CREATE TRIGGER prevent_company_plan_tampering BEFORE UPDATE OF plan ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.prevent_company_plan_tampering();

ALTER TABLE public.subscription_requests
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS address_number TEXT,
  ADD COLUMN IF NOT EXISTS neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS acquisition_source TEXT CHECK (acquisition_source IS NULL OR acquisition_source IN ('instagram', 'google', 'referral', 'other')),
  ADD COLUMN IF NOT EXISTS plan TEXT REFERENCES public.plans(id),
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT CHECK (billing_cycle IS NULL OR billing_cycle IN ('monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS quoted_amount NUMERIC(12, 2) CHECK (quoted_amount IS NULL OR quoted_amount >= 0);

DROP POLICY IF EXISTS "Public can submit subscription requests" ON public.subscription_requests;
REVOKE INSERT ON public.subscription_requests FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_company_plan_member_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  limits public.plans%ROWTYPE;
  current_count INTEGER;
  allowed_count INTEGER;
BEGIN
  IF NEW.company_id IS NULL OR NEW.role = 'platform_admin' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.company_id IS NOT DISTINCT FROM OLD.company_id AND NEW.role IS NOT DISTINCT FROM OLD.role THEN RETURN NEW; END IF;

  PERFORM 1 FROM public.companies WHERE id = NEW.company_id FOR UPDATE;
  SELECT p.* INTO limits FROM public.companies c JOIN public.plans p ON p.id = c.plan WHERE c.id = NEW.company_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plano da empresa não encontrado.'; END IF;

  allowed_count := CASE NEW.role
    WHEN 'administrador' THEN limits.max_administrators
    WHEN 'vendedor' THEN limits.max_sellers
    ELSE 0
  END;
  SELECT count(*) INTO current_count FROM public.profiles
  WHERE company_id = NEW.company_id AND role = NEW.role AND (TG_OP <> 'UPDATE' OR id <> NEW.id);
  IF current_count >= allowed_count THEN
    RAISE EXCEPTION 'Limite de % do plano % atingido.', CASE NEW.role WHEN 'administrador' THEN 'administradores' ELSE 'vendedores' END, limits.name
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_company_plan_member_limit ON public.profiles;
CREATE TRIGGER enforce_company_plan_member_limit BEFORE INSERT OR UPDATE OF company_id, role ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_company_plan_member_limit();

CREATE OR REPLACE FUNCTION public.enforce_company_plan_vehicle_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  max_allowed INTEGER;
  current_count INTEGER;
BEGIN
  IF NEW.company_id IS NULL THEN RETURN NEW; END IF;
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
CREATE TRIGGER enforce_company_plan_vehicle_limit BEFORE INSERT ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.enforce_company_plan_vehicle_limit();

DROP POLICY IF EXISTS sales_tenant_read ON public.sales;
CREATE POLICY sales_tenant_read ON public.sales FOR SELECT TO authenticated
USING (company_id = public.current_company_id() AND EXISTS (
  SELECT 1 FROM public.companies c JOIN public.plans p ON p.id = c.plan
  WHERE c.id = sales.company_id AND p.reports_enabled
));
DROP POLICY IF EXISTS negotiations_tenant_read ON public.negotiations;
CREATE POLICY negotiations_tenant_read ON public.negotiations FOR SELECT TO authenticated
USING (company_id = public.current_company_id() AND EXISTS (
  SELECT 1 FROM public.companies c JOIN public.plans p ON p.id = c.plan
  WHERE c.id = negotiations.company_id AND p.reports_enabled
) AND (seller_id = auth.uid() OR public.is_company_admin(company_id)));

COMMIT;
