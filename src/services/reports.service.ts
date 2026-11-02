import { supabase, type Negotiation, type Profile, type Sale, type Vehicle } from '../lib/supabase';
import { normalizeSupabaseError } from '../lib/errors';
import { scopeToTenant, type TenantContext } from './shared';

export type SaleWithDetails = Sale & { vehicle?: Vehicle; seller?: Profile };

export async function getReportData(
  ctx: TenantContext,
  startDate: string,
  endDate: string
): Promise<{ sales: SaleWithDetails[]; negotiations: Negotiation[] }> {
  let salesQuery = supabase
    .from('sales')
    .select('*, vehicle:vehicles(*), seller:profiles(*)')
    .gte('sale_date', startDate)
    .lte('sale_date', endDate);
  salesQuery = scopeToTenant(salesQuery, ctx);

  let negotiationsQuery = supabase
    .from('negotiations')
    .select('*')
    .gte('created_at', startDate)
    .lte('created_at', endDate);
  negotiationsQuery = scopeToTenant(negotiationsQuery, ctx);

  const [salesResult, negotiationsResult] = await Promise.all([salesQuery, negotiationsQuery]);
  if (salesResult.error) throw normalizeSupabaseError(salesResult.error);
  if (negotiationsResult.error) throw normalizeSupabaseError(negotiationsResult.error);

  return {
    sales: (salesResult.data as unknown as SaleWithDetails[]) ?? [],
    negotiations: negotiationsResult.data ?? [],
  };
}
