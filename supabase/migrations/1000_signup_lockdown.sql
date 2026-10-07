-- Signup profiles always start as unassigned sellers.
-- Never trust role or company_id supplied through user metadata.
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
      'vendedor',
      NULL
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name;
  END IF;
  RETURN NEW;
END;
$$;
