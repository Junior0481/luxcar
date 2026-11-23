-- Subscription status is derived from the billing dates, never set by hand:
-- active until current_period_end, past_due for 7 days of grace, then blocked.
-- Blocked companies lose tenant access through current_company_id().
BEGIN;

ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_subscription_status_check;
ALTER TABLE public.companies ADD CONSTRAINT companies_subscription_status_check
  CHECK (subscription_status IN ('active', 'past_due', 'blocked', 'cancelled'));

CREATE OR REPLACE FUNCTION public.subscription_status_for(period_end TIMESTAMPTZ, at_time TIMESTAMPTZ DEFAULT now())
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN period_end IS NULL OR at_time <= period_end THEN 'active'
    WHEN at_time <= period_end + interval '7 days' THEN 'past_due'
    ELSE 'blocked'
  END;
$$;

-- Any change to the billing period (payment, provisioning) recomputes the status at once.
CREATE OR REPLACE FUNCTION public.sync_subscription_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.subscription_status = 'cancelled' OR NEW.current_period_end IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.grace_ends_at := NEW.current_period_end + interval '7 days';
  NEW.subscription_status := public.subscription_status_for(NEW.current_period_end);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS companies_sync_subscription_status ON public.companies;
CREATE TRIGGER companies_sync_subscription_status
BEFORE INSERT OR UPDATE OF current_period_end, subscription_status ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.sync_subscription_status();

-- Daily job: moves companies across active/past_due/blocked as dates pass and audits each change.
CREATE OR REPLACE FUNCTION public.refresh_subscription_statuses()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed INTEGER;
BEGIN
  WITH candidates AS (
    SELECT id, subscription_status AS old_status, public.subscription_status_for(current_period_end) AS new_status
    FROM public.companies
    WHERE subscription_status <> 'cancelled' AND current_period_end IS NOT NULL
    FOR UPDATE
  ), updated AS (
    UPDATE public.companies c
    SET subscription_status = k.new_status
    FROM candidates k
    WHERE c.id = k.id AND k.new_status <> k.old_status
    RETURNING c.id, k.old_status, c.subscription_status AS new_status, c.current_period_end, c.grace_ends_at
  )
  INSERT INTO public.platform_admin_audit (actor_id, company_id, event_type, details)
  SELECT NULL, id, 'subscription_status_auto_changed',
    jsonb_build_object('from', old_status, 'to', new_status, 'current_period_end', current_period_end, 'grace_ends_at', grace_ends_at)
  FROM updated;
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_subscription_statuses() FROM PUBLIC, anon, authenticated;

-- Tenant helper: a blocked company (stored or already past grace) resolves to no tenant.
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
      c.subscription_status <> 'blocked'
      AND (c.subscription_status = 'cancelled' OR public.subscription_status_for(c.current_period_end) <> 'blocked')
    ));
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
      AND company_id = public.current_company_id()
      AND role = 'administrador'
  );
$$;

-- What the signed-in member needs to show the subscription banner or the blocked screen.
CREATE OR REPLACE FUNCTION public.current_company_subscription()
RETURNS TABLE (
  company_id UUID,
  plan TEXT,
  billing_cycle TEXT,
  subscription_status TEXT,
  current_period_end TIMESTAMPTZ,
  grace_ends_at TIMESTAMPTZ
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
    CASE WHEN c.current_period_end IS NULL THEN c.grace_ends_at ELSE c.current_period_end + interval '7 days' END
  FROM public.profiles p
  JOIN public.companies c ON c.id = p.company_id
  WHERE p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_company_subscription() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_company_subscription() TO authenticated;

SELECT public.refresh_subscription_statuses();

COMMIT;

-- pg_cron exists on Supabase; skip scheduling where it is unavailable.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-subscription-statuses') THEN
      PERFORM cron.unschedule('refresh-subscription-statuses');
    END IF;
    -- 03:05 UTC = 00:05 in Brasília.
    PERFORM cron.schedule('refresh-subscription-statuses', '5 3 * * *', 'SELECT public.refresh_subscription_statuses()');
  END IF;
END;
$$;
