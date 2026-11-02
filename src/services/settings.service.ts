import { supabase, type Vehicle, type Negotiation, type VehicleCost, type InteractionHistory, type Sale, type Profile } from '../lib/supabase';
import { normalizeSupabaseError } from '../lib/errors';
import { scopeToTenant, type TenantContext } from './shared';

export type SettingsExportData = {
  vehicles: Vehicle[];
  negotiations: Negotiation[];
  vehicle_costs: VehicleCost[];
  interaction_history: InteractionHistory[];
  sales: Sale[];
};

export type CompanyBrandingUpdate = {
  name: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  custom_domain: string | null;
};

export async function updateUserProfile(profileId: string, updates: Partial<Pick<Profile, 'full_name' | 'email'>>): Promise<void> {
  const { error } = await supabase.from('profiles').update(updates).eq('id', profileId);
  if (error) throw normalizeSupabaseError(error);
}

export async function updateCompanyBranding(companyId: string, updates: CompanyBrandingUpdate): Promise<void> {
  const { error } = await supabase.from('companies').update(updates).eq('id', companyId).select('id').single();
  if (error) throw normalizeSupabaseError(error);
}

/** Lê os dados do backup/export com o mesmo escopo da loja autenticada. */
export async function getSettingsExportData(ctx: TenantContext): Promise<SettingsExportData> {
  let vehiclesQuery = supabase.from('vehicles').select('*').order('created_at', { ascending: false });
  vehiclesQuery = scopeToTenant(vehiclesQuery, ctx);
  let negotiationsQuery = supabase.from('negotiations').select('*').order('created_at', { ascending: false });
  negotiationsQuery = scopeToTenant(negotiationsQuery, ctx);
  let salesQuery = supabase.from('sales').select('*').order('created_at', { ascending: false });
  salesQuery = scopeToTenant(salesQuery, ctx);

  const [vehicles, negotiations, costs, interactions, sales] = await Promise.all([
    vehiclesQuery,
    negotiationsQuery,
    supabase.from('vehicle_costs').select('*').order('created_at', { ascending: false }),
    supabase.from('interaction_history').select('*').order('created_at', { ascending: false }),
    salesQuery,
  ]);
  const failed = [vehicles, negotiations, costs, interactions, sales].find((response) => response.error);
  if (failed?.error) throw normalizeSupabaseError(failed.error);

  return {
    vehicles: vehicles.data ?? [],
    negotiations: negotiations.data ?? [],
    vehicle_costs: costs.data ?? [],
    interaction_history: interactions.data ?? [],
    sales: sales.data ?? [],
  };
}
