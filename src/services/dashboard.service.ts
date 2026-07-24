/**
 * Serviço de Dashboard — camada aditiva da LuxCar.
 *
 * Consolida a leitura do `Dashboard.tsx`: métricas + listas recentes.
 *
 * ATENÇÃO (risco de tenant): a view/tabela `dashboard_metrics` é lida com
 * `.single()` sem escopo de loja. Se a view agrega TODAS as lojas, os KPIs
 * vazam entre tenants. As listas recentes daqui já são escopadas por tenant.
 * Recomendação registrada em conflicts.md: `dashboard_metrics` deve ser uma
 * view por `company_id` (ou função `security definer` parametrizada).
 */

import { supabase, type Vehicle, type Negotiation } from '../lib/supabase';
import { normalizeSupabaseError } from '../lib/errors';
import { createLogger } from '../lib/logger';
import { scopeToTenant, type TenantContext } from './shared';

const log = createLogger('dashboard');

export type DashboardMetrics = {
  vehicles_available?: number;
  vehicles_in_negotiation?: number;
  vehicles_sold?: number;
  active_negotiations?: number;
  potential_profit?: number;
  [key: string]: unknown;
};

export type DashboardData = {
  metrics: DashboardMetrics | null;
  recentVehicles: Vehicle[];
  recentNegotiations: Negotiation[];
};

/**
 * Carrega dados do dashboard preservando o contrato atual.
 * `recentLimit` default 5 (igual ao Dashboard.tsx). Falha de métricas não
 * derruba as listas: retorna `metrics: null` e loga (erro não silencioso).
 */
export async function getDashboardData(
  ctx: TenantContext,
  recentLimit = 5
): Promise<DashboardData> {
  let vehiclesQuery = supabase
    .from('vehicles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(recentLimit);
  vehiclesQuery = scopeToTenant(vehiclesQuery, ctx);

  let negotiationsQuery = supabase
    .from('negotiations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(recentLimit);
  negotiationsQuery = scopeToTenant(negotiationsQuery, ctx);

  const [metricsRes, vehiclesRes, negotiationsRes] = await Promise.all([
    supabase.from('dashboard_metrics').select('*').single(),
    vehiclesQuery,
    negotiationsQuery,
  ]);

  if (vehiclesRes.error) {
    log.error('getDashboardData: veículos recentes falhou', vehiclesRes.error);
    throw normalizeSupabaseError(vehiclesRes.error);
  }
  if (negotiationsRes.error) {
    log.error('getDashboardData: negociações recentes falhou', negotiationsRes.error);
    throw normalizeSupabaseError(negotiationsRes.error);
  }
  if (metricsRes.error) {
    // métricas são best-effort; loga e segue com null (não silencioso)
    log.warn('getDashboardData: métricas indisponíveis', metricsRes.error);
  }

  return {
    metrics: (metricsRes.data as DashboardMetrics) ?? null,
    recentVehicles: vehiclesRes.data ?? [],
    recentNegotiations: negotiationsRes.data ?? [],
  };
}
