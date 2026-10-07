-- P1-2: finalização de venda atômica e com o preço correto.
--   * UNIQUE em sales(negotiation_id): uma venda por negociação, mesmo com o
--     insert concorrente do front (NegotiationDetails) ou dois pagamentos pagos.
--   * Preço da venda = preço acordado (negotiations.offered_price, ou
--     vehicles.sale_price se não houver proposta), nunca o valor de um pagamento.
--   * A venda só nasce quando a soma dos pagamentos pagos cobre o preço acordado;
--     pagamento parcial não finaliza a negociação.
-- Reexecutável: CREATE OR REPLACE / IF NOT EXISTS e deduplicação idempotente.

-- 1. Remove vendas duplicadas antigas (mantém a mais antiga por negociação)
--    para que o índice único possa ser criado. Pagamentos apontam para a mantida.
WITH ranked AS (
  SELECT id, negotiation_id,
    first_value(id) OVER (PARTITION BY negotiation_id ORDER BY created_at, id) AS keep_id
  FROM public.sales
)
UPDATE public.payments p SET sale_id = r.keep_id
FROM ranked r
WHERE p.sale_id = r.id AND r.id <> r.keep_id;

DELETE FROM public.sales s
USING (
  SELECT id, first_value(id) OVER (PARTITION BY negotiation_id ORDER BY created_at, id) AS keep_id
  FROM public.sales
) r
WHERE s.id = r.id AND r.id <> r.keep_id;

CREATE UNIQUE INDEX IF NOT EXISTS ux_sales_negotiation ON public.sales(negotiation_id);

-- 2. Preço acordado de uma negociação.
CREATE OR REPLACE FUNCTION public.negotiation_agreed_price(target_negotiation UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(n.offered_price, v.sale_price)
  FROM public.negotiations n
  JOIN public.vehicles v ON v.id = n.vehicle_id
  WHERE n.id = target_negotiation;
$$;

-- 3. Finaliza a venda. Só administrador da loja da negociação.
--    Idempotente: se a venda já existe, devolve a existente sem alterar nada.
CREATE OR REPLACE FUNCTION public.finalize_sale(target_negotiation UUID)
RETURNS public.sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  neg public.negotiations;
  agreed NUMERIC;
  paid_total NUMERIC;
  paid_method TEXT;
  result public.sales;
BEGIN
  SELECT * INTO neg FROM public.negotiations WHERE id = target_negotiation FOR UPDATE;
  IF neg.id IS NULL OR NOT public.is_company_admin(neg.company_id) THEN
    RAISE EXCEPTION 'Negociação não encontrada ou acesso negado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO result FROM public.sales WHERE negotiation_id = neg.id;
  IF result.id IS NOT NULL THEN
    RETURN result;
  END IF;

  IF neg.stage = 'perdido' THEN
    RAISE EXCEPTION 'Negociação perdida não pode ser finalizada' USING ERRCODE = 'P0001';
  END IF;

  agreed := public.negotiation_agreed_price(neg.id);
  IF agreed IS NULL OR agreed <= 0 THEN
    RAISE EXCEPTION 'Negociação sem preço acordado' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO paid_total
  FROM public.payments WHERE negotiation_id = neg.id AND status = 'paid';
  IF paid_total < agreed THEN
    RAISE EXCEPTION 'Pagamentos pagos (%) não cobrem o preço acordado (%)', paid_total, agreed
      USING ERRCODE = 'P0001';
  END IF;

  -- Forma de pagamento: a de maior valor pago (empate: a mais recente).
  SELECT method INTO paid_method
  FROM public.payments WHERE negotiation_id = neg.id AND status = 'paid'
  ORDER BY amount DESC, paid_at DESC NULLS LAST LIMIT 1;

  INSERT INTO public.sales (company_id, negotiation_id, vehicle_id, seller_id, final_price, payment_method, sale_date)
  VALUES (neg.company_id, neg.id, neg.vehicle_id, neg.seller_id, agreed, paid_method, current_date)
  ON CONFLICT (negotiation_id) DO NOTHING
  RETURNING * INTO result;
  IF result.id IS NULL THEN
    SELECT * INTO result FROM public.sales WHERE negotiation_id = neg.id;
  END IF;

  UPDATE public.payments SET sale_id = result.id
  WHERE negotiation_id = neg.id AND status = 'paid' AND sale_id IS NULL;
  UPDATE public.negotiations SET stage = 'finalizado' WHERE id = neg.id AND stage <> 'finalizado';
  UPDATE public.vehicles SET status = 'vendido' WHERE id = neg.vehicle_id;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_sale(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_sale(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.negotiation_agreed_price(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.negotiation_agreed_price(UUID) TO authenticated;

-- 4. set_payment_status: ao marcar como pago, finaliza só se o total pago cobrir o preço.
CREATE OR REPLACE FUNCTION public.set_payment_status(payment_id UUID, next_status TEXT)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_payment public.payments;
  paid_total NUMERIC;
BEGIN
  SELECT * INTO current_payment FROM public.payments p WHERE p.id = payment_id FOR UPDATE;
  IF current_payment.id IS NULL OR NOT public.is_company_admin(current_payment.company_id) THEN
    RAISE EXCEPTION 'Pagamento não encontrado ou acesso negado' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    (current_payment.status = 'pending' AND next_status IN ('authorized', 'paid', 'cancelled')) OR
    (current_payment.status = 'authorized' AND next_status IN ('paid', 'cancelled')) OR
    (current_payment.status = 'paid' AND next_status = 'refunded')
  ) THEN
    RAISE EXCEPTION 'Transição de pagamento inválida';
  END IF;

  UPDATE public.payments p
  SET status = next_status,
      paid_at = CASE WHEN next_status = 'paid' THEN now() ELSE p.paid_at END,
      updated_at = now()
  WHERE p.id = current_payment.id
  RETURNING * INTO current_payment;

  IF next_status = 'paid' THEN
    SELECT COALESCE(SUM(amount), 0) INTO paid_total
    FROM public.payments WHERE negotiation_id = current_payment.negotiation_id AND status = 'paid';
    IF paid_total >= COALESCE(public.negotiation_agreed_price(current_payment.negotiation_id), 'infinity'::numeric) THEN
      PERFORM public.finalize_sale(current_payment.negotiation_id);
      SELECT * INTO current_payment FROM public.payments p WHERE p.id = current_payment.id;
    END IF;
  END IF;

  RETURN current_payment;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_payment_status(UUID, TEXT) TO authenticated;

-- 5. Função de trigger legada (não está ligada a nenhum trigger): alinhada ao
--    mesmo preço e à mesma proteção contra duplicata, caso venha a ser usada.
CREATE OR REPLACE FUNCTION public.create_sale_when_finalized()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage = 'finalizado' AND OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO public.sales (company_id, negotiation_id, vehicle_id, seller_id, final_price, sale_date)
    SELECT NEW.company_id, NEW.id, NEW.vehicle_id, NEW.seller_id, price, current_date
    FROM (SELECT public.negotiation_agreed_price(NEW.id) AS price) p
    WHERE p.price IS NOT NULL
    ON CONFLICT (negotiation_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
