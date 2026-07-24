/**
 * Serviço de Custos de Veículo e Interações — camada aditiva da LuxCar.
 *
 * Consolida `vehicle_costs` (CostForm) e `interaction_history` (InteractionForm),
 * preservando os contratos de insert atuais e centralizando validação/erro.
 *
 * Escopo por tenant: estas tabelas não têm `company_id` direto; o isolamento
 * acontece pela relação com o veículo/negociação (a RLS deve refletir isso).
 * Ver conflicts.md.
 */

import {
  supabase,
  type VehicleCost,
  type InteractionHistory,
} from '../lib/supabase';
import { normalizeSupabaseError, AppError } from '../lib/errors';
import { createLogger } from '../lib/logger';
import { assertValid, validateVehicleCost } from './validation';

const log = createLogger('costs');

export type CreateCostInput = {
  vehicle_id: string;
  cost_type?: VehicleCost['cost_type'];
  description: string;
  amount: number;
  service_date?: string;
  created_by?: string;
};

/** Registra um custo/manutenção de veículo. */
export async function createVehicleCost(input: CreateCostInput): Promise<VehicleCost> {
  const valid = assertValid(
    validateVehicleCost({
      vehicle_id: input.vehicle_id,
      cost_type: input.cost_type,
      description: input.description,
      amount: input.amount,
    })
  );

  const payload = {
    vehicle_id: valid.vehicle_id,
    cost_type: valid.cost_type,
    description: valid.description,
    amount: valid.amount,
    service_date: input.service_date || null,
    created_by: input.created_by || null,
  };

  const { data, error } = await supabase
    .from('vehicle_costs')
    .insert([payload])
    .select()
    .single();
  if (error) {
    log.error('createVehicleCost falhou', error);
    throw normalizeSupabaseError(error);
  }
  return data as VehicleCost;
}

/** Lista custos de um veículo (sem paginação — volume por veículo é baixo). */
export async function listVehicleCosts(vehicleId: string): Promise<VehicleCost[]> {
  const { data, error } = await supabase
    .from('vehicle_costs')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('service_date', { ascending: false });
  if (error) {
    log.error('listVehicleCosts falhou', error);
    throw normalizeSupabaseError(error);
  }
  return data ?? [];
}

/** Soma total de custos de um veículo — usado em margem/lucro. */
export async function sumVehicleCosts(vehicleId: string): Promise<number> {
  const costs = await listVehicleCosts(vehicleId);
  return costs.reduce((sum, c) => sum + Number(c.amount || 0), 0);
}

export type CreateInteractionInput = {
  negotiation_id: string;
  vehicle_id: string;
  user_id?: string;
  interaction_type: InteractionHistory['interaction_type'];
  description: string;
};

/** Registra uma interação no histórico de uma negociação. */
export async function createInteraction(
  input: CreateInteractionInput
): Promise<InteractionHistory> {
  if (!input.description || !input.description.trim()) {
    throw new AppError('validation', { userMessage: 'Descreva a interação.' });
  }

  const payload = {
    negotiation_id: input.negotiation_id,
    vehicle_id: input.vehicle_id,
    user_id: input.user_id || null,
    interaction_type: input.interaction_type,
    description: input.description.trim(),
  };

  const { data, error } = await supabase
    .from('interaction_history')
    .insert([payload])
    .select()
    .single();
  if (error) {
    log.error('createInteraction falhou', error);
    throw normalizeSupabaseError(error);
  }
  return data as InteractionHistory;
}

/** Histórico de interações de uma negociação, mais recentes primeiro. */
export async function listInteractions(
  negotiationId: string
): Promise<InteractionHistory[]> {
  const { data, error } = await supabase
    .from('interaction_history')
    .select('*')
    .eq('negotiation_id', negotiationId)
    .order('created_at', { ascending: false });
  if (error) {
    log.error('listInteractions falhou', error);
    throw normalizeSupabaseError(error);
  }
  return data ?? [];
}
