-- AbacatePay: charges created by the create-charge Edge Function and applied by the
-- abacatepay-webhook function through apply_paid_charge(), which is transactional
-- and idempotent (the same webhook delivered twice changes nothing the second time).
BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'abacatepay',
  provider_charge_id TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('signup', 'renewal')),
  subscription_request_id UUID REFERENCES public.subscription_requests(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  plan TEXT NOT NULL REFERENCES public.plans(id),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  checkout_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired')),
  paid_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((kind = 'signup' AND subscription_request_id IS NOT NULL) OR (kind = 'renewal' AND company_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_payment_charges_company_created ON public.payment_charges(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_charges_request ON public.payment_charges(subscription_request_id);

ALTER TABLE public.payment_charges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_charges_platform_read ON public.payment_charges;
CREATE POLICY payment_charges_platform_read ON public.payment_charges FOR SELECT TO authenticated
  USING (public.is_platform_admin());
DROP POLICY IF EXISTS payment_charges_company_admin_read ON public.payment_charges;
CREATE POLICY payment_charges_company_admin_read ON public.payment_charges FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin(company_id));
REVOKE ALL ON public.payment_charges FROM anon, authenticated;
GRANT SELECT ON public.payment_charges TO authenticated;

-- AbacatePay product per plan, cycle and price (checkouts reference products by id).
CREATE TABLE IF NOT EXISTS public.abacatepay_products (
  external_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.abacatepay_products ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.abacatepay_products FROM anon, authenticated;

ALTER TABLE public.subscription_payments ADD COLUMN IF NOT EXISTS provider_charge_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS subscription_payments_provider_charge_key
  ON public.subscription_payments(provider_charge_id) WHERE provider_charge_id IS NOT NULL;

-- Store administrators see their own payment history.
DROP POLICY IF EXISTS "Company admins read subscription payments" ON public.subscription_payments;
CREATE POLICY "Company admins read subscription payments"
  ON public.subscription_payments FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin(company_id));

-- Next period keeps the due day; a lapse longer than one cycle restarts the period now.
CREATE OR REPLACE FUNCTION public.next_billing_period(current_end TIMESTAMPTZ, cycle TEXT, at_time TIMESTAMPTZ DEFAULT now())
RETURNS TABLE (period_start TIMESTAMPTZ, period_end TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  step INTERVAL := CASE WHEN cycle = 'annual' THEN interval '1 year' ELSE interval '1 month' END;
BEGIN
  period_start := COALESCE(current_end, at_time);
  period_end := period_start + step;
  IF period_end <= at_time THEN
    period_start := at_time;
    period_end := at_time + step;
  END IF;
  RETURN NEXT;
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
  IF p_paid_amount IS NOT NULL AND p_paid_amount < charge.amount THEN
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

    SELECT p.* INTO owner_profile FROM public.profiles p JOIN auth.users u ON u.id = p.id
    WHERE lower(p.email) = lower(req.owner_email) AND u.email_confirmed_at IS NOT NULL
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

COMMIT;
