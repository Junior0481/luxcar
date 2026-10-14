BEGIN;

CREATE TABLE IF NOT EXISTS public.subscription_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  phone TEXT,
  city TEXT,
  state TEXT,
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'provisioning', 'provisioned', 'rejected')),
  payment_confirmed_at TIMESTAMPTZ,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_requests_status_created
  ON public.subscription_requests(status, created_at DESC);

ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can submit subscription requests" ON public.subscription_requests;
CREATE POLICY "Public can submit subscription requests"
  ON public.subscription_requests FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'pending_payment'
    AND payment_confirmed_at IS NULL
    AND company_id IS NULL
  );

DROP POLICY IF EXISTS "Platform admins can review subscription requests" ON public.subscription_requests;
CREATE POLICY "Platform admins can review subscription requests"
  ON public.subscription_requests FOR SELECT TO authenticated
  USING (public.is_platform_admin());

DROP TRIGGER IF EXISTS update_subscription_requests_updated_at ON public.subscription_requests;
CREATE TRIGGER update_subscription_requests_updated_at
  BEFORE UPDATE ON public.subscription_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT INSERT ON public.subscription_requests TO anon, authenticated;
GRANT SELECT ON public.subscription_requests TO authenticated;

COMMIT;
