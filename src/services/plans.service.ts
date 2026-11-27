import { supabase } from '../lib/supabase';
import { normalizeSupabaseError } from '../lib/errors';
import type { TenantContext } from './shared';

export type Plan = {
  id: 'silver' | 'gold' | 'platinum';
  name: string;
  max_administrators: number;
  max_sellers: number;
  max_vehicles: number;
  reports_enabled: boolean;
  monthly_price: number;
  annual_price: number;
};

/** Plano da empresa do usuário logado; null para quem não tem empresa. */
export async function getCompanyPlan(ctx: TenantContext): Promise<Plan | null> {
  if (!ctx.companyId) return null;
  const { data, error } = await supabase
    .from('companies')
    .select('plan:plans(*)')
    .eq('id', ctx.companyId)
    .single();
  if (error) throw normalizeSupabaseError(error);
  return (data?.plan as unknown as Plan) ?? null;
}

export async function countCompanyVehicles(ctx: TenantContext): Promise<number> {
  if (!ctx.companyId) return 0;
  const { count, error } = await supabase
    .from('vehicles')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', ctx.companyId)
    .neq('status', 'vendido'); // o limite do plano conta só o estoque
  if (error) throw normalizeSupabaseError(error);
  return count ?? 0;
}
