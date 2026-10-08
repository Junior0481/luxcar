-- Preserve tenant consistency between rows even when writes bypass RLS.
CREATE UNIQUE INDEX IF NOT EXISTS ux_vehicles_id_company
  ON public.vehicles(id, company_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_negotiations_id_company
  ON public.negotiations(id, company_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_negotiations_id_vehicle
  ON public.negotiations(id, vehicle_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_sales_id_company
  ON public.sales(id, company_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'negotiations_vehicle_company_fkey') THEN
    ALTER TABLE public.negotiations
      ADD CONSTRAINT negotiations_vehicle_company_fkey
      FOREIGN KEY (vehicle_id, company_id)
      REFERENCES public.vehicles(id, company_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_negotiation_company_fkey') THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_negotiation_company_fkey
      FOREIGN KEY (negotiation_id, company_id)
      REFERENCES public.negotiations(id, company_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_vehicle_company_fkey') THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_vehicle_company_fkey
      FOREIGN KEY (vehicle_id, company_id)
      REFERENCES public.vehicles(id, company_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_negotiation_company_fkey') THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_negotiation_company_fkey
      FOREIGN KEY (negotiation_id, company_id)
      REFERENCES public.negotiations(id, company_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_sale_company_fkey') THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_sale_company_fkey
      FOREIGN KEY (sale_id, company_id)
      REFERENCES public.sales(id, company_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trade_in_negotiation_company_fkey') THEN
    ALTER TABLE public.trade_in_vehicles
      ADD CONSTRAINT trade_in_negotiation_company_fkey
      FOREIGN KEY (negotiation_id, company_id)
      REFERENCES public.negotiations(id, company_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interaction_history_negotiation_vehicle_fkey') THEN
    ALTER TABLE public.interaction_history
      ADD CONSTRAINT interaction_history_negotiation_vehicle_fkey
      FOREIGN KEY (negotiation_id, vehicle_id)
      REFERENCES public.negotiations(id, vehicle_id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- Storage paths use <company UUID>/... . Writes are tenant-scoped; only a
-- company administrator may delete objects. Public reads remain enabled.
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload" ON storage.objects;
CREATE POLICY "Usuários autenticados podem fazer upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'vehicles'
  AND (storage.foldername(name))[1] = public.current_company_id()::text
);

DROP POLICY IF EXISTS "Usuários podem atualizar suas imagens" ON storage.objects;
CREATE POLICY "Usuários podem atualizar suas imagens" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'vehicles'
  AND (storage.foldername(name))[1] = public.current_company_id()::text
)
WITH CHECK (
  bucket_id = 'vehicles'
  AND (storage.foldername(name))[1] = public.current_company_id()::text
);

DROP POLICY IF EXISTS "Administradores podem deletar imagens" ON storage.objects;
CREATE POLICY "Administradores podem deletar imagens" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'vehicles'
  AND (storage.foldername(name))[1] = public.current_company_id()::text
  AND public.is_company_admin(public.current_company_id())
);

-- Retain a safe search_path for the legacy customer trigger function.
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.customers (id, user_id, email, full_name)
  VALUES (
    gen_random_uuid(),
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Cliente')
  );
  RETURN NEW;
END;
$$;

-- SECURITY DEFINER routines are callable only by the roles that need them.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin, service_role;
REVOKE ALL ON FUNCTION public.handle_new_customer() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
REVOKE ALL ON FUNCTION public.current_company_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_company_id() TO authenticated;
REVOKE ALL ON FUNCTION public.is_company_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_company_admin(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.set_payment_status(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_payment_status(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.create_sale_when_finalized() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_sale(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_sale(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.negotiation_agreed_price(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.negotiation_agreed_price(UUID) TO authenticated;

