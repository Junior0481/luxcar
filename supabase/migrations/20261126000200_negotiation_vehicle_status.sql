-- O status do veículo acompanha as negociações no banco. Antes, o painel atualizava o veículo
-- depois de mudar o estágio, e o vendedor (sem permissão de editar veículos) recebia erro.
BEGIN;

CREATE OR REPLACE FUNCTION public.sync_vehicle_status_from_negotiation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.stage = 'finalizado' THEN
    RETURN NEW; -- finalize_sale marca o veículo como vendido.
  END IF;

  IF NEW.stage = 'perdido' THEN
    -- Volta a disponível só se nenhuma outra negociação do veículo continua em andamento.
    UPDATE public.vehicles v SET status = 'disponivel'
    WHERE v.id = NEW.vehicle_id AND v.status = 'em_negociacao'
      AND NOT EXISTS (
        SELECT 1 FROM public.negotiations n
        WHERE n.vehicle_id = NEW.vehicle_id AND n.id <> NEW.id
          AND n.stage NOT IN ('perdido', 'finalizado')
      );
  ELSE
    UPDATE public.vehicles v SET status = 'em_negociacao'
    WHERE v.id = NEW.vehicle_id AND v.status = 'disponivel';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_vehicle_status_from_negotiation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS negotiations_sync_vehicle_status ON public.negotiations;
CREATE TRIGGER negotiations_sync_vehicle_status
AFTER INSERT OR UPDATE OF stage ON public.negotiations
FOR EACH ROW EXECUTE FUNCTION public.sync_vehicle_status_from_negotiation();

COMMIT;
