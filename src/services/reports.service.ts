import { supabase, type Negotiation, type Profile, type Sale, type Vehicle } from '../lib/supabase';
import { normalizeSupabaseError } from '../lib/errors';
import type { TenantContext } from './shared';

export type SaleWithDetails = Sale & { vehicle?: Vehicle; seller?: Profile; costs_total?: number };

/**
 * Relatório consolidado via RPC `report_data`, que recusa empresas cujo plano
 * não inclui relatórios. As policies de tenant/ownership continuam valendo.
 */
export async function getReportData(
  _ctx: TenantContext,
  startDate: string,
  endDate: string
): Promise<{ sales: SaleWithDetails[]; negotiations: Negotiation[] }> {
  const { data, error } = await supabase.rpc('report_data', { p_start: startDate, p_end: endDate });
  if (error) throw normalizeSupabaseError(error);
  const result = (data ?? {}) as { sales?: SaleWithDetails[]; negotiations?: Negotiation[] };
  return { sales: result.sales ?? [], negotiations: result.negotiations ?? [] };
}
