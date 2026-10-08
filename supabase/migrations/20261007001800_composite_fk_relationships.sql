-- Remove simple FKs duplicated by tenant/composite FKs from 20261007001300.
-- The composite constraints only enforce tenant integrity when company_id is NOT NULL.
DO $$
DECLARE
  nullable_tenant_column TEXT;
BEGIN
  SELECT format('%I.%I.company_id', table_name, column_name)
    INTO nullable_tenant_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('vehicles', 'negotiations', 'sales', 'payments', 'trade_in_vehicles')
    AND column_name = 'company_id'
    AND is_nullable <> 'NO'
  LIMIT 1;

  IF nullable_tenant_column IS NOT NULL OR (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('vehicles', 'negotiations', 'sales', 'payments', 'trade_in_vehicles')
      AND column_name = 'company_id'
      AND is_nullable = 'NO'
  ) <> 5 THEN
    RAISE EXCEPTION 'T12 requires company_id NOT NULL on vehicles, negotiations, sales, payments and trade_in_vehicles';
  END IF;
END;
$$;

ALTER TABLE public.negotiations
  DROP CONSTRAINT IF EXISTS negotiations_vehicle_id_fkey;

ALTER TABLE public.sales
  DROP CONSTRAINT IF EXISTS sales_negotiation_id_fkey,
  DROP CONSTRAINT IF EXISTS sales_vehicle_id_fkey;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_negotiation_id_fkey,
  DROP CONSTRAINT IF EXISTS payments_sale_id_fkey;

ALTER TABLE public.trade_in_vehicles
  DROP CONSTRAINT IF EXISTS trade_in_vehicles_negotiation_id_fkey;

-- The composite (negotiation_id, vehicle_id) FK now provides both links.
ALTER TABLE public.interaction_history
  DROP CONSTRAINT IF EXISTS interaction_history_negotiation_id_fkey,
  DROP CONSTRAINT IF EXISTS interaction_history_vehicle_id_fkey;
