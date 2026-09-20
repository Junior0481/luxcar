-- Administração segura da plataforma e das equipes de cada tenant.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('vendedor', 'administrador', 'platform_admin'));

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'platform_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'user_type' = 'customer' THEN
    INSERT INTO public.customers (id, user_id, email, full_name, phone)
    VALUES (NEW.id, NEW.id, NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'Cliente'),
      NEW.raw_user_meta_data->>'phone')
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name;
  ELSE
    INSERT INTO public.profiles (id, email, full_name, role, company_id)
    VALUES (
      NEW.id, NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
      COALESCE(NEW.raw_user_meta_data->>'role', 'vendedor'),
      NULLIF(NEW.raw_user_meta_data->>'company_id', '')::uuid
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      company_id = EXCLUDED.company_id;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE policy_row RECORD;
BEGIN
  FOR policy_row IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', policy_row.policyname);
  END LOOP;
END $$;

CREATE POLICY "tenant_read_profiles" ON public.profiles
  FOR SELECT TO authenticated USING (
    id = auth.uid()
    OR public.is_platform_admin()
    OR company_id = public.current_company_id()
  );
CREATE POLICY "users_update_own_profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND company_id IS NOT DISTINCT FROM public.current_company_id());

DROP POLICY IF EXISTS "tenant_select_company" ON public.companies;
CREATE POLICY "tenant_select_company" ON public.companies
  FOR SELECT TO authenticated USING (
    id = public.current_company_id() OR public.is_platform_admin()
  );
DROP POLICY IF EXISTS "platform_insert_company" ON public.companies;
CREATE POLICY "platform_insert_company" ON public.companies
  FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin());
DROP POLICY IF EXISTS "platform_update_company" ON public.companies;
CREATE POLICY "platform_update_company" ON public.companies
  FOR UPDATE TO authenticated USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.create_sale_when_finalized()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage = 'finalizado' AND OLD.stage IS DISTINCT FROM NEW.stage
    AND NOT EXISTS (SELECT 1 FROM public.sales WHERE negotiation_id = NEW.id) THEN
    INSERT INTO public.sales (
      company_id, negotiation_id, vehicle_id, seller_id, final_price, sale_date, created_at
    ) VALUES (
      NEW.company_id, NEW.id, NEW.vehicle_id, NEW.seller_id,
      COALESCE(NEW.offered_price, 0), now(), now()
    );
  END IF;
  RETURN NEW;
END;
$$;

-- A conclusão financeira precisa escrever a venda através das políticas RLS,
-- depois de validar explicitamente o administrador do tenant.
CREATE OR REPLACE FUNCTION public.set_payment_status(payment_id UUID, next_status TEXT)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_payment public.payments;
  current_negotiation public.negotiations;
BEGIN
  SELECT * INTO current_payment FROM public.payments p WHERE p.id = payment_id FOR UPDATE;
  IF current_payment.id IS NULL OR NOT public.is_company_admin(current_payment.company_id) THEN
    RAISE EXCEPTION 'Pagamento não encontrado ou acesso negado';
  END IF;
  IF NOT (
    (current_payment.status = 'pending' AND next_status IN ('authorized', 'paid', 'cancelled')) OR
    (current_payment.status = 'authorized' AND next_status IN ('paid', 'cancelled')) OR
    (current_payment.status = 'paid' AND next_status = 'refunded')
  ) THEN RAISE EXCEPTION 'Transição de pagamento inválida'; END IF;

  UPDATE public.payments SET status = next_status,
    paid_at = CASE WHEN next_status = 'paid' THEN now() ELSE paid_at END,
    updated_at = now()
  WHERE id = current_payment.id RETURNING * INTO current_payment;

  IF next_status = 'paid' THEN
    SELECT * INTO current_negotiation FROM public.negotiations n
      WHERE n.id = current_payment.negotiation_id FOR UPDATE;
    INSERT INTO public.sales (company_id, negotiation_id, vehicle_id, seller_id, final_price, payment_method, sale_date)
    SELECT n.company_id, n.id, n.vehicle_id, n.seller_id, p.amount, p.method, current_date
    FROM public.negotiations n
    JOIN public.payments p ON p.negotiation_id = n.id
    WHERE p.id = current_payment.id
      AND NOT EXISTS (SELECT 1 FROM public.sales s WHERE s.negotiation_id = n.id);
    UPDATE public.negotiations SET stage = 'finalizado' WHERE id = current_negotiation.id;
    UPDATE public.vehicles SET status = 'vendido' WHERE id = current_negotiation.vehicle_id;
  END IF;
  RETURN current_payment;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_payment_status(UUID, TEXT) TO authenticated;
