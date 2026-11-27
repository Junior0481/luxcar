-- Cancelar ou estornar um pagamento que tinha fechado a venda volta tudo ao estado anterior:
-- a venda sai dos números, a negociação volta à etapa em que estava e o veículo volta a
-- "em negociação". O pagamento continua listado, marcado como cancelado/estornado.
BEGIN;

ALTER TABLE public.negotiations ADD COLUMN IF NOT EXISTS stage_before_sale TEXT;

-- Guarda a etapa anterior quando a negociação é finalizada (por finalize_sale).
CREATE OR REPLACE FUNCTION public.remember_stage_before_sale()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.stage = 'finalizado' AND OLD.stage IS DISTINCT FROM 'finalizado' THEN
    NEW.stage_before_sale := OLD.stage;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.remember_stage_before_sale() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS negotiations_remember_stage_before_sale ON public.negotiations;
CREATE TRIGGER negotiations_remember_stage_before_sale
BEFORE UPDATE OF stage ON public.negotiations
FOR EACH ROW EXECUTE FUNCTION public.remember_stage_before_sale();

CREATE OR REPLACE FUNCTION public.set_payment_status(payment_id UUID, next_status TEXT)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_payment public.payments;
  paid_total NUMERIC;
  current_sale public.sales;
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

  -- Cancelar/estornar um pagamento que fechou a venda desfaz a venda quando o total pago
  -- deixa de cobrir o preço: a negociação volta à etapa anterior e o veículo à negociação.
  IF next_status IN ('cancelled', 'refunded') THEN
    SELECT * INTO current_sale FROM public.sales WHERE negotiation_id = current_payment.negotiation_id FOR UPDATE;
    IF current_sale.id IS NOT NULL THEN
      SELECT COALESCE(SUM(amount), 0) INTO paid_total
      FROM public.payments WHERE negotiation_id = current_payment.negotiation_id AND status = 'paid';
      IF paid_total < COALESCE(public.negotiation_agreed_price(current_payment.negotiation_id), 0) THEN
        UPDATE public.payments SET sale_id = NULL WHERE sale_id = current_sale.id;
        DELETE FROM public.sales WHERE id = current_sale.id;
        UPDATE public.negotiations
        SET stage = COALESCE(stage_before_sale, 'documentacao'), stage_before_sale = NULL
        WHERE id = current_payment.negotiation_id AND stage = 'finalizado';
        UPDATE public.vehicles SET status = 'em_negociacao'
        WHERE id = current_sale.vehicle_id AND status = 'vendido';
        SELECT * INTO current_payment FROM public.payments p WHERE p.id = current_payment.id;
      END IF;
    END IF;
  END IF;

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

REVOKE ALL ON FUNCTION public.set_payment_status(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_payment_status(UUID, TEXT) TO authenticated;

COMMIT;
