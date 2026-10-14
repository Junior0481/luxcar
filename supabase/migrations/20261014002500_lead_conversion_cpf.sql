DROP FUNCTION IF EXISTS public.convert_lead_to_negotiation(uuid, uuid, text, numeric, text, text);

CREATE FUNCTION public.convert_lead_to_negotiation(
  p_lead_id uuid,
  p_vehicle_id uuid,
  p_client_cpf text DEFAULT NULL,
  p_stage text DEFAULT 'primeiro_contato',
  p_offered_price numeric DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_priority text DEFAULT 'media'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lead_row public.leads%ROWTYPE;
  negotiation_id uuid;
  actor_id uuid := auth.uid();
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'É necessário entrar na loja para escalar um lead.';
  END IF;

  SELECT * INTO lead_row
  FROM public.leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF NOT FOUND OR lead_row.company_id IS DISTINCT FROM public.current_company_id() THEN
    RAISE EXCEPTION 'Lead não encontrado nesta loja.';
  END IF;

  IF lead_row.status IN ('converted', 'lost') OR lead_row.converted_negotiation_id IS NOT NULL THEN
    RAISE EXCEPTION 'Este lead já foi encerrado ou escalado para negociação.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = actor_id
      AND p.company_id = lead_row.company_id
      AND p.role IN ('vendedor', 'administrador')
  ) THEN
    RAISE EXCEPTION 'Usuário sem permissão para escalar leads desta loja.';
  END IF;

  PERFORM 1 FROM public.vehicles v
  WHERE v.id = p_vehicle_id
    AND v.company_id = lead_row.company_id
    AND v.status = 'disponivel'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selecione um veículo disponível desta loja.';
  END IF;

  IF p_stage NOT IN (
    'primeiro_contato', 'avaliacao', 'test_drive_agendado', 'test_drive_realizado',
    'proposta_enviada', 'negociacao_preco', 'aprovacao_credito', 'documentacao'
  ) THEN
    RAISE EXCEPTION 'Etapa de negociação inválida.';
  END IF;

  IF p_priority NOT IN ('baixa', 'media', 'alta') THEN
    RAISE EXCEPTION 'Prioridade inválida.';
  END IF;

  INSERT INTO public.negotiations (
    company_id, vehicle_id, seller_id, client_name, client_phone,
    client_email, client_cpf, stage, offered_price, notes, priority
  ) VALUES (
    lead_row.company_id, p_vehicle_id, actor_id, lead_row.customer_name,
    lead_row.customer_phone, lead_row.customer_email, NULLIF(btrim(p_client_cpf), ''),
    p_stage, p_offered_price, NULLIF(btrim(p_notes), ''), p_priority
  )
  RETURNING id INTO negotiation_id;

  UPDATE public.vehicles
  SET status = 'em_negociacao'
  WHERE id = p_vehicle_id AND company_id = lead_row.company_id;

  UPDATE public.leads
  SET status = 'converted', converted_negotiation_id = negotiation_id
  WHERE id = p_lead_id;

  RETURN negotiation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_lead_to_negotiation(uuid, uuid, text, text, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_lead_to_negotiation(uuid, uuid, text, text, numeric, text, text) TO authenticated;
