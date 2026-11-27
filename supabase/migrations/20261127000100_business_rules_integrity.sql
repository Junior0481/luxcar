-- Regras de negócio garantidas no banco (auditoria de 2026-11-27).
--   1. Um veículo é vendido uma vez só, e um veículo vendido não abre nem reabre negociação.
--   2. Venda fechada não muda de etapa: para desfazer, cancela-se ou estorna-se o pagamento.
--   3. "Finalizado" só existe com venda (gravado por finalize_sale).
--   4. Pagamento novo nasce pendente; só set_payment_status confirma.
--   5. Pagamentos e vendas só mudam pelas funções do banco, nunca por escrita direta.
--   6. O valor proposto fica fixo depois do primeiro pagamento confirmado.
--   7. set_payment_status trava a negociação antes de somar (dois pagamentos ao mesmo tempo).
--   8. O veículo da negociação não muda.
--   9. Excluir a negociação devolve o veículo à vitrine quando não sobra outra em andamento.
--  10. O limite de veículos do plano conta só o estoque (vendidos ficam fora).
--  11. Loja bloqueada sai da vitrine pública.
--  12. A troca avaliada pelo administrador abate o valor a pagar; vendedor não avalia a própria troca.
--  13. Datas no fuso de São Paulo; relatório filtra negociações por dia local.
--  14. A soma dos pagamentos em aberto e pagos não passa do valor a pagar.
--  15. Relatório recebe o custo do veículo para calcular o lucro.
-- Reexecutável: CREATE OR REPLACE, DROP ... IF EXISTS e índices condicionais.
BEGIN;

-- Datas -----------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.local_today()
RETURNS DATE LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date;
$$;

-- Valor a pagar ---------------------------------------------------------------------------

-- Crédito da troca: só conta depois que o administrador conclui a avaliação.
CREATE OR REPLACE FUNCTION public.negotiation_trade_in_credit(target_negotiation UUID)
RETURNS NUMERIC LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(COALESCE(t.offered_value, t.evaluated_value, 0)), 0)
  FROM public.trade_in_vehicles t
  WHERE t.negotiation_id = target_negotiation AND t.needs_evaluation IS FALSE;
$$;

CREATE OR REPLACE FUNCTION public.negotiation_amount_due(target_negotiation UUID)
RETURNS NUMERIC LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT GREATEST(public.negotiation_agreed_price(target_negotiation)
    - public.negotiation_trade_in_credit(target_negotiation), 0);
$$;

REVOKE ALL ON FUNCTION public.negotiation_trade_in_credit(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.negotiation_amount_due(UUID) FROM PUBLIC, anon, authenticated;

-- Negociações -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_negotiation_business_rules()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  vehicle_status TEXT;
  has_sale BOOLEAN;
  has_paid BOOLEAN;
BEGIN
  SELECT status INTO vehicle_status FROM public.vehicles WHERE id = NEW.vehicle_id;

  IF TG_OP = 'INSERT' THEN
    IF NEW.stage = 'finalizado' THEN
      RAISE EXCEPTION 'A negociação é finalizada quando os pagamentos confirmados cobrem o valor.'
        USING ERRCODE = 'P0001';
    END IF;
    IF vehicle_status = 'vendido' AND NEW.stage <> 'perdido' THEN
      RAISE EXCEPTION 'Este veículo já foi vendido.' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id THEN
    RAISE EXCEPTION 'O veículo da negociação não pode ser trocado. Crie uma nova negociação.'
      USING ERRCODE = 'P0001';
  END IF;

  has_sale := EXISTS (SELECT 1 FROM public.sales WHERE negotiation_id = NEW.id);
  has_paid := EXISTS (SELECT 1 FROM public.payments WHERE negotiation_id = NEW.id AND status = 'paid');

  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    IF NEW.stage = 'finalizado' AND NOT has_sale THEN
      RAISE EXCEPTION 'A negociação é finalizada quando os pagamentos confirmados cobrem o valor.'
        USING ERRCODE = 'P0001';
    END IF;
    IF OLD.stage = 'finalizado' AND has_sale THEN
      RAISE EXCEPTION 'Venda fechada não muda de etapa. Para desfazer, cancele ou estorne o pagamento.'
        USING ERRCODE = 'P0001';
    END IF;
    IF NEW.stage = 'perdido' AND has_paid THEN
      RAISE EXCEPTION 'Há pagamento confirmado nesta negociação. Estorne-o antes de marcá-la como perdida.'
        USING ERRCODE = 'P0001';
    END IF;
    IF OLD.stage = 'perdido' AND vehicle_status = 'vendido' THEN
      RAISE EXCEPTION 'Este veículo já foi vendido; a negociação não pode ser reaberta.'
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    -- A etapa anterior à venda só é gravada junto com a mudança de etapa.
    NEW.stage_before_sale := OLD.stage_before_sale;
  END IF;

  IF NEW.offered_price IS DISTINCT FROM OLD.offered_price AND (has_sale OR has_paid) THEN
    RAISE EXCEPTION 'O valor proposto fica fixo depois do primeiro pagamento confirmado.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_negotiation_business_rules() FROM PUBLIC, anon, authenticated;

-- "guard" vem antes de "remember_stage_before_sale" na ordem alfabética dos triggers.
DROP TRIGGER IF EXISTS negotiations_guard_business_rules ON public.negotiations;
CREATE TRIGGER negotiations_guard_business_rules
BEFORE INSERT OR UPDATE ON public.negotiations
FOR EACH ROW EXECUTE FUNCTION public.guard_negotiation_business_rules();

-- Status do veículo também acompanha a exclusão da negociação.
CREATE OR REPLACE FUNCTION public.sync_vehicle_status_from_negotiation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_vehicle UUID;
  target_negotiation UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_vehicle := OLD.vehicle_id;
    target_negotiation := OLD.id;
  ELSE
    IF NEW.stage = 'finalizado' THEN
      RETURN NEW; -- finalize_sale marca o veículo como vendido.
    END IF;
    target_vehicle := NEW.vehicle_id;
    target_negotiation := NEW.id;
  END IF;

  IF TG_OP = 'DELETE' OR NEW.stage = 'perdido' THEN
    -- Volta a disponível só se nenhuma outra negociação do veículo continua em andamento.
    UPDATE public.vehicles v SET status = 'disponivel'
    WHERE v.id = target_vehicle AND v.status = 'em_negociacao'
      AND NOT EXISTS (
        SELECT 1 FROM public.negotiations n
        WHERE n.vehicle_id = target_vehicle AND n.id <> target_negotiation
          AND n.stage NOT IN ('perdido', 'finalizado')
      );
  ELSE
    UPDATE public.vehicles v SET status = 'em_negociacao'
    WHERE v.id = target_vehicle AND v.status = 'disponivel';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_vehicle_status_from_negotiation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS negotiations_sync_vehicle_status_on_delete ON public.negotiations;
CREATE TRIGGER negotiations_sync_vehicle_status_on_delete
AFTER DELETE ON public.negotiations
FOR EACH ROW EXECUTE FUNCTION public.sync_vehicle_status_from_negotiation();

-- Pagamentos ------------------------------------------------------------------------------

-- Escrita direta pela API: só INSERT (pendente). Status muda por set_payment_status.
DROP POLICY IF EXISTS tenant_update_payments ON public.payments;
REVOKE UPDATE, DELETE, TRUNCATE ON public.payments FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_payment_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  neg public.negotiations;
  due NUMERIC;
  committed NUMERIC;
BEGIN
  -- Pedido vindo da API (papel definido pelo PostgREST): nasce pendente, sem venda.
  IF current_setting('role', true) IN ('authenticated', 'anon') THEN
    NEW.status := 'pending';
    NEW.paid_at := NULL;
    NEW.sale_id := NULL;
  END IF;

  SELECT * INTO neg FROM public.negotiations WHERE id = NEW.negotiation_id FOR UPDATE;
  IF neg.id IS NULL THEN
    RETURN NEW; -- a FK recusa.
  END IF;
  IF neg.stage IN ('finalizado', 'perdido') THEN
    RAISE EXCEPTION 'Negociação finalizada ou perdida não recebe novos pagamentos.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sales WHERE vehicle_id = neg.vehicle_id) THEN
    RAISE EXCEPTION 'Este veículo já foi vendido.' USING ERRCODE = 'P0001';
  END IF;

  due := public.negotiation_amount_due(neg.id);
  IF due IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0) INTO committed
    FROM public.payments
    WHERE negotiation_id = neg.id AND status IN ('pending', 'authorized', 'paid');
    IF committed + NEW.amount > due THEN
      RAISE EXCEPTION 'O pagamento ultrapassa o valor a pagar. Saldo disponível: R$ %',
        to_char(GREATEST(due - committed, 0), 'FM999G999G990D00')
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_payment_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS payments_guard_insert ON public.payments;
CREATE TRIGGER payments_guard_insert
BEFORE INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.guard_payment_insert();

-- Vendas ----------------------------------------------------------------------------------

DROP POLICY IF EXISTS sales_admin_insert ON public.sales;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.sales FROM anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.sales GROUP BY vehicle_id HAVING count(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS ux_sales_vehicle ON public.sales(vehicle_id);
  ELSE
    RAISE NOTICE 'ux_sales_vehicle não criado: há veículos com mais de uma venda. finalize_sale continua recusando a segunda.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_sale(target_negotiation UUID)
RETURNS public.sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  neg public.negotiations;
  vehicle_row public.vehicles;
  agreed NUMERIC;
  due NUMERIC;
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

  SELECT * INTO vehicle_row FROM public.vehicles WHERE id = neg.vehicle_id FOR UPDATE;
  IF vehicle_row.status = 'vendido' OR EXISTS (SELECT 1 FROM public.sales WHERE vehicle_id = neg.vehicle_id) THEN
    RAISE EXCEPTION 'Este veículo já foi vendido em outra negociação.' USING ERRCODE = 'P0001';
  END IF;

  agreed := public.negotiation_agreed_price(neg.id);
  IF agreed IS NULL OR agreed <= 0 THEN
    RAISE EXCEPTION 'Negociação sem preço acordado' USING ERRCODE = 'P0001';
  END IF;
  due := public.negotiation_amount_due(neg.id);

  SELECT COALESCE(SUM(amount), 0) INTO paid_total
  FROM public.payments WHERE negotiation_id = neg.id AND status = 'paid';
  IF paid_total < due THEN
    RAISE EXCEPTION 'Pagamentos pagos (%) não cobrem o valor a pagar (%)', paid_total, due
      USING ERRCODE = 'P0001';
  END IF;

  -- Forma de pagamento: a de maior valor pago (empate: a mais recente).
  SELECT method INTO paid_method
  FROM public.payments WHERE negotiation_id = neg.id AND status = 'paid'
  ORDER BY amount DESC, paid_at DESC NULLS LAST LIMIT 1;

  INSERT INTO public.sales (company_id, negotiation_id, vehicle_id, seller_id, final_price, payment_method, sale_date)
  VALUES (neg.company_id, neg.id, neg.vehicle_id, neg.seller_id, agreed, paid_method, public.local_today())
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

CREATE OR REPLACE FUNCTION public.set_payment_status(payment_id UUID, next_status TEXT)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_negotiation UUID;
  neg public.negotiations;
  current_payment public.payments;
  paid_total NUMERIC;
  due NUMERIC;
  current_sale public.sales;
BEGIN
  -- Trava a negociação antes de qualquer soma: dois pagamentos confirmados ao mesmo tempo
  -- passam um depois do outro, e o segundo enxerga o primeiro.
  SELECT p.negotiation_id INTO target_negotiation FROM public.payments p WHERE p.id = payment_id;
  IF target_negotiation IS NOT NULL THEN
    SELECT * INTO neg FROM public.negotiations WHERE id = target_negotiation FOR UPDATE;
  END IF;

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

  IF next_status IN ('authorized', 'paid') THEN
    IF neg.stage = 'perdido' THEN
      RAISE EXCEPTION 'Negociação perdida não recebe pagamento. Reabra a negociação antes.' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.sales WHERE vehicle_id = neg.vehicle_id AND negotiation_id <> neg.id) THEN
      RAISE EXCEPTION 'Este veículo já foi vendido em outra negociação.' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.payments p
  SET status = next_status,
      paid_at = CASE WHEN next_status = 'paid' THEN now() ELSE p.paid_at END,
      updated_at = now()
  WHERE p.id = current_payment.id
  RETURNING * INTO current_payment;

  due := public.negotiation_amount_due(current_payment.negotiation_id);

  -- Cancelar/estornar um pagamento que fechou a venda desfaz a venda quando o total pago
  -- deixa de cobrir o valor: a negociação volta à etapa anterior e o veículo à negociação.
  IF next_status IN ('cancelled', 'refunded') THEN
    SELECT * INTO current_sale FROM public.sales WHERE negotiation_id = current_payment.negotiation_id FOR UPDATE;
    IF current_sale.id IS NOT NULL THEN
      SELECT COALESCE(SUM(amount), 0) INTO paid_total
      FROM public.payments WHERE negotiation_id = current_payment.negotiation_id AND status = 'paid';
      IF paid_total < COALESCE(due, 0) THEN
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
    IF paid_total >= COALESCE(due, 'infinity'::numeric) THEN
      PERFORM public.finalize_sale(current_payment.negotiation_id);
      SELECT * INTO current_payment FROM public.payments p WHERE p.id = current_payment.id;
    END IF;
  END IF;

  RETURN current_payment;
END;
$$;

REVOKE ALL ON FUNCTION public.set_payment_status(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_payment_status(UUID, TEXT) TO authenticated;

-- Troca -----------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_trade_in_business_rules()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_negotiation UUID := CASE WHEN TG_OP = 'DELETE' THEN OLD.negotiation_id ELSE NEW.negotiation_id END;
BEGIN
  IF EXISTS (SELECT 1 FROM public.sales WHERE negotiation_id = target_negotiation) THEN
    RAISE EXCEPTION 'A troca não muda depois da venda fechada.' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

  -- Avaliação é do administrador: o vendedor cadastra a troca, a avaliação fica pendente.
  IF TG_OP = 'INSERT' AND current_setting('role', true) IN ('authenticated', 'anon')
     AND NOT public.is_company_admin(NEW.company_id) THEN
    NEW.evaluated_value := NULL;
    NEW.evaluator_name := NULL;
    NEW.evaluation_date := NULL;
    NEW.needs_evaluation := true;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_trade_in_business_rules() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trade_in_guard_business_rules ON public.trade_in_vehicles;
CREATE TRIGGER trade_in_guard_business_rules
BEFORE INSERT OR UPDATE OR DELETE ON public.trade_in_vehicles
FOR EACH ROW EXECUTE FUNCTION public.guard_trade_in_business_rules();

-- Limite do plano: conta o estoque, não os vendidos ---------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_company_plan_vehicle_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  max_allowed INTEGER;
  current_count INTEGER;
BEGIN
  IF NEW.company_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.company_id IS NOT DISTINCT FROM OLD.company_id THEN RETURN NEW; END IF;
  PERFORM 1 FROM public.companies WHERE id = NEW.company_id FOR UPDATE;
  SELECT p.max_vehicles INTO max_allowed FROM public.companies c JOIN public.plans p ON p.id = c.plan WHERE c.id = NEW.company_id;
  IF max_allowed IS NULL THEN RAISE EXCEPTION 'Plano da empresa não encontrado.'; END IF;
  SELECT count(*) INTO current_count FROM public.vehicles
  WHERE company_id = NEW.company_id AND status <> 'vendido';
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Limite de % veículos do plano atingido.', max_allowed USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enforce_company_plan_vehicle_limit() FROM PUBLIC, anon, authenticated;

-- Vitrine pública: mesmo critério de acesso do painel -------------------------------------

CREATE OR REPLACE FUNCTION public.company_is_open(
  company_status TEXT, company_subscription_status TEXT, period_end TIMESTAMPTZ)
RETURNS BOOLEAN LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(company_status, 'active') = 'active'
    AND company_subscription_status IS DISTINCT FROM 'blocked'
    AND (company_subscription_status = 'cancelled' OR public.subscription_status_for(period_end) <> 'blocked');
$$;
GRANT EXECUTE ON FUNCTION public.company_is_open(TEXT, TEXT, TIMESTAMPTZ) TO anon, authenticated;

CREATE OR REPLACE VIEW public.public_vehicles WITH (security_barrier = true) AS
SELECT v.id, v.company_id, v.brand, v.model, v.year, v.version, v.sale_price, v.fipe_code,
  v.fipe_value, v.status, v.color, v.mileage, v.fuel_type, v.transmission, v.description,
  v.images, v.created_at, v.updated_at,
  c.name AS company_name, c.slug AS company_slug, c.city AS company_city, c.state AS company_state,
  c.phone AS company_phone, c.logo_url AS company_logo_url,
  c.primary_color AS company_primary_color, c.secondary_color AS company_secondary_color
FROM public.vehicles v
JOIN public.companies c ON c.id = v.company_id
WHERE v.status = 'disponivel'
  AND c.status = 'active'
  AND public.company_is_open(c.status, c.subscription_status, c.current_period_end);

CREATE OR REPLACE VIEW public.public_company_branding WITH (security_barrier = true) AS
SELECT id, name, slug, logo_url, favicon_url, primary_color, secondary_color, custom_domain,
  city, state, phone, branding
FROM public.companies
WHERE status = 'active'
  AND public.company_is_open(status, subscription_status, current_period_end);

-- Relatório -------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.report_data(p_start TEXT, p_end TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT public.current_company_reports_enabled() THEN
    RAISE EXCEPTION 'Relatórios não estão disponíveis no plano atual.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN jsonb_build_object(
    'sales', COALESCE((
      SELECT jsonb_agg(to_jsonb(s) || jsonb_build_object(
        'vehicle', to_jsonb(v),
        'seller', to_jsonb(pr),
        'costs_total', COALESCE((SELECT SUM(vc.amount) FROM public.vehicle_costs vc WHERE vc.vehicle_id = s.vehicle_id), 0)
      ))
      FROM public.sales s
      LEFT JOIN public.vehicles v ON v.id = s.vehicle_id
      LEFT JOIN public.profiles pr ON pr.id = s.seller_id
      WHERE s.company_id = public.current_company_id()
        AND s.sale_date >= p_start::date AND s.sale_date <= p_end::date
    ), '[]'::jsonb),
    'negotiations', COALESCE((
      SELECT jsonb_agg(to_jsonb(n))
      FROM public.negotiations n
      WHERE n.company_id = public.current_company_id()
        AND (n.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start::date AND p_end::date
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.report_data(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_data(TEXT, TEXT) TO authenticated;

COMMIT;
