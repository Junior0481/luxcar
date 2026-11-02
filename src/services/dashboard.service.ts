/**
 * Serviço de Dashboard — camada aditiva da LuxCar.
 *
 * Consolida a leitura do `Dashboard.tsx`: métricas + listas recentes.
 *
 * Os cálculos usam os mesmos dados completos já carregados pela tela e todas
 * as consultas de negócio recebem escopo por tenant.
 */

import { supabase, type Vehicle, type Negotiation } from '../lib/supabase';
import { normalizeSupabaseError } from '../lib/errors';
import { createLogger } from '../lib/logger';
import { scopeToTenant, type TenantContext } from './shared';

const log = createLogger('dashboard');

export type DashboardMetrics = {
  vehicles_available: number;
  vehicles_in_negotiation: number;
  vehicles_sold: number;
  active_negotiations: number;
  monthly_revenue: number;
  potential_profit: number;
};

export type DashboardData = {
  metrics: DashboardMetrics | null;
  recentVehicles: Vehicle[];
  recentNegotiations: Negotiation[];
};

/**
 * Carrega o estoque e negociações completos para preservar os totais atuais;
 * as listas recentes são os cinco primeiros registros de cada consulta.
 */
export async function getDashboardData(
  ctx: TenantContext,
  recentLimit = 5
): Promise<DashboardData> {
  let vehiclesQuery = supabase
    .from('vehicles')
    .select('*')
    .order('created_at', { ascending: false });
  vehiclesQuery = scopeToTenant(vehiclesQuery, ctx);

  let negotiationsQuery = supabase
    .from('negotiations')
    .select('*')
    .order('created_at', { ascending: false });
  negotiationsQuery = scopeToTenant(negotiationsQuery, ctx);

  const [vehiclesRes, negotiationsRes] = await Promise.all([vehiclesQuery, negotiationsQuery]);

  if (vehiclesRes.error) {
    log.error('getDashboardData: veículos recentes falhou', vehiclesRes.error);
    throw normalizeSupabaseError(vehiclesRes.error);
  }
  if (negotiationsRes.error) {
    log.error('getDashboardData: negociações recentes falhou', negotiationsRes.error);
    throw normalizeSupabaseError(negotiationsRes.error);
  }
  const vehicles = vehiclesRes.data ?? [];
  const negotiations = negotiationsRes.data ?? [];

  return {
    metrics: {
      vehicles_available: vehicles.filter((vehicle) => vehicle.status === 'disponivel').length,
      vehicles_in_negotiation: vehicles.filter((vehicle) => vehicle.status === 'em_negociacao').length,
      vehicles_sold: vehicles.filter((vehicle) => vehicle.status === 'vendido').length,
      active_negotiations: negotiations.filter((item) => !['finalizado', 'perdido'].includes(item.stage)).length,
      monthly_revenue: 0,
      potential_profit: vehicles
        .filter((vehicle) => vehicle.status !== 'vendido')
        .reduce((total, vehicle) => total + Number(vehicle.sale_price) - Number(vehicle.purchase_price), 0),
    },
    recentVehicles: vehicles.slice(0, recentLimit),
    recentNegotiations: negotiations.slice(0, recentLimit),
  };
}
