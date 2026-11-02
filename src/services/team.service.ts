import { supabase, type Profile } from '../lib/supabase';
import { normalizeSupabaseError } from '../lib/errors';
import { scopeToTenant, type TenantContext } from './shared';

export type CreateTeamMemberInput = {
  fullName: string;
  email: string;
  password: string;
  role: 'vendedor' | 'administrador';
};

export async function listTeamMembers(ctx: TenantContext): Promise<Profile[]> {
  let query = supabase.from('profiles').select('*').order('full_name');
  query = scopeToTenant(query, ctx);
  const { data, error } = await query;
  if (error) throw normalizeSupabaseError(error);
  return data ?? [];
}

export async function createTeamMember(input: CreateTeamMemberInput): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-provision', {
    body: { action: 'create_member', ...input },
  });
  if (error || data?.error) {
    throw new Error(data?.error || error?.message || 'Não foi possível criar o acesso.');
  }
}
