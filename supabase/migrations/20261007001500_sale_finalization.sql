-- P1-2: finalize a sale only after confirmed payments cover the agreed price.
CREATE UNIQUE INDEX IF NOT EXISTS ux_sales_negotiation ON public.sales (negotiation_id);

CREATE OR REPLACE FUNCTION public.finalize_sale(target_negotiation UUID)
RETURNS public.sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n public.negotiations;
  v public.vehicles;
  existing_sale public.sales;
  sale_row public.sales;
  agreed_price NUMERIC(10,2);
  total_paid NUMERIC(10,2);
  preferred_method TEXT;
BEGIN
  SELECT * INTO n FROM public.negotiations WHERE id = target_negotiation FOR UPDATE;
  IF n.id IS NULL OR NOT public.is_company_admin(n.company_id) THEN
    RAISE EXCEPTION 'Negociação não encontrada ou acesso negado' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO existing_sale FROM public.sales WHERE negotiation_id = n.id;
  IF existing_sale.id IS NOT NULL THEN RETURN existing_sale; END IF;

  SELECT * INTO v FROM public.vehicles WHERE id = n.vehicle_id FOR UPDATE;
  agreed_price := COALESCE(n.offered_price, v.sale_price);
  SELECT COALESCE(sum(amount), 0),
         (array_agg(method ORDER BY amount DESC, created_at ASC))[1]
    INTO total_paid, preferred_method
    FROM public.payments
    WHERE negotiation_id = n.id AND status = 'paid';
  IF total_paid < agreed_price THEN
    RAISE EXCEPTION 'Pagamentos confirmados não cobrem o preço acordado';
  END IF;

  INSERT INTO public.sales (
    company_id, negotiation_id, vehicle_id, seller_id, final_price, payment_method, sale_date
  ) VALUES (
    n.company_id, n.id, n.vehicle_id, n.seller_id, agreed_price, preferred_method, current_date
  ) RETURNING * INTO sale_row;
  UPDATE public.payments SET sale_id = sale_row.id
    WHERE negotiation_id = n.id AND status = 'paid' AND sale_id IS NULL;
  UPDATE public.negotiations SET stage = 'finalizado' WHERE id = n.id;
  UPDATE public.vehicles SET status = 'vendido' WHERE id = n.vehicle_id;
  RETURN sale_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_payment_status(payment_id UUID, next_status TEXT)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_payment public.payments;
  current_negotiation public.negotiations;
  agreed_price NUMERIC(10,2);
  total_paid NUMERIC(10,2);
  v public.vehicles;
BEGIN
  SELECT * INTO current_payment FROM public.payments WHERE id = payment_id FOR UPDATE;
  IF current_payment.id IS NULL OR NOT public.is_company_admin(current_payment.company_id) THEN
    RAISE EXCEPTION 'Pagamento não encontrado ou acesso negado' USING ERRCODE = '42501';
  END IF;
  IF NOT (
    (current_payment.status = 'pending' AND next_status IN ('authorized', 'paid', 'cancelled')) OR
    (current_payment.status = 'authorized' AND next_status IN ('paid', 'cancelled')) OR
    (current_payment.status = 'paid' AND next_status = 'refunded')
  ) THEN RAISE EXCEPTION 'Transição de pagamento inválida'; END IF;

  UPDATE public.payments SET status = next_status,
    paid_at = CASE WHEN next_status = 'paid' THEN now() ELSE paid_at END,
    updated_at = now()
    WHERE id = payment_id RETURNING * INTO current_payment;
  IF next_status = 'paid' THEN
    SELECT * INTO current_negotiation FROM public.negotiations
      WHERE id = current_payment.negotiation_id FOR UPDATE;
    SELECT * INTO v FROM public.vehicles WHERE id = current_negotiation.vehicle_id;
    agreed_price := COALESCE(current_negotiation.offered_price, v.sale_price);
    SELECT COALESCE(sum(amount), 0) INTO total_paid FROM public.payments
      WHERE negotiation_id = current_negotiation.id AND status = 'paid';
    IF total_paid >= agreed_price THEN PERFORM public.finalize_sale(current_negotiation.id); END IF;
  END IF;
  RETURN current_payment;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_sale(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_sale(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.set_payment_status(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_payment_status(UUID, TEXT) TO authenticated;
