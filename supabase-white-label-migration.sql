-- LuxCar SaaS white label: isolamento multitenant, clientes, pagamentos e marca.
-- Execute no SQL Editor do Supabase em uma janela de manutenção.

BEGIN;

-- 1. Identidade visual por empresa
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#111827',
  ADD COLUMN IF NOT EXISTS favicon_url TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS branding JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. Dados legados conhecidos pertencem ao tenant inicial LuxCar Motors.
UPDATE public.profiles
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.customers c WHERE c.user_id = profiles.id
  );

UPDATE public.vehicles
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

UPDATE public.negotiations
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

UPDATE public.sales
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- Perfis históricos que também representam clientes são preservados porque podem
-- ser referenciados por auditoria (por exemplo, custos cadastrados). Sem
-- company_id eles não recebem acesso interno a nenhuma loja pelas políticas RLS.
UPDATE public.profiles p
SET company_id = NULL
FROM public.customers c
WHERE c.user_id = p.id;

ALTER TABLE public.vehicles ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.negotiations ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.sales ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_company_status ON public.vehicles(company_id, status);
CREATE INDEX IF NOT EXISTS idx_negotiations_company_stage ON public.negotiations(company_id, stage);
CREATE INDEX IF NOT EXISTS idx_sales_company_date ON public.sales(company_id, sale_date DESC);

-- 3. Um cliente final pode se relacionar com várias lojas.
CREATE TABLE IF NOT EXISTS public.customer_companies (
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_companies_company
  ON public.customer_companies(company_id);

-- 4. Pagamentos pertencem a uma venda e a uma negociação do mesmo tenant.
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  negotiation_id UUID NOT NULL REFERENCES public.negotiations(id) ON DELETE RESTRICT,
  sale_id UUID REFERENCES public.sales(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL CHECK (method IN ('pix', 'dinheiro', 'cartao', 'financiamento', 'transferencia', 'outro')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'paid', 'cancelled', 'refunded')),
  external_reference TEXT,
  notes TEXT,
  paid_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_company_status
  ON public.payments(company_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_negotiation
  ON public.payments(negotiation_id);

-- 5. Preferências enxutas: somente mudanças de negociação e veículo vinculado.
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  negotiation_status BOOLEAN NOT NULL DEFAULT true,
  linked_vehicle_updates BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Cadastro correto: cliente final OU membro interno, nunca os dois.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'user_type' = 'customer' THEN
    INSERT INTO public.customers (id, user_id, email, full_name, phone)
    VALUES (
      NEW.id,
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'Cliente'),
      NULLIF(NEW.raw_user_meta_data->>'phone', '')
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone;
  ELSE
    INSERT INTO public.profiles (id, email, full_name, role, company_id)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
      CASE WHEN NEW.raw_user_meta_data->>'role' = 'administrador'
        THEN 'administrador' ELSE 'vendedor' END,
      NULLIF(NEW.raw_user_meta_data->>'company_id', '')::uuid
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_customer_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Helper de tenant para políticas RLS.
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(target_company UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND company_id = target_company
      AND role = 'administrador'
  );
$$;

ALTER TABLE public.customer_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Remove políticas permissivas legadas antes de instalar as regras definitivas.
DO $$
DECLARE policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'companies', 'vehicles', 'negotiations', 'customer_companies',
        'payments', 'notification_preferences'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_row.policyname, policy_row.schemaname, policy_row.tablename
    );
  END LOOP;
END $$;

CREATE POLICY "tenant_select_company" ON public.companies
  FOR SELECT TO authenticated USING (id = public.current_company_id());
CREATE POLICY "tenant_update_company" ON public.companies
  FOR UPDATE TO authenticated
  USING (public.is_company_admin(id))
  WITH CHECK (public.is_company_admin(id));

CREATE POLICY "tenant_select_vehicles" ON public.vehicles
  FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "tenant_insert_vehicles" ON public.vehicles
  FOR INSERT TO authenticated WITH CHECK (
    company_id = public.current_company_id() AND public.is_company_admin(company_id)
  );
CREATE POLICY "tenant_update_vehicles" ON public.vehicles
  FOR UPDATE TO authenticated
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));
CREATE POLICY "tenant_delete_vehicles" ON public.vehicles
  FOR DELETE TO authenticated USING (public.is_company_admin(company_id));

CREATE POLICY "tenant_select_negotiations" ON public.negotiations
  FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "tenant_insert_negotiations" ON public.negotiations
  FOR INSERT TO authenticated WITH CHECK (
    company_id = public.current_company_id() AND seller_id = auth.uid()
  );
CREATE POLICY "tenant_update_negotiations" ON public.negotiations
  FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

CREATE POLICY "customers_read_own_companies" ON public.customer_companies
  FOR SELECT TO authenticated USING (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
  );
CREATE POLICY "admins_manage_customer_companies" ON public.customer_companies
  FOR ALL TO authenticated
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

CREATE POLICY "tenant_read_payments" ON public.payments
  FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "tenant_create_payments" ON public.payments
  FOR INSERT TO authenticated WITH CHECK (
    company_id = public.current_company_id() AND created_by = auth.uid()
  );
CREATE POLICY "tenant_update_payments" ON public.payments
  FOR UPDATE TO authenticated
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

CREATE POLICY "users_manage_notification_preferences" ON public.notification_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Atualiza pagamento e conclui a negociação de forma atômica.
CREATE OR REPLACE FUNCTION public.set_payment_status(
  payment_id UUID,
  next_status TEXT
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_payment public.payments;
  current_negotiation public.negotiations;
BEGIN
  SELECT * INTO current_payment FROM public.payments WHERE id = payment_id FOR UPDATE;
  IF current_payment.id IS NULL OR NOT public.is_company_admin(current_payment.company_id) THEN
    RAISE EXCEPTION 'Pagamento não encontrado ou acesso negado';
  END IF;

  IF NOT (
    (current_payment.status = 'pending' AND next_status IN ('authorized', 'paid', 'cancelled')) OR
    (current_payment.status = 'authorized' AND next_status IN ('paid', 'cancelled')) OR
    (current_payment.status = 'paid' AND next_status = 'refunded')
  ) THEN
    RAISE EXCEPTION 'Transição de pagamento inválida';
  END IF;

  UPDATE public.payments
  SET status = next_status,
      paid_at = CASE WHEN next_status = 'paid' THEN now() ELSE paid_at END,
      updated_at = now()
  WHERE id = payment_id
  RETURNING * INTO current_payment;

  IF next_status = 'paid' THEN
    SELECT * INTO current_negotiation
    FROM public.negotiations WHERE id = current_payment.negotiation_id FOR UPDATE;

    UPDATE public.negotiations SET stage = 'finalizado'
    WHERE id = current_negotiation.id;
    UPDATE public.vehicles SET status = 'vendido'
    WHERE id = current_negotiation.vehicle_id;

    INSERT INTO public.sales (
      company_id, negotiation_id, vehicle_id, seller_id,
      final_price, payment_method, sale_date
    )
    SELECT
      current_payment.company_id, current_negotiation.id,
      current_negotiation.vehicle_id, current_negotiation.seller_id,
      current_payment.amount, current_payment.method, current_date
    WHERE NOT EXISTS (
      SELECT 1 FROM public.sales WHERE negotiation_id = current_negotiation.id
    );
  END IF;

  RETURN current_payment;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_payment_status(UUID, TEXT) TO authenticated;

-- 8. View pública sem custo de compra ou dados internos.
DROP VIEW IF EXISTS public.public_vehicles;
CREATE VIEW public.public_vehicles
WITH (security_barrier = true)
AS
SELECT
  v.id, v.company_id, v.brand, v.model, v.year, v.version,
  v.sale_price, v.fipe_code, v.fipe_value, v.status, v.color,
  v.mileage, v.fuel_type, v.transmission, v.description, v.images,
  v.created_at, v.updated_at,
  c.name AS company_name, c.slug AS company_slug, c.city AS company_city,
  c.state AS company_state, c.phone AS company_phone, c.logo_url AS company_logo_url,
  c.primary_color AS company_primary_color, c.secondary_color AS company_secondary_color
FROM public.vehicles v
JOIN public.companies c ON c.id = v.company_id
WHERE v.status = 'disponivel' AND c.status = 'active';

REVOKE ALL ON public.vehicles FROM anon;
GRANT SELECT ON public.public_vehicles TO anon, authenticated;

DROP VIEW IF EXISTS public.public_company_branding;
CREATE VIEW public.public_company_branding
WITH (security_barrier = true)
AS
SELECT
  id, name, slug, logo_url, favicon_url, primary_color, secondary_color,
  custom_domain, city, state, phone, branding
FROM public.companies
WHERE status = 'active';
GRANT SELECT ON public.public_company_branding TO anon, authenticated;

COMMIT;
