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

