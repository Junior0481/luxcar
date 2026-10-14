BEGIN;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('active', 'past_due', 'cancelled')),
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grace_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_access_delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS owner_first_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  subscription_request_id UUID REFERENCES public.subscription_requests(id) ON DELETE SET NULL,
  payment_reference TEXT,
  amount NUMERIC(12,2) CHECK (amount IS NULL OR amount >= 0),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (period_end > period_start)
);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_company_created
  ON public.subscription_payments(company_id, created_at DESC);

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admins read subscription payments" ON public.subscription_payments;
CREATE POLICY "Platform admins read subscription payments"
  ON public.subscription_payments FOR SELECT TO authenticated
  USING (public.is_platform_admin());
GRANT SELECT ON public.subscription_payments TO authenticated;

CREATE TABLE IF NOT EXISTS public.platform_admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  subscription_request_id UUID REFERENCES public.subscription_requests(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_admin_audit_created
  ON public.platform_admin_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_admin_audit_company_created
  ON public.platform_admin_audit(company_id, created_at DESC);

ALTER TABLE public.platform_admin_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admins read audit log" ON public.platform_admin_audit;
CREATE POLICY "Platform admins read audit log"
  ON public.platform_admin_audit FOR SELECT TO authenticated
  USING (public.is_platform_admin());
GRANT SELECT ON public.platform_admin_audit TO authenticated;

COMMIT;
