-- Endurecimento de segurança (auditoria de 2026-11-26):
--  1. administrador da loja não altera cobrança, status, plano, slug nem domínio da empresa;
--  2. profiles.email deixa de ser editável e segue o email de login (auth.users);
--     apply_paid_charge escolhe o dono pelo email de login e exige o valor pago;
--  3. loja suspensa/inativa pela plataforma perde o tenant, como a bloqueada;
--  4. negotiation_agreed_price deixa de ser chamável direto pela API;
--  5. fotos do estoque só por administrador (vendedor continua enviando fotos de troca);
--  6. uma solicitação de assinatura pendente por email.
BEGIN;

-- 1. Colunas de cobrança e identidade da empresa: só plataforma, service_role ou funções internas.
--    O nome do trigger ordena antes de companies_sync_subscription_status, então vê o valor enviado.
CREATE OR REPLACE FUNCTION public.guard_company_privileged_columns()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND NOT public.is_platform_admin() AND (
       NEW.status IS DISTINCT FROM OLD.status
    OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
    OR NEW.billing_cycle IS DISTINCT FROM OLD.billing_cycle
    OR NEW.subscription_started_at IS DISTINCT FROM OLD.subscription_started_at
    OR NEW.current_period_end IS DISTINCT FROM OLD.current_period_end
    OR NEW.grace_ends_at IS DISTINCT FROM OLD.grace_ends_at
    OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
    OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
    OR NEW.owner_access_delivered_at IS DISTINCT FROM OLD.owner_access_delivered_at
    OR NEW.owner_first_login_at IS DISTINCT FROM OLD.owner_first_login_at
    OR NEW.onboarding_completed_at IS DISTINCT FROM OLD.onboarding_completed_at
    OR NEW.max_vehicles IS DISTINCT FROM OLD.max_vehicles
    OR NEW.max_users IS DISTINCT FROM OLD.max_users
    OR NEW.slug IS DISTINCT FROM OLD.slug
    OR NEW.custom_domain IS DISTINCT FROM OLD.custom_domain
  ) THEN
    RAISE EXCEPTION 'Somente a administração da plataforma pode alterar assinatura, status, slug ou domínio da empresa.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS companies_guard_privileged_columns ON public.companies;
CREATE TRIGGER companies_guard_privileged_columns
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.guard_company_privileged_columns();

-- 2. profiles.email espelha auth.users.email (que só muda após confirmação do novo endereço).
CREATE OR REPLACE FUNCTION public.guard_profile_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email
    AND current_user IN ('anon', 'authenticated')
    AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'O email do perfil acompanha o email de login e não pode ser alterado diretamente.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_email ON public.profiles;
CREATE TRIGGER guard_profile_email
BEFORE UPDATE OF email ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_email();

CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_profile_email() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_profile_email() TO supabase_auth_admin, service_role;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
AFTER UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();

-- Realinha perfis que divergem do email de login. Um perfil adulterado com o email de outra
-- conta libera o endereço antes (com sufixo), para não esbarrar no UNIQUE.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.id, u.email AS login_email FROM public.profiles p JOIN auth.users u ON u.id = p.id
    WHERE p.email IS DISTINCT FROM u.email AND u.email IS NOT NULL
  LOOP
    UPDATE public.profiles SET email = email || '.invalid-' || left(id::text, 8)
    WHERE lower(email) = lower(r.login_email) AND id <> r.id;
    UPDATE public.profiles SET email = r.login_email WHERE id = r.id;
  END LOOP;
END;
$$;

-- Email único sem diferenciar maiúsculas (só se não houver duplicata para resolver à mão).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles GROUP BY lower(email) HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_key ON public.profiles (lower(email));
  ELSE
    RAISE WARNING 'profiles tem emails duplicados ignorando maiúsculas; índice profiles_email_lower_key não criado.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_paid_charge(p_provider_charge_id TEXT, p_paid_amount NUMERIC DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  charge public.payment_charges%ROWTYPE;
  req public.subscription_requests%ROWTYPE;
  owner_profile public.profiles%ROWTYPE;
  selected_plan public.plans%ROWTYPE;
  period RECORD;
  current_end TIMESTAMPTZ;
  new_company_id UUID;
  new_payment_id UUID;
  reference TEXT;
BEGIN
  SELECT * INTO charge FROM public.payment_charges WHERE provider_charge_id = p_provider_charge_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'unknown_charge');
  END IF;
  IF charge.status = 'paid' THEN
    RETURN jsonb_build_object('status', 'already_processed', 'charge_id', charge.id);
  END IF;
  IF p_paid_amount IS NULL OR p_paid_amount < charge.amount THEN
    RAISE EXCEPTION 'Valor pago (%) menor que o cobrado (%).', p_paid_amount, charge.amount USING ERRCODE = 'check_violation';
  END IF;
  reference := 'abacatepay:' || charge.provider_charge_id;

  IF charge.kind = 'renewal' THEN
    SELECT current_period_end INTO current_end FROM public.companies WHERE id = charge.company_id FOR UPDATE;
    SELECT * INTO period FROM public.next_billing_period(current_end, charge.billing_cycle);
    INSERT INTO public.subscription_payments (company_id, payment_reference, amount, period_start, period_end, status, confirmed_at, provider_charge_id)
    VALUES (charge.company_id, reference, charge.amount, period.period_start, period.period_end, 'confirmed', now(), charge.provider_charge_id)
    RETURNING id INTO new_payment_id;
    UPDATE public.companies SET current_period_end = period.period_end, cancelled_at = NULL WHERE id = charge.company_id;
    INSERT INTO public.platform_admin_audit (actor_id, company_id, event_type, details)
    VALUES (NULL, charge.company_id, 'subscription_payment_confirmed', jsonb_build_object(
      'payment_id', new_payment_id, 'payment_reference', reference, 'amount', charge.amount,
      'period_start', period.period_start, 'period_end', period.period_end, 'automatic', true));
    new_company_id := charge.company_id;
  ELSE
    SELECT * INTO req FROM public.subscription_requests WHERE id = charge.subscription_request_id FOR UPDATE;
    IF req.status <> 'pending_payment' THEN
      UPDATE public.payment_charges SET status = 'paid', paid_at = now() WHERE id = charge.id;
      INSERT INTO public.platform_admin_audit (actor_id, company_id, subscription_request_id, event_type, details)
      VALUES (NULL, req.company_id, req.id, 'payment_received_for_closed_request', jsonb_build_object('payment_reference', reference, 'request_status', req.status));
      RETURN jsonb_build_object('status', 'request_not_pending', 'request_status', req.status);
    END IF;

    -- O dono é a conta cujo email de LOGIN (auth.users) foi confirmado; profiles.email não decide nada.
    SELECT p.* INTO owner_profile FROM public.profiles p JOIN auth.users u ON u.id = p.id
    WHERE lower(u.email) = lower(req.owner_email) AND u.email_confirmed_at IS NOT NULL
    FOR UPDATE OF p;
    IF NOT FOUND OR owner_profile.role <> 'vendedor' OR owner_profile.company_id IS NOT NULL THEN
      RAISE EXCEPTION 'Conta do proprietário indisponível para a solicitação %.', req.id USING ERRCODE = 'foreign_key_violation';
    END IF;

    SELECT * INTO selected_plan FROM public.plans WHERE id = charge.plan;
    SELECT * INTO period FROM public.next_billing_period(NULL, charge.billing_cycle);
    INSERT INTO public.companies (
      name, slug, email, phone, postal_code, address, address_number, neighborhood, city, state,
      status, plan, max_vehicles, max_users, subscription_status, billing_cycle,
      subscription_started_at, current_period_end, owner_user_id
    ) VALUES (
      req.company_name, req.slug, req.owner_email, req.phone, req.postal_code, req.address, req.address_number, req.neighborhood, req.city, req.state,
      'active', charge.plan, selected_plan.max_vehicles, selected_plan.max_administrators + selected_plan.max_sellers, 'active', charge.billing_cycle,
      period.period_start, period.period_end, owner_profile.id
    ) RETURNING id INTO new_company_id;

    UPDATE public.profiles SET role = 'administrador', company_id = new_company_id, full_name = req.owner_name
    WHERE id = owner_profile.id;

    INSERT INTO public.subscription_payments (company_id, subscription_request_id, payment_reference, amount, period_start, period_end, status, confirmed_at, provider_charge_id)
    VALUES (new_company_id, req.id, reference, charge.amount, period.period_start, period.period_end, 'confirmed', now(), charge.provider_charge_id)
    RETURNING id INTO new_payment_id;

    UPDATE public.subscription_requests
    SET status = 'provisioned', payment_confirmed_at = now(), company_id = new_company_id, payment_reference = reference
    WHERE id = req.id;
    UPDATE public.payment_charges SET company_id = new_company_id WHERE id = charge.id;

    INSERT INTO public.platform_admin_audit (actor_id, company_id, subscription_request_id, event_type, details)
    VALUES (NULL, new_company_id, req.id, 'subscription_payment_confirmed', jsonb_build_object(
      'payment_id', new_payment_id, 'payment_reference', reference, 'plan', charge.plan, 'billing_cycle', charge.billing_cycle,
      'period_start', period.period_start, 'period_end', period.period_end, 'provisioned_admin_id', owner_profile.id, 'automatic', true));
  END IF;

  UPDATE public.payment_charges SET status = 'paid', paid_at = now() WHERE id = charge.id;
  RETURN jsonb_build_object('status', 'applied', 'kind', charge.kind, 'company_id', new_company_id, 'payment_id', new_payment_id);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_paid_charge(TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_paid_charge(TEXT, NUMERIC) TO service_role;

-- 3. Empresa suspensa ou inativa pela plataforma também resolve para nenhum tenant.
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.company_id
  FROM public.profiles p
  LEFT JOIN public.companies c ON c.id = p.company_id
  WHERE p.id = auth.uid()
    AND (c.id IS NULL OR (
      COALESCE(c.status, 'active') = 'active'
      AND c.subscription_status <> 'blocked'
      AND (c.subscription_status = 'cancelled' OR public.subscription_status_for(c.current_period_end) <> 'blocked')
    ));
$$;

-- O painel precisa saber da suspensão para mostrar a tela certa.
DROP FUNCTION IF EXISTS public.current_company_subscription();
CREATE FUNCTION public.current_company_subscription()
RETURNS TABLE (
  company_id UUID,
  plan TEXT,
  billing_cycle TEXT,
  subscription_status TEXT,
  current_period_end TIMESTAMPTZ,
  grace_ends_at TIMESTAMPTZ,
  company_status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.plan, c.billing_cycle,
    CASE WHEN c.subscription_status = 'cancelled' THEN 'cancelled'
      WHEN c.subscription_status = 'blocked' THEN 'blocked'
      ELSE public.subscription_status_for(c.current_period_end) END,
    c.current_period_end,
    CASE WHEN c.current_period_end IS NULL THEN c.grace_ends_at ELSE c.current_period_end + interval '7 days' END,
    COALESCE(c.status, 'active')
  FROM public.profiles p
  JOIN public.companies c ON c.id = p.company_id
  WHERE p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_company_subscription() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_company_subscription() TO authenticated;

-- 4. Preço acordado: uso interno de finalize_sale/set_payment_status (SECURITY DEFINER).
REVOKE ALL ON FUNCTION public.negotiation_agreed_price(UUID) FROM PUBLIC, anon, authenticated;

-- 5. Storage do estoque: administrador envia/atualiza fotos do estoque; qualquer membro, só as de troca.
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload" ON storage.objects;
CREATE POLICY "Usuários autenticados podem fazer upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'vehicles'
  AND (storage.foldername(name))[1] = public.current_company_id()::text
  AND ((storage.foldername(name))[2] = 'trade-in' OR public.is_company_admin(public.current_company_id()))
);

DROP POLICY IF EXISTS "Usuários podem atualizar suas imagens" ON storage.objects;
CREATE POLICY "Usuários podem atualizar suas imagens" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'vehicles'
  AND (storage.foldername(name))[1] = public.current_company_id()::text
  AND ((storage.foldername(name))[2] = 'trade-in' OR public.is_company_admin(public.current_company_id()))
)
WITH CHECK (
  bucket_id = 'vehicles'
  AND (storage.foldername(name))[1] = public.current_company_id()::text
  AND ((storage.foldername(name))[2] = 'trade-in' OR public.is_company_admin(public.current_company_id()))
);

-- 6. Uma solicitação aguardando pagamento por email: as antigas duplicadas viram rejeitadas.
UPDATE public.subscription_requests r SET status = 'rejected', updated_at = now()
WHERE r.status = 'pending_payment' AND EXISTS (
  SELECT 1 FROM public.subscription_requests newer
  WHERE newer.status = 'pending_payment'
    AND lower(newer.owner_email) = lower(r.owner_email)
    AND (newer.created_at, newer.id) > (r.created_at, r.id)
);
CREATE UNIQUE INDEX IF NOT EXISTS subscription_requests_one_pending_per_email
  ON public.subscription_requests (lower(owner_email)) WHERE status = 'pending_payment';

COMMIT;
